// CLI: exactly ONE manually-triggered Azure gpt-image-2 Character Pilot
// request (Phase 2). GENERATE_CALL_COUNT = 1, RETRY_COUNT = 0 — no loop,
// no automatic retry, no fallback generation. Saves the result as a local
// temp file only (os.tmpdir(), never under the repo, never uploaded) and
// makes zero database writes. See scripts/gpt-image-2-smoke-test.ts for
// the (separate, already-run) Phase 1B connectivity smoke test this reuses
// the exact same client/config pattern from.
//
// Usage (run from Backend/):
//   npx ts-node scripts/gpt-image-2-character-pilot.ts
//
// Never logs: the API key, any Authorization header, or the base64 image
// payload — only safe structured metadata (see azureImageService.ts).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isAzureImageConfigured, generateImage } from '../src/services/azureImageService';

// ============================================================
// CHARACTER_BIBLE — CHARACTER_PILOT_001 (entirely synthetic/fictional; no
// real child, no photo, no personal data, no celebrity or franchise
// reference).
// ============================================================
const CHARACTER_BLOCK = `CHARACTER: An original fictional child protagonist, gender-neutral young explorer, approximately 7 years old, with a curious, kind, and adventurous personality. Friendly rounded youthful face with a warm natural expression, large expressive brown eyes, small natural nose, and a gentle smile. Short-to-medium softly wavy dark brown hair. Warm medium skin tone. Wearing a forest-green explorer jacket over a cream shirt, warm brown trousers, and comfortable brown walking shoes, carrying a small mustard-yellow backpack. Age-appropriate child body proportions, slightly stylized for children's publishing — not miniature, not chibi, not adult-like. Standing naturally in a relaxed, exploratory pose, full body visible. Maintain exactly this hair color/style, these brown eyes, this skin tone, the green jacket, cream shirt, brown trousers, and mustard-yellow backpack — preserve this age appearance and these facial identity cues throughout.`;

// ============================================================
// PILOT_SCENE
// ============================================================
const SCENE_BLOCK = `SCENE: The young explorer has just entered a magical forest in the early morning. Soft golden light filters through tall trees. Small glowing particles appear subtly in the air. Wildflowers and soft foliage frame the environment. The character looks curious and pleasantly surprised. The scene feels warm, safe, magical, adventurous, and emotionally inviting. The character is the dominant subject of the composition.`;

// ============================================================
// STYLE_BIBLE — STORYBOOK_WATERCOLOR
// ============================================================
const STYLE_BLOCK = `STYLE (Storybook Watercolor): Traditional watercolor and subtle ink, premium hand-painted children's book illustration. Soft watercolor edges, subtle pigment variation, gentle handmade texture, natural paper feel, professionally finished rather than a rough sketch. Warm, harmonious, slightly muted color palette, rich enough for children's publishing — no neon colors. Soft warm natural light with gentle dimensional shadows and a welcoming atmosphere. Subtle watercolor paper texture, visible but controlled brush/pigment character. Minimal, delicate ink linework where useful — no heavy black outlines.`;

// ============================================================
// COMPOSITION_RULES
// ============================================================
const COMPOSITION_BLOCK = `COMPOSITION: The protagonist must remain the clear focal point of the image. The full body must remain visible — do not crop the head, hands, feet, or backpack. Reserve a calm, relatively uncluttered area in the upper-right portion of the composition for future book typography. Balanced, premium children's-book composition; avoid clutter around the character; maintain a readable silhouette. The illustration itself must contain absolutely no text, letters, words, logos, or watermarks anywhere in the image.`;

// ============================================================
// NEGATIVE_RULES
// ============================================================
const NEGATIVE_BLOCK = `DO NOT use: 3D rendering, photorealism, anime style, cel-shading, vector-flat style, heavy black outlines, plastic texture, hyperreal skin, any franchise aesthetic, or imitation of a living artist's style. This is an entirely original fictional character — no celebrity likeness, no copyrighted or franchise characters.`;

const CHARACTER_PILOT_PROMPT = [CHARACTER_BLOCK, SCENE_BLOCK, STYLE_BLOCK, COMPOSITION_BLOCK, NEGATIVE_BLOCK].join('\n\n');

// Cost-controlled pilot — intentionally the SAME config as
// COST_BENCHMARK_SAMPLE_001 so latency/output are comparable. Do not
// silently bump to medium/high; that's a separate, explicitly later test.
const PILOT_CONFIG = {
  size: '1024x1024',
  quality: 'low',
  outputFormat: 'png',
} as const;

function pngLooksValid(buffer: Buffer): boolean {
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length > PNG_MAGIC.length && buffer.subarray(0, 8).equals(PNG_MAGIC);
}

function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function main() {
  if (!isAzureImageConfigured()) {
    console.log('API_KEY_REQUIRED: YES');
    console.log('PLANNED_GENERATION_REQUESTS: 1 (not consumed — Azure gpt-image-2 is not configured)');
    process.exitCode = 1;
    return;
  }

  console.log('--- Character Pilot: planned configuration (safe summary, no credentials) ---');
  console.log('characterId: CHARACTER_PILOT_001');
  console.log('styleId: STORYBOOK_WATERCOLOR');
  console.log(`deployment: gpt-image-2, n: 1, size: ${PILOT_CONFIG.size}, quality: ${PILOT_CONFIG.quality}, output_format: ${PILOT_CONFIG.outputFormat}`);
  console.log(`prompt length: ${CHARACTER_PILOT_PROMPT.length} characters`);
  console.log('PLANNED_GENERATION_REQUESTS: 1');
  console.log('--------------------------------------------------------------------------');

  const startTime = new Date();
  console.log(`START_TIME: ${startTime.toISOString()}`);

  // The ONE generateImage call this script ever makes — no loop, no retry.
  const result = await generateImage({ prompt: CHARACTER_PILOT_PROMPT, ...PILOT_CONFIG, n: 1 });

  const endTime = new Date();
  console.log(`END_TIME: ${endTime.toISOString()}`);
  console.log(`LATENCY_MS: ${result.latencyMs}`);
  console.log(`DEPLOYMENT: ${result.deployment}`);
  console.log(`REQUEST_ID: ${result.requestId ?? '(not provided)'}`);

  if (!result.success) {
    console.log('REQUEST_SUCCESS: false');
    console.log(`HTTP_STATUS: ${result.httpStatus ?? '(none — network/timeout)'}`);
    console.log(`ERROR_CLASSIFICATION: ${result.errorClassification}`);
    console.log(`SAFE_ERROR_MESSAGE: ${result.safeErrorMessage}`);
    process.exitCode = 1;
    return;
  }

  console.log('REQUEST_SUCCESS: true');
  console.log(`IMAGE_MIME_TYPE: ${result.mimeType}`);
  console.log(`IMAGE_SIZE_BYTES: ${result.byteSize}`);
  console.log(`IMAGE_VALID: ${pngLooksValid(result.buffer)}`);
  const dims = pngDimensions(result.buffer);
  console.log(`ACTUAL_WIDTH: ${dims?.width ?? '(undetectable)'}`);
  console.log(`ACTUAL_HEIGHT: ${dims?.height ?? '(undetectable)'}`);

  const outPath = path.join(os.tmpdir(), `cdc-gpt-image-2-character-pilot-${Date.now()}.png`);
  fs.writeFileSync(outPath, result.buffer);
  console.log(`LOCAL_TEMP_ARTIFACT_PATH: ${outPath}`);
}

main().catch((err) => {
  console.log('REQUEST_SUCCESS: false');
  console.log(`SAFE_ERROR_MESSAGE: ${err instanceof Error ? err.message : 'Unknown failure before/after the Azure call.'}`);
  process.exitCode = 1;
});
