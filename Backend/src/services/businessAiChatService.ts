import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';
import { isAzureOpenAiConfigured } from './azureOpenAiService';
import { callAzureChatCompletionFull } from './azureChatCompletionService';

// ============================================================
// CDC Business AI — the actual model call behind POST /api/v1/chat (the
// embeddable chatbot widget).
//
// AUDIT NOTE (fixed): despite isBusinessAiChatConfigured() checking
// GEMINI_API_KEY and this file's own usage-doc-comment referencing "Gemini's
// own token accounting", there was no Gemini call anywhere in this file —
// only Azure OpenAI (primary/secondary region failover). A business whose
// widget visitors hit this route while BOTH Azure regions were down got a
// hard failure even with a valid, healthy GEMINI_API_KEY configured. Fixed
// by adding a genuine Gemini fallback (same gemini-flash-latest ->
// gemini-flash-lite-latest -> gemini-3.5-flash cascade used by
// aiAgentService.ts/examProctoringService.ts) as the real last rung.
// ============================================================

export function isBusinessAiChatConfigured(): boolean {
  return !!GEMINI_API_KEY || isAzureOpenAiConfigured();
}

export class BusinessAiChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessAiChatError';
  }
}

export interface ChatTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface GenerateAgentReplyParams {
  systemPrompt: string;
  // Assembled from the agent's KnowledgeDocument rows — plain text, already
  // formatted, injected as additional system context ahead of the persona
  // prompt so the model treats it as ground truth rather than something
  // the visitor said.
  knowledgeContext: string;
  // Prior turns in this conversation, oldest first — capped by the caller
  // (see routes/chatApi.ts) so a very long-running conversation doesn't
  // grow the prompt unboundedly.
  history: ChatTurn[];
  message: string;
}

export interface GenerateAgentReplyResult {
  reply: string;
  // Gemini's own token accounting for this turn — undefined if the SDK
  // response didn't include usageMetadata (seen on some error/edge
  // responses), in which case the caller's usage tracker just skips
  // recording rather than guessing at a token count.
  usage?: { promptTokens: number; completionTokens: number };
}

const geminiClient = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const GEMINI_MODEL_FALLBACK_SEQUENCE = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
const GEMINI_ATTEMPTS_PER_MODEL = 2;
const GEMINI_RETRY_DELAY_MS = 1500;

function isRetryableGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(503|429)\b/.test(message) || /overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(message);
}

// Cross-vendor fallback — flattens the same system/history/message shape
// Azure received into a single prompt string, same "one string in, one
// string out" translation courseTutorService.ts's Gemini fallback uses.
async function callGeminiChatFallback(systemInstruction: string, history: ChatTurn[], message: string): Promise<string> {
  if (!geminiClient) throw new BusinessAiChatError('Gemini fallback is not configured (GEMINI_API_KEY missing).');

  const historyText = history.length
    ? `\n\nConversation so far:\n${history.map((t) => `${t.role === 'USER' ? 'Visitor' : 'Assistant'}: ${t.content}`).join('\n')}`
    : '';
  const prompt = `${systemInstruction}${historyText}\n\nVisitor: ${message}`;

  let lastErr: unknown;
  geminiLoop: for (const modelName of GEMINI_MODEL_FALLBACK_SEQUENCE) {
    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const model = geminiClient.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.7 } }, GEMINI_REQUEST_OPTIONS);
        const result = await model.generateContent(prompt);
        const reply = result.response.text();
        if (!reply) throw new Error('Gemini fallback returned an empty response.');
        return reply;
      } catch (err) {
        lastErr = err;
        console.error(`[businessAiChatService] Gemini ${modelName} attempt ${attempt}/${GEMINI_ATTEMPTS_PER_MODEL} failed:`, err instanceof Error ? err.message : err);
        if (!isRetryableGeminiError(err)) break geminiLoop;
        if (attempt < GEMINI_ATTEMPTS_PER_MODEL) await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_DELAY_MS));
      }
    }
  }
  throw lastErr;
}

export async function generateAgentReply(params: GenerateAgentReplyParams): Promise<GenerateAgentReplyResult> {
  if (!isBusinessAiChatConfigured()) {
    throw new BusinessAiChatError('The chatbot is not configured (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
  }

  const systemInstruction = params.knowledgeContext
    ? `${params.systemPrompt}\n\nUse the following context to answer questions when relevant. If the context doesn't cover the visitor's question, answer helpfully from general knowledge, but never contradict the context:\n\n${params.knowledgeContext}`
    : params.systemPrompt;

  // AUDIT NOTE (fixed): params.history was received but never sent — every
  // reply was generated with zero memory of the conversation so far. Now
  // included as proper prior turns ahead of the current message.
  const messages = [
    { role: 'system' as const, content: systemInstruction },
    ...params.history.map((turn) => ({
      role: (turn.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: turn.content,
    })),
    { role: 'user' as const, content: params.message },
  ];

  // Region failover (primary -> secondary Azure OpenAI resource) and retry
  // now live in azureChatCompletionService.ts, shared across every direct
  // Azure caller in this codebase. Gemini is the real last rung, only
  // reached once both Azure regions are exhausted.
  try {
    const { content, usage } = await callAzureChatCompletionFull({ messages });
    return {
      reply: content,
      usage: usage ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens } : undefined,
    };
  } catch (azureErr) {
    console.error('[businessAiChatService] Azure exhausted, trying Gemini fallback:', azureErr instanceof Error ? azureErr.message : azureErr);
    try {
      const reply = await callGeminiChatFallback(systemInstruction, params.history, params.message);
      return { reply };
    } catch (geminiErr) {
      const lastErr = geminiErr ?? azureErr;
      throw lastErr instanceof BusinessAiChatError
        ? lastErr
        : new BusinessAiChatError(lastErr instanceof Error ? `AI request failed: ${lastErr.message}` : 'AI request failed.');
    }
  }
}
