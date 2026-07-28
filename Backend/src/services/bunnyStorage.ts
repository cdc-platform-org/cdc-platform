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

// Recursively walks an arbitrary JSON value (the shape varies per CMS page
// — see Frontend/src/types/siteContent.ts) and collects every string that
// looks like one of our Bunny CDN URLs, wherever it's nested (a single
// heksCard.imageUrl field, an array of gallery.images[].url entries,
// etc). Used to diff a CMS page's old vs new content on save, so an image
// that got replaced or removed from the page doesn't leave an orphaned
// file behind in storage — without adminCms.ts needing to know the shape
// of any particular page's content.
export function extractBunnyStorageUrls(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (BUNNY_CDN_URL && value.startsWith(`${BUNNY_CDN_URL.replace(/\/$/, '')}/`)) {
      into.add(value);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) extractBunnyStorageUrls(item, into);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) extractBunnyStorageUrls(item, into);
  }
  return into;
}

// Takes whatever URL a DB record happened to have stored (a real Bunny CDN
// URL from uploadToBunnyStorage, a legacy local /uploads/... path from
// before the Bunny migration, or an arbitrary external URL someone pasted
// into a "paste an image URL" field) and deletes it from Bunny Storage only
// if it's actually one of ours — parsing folder/filename out of anything
// else would either no-op against a URL we don't own or, worse, misparse
// into deleting the wrong object. Safe to call with null/undefined/empty.
export async function deleteBunnyStorageUrlIfManaged(url: string | null | undefined): Promise<void> {
  if (!url || !isBunnyStorageConfigured()) return;
  const base = BUNNY_CDN_URL.replace(/\/$/, '');
  if (!url.startsWith(`${base}/`)) return;
  const pathPart = url.slice(base.length + 1); // "<folder>/<filename>"
  const slashIndex = pathPart.indexOf('/');
  if (slashIndex <= 0 || slashIndex === pathPart.length - 1) return; // malformed — no folder or no filename
  const folderName = pathPart.slice(0, slashIndex);
  const filename = pathPart.slice(slashIndex + 1);
  await deleteFromBunnyStorage(folderName, filename);
}
