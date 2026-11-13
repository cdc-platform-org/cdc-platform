// ============================================================
// Children's Book animation — Azure OpenAI Sora 2 image-to-video client.
// Uses the Azure OpenAI v1 video jobs API (Microsoft Learn, "Sora 2 video
// generation"):
//   POST {endpoint}/openai/v1/videos              multipart: model, prompt,
//        size ("1280x720"), seconds ("4"|"8"|"12"), input_reference (image,
//        must match `size` exactly — the renderer pre-composes it)
//   GET  {endpoint}/openai/v1/videos/{id}         status: queued | in_progress | completed | failed
//   GET  {endpoint}/openai/v1/videos/{id}/content the MP4
// Auth: the `api-key` header. Any failure here is non-fatal for the
// animation: the caller falls back to Ken Burns for that page.
// ============================================================

import { VIDEO_HEIGHT, VIDEO_WIDTH, SORA_CLIP_SECONDS } from './bookAnimationPlan';

export interface SoraConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

export function readSoraConfig(env: NodeJS.ProcessEnv = process.env): SoraConfig | null {
  const endpoint = (env.AZURE_VIDEO_ENDPOINT || '').trim();
  const apiKey = (env.AZURE_VIDEO_API_KEY || '').trim();
  if (!endpoint || !apiKey) return null;
  return { endpoint: normalizeSoraBase(endpoint), apiKey, deployment: (env.AZURE_VIDEO_DEPLOYMENT || 'sora-2').trim() || 'sora-2' };
}

// Accepts "https://res.openai.azure.com", ".../openai", ".../openai/v1" or a
// trailing slash; always returns the ".../openai/v1" base.
export function normalizeSoraBase(endpoint: string): string {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (/\/openai\/v1$/i.test(trimmed)) return trimmed;
  if (/\/openai$/i.test(trimmed)) return `${trimmed}/v1`;
  return `${trimmed}/openai/v1`;
}

export class SoraError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = 'SoraError';
  }
}

export interface SoraClipRequest {
  prompt: string;
  // JPEG/PNG of exactly VIDEO_WIDTH x VIDEO_HEIGHT.
  image: Buffer;
  imageMimeType: 'image/jpeg' | 'image/png';
}

export interface SoraClipResult {
  video: Buffer;
  videoId: string;
  seconds: number;
}

export interface SoraClientOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function errorText(res: Response): Promise<string> {
  try {
    const body = await res.text();
    return body.slice(0, 400);
  } catch {
    return '';
  }
}

export async function generateSoraClip(config: SoraConfig, request: SoraClipRequest, options: SoraClientOptions = {}): Promise<SoraClipResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  const deadline = Date.now() + (options.timeoutMs ?? 12 * 60_000);
  const headers = { 'api-key': config.apiKey };

  const form = new FormData();
  form.append('model', config.deployment);
  form.append('prompt', request.prompt);
  form.append('size', `${VIDEO_WIDTH}x${VIDEO_HEIGHT}`);
  form.append('seconds', String(SORA_CLIP_SECONDS));
  form.append('input_reference', new Blob([new Uint8Array(request.image)], { type: request.imageMimeType }), request.imageMimeType === 'image/png' ? 'reference.png' : 'reference.jpg');

  const created = await doFetch(`${config.endpoint}/videos`, { method: 'POST', headers, body: form });
  if (!created.ok) {
    throw new SoraError(`Sora create failed (${created.status}): ${await errorText(created)}`, created.status === 429 || created.status >= 500);
  }
  const job = (await created.json()) as { id?: string; status?: string };
  if (!job.id) throw new SoraError('Sora create returned no job id', true);

  let status = job.status ?? 'queued';
  let last: any = job;
  while (status !== 'completed') {
    if (status === 'failed' || status === 'cancelled') {
      const reason = last?.error?.message ?? last?.failure_reason ?? status;
      // A content-filter rejection will fail the same way again.
      throw new SoraError(`Sora job ${job.id} ${status}: ${reason}`, !/content|policy|moderation|safety/i.test(String(reason)));
    }
    if (Date.now() > deadline) throw new SoraError(`Sora job ${job.id} timed out (last status ${status})`, true);
    await sleep(pollIntervalMs);
    const polled = await doFetch(`${config.endpoint}/videos/${encodeURIComponent(job.id)}`, { headers });
    if (!polled.ok) {
      if (polled.status === 429 || polled.status >= 500) continue; // transient; keep polling until the deadline
      throw new SoraError(`Sora status failed (${polled.status}): ${await errorText(polled)}`, false);
    }
    last = await polled.json();
    status = last?.status ?? status;
  }

  const content = await doFetch(`${config.endpoint}/videos/${encodeURIComponent(job.id)}/content`, { headers });
  if (!content.ok) throw new SoraError(`Sora download failed (${content.status}): ${await errorText(content)}`, true);
  const video = Buffer.from(await content.arrayBuffer());
  if (video.length < 1000) throw new SoraError(`Sora download for ${job.id} is empty`, true);
  return { video, videoId: job.id, seconds: Number(last?.seconds) || SORA_CLIP_SECONDS };
}

// Prompt for a page: gentle motion only, same illustration style, no text,
// no new characters. The scene description is book data, not instructions.
export function buildSoraPrompt(params: { sceneText: string; styleLine?: string | null; isCover: boolean }): string {
  const scene = params.sceneText.replace(/\s+/g, ' ').trim().slice(0, 600);
  return [
    params.isCover
      ? 'Bring this children\'s picture-book cover illustration gently to life.'
      : 'Bring this children\'s picture-book page illustration gently to life.',
    'Keep exactly the same characters, faces, clothes, colours, composition and illustration style as the reference image' + (params.styleLine ? ` (${params.styleLine})` : '') + '.',
    'Subtle, slow, calm motion only: soft breeze in hair, leaves and clothes, blinking, small natural gestures, drifting light and particles, a very slow gentle camera push-in.',
    'Do not add any new characters, animals or objects. No text, letters, captions, logos or watermarks. No scene cuts. Child-friendly and peaceful.',
    scene ? `Scene for context: ${scene}` : '',
  ].filter(Boolean).join(' ');
}
