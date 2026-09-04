import OpenAI from 'openai';
import { azureOpenai } from '../utils/azureOpenai';
import {
  AZURE_OPENAI_DEPLOYMENT_NAME,
  AZURE_OPENAI_KEY_SECONDARY,
  AZURE_OPENAI_ENDPOINT_SECONDARY,
  AZURE_OPENAI_DEPLOYMENT_NAME_SECONDARY,
} from '../utils/env';

// ============================================================
// MULTI-REGION AZURE OPENAI FAILOVER — the single place every AI service in
// this codebase that talks to Azure OpenAI directly (aiAgentService.ts,
// courseTutorService.ts, businessAiChatService.ts, businessKycService.ts,
// contentModerationService.ts) should route the actual network call
// through, so a regional Azure outage/rate-limit is handled in exactly one
// place instead of duplicated per caller.
//
// Primary is the AzureOpenAI-SDK-bound resource in utils/azureOpenai.ts
// (api-version + deployment config). Secondary is a fully separate Azure
// OpenAI resource — its own key, its own region, addressed via the newer
// "v1" API surface (a baseURL ending in /openai/v1, no api-version/
// deployment binding needed), so it's a plain OpenAI SDK client rather than
// AzureOpenAI. Optional — every caller here degrades to primary-only
// (throwing the primary's own error) when the secondary env vars are unset.
// ============================================================

export function isSecondaryAzureConfigured(): boolean {
  return !!AZURE_OPENAI_KEY_SECONDARY && !!AZURE_OPENAI_ENDPOINT_SECONDARY;
}

let secondaryClient: OpenAI | null = null;
function getSecondaryClient(): OpenAI {
  if (!secondaryClient) {
    secondaryClient = new OpenAI({
      apiKey: AZURE_OPENAI_KEY_SECONDARY,
      baseURL: AZURE_OPENAI_ENDPOINT_SECONDARY,
      // Same reasoning as utils/azureOpenai.ts's primary client: bounded so
      // a stuck request fails fast enough for this file's own retry/
      // failover loop to act, and the SDK's own retry is disabled since
      // that loop already retries at the application layer.
      timeout: 60_000,
      maxRetries: 0,
    });
  }
  return secondaryClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAzureError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /timeout|ETIMEDOUT|ECONNABORTED|ECONNRESET/i.test(message);
}

export type AzureChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | Array<Record<string, unknown>> };

export interface CallAzureChatOptions {
  messages: AzureChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
}

const BASE_RETRY_DELAY_MS = 500;
// 2 rounds x up to 2 regions = up to 4 total attempts — platform policy is
// "up to 3 retries" (1 initial + 3 retries).
const ROUNDS_PER_REGION = 2;

// One chat-completion call with automatic primary -> secondary region
// failover. On a retryable failure (429/5xx/timeout) from one region, the
// OTHER region is tried immediately (no backoff delay — a different
// resource/region has no reason to wait out the first one's problem). Only
// once every configured region has been tried in this round does the next
// round wait with exponential backoff (500ms, then 1000ms) before cycling
// through the regions again. A 400 (malformed request) fails fast on
// whichever region hit it first — every other region would reject the same
// request identically, so trying them is pure noise. The end user only
// ever sees a real error once BOTH regions (or the only configured one)
// have been exhausted.
export interface AzureChatCompletionResult {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export async function callAzureChatCompletionFull(options: CallAzureChatOptions): Promise<AzureChatCompletionResult> {
  const { messages, temperature = 0.7, jsonMode = false } = options;
  const buildArgs = (model: string) => ({
    model,
    messages: messages as any,
    temperature,
    ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const toResult = (response: { choices: { message?: { content?: string | null } }[]; usage?: { prompt_tokens: number; completion_tokens: number } }): AzureChatCompletionResult => ({
    content: response.choices[0]?.message?.content || '',
    usage: response.usage ? { promptTokens: response.usage.prompt_tokens ?? 0, completionTokens: response.usage.completion_tokens ?? 0 } : undefined,
  });

  const regions: { label: string; call: () => Promise<AzureChatCompletionResult> }[] = [
    {
      label: 'primary',
      call: async () => toResult(await azureOpenai.chat.completions.create(buildArgs(AZURE_OPENAI_DEPLOYMENT_NAME))),
    },
  ];
  if (isSecondaryAzureConfigured()) {
    regions.push({
      label: 'secondary',
      call: async () =>
        toResult(
          await getSecondaryClient().chat.completions.create(
            buildArgs(AZURE_OPENAI_DEPLOYMENT_NAME_SECONDARY || AZURE_OPENAI_DEPLOYMENT_NAME)
          )
        ),
    });
  }

  let lastErr: unknown;
  for (let round = 0; round < ROUNDS_PER_REGION; round++) {
    for (const region of regions) {
      try {
        const result = await region.call();
        if (!result.content) throw new Error('AI provider returned an empty response.');
        return result;
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number })?.status;
        console.error(
          `[azureChatCompletionService] ${region.label} region, round ${round + 1}/${ROUNDS_PER_REGION} failed:`,
          err instanceof Error ? err.message : err
        );
        if (status === 400) throw err;
        // Not classified as obviously retryable (e.g. an auth error tied
        // to just one region's key) still moves on to the next region
        // immediately rather than aborting — that's a fully separate
        // credential/resource, worth a genuine attempt regardless of why
        // this one failed. isRetryableAzureError only governs whether a
        // *repeat* of the same region (next round) is worth the backoff
        // wait below.
      }
    }
    if (round < ROUNDS_PER_REGION - 1 && isRetryableAzureError(lastErr)) {
      await sleep(BASE_RETRY_DELAY_MS * 2 ** round);
    } else if (round < ROUNDS_PER_REGION - 1 && !isRetryableAzureError(lastErr)) {
      break;
    }
  }
  throw lastErr;
}

// Convenience wrapper for the common case (no caller needs token usage) —
// see callAzureChatCompletionFull for the region-failover behavior itself.
export async function callAzureChatCompletion(options: CallAzureChatOptions): Promise<string> {
  const { content } = await callAzureChatCompletionFull(options);
  return content;
}
