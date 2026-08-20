import sharp from 'sharp';

// ============================================================
// Blog/article cover image processing — previously blog.ts's /upload-image
// pushed the raw upload straight to Bunny Storage with no resize step at
// all, so an oversized or odd-aspect-ratio upload landed on the CDN exactly
// as picked. This resizes down to a landscape-safe bound (1920px longest
// edge) with `fit: 'inside'`, which by definition never crops — the source
// aspect ratio is always preserved, just downscaled if it's larger than the
// bound. Deliberately NOT a hard 16:9 crop: force-cropping to an exact
// ratio would cut real content off a portrait/square upload, which is worse
// than leaving it at its native (already-close-to-landscape) ratio — the
// 1200×675 (16:9) hint on the admin form guides submitters toward the ideal
// shape instead of the backend silently mangling whatever they send.
// ============================================================

const MAX_DIMENSION = 1920; // px, longest edge

export interface ProcessedBlogImage {
  buffer: Buffer;
  mimetype: string;
}

// Never throws — on any processing failure (corrupt input, unsupported
// format sharp can't decode) the original buffer/mimetype pass through
// untouched, same posture as productImageProtection.ts.
export async function processBlogCoverImage(buffer: Buffer, mimetype: string): Promise<ProcessedBlogImage> {
  try {
    const output = await sharp(buffer, { failOn: 'none' })
      .rotate() // auto-orient from EXIF before recompressing strips it
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    return { buffer: output, mimetype };
  } catch (err) {
    console.error('[blogImageProcessing] Failed to process cover image, storing the original as-is:', err instanceof Error ? err.message : err);
    return { buffer, mimetype };
  }
}
