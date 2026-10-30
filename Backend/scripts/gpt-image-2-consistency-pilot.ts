// CLI: Phase 3 — two-scene character/style consistency test. Makes AT MOST
// TWO Azure gpt-image-2 requests, strictly sequential: Request #2 (Scene B)
// only fires if Request #1 (Scene A) succeeded. No loop, no retry, no
// fallback, no third scene. MAX_REQUEST_COUNT = 2, RETRY_COUNT = 0. Saves
// both results as local temp files only; makes zero database writes.
//
// Usage (run from Backend/):
//   npx ts-node scripts/gpt-image-2-consistency-pilot.ts
//
// Never logs: the API key, any Authorization header, or the base64 image
// payload — only safe structured metadata (see azureImageService.ts).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isAzureImageConfigured, generateImage, GenerateImageResult } from '../src/services/azureImageService';

// ============================================================
// LOCKED CHARACTER_BIBLE + LOCKED PROPORTION_RULE + IDENTITY_LOCK —
// materially identical text reused in both prompts (Phase 3's own
// consistency-control rule: character/style wording must not differ
// between Scene A and Scene B). Proportion wording is Phase 2B's
// confirmed-effective version.
// ============================================================
const CHARACTER_BLOCK = `CHARACTER (CHARACTER_PILOT_001): An original fictional child protagonist, gender-neutral young explorer, approximately 7 years old, with a curious, kind, and adventurous personality. Friendly rounded youthful face with a warm natural expression, large expressive brown eyes, small natural nose, and a gentle smile. Short-to-medium softly wavy dark brown hair. Warm medium skin tone. Wearing a forest-green explorer jacket over a cream shirt, warm brown trousers, and comfortable brown walking shoes, carrying a small mustard-yellow backpack.

LOCKED PROPORTION RULE: Use believable age-appropriate proportions for an approximately 7-year-old child in a premium illustrated children's book. The character must have naturally proportioned child anatomy, with longer limbs and a smaller head-to-body ratio than a chibi, kawaii, toddler, mascot, or super-deformed character. Target approximately realistic child proportions while retaining gentle storybook stylization. The head must NOT be oversized. The body must NOT appear miniature. The legs must have natural child length. The protagonist must visually read as approximately seven years old.

IDENTITY LOCK: This is the SAME fictional child appearing on two different pages of one book — preserve the same approximate facial structure, the same age appearance, the same hairstyle and hair color, the same brown eyes, the same skin tone, the same green jacket, cream shirt, brown trousers, brown walking shoes, the same mustard-yellow backpack, and the same body proportions. Do not redesign or reinterpret the protagonist.`;

// ============================================================
// LOCKED STYLE_BIBLE — revised LINEWORK POLICY (Phase 3's product
// decision: stop chasing absolute zero linework; delicate painterly
// contour accents are acceptable as long as they never dominate).
// ============================================================
const STYLE_BLOCK = `STYLE (STORYBOOK_WATERCOLOR): Premium traditional watercolor children's-book illustration. Soft watercolor pigment, gentle handmade texture, subtle pigment variation, natural watercolor transitions, professional publishing finish. Warm, harmonious, slightly muted color palette, rich enough for premium children's publishing — no neon palette. Soft warm natural illumination with gentle dimensional shadows. Subtle watercolor-paper texture.

LINEWORK POLICY: The illustration must primarily be defined through watercolor pigment, painted shapes, soft value transitions, and natural painted edges. Heavy or dominant outlines are prohibited. Delicate painterly contour accents are acceptable when they feel naturally integrated into the watercolor illustration. Linework must never dominate the watercolor medium.`;

const NEGATIVE_BLOCK = `NEGATIVE: no chibi proportions, no super-deformed proportions, no oversized head, no tiny body, no toddler proportions, no mascot proportions, no bobble-head appearance, no heavy black outlines, no comic-book contours, no cel-animation outlines, no dark silhouette, no dominant line-art rendering, no 3D render, no photorealism, no anime, no plastic texture, no hyperreal skin, no imitation of living artists, no copyrighted or franchise characters or aesthetic.`;

const SCENE_A_BLOCK = `SCENE (CONSISTENCY_SCENE_A): The young explorer is walking along a quiet woodland path in late morning. The character gently holds a small fallen golden leaf in one hand and looks at it with curiosity. Tall trees and soft foliage surround the path. Warm sunlight filters through the leaves. The atmosphere is peaceful, curious, safe, and magical.

COMPOSITION: Full body visible, character is the primary focal point, natural walking/standing movement, readable silhouette, no body cropping. Background supports the character without overpowering it. Leave a calm, typography-safe region in the upper-left of the composition. The illustration must contain absolutely no text, letters, words, or logos anywhere in the image.`;

const SCENE_B_BLOCK = `SCENE (CONSISTENCY_SCENE_B): The SAME young explorer is beside a calm forest stream in late afternoon, kneeling carefully near the water and watching a small glowing firefly hovering above the stream. The mustard-yellow backpack remains clearly visible. Warm late-afternoon light reflects softly from the water. The scene feels magical, calm, adventurous, and emotionally warm.

COMPOSITION: Same protagonist, kneeling pose, character remains clearly readable. Do not crop the head or any important clothing/accessory features — the backpack remains visible. The environment must not overpower the protagonist. Leave a calm, typography-safe region in the upper-right of the composition. The illustration must contain absolutely no text, letters, words, or logos anywhere in the image.`;

const PROMPT_A = [CHARACTER_BLOCK, STYLE_BLOCK, SCENE_A_BLOCK, NEGATIVE_BLOCK].join('\n\n');
const PROMPT_B = [CHARACTER_BLOCK, STYLE_BLOCK, SCENE_B_BLOCK, NEGATIVE_BLOCK].join('\n\n');

// Identical technical settings for both requests, matching every prior
// benchmark sample.
const GEN_CONFIG = { size: '1024x1024', quality: 'low', outputFormat: 'png' } as const;

function pngLooksValid(buffer: Buffer): boolean {
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length > PNG_MAGIC.length && buffer.subarray(0, 8).equals(PNG_MAGIC);
}

function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function report(label: string, result: GenerateImageResult) {
  console.log(`--- ${label} ---`);
  console.log(`LATENCY_MS: ${result.latencyMs}`);
  console.log(`DEPLOYMENT: ${result.deployment}`);
  console.log(`REQUEST_ID: ${result.requestId ?? '(not provided)'}`);
  if (!result.success) {
    console.log('REQUEST_SUCCESS: false');
    console.log(`HTTP_STATUS: ${result.httpStatus ?? '(none — network/timeout)'}`);
    console.log(`ERROR_CLASSIFICATION: ${result.errorClassification}`);
    console.log(`SAFE_ERROR_MESSAGE: ${result.safeErrorMessage}`);
    return;
  }
  console.log('REQUEST_SUCCESS: true');
  console.log(`IMAGE_MIME_TYPE: ${result.mimeType}`);
  console.log(`IMAGE_SIZE_BYTES: ${result.byteSize}`);
  console.log(`IMAGE_VALID: ${pngLooksValid(result.buffer)}`);
  const dims = pngDimensions(result.buffer);
  console.log(`ACTUAL_WIDTH: ${dims?.width ?? '(undetectable)'}`);
  console.log(`ACTUAL_HEIGHT: ${dims?.height ?? '(undetectable)'}`);
}

async function main() {
  if (!isAzureImageConfigured()) {
    console.log('API_KEY_REQUIRED: YES');
    console.log('PLANNED_REQUEST_COUNT: 2 (not consumed — Azure gpt-image-2 is not configured)');
    process.exitCode = 1;
    return;
  }

  console.log('--- Consistency Pilot: planned configuration (safe summary, no credentials) ---');
  console.log('characterId: CHARACTER_PILOT_001 (locked)');
  console.log('styleId: STORYBOOK_WATERCOLOR (locked, revised linework policy)');
  console.log(`deployment: gpt-image-2, n: 1 per request, size: ${GEN_CONFIG.size}, quality: ${GEN_CONFIG.quality}, output_format: ${GEN_CONFIG.outputFormat}`);
  console.log(`prompt A length: ${PROMPT_A.length} characters, prompt B length: ${PROMPT_B.length} characters`);
  console.log('PLANNED_REQUEST_COUNT: 2, MAX_REQUEST_COUNT: 2, RETRY_COUNT: 0');
  console.log('----------------------------------------------------------------------------------');

  // ---- Request #1: Scene A ----
  const startA = new Date();
  console.log(`SCENE_A_START_TIME: ${startA.toISOString()}`);
  const resultA = await generateImage({ prompt: PROMPT_A, ...GEN_CONFIG, n: 1 });
  const endA = new Date();
  console.log(`SCENE_A_END_TIME: ${endA.toISOString()}`);
  report('SCENE A', resultA);

  if (!resultA.success) {
    console.log('STOPPING: Scene A failed — Scene B will NOT be attempted, per the sequential-dependency rule.');
    process.exitCode = 1;
    return;
  }

  const pathA = path.join(os.tmpdir(), `cdc-book-consistency-scene-a-${Date.now()}.png`);
  fs.writeFileSync(pathA, resultA.buffer);
  console.log(`SCENE_A_LOCAL_TEMP_ARTIFACT_PATH: ${pathA}`);

  // ---- Request #2: Scene B (only reached because Scene A succeeded) ----
  const startB = new Date();
  console.log(`SCENE_B_START_TIME: ${startB.toISOString()}`);
  const resultB = await generateImage({ prompt: PROMPT_B, ...GEN_CONFIG, n: 1 });
  const endB = new Date();
  console.log(`SCENE_B_END_TIME: ${endB.toISOString()}`);
  report('SCENE B', resultB);

  if (!resultB.success) {
    console.log('Scene B failed — not retrying.');
    process.exitCode = 1;
    return;
  }

  const pathB = path.join(os.tmpdir(), `cdc-book-consistency-scene-b-${Date.now()}.png`);
  fs.writeFileSync(pathB, resultB.buffer);
  console.log(`SCENE_B_LOCAL_TEMP_ARTIFACT_PATH: ${pathB}`);
}

main().catch((err) => {
  console.log('REQUEST_SUCCESS: false');
  console.log(`SAFE_ERROR_MESSAGE: ${err instanceof Error ? err.message : 'Unknown failure before/after an Azure call.'}`);
  process.exitCode = 1;
});
