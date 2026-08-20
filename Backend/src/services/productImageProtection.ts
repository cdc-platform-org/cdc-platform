import sharp from 'sharp';

// ============================================================
// Digital Store preview-image protection — DigitalProduct.imageUrl/
// previewImages (the public cover + gallery screenshots shown on /store)
// used to be stored at whatever resolution/quality the submitter uploaded,
// with no compression or watermark step, via the same generic uploadImage()
// used for avatars/course thumbnails/blog covers. For a visual digital
// product (a design pack, a template set, an illustration) that means a
// full-resolution, unmarked, sellable-quality asset was sitting on a public
// CDN URL before anyone paid for it.
//
// Deliberately scoped to THIS file, called only from products.ts/
// adminProducts.ts's /upload-image handlers — NOT folded into the shared
// imageStorage.ts uploadImage(), which stays untouched so avatars/course
// thumbnails/blog covers are never watermarked or downres'd.
// ============================================================

const MAX_PREVIEW_DIMENSION = 1600; // px, longest edge — a legible preview, not a sellable-quality export
const JPEG_QUALITY = 82;
const WATERMARK_TEXT = 'CDC.ORG.GE';

function buildWatermarkTile(): Buffer {
  const width = 420;
  const height = 220;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="30" font-weight="700"
          fill="rgba(255,255,255,0.26)" stroke="rgba(0,0,0,0.16)" stroke-width="0.6"
          text-anchor="middle" dominant-baseline="middle"
          transform="rotate(-28 ${width / 2} ${height / 2})">${WATERMARK_TEXT}</text>
  </svg>`;
  return Buffer.from(svg);
}

export interface ProtectedImage {
  buffer: Buffer;
  mimetype: string;
}

// Resizes down to MAX_PREVIEW_DIMENSION, tiles a diagonal semi-transparent
// watermark across the whole frame, and recompresses to JPEG. Never throws —
// on any processing failure (corrupt input, unsupported format sharp can't
// decode) the original buffer/mimetype pass through untouched, same "can
// only help, never breaks the upload" posture as videoCompressionService.ts.
export async function protectProductPreviewImage(buffer: Buffer, mimetype: string): Promise<ProtectedImage> {
  try {
    const output = await sharp(buffer, { failOn: 'none' })
      .rotate() // auto-orient from EXIF before recompressing strips it
      .resize({ width: MAX_PREVIEW_DIMENSION, height: MAX_PREVIEW_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .composite([{ input: buildWatermarkTile(), tile: true, blend: 'over' }])
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buffer: output, mimetype: 'image/jpeg' };
  } catch (err) {
    console.error('[productImageProtection] Failed to process preview image, storing the original as-is:', err instanceof Error ? err.message : err);
    return { buffer, mimetype };
  }
}
