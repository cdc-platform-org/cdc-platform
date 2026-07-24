import { BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_HOST, BUNNY_CDN_URL } from '../utils/env';

// ============================================================
// Bunny Storage client — plain object storage for images/files (blog
// covers, gallery photos, CMS images, etc). Distinct from Bunny Stream
// (services/bunnyStreamService.ts), which is video-specific and handles
// its own encoding/playback; general files don't belong there.
// Docs: https://docs.bunny.net/reference/storage-api
// ============================================================

export class BunnyStorageNotConfiguredError extends Error {
  constructor() {
    super('Bunny Storage is not configured. Set BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_API_KEY, and BUNNY_CDN_URL.');
    this.name = 'BunnyStorageNotConfiguredError';
  }
}

export class BunnyStorageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BunnyStorageUploadError';
  }
}

export function isBunnyStorageConfigured(): boolean {
  return !!BUNNY_STORAGE_ZONE_NAME && !!BUNNY_STORAGE_API_KEY && !!BUNNY_CDN_URL;
}

// file/folder names go straight into a URL path segment — strip anything
// that isn't a safe path character so a crafted filename can't smuggle in
// a "/../" traversal or otherwise reshape the storage path.
function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export interface UploadToBunnyStorageParams {
  buffer: Buffer;
  mimetype: string;
  folderName: string;
  filename: string;
}

// Uploads a file buffer to Bunny Storage and returns its public CDN URL —
// that URL (not a local path) is what callers should persist to the
// database, so the file survives independently of this server's disk.
export async function uploadToBunnyStorage({ buffer, mimetype, folderName, filename }: UploadToBunnyStorageParams): Promise<string> {
  if (!isBunnyStorageConfigured()) {
    throw new BunnyStorageNotConfiguredError();
  }

  const safeFolder = sanitizePathSegment(folderName);
  const safeFilename = sanitizePathSegment(filename);
  const storageUrl = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE_NAME}/${safeFolder}/${safeFilename}`;

  let response: Response;
  try {
    response = await fetch(storageUrl, {
      method: 'PUT',
      headers: {
        AccessKey: BUNNY_STORAGE_API_KEY,
        'Content-Type': mimetype,
      },
      body: buffer,
    });
  } catch (err) {
    throw new BunnyStorageUploadError(err instanceof Error ? `Bunny Storage request failed: ${err.message}` : 'Bunny Storage request failed.');
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new BunnyStorageUploadError(`Bunny Storage upload failed (${response.status}): ${body}`);
  }

  return `${BUNNY_CDN_URL.replace(/\/$/, '')}/${safeFolder}/${safeFilename}`;
}

// Best-effort — callers fire-and-forget this (e.g. when a new image
// replaces an old one); a delete failure shouldn't block the caller's own
// response, the orphaned file just sits in storage as low-cost debris.
export async function deleteFromBunnyStorage(folderName: string, filename: string): Promise<void> {
  if (!isBunnyStorageConfigured()) return;
  const safeFolder = sanitizePathSegment(folderName);
  const safeFilename = sanitizePathSegment(filename);
  const storageUrl = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE_NAME}/${safeFolder}/${safeFilename}`;
  await fetch(storageUrl, { method: 'DELETE', headers: { AccessKey: BUNNY_STORAGE_API_KEY } }).catch(() => {});
}
