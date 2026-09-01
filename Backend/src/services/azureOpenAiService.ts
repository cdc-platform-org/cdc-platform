import { AzureOpenAI } from 'openai';
import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_DEPLOYMENT_NAME,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_DALLE_DEPLOYMENT_NAME,
  AZURE_OPENAI_DALLE_API_VERSION,
} from '../utils/env';

// The 4th rung in the AI resilience chain — reached only after
// examProctoringService.ts's/aiAgentService.ts's 3-model Gemini fallback
// (gemini-flash-latest → gemini-flash-lite-latest → gemini-3.5-flash) has
// already exhausted every model. A single-vendor outage (Google) no longer
// takes down exam generation, grading, or the business AI agents once this
// is configured. Deliberately a *cross-vendor* fallback, not another same-
// vendor model — the whole point is not sharing Gemini's failure domain.
//
// Same return shape as examProctoringService.ts's GeminiJsonResult
// ({ raw, usage }) so callers on either side of the provider boundary don't
// need to know or care which vendor actually answered — see that file's own
// comment on why the shape has to stay identical.
export interface AzureOpenAiJsonResult {
  raw: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export function isAzureOpenAiConfigured(): boolean {
  return !!(AZURE_OPENAI_API_KEY && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_DEPLOYMENT_NAME);
}

let client: AzureOpenAI | null = null;
function getClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      endpoint: AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_DEPLOYMENT_NAME,
      apiVersion: AZURE_OPENAI_API_VERSION,
    });
  }
  return client;
}

export class AzureOpenAiNotConfiguredError extends Error {
  constructor() {
    super('Azure OpenAI is not configured (AZURE_OPENAI_API_KEY/ENDPOINT/DEPLOYMENT_NAME missing).');
    this.name = 'AzureOpenAiNotConfiguredError';
  }
}

// Mirrors examProctoringService.ts's generateJson() contract: same prompt
// in, same { raw, usage } shape out, so the JSON the prompt asked for is
// parsed identically by the caller's own Zod schema regardless of which
// provider produced it. GPT-4o's JSON mode (response_format: json_object)
// is the OpenAI-side equivalent of Gemini's responseMimeType:
// 'application/json' — both just constrain the model to emit valid JSON,
// neither enforces a specific shape, which is why the prompt itself (not
// this function) is what defines the actual schema on both sides.
export async function generateJsonViaAzureOpenAI(prompt: string, temperature: number): Promise<AzureOpenAiJsonResult> {
  if (!isAzureOpenAiConfigured()) throw new AzureOpenAiNotConfiguredError();

  const result = await getClient().chat.completions.create({
    model: AZURE_OPENAI_DEPLOYMENT_NAME,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    response_format: { type: 'json_object' },
  });

  const raw = result.choices[0]?.message?.content;
  if (!raw) throw new Error('Azure OpenAI returned an empty response.');

  return {
    raw,
    usage: result.usage
      ? { promptTokens: result.usage.prompt_tokens, completionTokens: result.usage.completion_tokens }
      : undefined,
  };
}

// ============================================================
// DALL-E 3 — cover image generation. A separate deployment (and client
// instance) from the chat model above, same resource/API key. See
// aiAgentService.generateCoverImage's own comment for how this fits into
// the overall image-generation fallback chain (DALL-E 3 → Pollinations.ai
// → no image at all, never a broken blog-creation flow).
// ============================================================

export function isAzureOpenAiDalleConfigured(): boolean {
  return !!(AZURE_OPENAI_API_KEY && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_DALLE_DEPLOYMENT_NAME);
}

let dalleClient: AzureOpenAI | null = null;
function getDalleClient(): AzureOpenAI {
  if (!dalleClient) {
    dalleClient = new AzureOpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      endpoint: AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_DALLE_DEPLOYMENT_NAME,
      apiVersion: AZURE_OPENAI_DALLE_API_VERSION,
    });
  }
  return dalleClient;
}

export interface DalleImageResult {
  buffer: Buffer;
  mimeType: string;
}

// Requests raw base64 bytes directly (response_format: 'b64_json') rather
// than the URL Azure can also return — that URL points at short-lived
// Azure blob storage and would leave BlogPost.imageUrl pointing at a link
// that 404s once it expires. Falls back to fetching `url` if a given
// Azure API version ever omits b64_json from the response, so this
// doesn't silently break on a minor API-version behavior change.
export async function generateImageViaDallE3(prompt: string, timeoutMs: number): Promise<DalleImageResult> {
  if (!isAzureOpenAiDalleConfigured()) throw new AzureOpenAiNotConfiguredError();

  const result = await getDalleClient().images.generate(
    {
      model: AZURE_OPENAI_DALLE_DEPLOYMENT_NAME,
      prompt,
      // Closest DALL-E 3 supports to a 16:9 landscape banner (1024x1024 and
      // 1024x1792 are the other two options, square and portrait).
      size: '1792x1024',
      quality: 'hd',
      style: 'vivid',
      n: 1,
      response_format: 'b64_json',
    },
    { timeout: timeoutMs }
  );

  const item = result.data?.[0];
  if (item?.b64_json) {
    return { buffer: Buffer.from(item.b64_json, 'base64'), mimeType: 'image/png' };
  }
  if (item?.url) {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`Failed to download DALL-E 3 image (${response.status}).`);
    const mimeType = response.headers.get('content-type') || 'image/png';
    return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
  }
  throw new Error('DALL-E 3 returned no image data.');
}
import axios from 'axios';

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const response = await axios.post(
    `${AZURE_OPENAI_ENDPOINT}/translate`,
    { text, targetLanguage },
    { headers: { 'Ocp-Apim-Subscription-Key': AZURE_OPENAI_KEY } }
  );
  return response.data.translation;
}
