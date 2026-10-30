import OpenAI from 'openai';
import { AZURE_IMAGE_ENDPOINT, AZURE_IMAGE_API_KEY, AZURE_IMAGE_DEPLOYMENT } from '../utils/env';

// ============================================================
// gpt-image-2 client foundation (Children's Book generator, Phase 1 — smoke
// test only, see scripts/gpt-image-2-smoke-test.ts). A fully separate Azure
// OpenAI resource ("cdc-book-images") from every other AI provider in this
// codebase — its own key/endpoint/deployment — addressed via the current
// Azure OpenAI "v1" data-plane surface:
//
//   POST {endpoint}/openai/v1/images/generations?api-version=preview
//
// Same pattern services/azureChatCompletionService.ts's secondary resource
// already uses (plain OpenAI SDK client, baseURL + apiKey, not the
// AzureOpenAI class — that class is for the older deployment-scoped/
// api-version-bound surface the primary chat resource uses). Verified
// against Microsoft's current "v1 preview" REST reference
// (learn.microsoft.com/azure/foundry/openai/reference-preview-latest) on
// 2026-10-01 — deliberately NOT reusing azureOpenAiService.ts's DALL-E 3
// api-version, which is for a different, older surface.
//
// This file is ONLY the client + error classification — no route, no DB,
// no retry policy beyond what the caller decides. See the smoke-test
// script for the one manually-triggered call this phase allows.
// ============================================================

export function isAzureImageConfigured(): boolean {
  return !!AZURE_IMAGE_ENDPOINT && !!AZURE_IMAGE_API_KEY && !!AZURE_IMAGE_DEPLOYMENT;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const baseURL = `${AZURE_IMAGE_ENDPOINT.replace(/\/+$/, '')}/openai/v1`;
    client = new OpenAI({
      apiKey: AZURE_IMAGE_API_KEY,
      baseURL,
      // The vanilla OpenAI SDK doesn't know about Azure's api-version query
      // param — defaultQuery appends it to every request on this client,
      // same mechanism needed for any Azure "v1 preview" surface call.
      defaultQuery: { 'api-version': 'preview' },
      timeout: 120_000,
      // No SDK-level retry — a failed smoke-test call must surface
      // immediately (REQUEST_COUNT_LIMIT = 1, no automatic retry, per the
      // approved smoke-test design) rather than silently re-firing a paid
      // request.
      maxRetries: 0,
    });
  }
  return client;
}

export class AzureImageNotConfiguredError extends Error {
  constructor() {
    super('Azure gpt-image-2 is not configured (AZURE_IMAGE_ENDPOINT/API_KEY/DEPLOYMENT missing).');
    this.name = 'AzureImageNotConfiguredError';
  }
}

export type ImageErrorClassification =
  | 'AUTHENTICATION_OR_ACCESS'
  | 'DEPLOYMENT_OR_ENDPOINT'
  | 'QUOTA_OR_RATE_LIMIT'
  | 'REQUEST_SCHEMA'
  | 'CONTENT_FILTER'
  | 'AZURE_SERVICE'
  | 'NETWORK_OR_TIMEOUT'
  | 'UNKNOWN';

// Maps an HTTP status (+ a best-effort look at the error body) to one of
// the 8 categories the smoke-test design requires — status-code-first
// since that's always present and trustworthy; the body's own `code`/
// `type` fields are a secondary signal Azure doesn't always populate the
// same way on every failure path.
export function classifyImageError(status: number | undefined, errorCode: string | undefined, message: string | undefined): ImageErrorClassification {
  const code = (errorCode || '').toLowerCase();
  const msg = (message || '').toLowerCase();
  if (status === 401 || status === 403 || code.includes('auth') || code.includes('permission')) return 'AUTHENTICATION_OR_ACCESS';
  if (status === 404 || code.includes('deployment') || msg.includes('deployment')) return 'DEPLOYMENT_OR_ENDPOINT';
  if (status === 429 || code.includes('quota') || code.includes('rate')) return 'QUOTA_OR_RATE_LIMIT';
  if (status === 400 && (code.includes('content_filter') || msg.includes('content management') || msg.includes('safety'))) return 'CONTENT_FILTER';
  if (status === 400) return 'REQUEST_SCHEMA';
  if (status !== undefined && status >= 500) return 'AZURE_SERVICE';
  if (code.includes('timeout') || code.includes('econnreset') || code.includes('enotfound') || status === undefined) return 'NETWORK_OR_TIMEOUT';
  return 'UNKNOWN';
}

export interface GenerateImageParams {
  prompt: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  n?: number; // 1-10; this phase only ever calls with the default of 1.
}

export interface GenerateImageSuccess {
  success: true;
  deployment: string;
  latencyMs: number;
  requestId: string | null;
  mimeType: string;
  byteSize: number;
  buffer: Buffer; // Never logged — caller decides what to do with it (smoke test: write to a local temp file only).
}

export interface GenerateImageFailure {
  success: false;
  deployment: string;
  latencyMs: number;
  requestId: string | null;
  httpStatus: number | undefined;
  errorClassification: ImageErrorClassification;
  // Deliberately stripped of anything that could carry a credential/header
  // value — see safeguard in the catch block below.
  safeErrorMessage: string;
}

export type GenerateImageResult = GenerateImageSuccess | GenerateImageFailure;

const OUTPUT_MIME: Record<NonNullable<GenerateImageParams['outputFormat']>, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// Generates exactly ONE image per call (the caller controls `n`; this
// phase's smoke test always leaves it at the default of 1). Never logs the
// API key, the Authorization header, or the base64 image payload itself —
// only structured, safe metadata is ever returned.
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  if (!isAzureImageConfigured()) throw new AzureImageNotConfiguredError();

  const start = Date.now();
  try {
    const { data, response } = await getClient()
      .images.generate({
        model: AZURE_IMAGE_DEPLOYMENT,
        prompt: params.prompt,
        n: params.n ?? 1,
        size: params.size,
        quality: params.quality,
        output_format: params.outputFormat,
      })
      .withResponse();

    const latencyMs = Date.now() - start;
    const requestId = response.headers.get('x-request-id') ?? response.headers.get('apim-request-id');
    const item = data.data?.[0];
    if (!item?.b64_json) {
      return {
        success: false,
        deployment: AZURE_IMAGE_DEPLOYMENT,
        latencyMs,
        requestId,
        httpStatus: 200,
        errorClassification: 'UNKNOWN',
        safeErrorMessage: 'Azure returned a 200 response with no image data.',
      };
    }

    const buffer = Buffer.from(item.b64_json, 'base64');
    return {
      success: true,
      deployment: AZURE_IMAGE_DEPLOYMENT,
      latencyMs,
      requestId,
      mimeType: OUTPUT_MIME[params.outputFormat ?? 'png'],
      byteSize: buffer.byteLength,
      buffer,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    // openai SDK errors (APIError and subclasses) carry `status` and a
    // parsed `error` body — read only the fields needed to classify/report
    // safely; never forward the raw error object (it can include request
    // headers, which would risk echoing the Authorization/api-key value).
    const anyErr = err as { status?: number; code?: string; error?: { code?: string; message?: string }; message?: string };
    const status = anyErr?.status;
    const errorCode = anyErr?.error?.code ?? anyErr?.code;
    const message = anyErr?.error?.message ?? anyErr?.message ?? 'Unknown error calling Azure gpt-image-2.';
    return {
      success: false,
      deployment: AZURE_IMAGE_DEPLOYMENT,
      latencyMs,
      requestId: null,
      httpStatus: status,
      errorClassification: classifyImageError(status, errorCode, message),
      safeErrorMessage: message,
    };
  }
}
