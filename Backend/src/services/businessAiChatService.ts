import { azureOpenai } from '../utils/azureOpenai';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';

// ============================================================
// CDC Business AI — the actual model call behind POST /api/v1/chat. Same
// provider as aiExamService.ts/businessKycService.ts (Gemini, already
// configured — no new vendor/key for this feature).
// ============================================================

export function isBusinessAiChatConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = azureOpenai;

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

export async function generateAgentReply(params: GenerateAgentReplyParams): Promise<GenerateAgentReplyResult> {
  if (!client) {
    throw new BusinessAiChatError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const systemInstruction = params.knowledgeContext
    ? `${params.systemPrompt}\n\nUse the following context to answer questions when relevant. If the context doesn't cover the visitor's question, answer helpfully from general knowledge, but never contradict the context:\n\n${params.knowledgeContext}`
    : params.systemPrompt;

  

  let reply: string;
  let usage: GenerateAgentReplyResult['usage'];
  try {
    const response = await azureOpenai.chat.completions.create({ model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o", messages: [{ role: "user", content: params.message }] }); const result = { response: { text: () => response.choices[0]?.message?.content || "" } };
    reply = result.response.text();
    const usageMetadata = result.response.usageMetadata;
    if (usageMetadata) {
      usage = {
        promptTokens: usageMetadata.promptTokenCount ?? 0,
        completionTokens: usageMetadata.candidatesTokenCount ?? 0,
      };
    }
  } catch (err) {
    throw new BusinessAiChatError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!reply) throw new BusinessAiChatError('Gemini returned an empty response.');
  return { reply, usage };
}
