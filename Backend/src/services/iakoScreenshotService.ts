import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { uploadPrivateBlob, getSignedBlobUrl, assertPrivateBlobContainer } from './privateBlobStorage';

export interface IakoScreenshot { buffer: Buffer; mimeType: string; filename: string }
export class IakoScreenshotError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const MIME_FORMAT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/webp': 'webp' };

export async function validateIakoScreenshots(images: IakoScreenshot[]): Promise<IakoScreenshot[]> {
  if (images.length > 3) throw new IakoScreenshotError(400, 'You can attach at most 3 screenshots.');
  return Promise.all(images.map(async (image) => {
    if (image.buffer.length > MAX_BYTES) throw new IakoScreenshotError(413, 'A screenshot exceeds the 8MB limit.');
    const expected = MIME_FORMAT[image.mimeType.toLowerCase()];
    if (!expected) throw new IakoScreenshotError(400, 'Only PNG, JPEG, or WebP screenshots are allowed.');
    try {
      const decoder = sharp(image.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (metadata.format !== expected || !metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000 || (metadata.pages ?? 1) > 1) throw new Error('Invalid image');
      // Decode every pixel (metadata alone accepts truncated files), strip EXIF,
      // and send the same bounded pixels to storage and to the vision provider.
      const buffer = await decoder.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
      return { buffer, mimeType: 'image/webp', filename: `${randomUUID()}.webp` };
    } catch {
      throw new IakoScreenshotError(400, 'This screenshot is invalid, too large, or does not match its declared image type.');
    }
  }));
}

export async function storeIakoScreenshots(userId: string, images: IakoScreenshot[]): Promise<string[]> {
  if (!images.length) return [];
  await assertPrivateBlobContainer();
  return Promise.all(images.map(async (image) => {
    const name = `iako-private/${userId}/${randomUUID()}.webp`;
    await uploadPrivateBlob(name, image.buffer, image.mimeType);
    return name;
  }));
}

export async function signIakoScreenshots(userId: string, references: string[]): Promise<string[]> {
  const prefix = `iako-private/${userId}/`;
  // Never sign a caller-provided URL, another user's blob, or an old public
  // upload. Reads are only called after conversation entitlement checks.
  const valid = references.filter((ref) => ref.startsWith(prefix) && /^[0-9a-f-]{36}\.webp$/.test(ref.slice(prefix.length)));
  return Promise.all(valid.map((ref) => getSignedBlobUrl(ref, 5)));
}
