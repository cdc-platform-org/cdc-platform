/**
 * Design editor — images inside designs.
 *
 * Two kinds of image `src` can appear in a design (schemas/designTemplateSchemas.ts):
 *   - `cdcdesign://design-asset-<userId>-<uuid>.webp` — a photo/logo the buyer
 *     uploaded. Stored in the PRIVATE blob container (people put their own
 *     face on a CV); only the uploader can read it back.
 *   - `https://…` on our own public CDN — images the template author used.
 *
 * The browser never loads either directly: the editor draws images onto a
 * canvas and exports it, and a cross-origin image without CORS headers would
 * "taint" the canvas and break export. So everything is streamed through
 * GET /api/designs/:id/assets (same origin rules as the rest of the API).
 * The https branch is restricted to an allowlist of our own hosts and refuses
 * redirects, so the endpoint can't be used as an open proxy (SSRF).
 *
 * Business rules for designs themselves: ./designService.ts.
 */
import crypto from 'crypto';
import sharp from 'sharp';
import { uploadPrivateBlob, downloadPrivateBlob } from '../integrations/privateBlobStorage';
import { BUNNY_CDN_URL } from '../../utils/env';
import { DESIGN_ASSET_REF_SCHEME } from '../../schemas/designTemplateSchemas';
import { DesignError } from './designService';

const MAX_REMOTE_IMAGE_BYTES = 15 * 1024 * 1024;
const REMOTE_FETCH_TIMEOUT_MS = 10_000;
// Print quality for an A4 page at 300 DPI is ~3500 px on the long side.
const MAX_UPLOAD_EDGE_PX = 4000;
const ASSET_NAME_PATTERN = /^design-asset-([0-9a-f-]{36})-[0-9a-f-]{36}\.(webp|png)$/;

function allowedRemoteHosts(): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    try { hosts.add(new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase()); } catch { /* ignore malformed */ }
  };
  add(BUNNY_CDN_URL);
  // Optional extra hosts (comma separated), e.g. a second CDN zone.
  (process.env.DESIGN_ASSET_HOSTS || '').split(',').map((host) => host.trim()).forEach(add);
  return hosts;
}

export function parseAssetRef(ref: string): { blobName: string; ownerId: string } | null {
  if (!ref.startsWith(DESIGN_ASSET_REF_SCHEME)) return null;
  const blobName = ref.slice(DESIGN_ASSET_REF_SCHEME.length);
  const match = ASSET_NAME_PATTERN.exec(blobName);
  return match ? { blobName, ownerId: match[1] } : null;
}

// Re-encodes the upload (strips EXIF/GPS, caps size, normalizes format) and
// stores it privately. Returns the ref the editor puts into the design.
export async function storeDesignUpload(userId: string, buffer: Buffer): Promise<{ ref: string; width: number; height: number }> {
  let image = sharp(buffer, { failOn: 'error' }).rotate();
  const meta = await image.metadata().catch(() => null);
  if (!meta?.width || !meta.height) throw new DesignError(400, 'The file is not a readable image.', 'BAD_IMAGE');
  image = image.resize({ width: MAX_UPLOAD_EDGE_PX, height: MAX_UPLOAD_EDGE_PX, fit: 'inside', withoutEnlargement: true });
  // WebP keeps transparency (logos) and is far smaller than PNG; quality 90
  // is visually lossless at print size.
  const { data, info } = await image.webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const blobName = `design-asset-${userId}-${crypto.randomUUID()}.webp`;
  await uploadPrivateBlob(blobName, data, 'image/webp');
  return { ref: `${DESIGN_ASSET_REF_SCHEME}${blobName}`, width: info.width, height: info.height };
}

export async function loadDesignAsset(userId: string, ref: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (ref.startsWith(DESIGN_ASSET_REF_SCHEME)) {
    const parsed = parseAssetRef(ref);
    if (!parsed || parsed.ownerId !== userId) throw new DesignError(404, 'Image not found.');
    const buffer = await downloadPrivateBlob(parsed.blobName).catch(() => {
      throw new DesignError(404, 'Image not found.');
    });
    return { buffer, contentType: parsed.blobName.endsWith('.png') ? 'image/png' : 'image/webp' };
  }

  let url: URL;
  try { url = new URL(ref); } catch { throw new DesignError(400, 'Invalid image address.'); }
  if (url.protocol !== 'https:' || !allowedRemoteHosts().has(url.hostname.toLowerCase())) {
    throw new DesignError(400, 'Images must come from our own storage.', 'HOST_NOT_ALLOWED');
  }
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS) })
    .catch(() => { throw new DesignError(502, 'Could not load the image.'); });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.startsWith('image/')) throw new DesignError(502, 'Could not load the image.');
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_REMOTE_IMAGE_BYTES) throw new DesignError(413, 'Image is too large.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_REMOTE_IMAGE_BYTES) throw new DesignError(413, 'Image is too large.');
  // SVG could carry script; the editor only needs raster images.
  if (contentType.includes('svg')) throw new DesignError(415, 'SVG images are not supported.');
  return { buffer, contentType };
}
