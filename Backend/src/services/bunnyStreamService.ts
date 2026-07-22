import { BUNNY_STREAM_API_KEY, BUNNY_STREAM_LIBRARY_ID, BUNNY_CDN_HOSTNAME } from '../utils/env';

// ============================================================
// Bunny Stream video API client.
// Docs: https://docs.bunny.net/reference/video_createvideo
//       https://docs.bunny.net/reference/video_uploadvideo
//       https://docs.bunny.net/stream/embedding
// ============================================================

const BASE_URL = 'https://video.bunnycdn.com/library';
// Fixed Bunny domain for the embeddable player iframe — NOT the same as the
// per-account BUNNY_CDN_HOSTNAME pull zone (used for thumbnails below).
const PLAYER_EMBED_HOST = 'https://player.mediadelivery.net';

export class BunnyNotConfiguredError extends Error {
  constructor() {
    super('Bunny Stream is not configured. Set BUNNY_STREAM_API_KEY and BUNNY_STREAM_LIBRARY_ID.');
    this.name = 'BunnyNotConfiguredError';
  }
}

function assertConfigured() {
  if (!BUNNY_STREAM_API_KEY || !BUNNY_STREAM_LIBRARY_ID) {
    throw new BunnyNotConfiguredError();
  }
}

export function isBunnyConfigured(): boolean {
  return !!BUNNY_STREAM_API_KEY && !!BUNNY_STREAM_LIBRARY_ID;
}

interface BunnyVideoModel {
  guid: string;
  title: string;
  status: number;
}

// Step 1 of 2 for uploading a lesson video — creates the video object and
// returns its guid, which is then used as the videoId for uploadVideoBinary.
export async function createBunnyVideo(title: string): Promise<string> {
  assertConfigured();
  const response = await fetch(`${BASE_URL}/${BUNNY_STREAM_LIBRARY_ID}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: BUNNY_STREAM_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Bunny create-video request failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as BunnyVideoModel;
  return data.guid;
}

// Step 2 of 2 — streams the raw file bytes into the video object created above.
export async function uploadBunnyVideoBinary(videoId: string, fileBuffer: Buffer): Promise<void> {
  assertConfigured();
  const response = await fetch(`${BASE_URL}/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_STREAM_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Bunny upload-video request failed (${response.status}): ${body}`);
  }
}

export async function deleteBunnyVideo(videoId: string): Promise<void> {
  assertConfigured();
  const response = await fetch(`${BASE_URL}/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`, {
    method: 'DELETE',
    headers: { AccessKey: BUNNY_STREAM_API_KEY, Accept: 'application/json' },
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '');
    throw new Error(`Bunny delete-video request failed (${response.status}): ${body}`);
  }
}

export function getBunnyEmbedUrl(videoId: string): string {
  return `${PLAYER_EMBED_HOST}/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}`;
}

export function getBunnyThumbnailUrl(videoId: string): string | null {
  if (!BUNNY_CDN_HOSTNAME) return null;
  return `https://${BUNNY_CDN_HOSTNAME}/${videoId}/thumbnail.jpg`;
}
