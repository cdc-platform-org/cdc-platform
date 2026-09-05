import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  uploadToBunnyStorage,
  isBunnyStorageConfigured,
  deleteBunnyStorageUrlIfManaged,
  UploadToBunnyStorageParams,
} from './bunnyStorage';
import { BACKEND_URL } from '../utils/env';

// ============================================================
// Automatic image optimization — every real image uploaded through this
// file's uploadImage() (avatars, course/blog/product/team/project/success-
// story/studio-case covers, AI-generated blog covers) gets downscaled and
// re-encoded to WebP before it's ever stored, same "fix once at the shared
// choke point" posture as this codebase's other cross-cutting fixes.
//
// Deliberately gated by mimetype, not by caller: uploadImage() is ALSO used
// for product preview VIDEOS (routes/products.ts's 'product-videos' folder)
// despite its name — a video buffer must never reach sharp. Downloadable
// digital-product assets (ZIP/PDF/etc.) never call this function at all —
// they go through productFileDelivery.ts's separate private-blob path — so
// excluding them is structural, not a mimetype check here.
//
// WebP only, not AVIF: AVIF encoding is meaningfully slower (real CPU cost
// per image) and this runs synchronously in the upload request path, not a
// fire-and-forget background job the way videoCompressionService.ts's
// re-encode is — WebP gets the large size reduction this exists for
// (typically 70-90% smaller than an unoptimized JPEG/PNG at the same visual
// quality) without risking a slow/timed-out upload request. Same "never
// throws — fall back to the original buffer on any failure" posture as
// this file's siblings (reviewImageOptimization.ts, blogImageProcessing.ts,
// productImageProtection.ts).
const OPTIMIZABLE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
// Deliberately excluded even though they're technically images: image/svg+xml
// (a vector logo/icon rasterized to WebP would lose its scalability — a real
// regression, not an optimization) and image/gif (an animated GIF flattened
// to a static WebP loses its animation; sharp can preserve animation but
// that's meaningfully more processing for a format this app doesn't
// currently accept via any upload filter anyway).
const MAX_DIMENSION = 2048; // px, longest edge — matches the requested "downscale to max 2048px"
const WEBP_QUALITY = 82;

interface OptimizedUpload {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}

async function optimizeImageIfApplicable(buffer: Buffer, mimetype: string, filename: string): Promise<OptimizedUpload> {
  if (!OPTIMIZABLE_MIME_TYPES.has(mimetype.toLowerCase())) {
    return { buffer, mimetype, filename };
  }
  try {
    const optimizedBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate() // auto-orient from EXIF before recompressing strips it
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    // The stored filename's extension must match the actual re-encoded
    // bytes — Bunny/the local fallback both serve Content-Type from the
    // `mimetype` param (not the URL), so this isn't load-bearing for
    // correct rendering, but a URL claiming ".png" while actually holding
    // WebP bytes would be a confusing landmine for any future code (or
    // admin) that infers format from the extension.
    const webpFilename = `${filename.replace(/\.[a-zA-Z0-9]+$/, '')}.webp`;
    return { buffer: optimizedBuffer, mimetype: 'image/webp', filename: webpFilename };
  } catch (err) {
    console.error('[imageStorage] Image optimization failed, storing the original as-is:', err instanceof Error ? err.message : err);
    return { buffer, mimetype, filename };
  }
}

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
  const { buffer, mimetype, filename } = await optimizeImageIfApplicable(params.buffer, params.mimetype, params.filename);
  const optimizedParams: UploadToBunnyStorageParams = { ...params, buffer, mimetype, filename };

  if (isBunnyStorageConfigured()) {
    return uploadToBunnyStorage(optimizedParams);
  }

  const safeFolder = sanitizePathSegment(optimizedParams.folderName);
  const safeFilename = sanitizePathSegment(optimizedParams.filename);
  const dir = path.join(UPLOADS_ROOT, safeFolder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safeFilename), optimizedParams.buffer);
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
