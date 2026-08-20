import sharp from 'sharp';

// ============================================================
// ProductReview photo optimization — a buyer's own real-world showcase
// photo (e.g. printed artwork, physical application of a digital asset),
// not a seller's sellable-quality preview asset, so unlike
// productImageProtection.ts this only resizes/recompresses — no watermark,
// no protection concern.
// ============================================================

const MAX_DIMENSION = 1600; // px, longest edge — plenty for a lightgallery/modal view
const JPEG_QUALITY = 82;

export interface OptimizedImage {
  buffer: Buffer;
  mimetype: string;
}

// Never throws — on any processing failure (corrupt input, unsupported
// format sharp can't decode) the original buffer/mimetype pass through
// untouched, same posture as protectProductPreviewImage.
export async function optimizeReviewImage(buffer: Buffer, mimetype: string): Promise<OptimizedImage> {
  try {
    const output = await sharp(buffer, { failOn: 'none' })
      .rotate() // auto-orient from EXIF before recompressing strips it
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buffer: output, mimetype: 'image/jpeg' };
  } catch (err) {
    console.error('[reviewImageOptimization] Failed to process review photo, storing the original as-is:', err instanceof Error ? err.message : err);
    return { buffer, mimetype };
  }
}
