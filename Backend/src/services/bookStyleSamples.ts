import sharp from 'sharp';
import { ILLUSTRATION_STYLES, IllustrationStyle, illustrationStylePromptLine } from './bookIllustrationStyles';
import { generateBookImage } from './bookImageGenerationService';
import { readBookAsset, storeBookAsset } from './bookStorageService';

// ============================================================
// Children's Book — one sample picture per illustration style, shown as a
// thumbnail in the style picker (like an image tool's style gallery) so a
// parent sees what "modern 3D" or "classic illustration" means before
// choosing. Every style uses the same scene (a made-up child and a small
// fox, never a real person), so the only difference is the style.
//
// Each sample is drawn ONCE, the first time it is asked for, stored, and
// served from storage forever after: 6 images in total for the whole
// platform. A failed draw waits FAILURE_COOLDOWN_MS before it may be tried
// again, so a public thumbnail URL can never turn into a stream of paid
// calls.
// ============================================================

const SAMPLE_SCENE =
  'A cheerful 6-year-old child with curly brown hair, wearing a yellow raincoat and red boots, walks through a sunny flower meadow next to a small friendly orange fox with a fluffy tail; a little cottage and soft hills in the background. Square composition, the child and the fox clearly visible in the centre.';
const THUMBNAIL_EDGE = 384;
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000;

const inFlight = new Map<IllustrationStyle, Promise<Buffer | null>>();
const lastFailureAt = new Map<IllustrationStyle, number>();

export function styleSampleKey(style: IllustrationStyle): string {
  return `style-samples/v1/${style}.webp`;
}

export function styleSamplePrompt(style: IllustrationStyle): string {
  return [
    'Children\'s storybook illustration sample.',
    illustrationStylePromptLine(style),
    `Style details: ${ILLUSTRATION_STYLES[style]}.`,
    SAMPLE_SCENE,
    'No readable text, letters or logos anywhere in the image.',
  ].join(' ');
}

async function drawSample(style: IllustrationStyle): Promise<Buffer | null> {
  const result = await generateBookImage({ prompt: styleSamplePrompt(style), size: '1024x1024', quality: 'medium' });
  if (!result.success) {
    console.warn(`[childrens-book] style sample ${style} failed: ${result.errorClassification}`);
    lastFailureAt.set(style, Date.now());
    return null;
  }
  const thumbnail = await sharp(result.buffer).resize(THUMBNAIL_EDGE, THUMBNAIL_EDGE, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  await storeBookAsset(styleSampleKey(style), thumbnail, 'image/webp');
  return thumbnail;
}

// Returns the stored sample, drawing it first if it doesn't exist yet.
// null = not available right now (the picker then shows a plain tile).
export async function getStyleSample(style: IllustrationStyle): Promise<Buffer | null> {
  try {
    return await readBookAsset(styleSampleKey(style));
  } catch {
    // not drawn yet
  }
  const failedAt = lastFailureAt.get(style);
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) return null;
  let pending = inFlight.get(style);
  if (!pending) {
    pending = drawSample(style)
      .catch((err) => {
        console.warn(`[childrens-book] style sample ${style} crashed:`, err instanceof Error ? err.message : err);
        lastFailureAt.set(style, Date.now());
        return null;
      })
      .finally(() => inFlight.delete(style));
    inFlight.set(style, pending);
  }
  return pending;
}
