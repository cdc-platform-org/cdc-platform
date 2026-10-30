import sharp from 'sharp';
import { generateBookImage, isImageGenerationMocked } from '../bookImageGenerationService';

describe('children book mock image generation', () => {
  it('returns a visible PNG placeholder without contacting Azure', async () => {
    expect(isImageGenerationMocked()).toBe(true);
    const result = await generateBookImage({ prompt: 'local test only' });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(768);
    expect(result.deployment).toBe('mock');
  });
});