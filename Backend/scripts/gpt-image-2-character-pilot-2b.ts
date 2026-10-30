// CLI: exactly ONE manually-triggered Azure gpt-image-2 request — Phase 2B,
// a refinement of Phase 2's Character Pilot (gpt-image-2-character-pilot.ts)
// testing ONLY two changed instruction blocks (body-proportion lock,
// linework lock). Scene/style-medium/composition/negative-base rules are
// otherwise byte-identical to Phase 2, per the approved "do not refine
// anything else" control rule. GENERATE_CALL_COUNT = 1, RETRY_COUNT = 0 —
// no loop, no automatic retry, no fallback. Saves the result as a local
// temp file only; makes zero database writes.
//
// Usage (run from Backend/):
//   npx ts-node scripts/gpt-image-2-character-pilot-2b.ts
//
// Never logs: the API key, any Authorization header, or the base64 image
// payload — only safe structured metadata (see azureImageService.ts).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isAzureImageConfigured, generateImage } from '../src/services/azureImageService';

// ============================================================
// CHARACTER_BLOCK — identical to Phase 2 except the proportion sentence is
// replaced by the approved BODY PROPORTION LOCK (refinement #1).
// ============================================================
const CHARACTER_BLOCK = `CHARACTER: An original fictional child protagonist, gender-neutral young explorer, approximately 7 years old, with a curious, kind, and adventurous personality. Friendly rounded youthful face with a warm natural expression, large expressive brown eyes, small natural nose, and a gentle smile. Short-to-medium softly wavy dark brown hair. Warm medium skin tone. Wearing a forest-green explorer jacket over a cream shirt, warm brown trousers, and comfortable brown walking shoes, carrying a small mustard-yellow backpack. BODY PROPORTION LOCK: Use believable age-appropriate proportions for an approximately 7-year-old child in a premium illustrated children's book. The character must have a naturally proportioned child body with longer limbs and a smaller head-to-body ratio than a chibi, kawaii, toddler-like, mascot, or super-deformed character. Target approximately realistic child proportions while retaining gentle storybook stylization. The head must NOT be oversized. The body must NOT appear miniature. The legs must have natural child length. The character must read visually as approximately seven years old, not as a toddler. Standing naturally in a relaxed, exploratory pose, full body visible. Maintain exactly this hair color/style, these brown eyes, this skin tone, the green jacket, cream shirt, brown trousers, and mustard-yellow backpack — preserve this age appearance and these facial identity cues throughout.`;

// Scene — byte-identical to Phase 2 (not part of this refinement).
const SCENE_BLOCK = `SCENE: The young explorer has just entered a magical forest in the early morning. Soft golden light filters through tall trees. Small glowing particles appear subtly in the air. Wildflowers and soft foliage frame the environment. The character looks curious and pleasantly surprised. The scene feels warm, safe, magical, adventurous, and emotionally inviting. The character is the dominant subject of the composition.`;

// ============================================================
// STYLE_BLOCK — identical to Phase 2 except the line-treatment sentence is
// replaced by the approved LINEWORK LOCK (refinement #2). Medium/color/
// lighting/texture sentences are unchanged (not part of this refinement).
// ============================================================
const STYLE_BLOCK = `STYLE (Storybook Watercolor): Traditional watercolor and subtle ink, premium hand-painted children's book illustration. Soft watercolor edges, subtle pigment variation, gentle handmade texture, natural paper feel, professionally finished rather than a rough sketch. Warm, harmonious, slightly muted color palette, rich enough for children's publishing — no neon colors. Soft warm natural light with gentle dimensional shadows and a welcoming atmosphere. Subtle watercolor paper texture, visible but controlled brush/pigment character. LINEWORK LOCK: The illustration must be primarily defined by watercolor pigment, soft value transitions, edges, and painted shapes. Visible ink outlines should be absent or nearly imperceptible. Do NOT draw a continuous contour around the character. Do NOT use dark outlines around the face, hair, clothing, hands, legs, shoes, or backpack. Edges should primarily emerge naturally from watercolor contrast rather than line art.`;

// Composition — byte-identical to Phase 2 (not part of this refinement).
const COMPOSITION_BLOCK = `COMPOSITION: The protagonist must remain the clear focal point of the image. The full body must remain visible — do not crop the head, hands, feet, or backpack. Reserve a calm, relatively uncluttered area in the upper-right portion of the composition for future book typography. Balanced, premium children's-book composition; avoid clutter around the character; maintain a readable silhouette. The illustration itself must contain absolutely no text, letters, words, logos, or watermarks anywhere in the image.`;

// Negative rules — Phase 2's base list, plus the two approved negative
// lists for this refinement (proportions, linework).
const NEGATIVE_BLOCK = `DO NOT use: 3D rendering, photorealism, anime style, cel-shading, vector-flat style, heavy black outlines, plastic texture, hyperreal skin, any franchise aesthetic, or imitation of a living artist's style. This is an entirely original fictional character — no celebrity likeness, no copyrighted or franchise characters.

NEGATIVE (proportions): no chibi proportions, no super-deformed proportions, no oversized head, no tiny body, no toddler proportions, no mascot proportions, no bobble-head appearance.

NEGATIVE (linework): no comic-book outlines, no cartoon contour lines, no dark ink silhouette, no cel-animation outlines, no heavy line art, no continuous character contour.`;

const CHARACTER_PILOT_PROMPT_2B = [CHARACTER_BLOCK, SCENE_BLOCK, STYLE_BLOCK, COMPOSITION_BLOCK, NEGATIVE_BLOCK].join('\n\n');

// Identical generation config to Phase 2 / COST_BENCHMARK_SAMPLE_001 and
// _002 — only the prompt text changed, so latency/cost stay comparable.
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

  console.log('--- Character Pilot 2B: planned configuration (safe summary, no credentials) ---');
  console.log('characterId: CHARACTER_PILOT_001 (refinement 2B: proportions + linework only)');
  console.log('styleId: STORYBOOK_WATERCOLOR');
  console.log(`deployment: gpt-image-2, n: 1, size: ${PILOT_CONFIG.size}, quality: ${PILOT_CONFIG.quality}, output_format: ${PILOT_CONFIG.outputFormat}`);
  console.log(`prompt length: ${CHARACTER_PILOT_PROMPT_2B.length} characters`);
  console.log('PLANNED_GENERATION_REQUESTS: 1');
  console.log('----------------------------------------------------------------------------------');

  const startTime = new Date();
  console.log(`START_TIME: ${startTime.toISOString()}`);

  // The ONE generateImage call this script ever makes — no loop, no retry.
  const result = await generateImage({ prompt: CHARACTER_PILOT_PROMPT_2B, ...PILOT_CONFIG, n: 1 });

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

  const outPath = path.join(os.tmpdir(), `cdc-gpt-image-2-character-pilot-2b-${Date.now()}.png`);
  fs.writeFileSync(outPath, result.buffer);
  console.log(`LOCAL_TEMP_ARTIFACT_PATH: ${outPath}`);
}

main().catch((err) => {
  console.log('REQUEST_SUCCESS: false');
  console.log(`SAFE_ERROR_MESSAGE: ${err instanceof Error ? err.message : 'Unknown failure before/after the Azure call.'}`);
  process.exitCode = 1;
});
