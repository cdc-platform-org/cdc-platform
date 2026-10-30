import * as azureImage from './azureImageService';
import { isBookAiMocked } from './bookMockConfig';
import sharp from 'sharp';

// ============================================================
// Children's Book — single entry point every image-producing call
// (character preview, final page, revision) goes through. Mock-first: in
// mock mode this NEVER calls azureImageService / Azure, and returns a
// deterministic local storybook placeholder PNG. In real mode it's a thin
// pass-through to the already-validated azureImageService.generateImage
// (Phase 1-4 pilots) — nothing about the real path is reimplemented here.
// ============================================================

// This authored landscape keeps the local reader and PDF visually usable
// without implying that any image model was called or that mock QA is real.
const MOCK_STORYBOOK_SVG = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <defs>
    <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#b9e6fa"/><stop offset="1" stop-color="#f3f7d4"/></linearGradient>
    <linearGradient id="path" x2="0" y2="1"><stop stop-color="#f7d99a"/><stop offset="1" stop-color="#fff0c7"/></linearGradient>
  </defs>
  <rect width="1024" height="768" fill="url(#sky)"/>
  <path d="M0 420 180 250l145 150 180-225 205 230 150-170 164 165v368H0Z" fill="#91b9b1"/>
  <path d="m0 485 190-105 155 80 175-125 180 135 150-95 174 115v278H0Z" fill="#739c79"/>
  <path d="M0 540c185-83 275-40 405 5 150 52 300-36 619-8v231H0Z" fill="#568b64"/>
  <path d="M495 768c45-104 18-168-17-225-39-63-34-96 47-143 54-31 80-57 92-92-8 72-39 111-88 151-54 44-46 78-7 132 48 66 67 112 48 177Z" fill="url(#path)"/>
  <g fill="#315e53">
    <path d="m120 548 54-160 54 160h-31l43 83H108l43-83Z"/><path d="m835 512 45-133 45 133h-27l36 70h-108l36-70Z"/>
    <path d="m265 556 38-111 38 111h-22l30 58h-92l30-58Z"/><path d="m700 572 35-104 35 104h-21l28 54h-84l28-54Z"/>
  </g>
  <g transform="translate(536 390)">
    <path d="M0 78 89 5l91 73v119H0Z" fill="#f3c879" stroke="#654b42" stroke-width="9" stroke-linejoin="round"/>
    <path d="m-13 82 102-91 105 91" fill="none" stroke="#8b5146" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="70" y="125" width="43" height="72" rx="4" fill="#8b5146"/>
    <rect x="23" y="105" width="32" height="32" rx="3" fill="#d7f0e9" stroke="#654b42" stroke-width="6"/>
    <rect x="137" y="105" width="32" height="32" rx="3" fill="#d7f0e9" stroke="#654b42" stroke-width="6"/>
  </g>
  <g fill="#fff9e8" opacity=".9"><path d="M125 150c8-28 53-35 68-8 30-9 57 12 54 34H111c-7-12 0-24 14-26Z"/><path d="M735 210c8-25 48-30 62-7 28-8 52 11 49 31H722c-6-11 0-22 13-24Z"/></g>
</svg>`);

export interface BookImageParams {
  prompt: string;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

export type BookImageResult = azureImage.GenerateImageResult;

export function isImageGenerationMocked(): boolean {
  return isBookAiMocked();
}

export async function generateBookImage(params: BookImageParams): Promise<BookImageResult> {
  if (isBookAiMocked()) {
    const start = Date.now();
    const buffer = await sharp(MOCK_STORYBOOK_SVG).png().toBuffer();
    return {
      success: true,
      deployment: 'mock',
      latencyMs: Date.now() - start,
      requestId: `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      mimeType: 'image/png',
      byteSize: buffer.byteLength,
      buffer,
    };
  }

  if (!azureImage.isAzureImageConfigured()) {
    return {
      success: false,
      deployment: 'unconfigured',
      latencyMs: 0,
      requestId: null,
      httpStatus: undefined,
      errorClassification: 'DEPLOYMENT_OR_ENDPOINT',
      safeErrorMessage: 'Azure gpt-image-2 is not configured, and mocking is disabled (BOOK_FORCE_REAL_AI=true).',
    };
  }

  return azureImage.generateImage({
    prompt: params.prompt,
    size: params.size ?? '1024x1024',
    quality: params.quality ?? 'low',
    outputFormat: 'png',
  });
}
