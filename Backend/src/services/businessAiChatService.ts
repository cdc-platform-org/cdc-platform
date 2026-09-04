import { GEMINI_API_KEY } from '../utils/env';
import { isAzureOpenAiConfigured } from './azureOpenAiService';
import { callAzureChatCompletionFull } from './azureChatCompletionService';

// ============================================================
// CDC Business AI — the actual model call behind POST /api/v1/chat (the
// embeddable chatbot widget).
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
  // Azure caller in this codebase.
  try {
    const { content, usage } = await callAzureChatCompletionFull({ messages });
    return {
      reply: content,
      usage: usage ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens } : undefined,
    };
  } catch (err) {
    throw err instanceof BusinessAiChatError
      ? err
      : new BusinessAiChatError(err instanceof Error ? `AI request failed: ${err.message}` : 'AI request failed.');
  }
}
