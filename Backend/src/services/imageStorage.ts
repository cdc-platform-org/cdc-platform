import fs from 'fs/promises';
import path from 'path';
import {
  uploadToBunnyStorage,
  isBunnyStorageConfigured,
  deleteBunnyStorageUrlIfManaged,
  UploadToBunnyStorageParams,
} from './bunnyStorage';
import { BACKEND_URL } from '../utils/env';

// Bunny Storage is the primary image store for avatars/blog/gallery/team
// photos. When it isn't configured, uploads used to fail outright (501
// before this existed). This falls back to the server's own local disk,
// served statically at /uploads (see server.ts's `app.use('/uploads', ...)`)
// so an upload attempt succeeds today instead of erroring.
//
// Caveat: on Azure App Service the local filesystem doesn't survive a
// redeploy/restart, so files written here are NOT durable — this is a
// stopgap to unblock uploads while real Bunny Storage credentials are
// sorted out, not a long-term replacement. Once BUNNY_STORAGE_ZONE_NAME /
// BUNNY_STORAGE_API_KEY / BUNNY_CDN_URL are set correctly, uploads switch
// back to Bunny automatically — no code change needed.
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'public', 'uploads');

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export async function uploadImage(params: UploadToBunnyStorageParams): Promise<string> {
  if (isBunnyStorageConfigured()) {
    return uploadToBunnyStorage(params);
  }

  const safeFolder = sanitizePathSegment(params.folderName);
  const safeFilename = sanitizePathSegment(params.filename);
  const dir = path.join(UPLOADS_ROOT, safeFolder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safeFilename), params.buffer);
  return `${BACKEND_URL}/uploads/${safeFolder}/${safeFilename}`;
}

// Mirrors deleteBunnyStorageUrlIfManaged's "only touch what we own" guard —
// no-ops on anything that isn't one of our local /uploads URLs.
export async function deleteManagedImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  if (isBunnyStorageConfigured()) {
    return deleteBunnyStorageUrlIfManaged(url);
  }
  const prefix = `${BACKEND_URL}/uploads/`;
  if (!url.startsWith(prefix)) return;
  const relative = url.slice(prefix.length);
  if (!relative || relative.includes('..')) return;
  await fs.unlink(path.join(UPLOADS_ROOT, relative)).catch(() => {});
}
