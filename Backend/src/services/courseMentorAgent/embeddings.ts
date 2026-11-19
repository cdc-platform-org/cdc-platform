/**
 * Course Mentor Agent — Azure OpenAI embeddings (optional).
 * Exports: isEmbeddingConfigured, embedTexts.
 *
 * Uses the same Azure OpenAI resource as the chat model, with its own
 * deployment (AZURE_OPENAI_EMBEDDING_DEPLOYMENT, e.g. text-embedding-3-small).
 * When that variable is not set, isEmbeddingConfigured() is false and
 * retrieval.ts uses keyword scoring instead — so the mentor works before the
 * deployment exists and simply gets smarter search once it does.
 */
import { AzureOpenAI } from 'openai';
import {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
} from '../../utils/env';

// Azure accepts up to 2048 inputs per request; smaller batches keep each
// request well under the per-request token limit for long Georgian chunks.
const BATCH_SIZE = 32;
// Georgian script costs several tokens per character; trim defensively so
// one oversized chunk can never fail the whole batch (8191-token limit).
const MAX_INPUT_CHARS = 6000;
const MAX_ATTEMPTS = 3;

export function isEmbeddingConfigured(): boolean {
  return !!(AZURE_OPENAI_API_KEY && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_EMBEDDING_DEPLOYMENT);
}

let client: AzureOpenAI | null = null;
function getClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      apiKey: AZURE_OPENAI_API_KEY,
      endpoint: AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
      apiVersion: AZURE_OPENAI_API_VERSION,
      timeout: 60_000,
      maxRetries: 0, // retried below with backoff, same policy as the chat client
    });
  }
  return client;
}

async function embedBatch(inputs: string[]): Promise<number[][]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await getClient().embeddings.create({ model: AZURE_OPENAI_EMBEDDING_DEPLOYMENT, input: inputs });
      return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      if (status === 400 || status === 401 || status === 404) break; // not transient
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

// Returns one vector per input, in order. Throws if embeddings are not
// configured — callers check isEmbeddingConfigured() first.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!isEmbeddingConfigured()) throw new Error('Embedding deployment is not configured.');
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, MAX_INPUT_CHARS) || ' ');
    out.push(...(await embedBatch(batch)));
  }
  return out;
}
