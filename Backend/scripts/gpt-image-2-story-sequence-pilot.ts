// CLI: Phase 4 — four-scene story-sequence stress test (DISCOVERY /
// INTERACTION / WONDER / EMOTIONAL RESOLUTION). Makes AT MOST FOUR Azure
// gpt-image-2 requests, strictly sequential: each next scene only fires if
// every prior scene succeeded. No loop construct, no retry, no fallback.
// MAX_REQUEST_COUNT = 4, RETRY_COUNT = 0. Saves successful results as
// local temp files only; makes zero database writes.
//
// Written as 4 explicit sequential call sites (not a loop over an array)
// specifically so the "at most 4 requests, hard stop on first failure"
// guarantee is trivial to statically verify by reading top to bottom.
//
// Usage (run from Backend/):
//   npx ts-node scripts/gpt-image-2-story-sequence-pilot.ts
//
// Never logs: the API key, any Authorization header, or the base64 image
// payload — only safe structured metadata (see azureImageService.ts).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isAzureImageConfigured, generateImage, GenerateImageResult } from '../src/services/azureImageService';

// ============================================================
// LOCKED CHARACTER_BIBLE + LOCKED PROPORTION_RULE + IDENTITY_LOCK —
// byte-identical to Phase 3's gpt-image-2-consistency-pilot.ts, reused
// verbatim across all four scenes for a valid controlled comparison.
// ============================================================
const CHARACTER_BLOCK = `CHARACTER (CHARACTER_PILOT_001): An original fictional child protagonist, gender-neutral young explorer, approximately 7 years old, with a curious, kind, and adventurous personality. Friendly rounded youthful face with a warm natural expression, large expressive brown eyes, small natural nose, and a gentle smile. Short-to-medium softly wavy dark brown hair. Warm medium skin tone. Wearing a forest-green explorer jacket over a cream shirt, warm brown trousers, and comfortable brown walking shoes, carrying a small mustard-yellow backpack.

LOCKED PROPORTION RULE: Use believable age-appropriate proportions for an approximately 7-year-old child in a premium illustrated children's book. The character must have naturally proportioned child anatomy, with longer limbs and a smaller head-to-body ratio than a chibi, kawaii, toddler, mascot, or super-deformed character. Target approximately realistic child proportions while retaining gentle storybook stylization. The head must NOT be oversized. The body must NOT appear miniature. The legs must have natural child length. The protagonist must visually read as approximately seven years old.

IDENTITY LOCK: This is the SAME fictional child appearing across multiple pages of one book — preserve the same approximate facial structure, the same age appearance, the same hairstyle and hair color, the same brown eyes, the same skin tone, the same green jacket, cream shirt, brown trousers, brown walking shoes, the same mustard-yellow backpack, and the same body proportions. Do not redesign or reinterpret the protagonist.`;

// ============================================================
// LOCKED STYLE_BIBLE — byte-identical to Phase 3 (revised LINEWORK_POLICY:
// delicate painterly contour accents acceptable, never dominant).
// ============================================================
const STYLE_BLOCK = `STYLE (STORYBOOK_WATERCOLOR): Premium traditional watercolor children's-book illustration. Soft watercolor pigment, gentle handmade texture, subtle pigment variation, natural watercolor transitions, professional publishing finish. Warm, harmonious, slightly muted color palette, rich enough for premium children's publishing — no neon palette. Soft warm natural illumination with gentle dimensional shadows. Subtle watercolor-paper texture.

LINEWORK POLICY: The illustration must primarily be defined through watercolor pigment, painted shapes, soft value transitions, and natural painted edges. Heavy or dominant outlines are prohibited. Delicate painterly contour accents are acceptable when they feel naturally integrated into the watercolor illustration. Linework must never dominate the watercolor medium.`;

const NEGATIVE_BLOCK = `NEGATIVE: no chibi proportions, no super-deformed proportions, no oversized head, no tiny body, no toddler proportions, no mascot proportions, no bobble-head appearance, no heavy black outlines, no comic-book contours, no cel-animation outlines, no dark silhouette, no dominant line-art rendering, no 3D render, no photorealism, no anime, no plastic texture, no hyperreal skin, no imitation of living artists, no copyrighted or franchise characters or aesthetic.`;

// Newly approved, stronger TEXT-SAFE LOCK wording (replaces Phase 3's
// softer "leave a calm typography-safe region" phrasing, which left
// Scene A's upper-left zone with intruding branches). Functional layout
// requirement, not an aesthetic suggestion — applied in full to all 4
// scenes, alternating which corner carries it so both sides get tested.
function textSafeLock(region: 'upper-left' | 'upper-right'): string {
  return `TEXT-SAFE LOCK: Reserve the ${region} approximately 30% of the image as a genuinely clean typography-safe region. This region must contain no character, no branches crossing through it, no detailed foliage, no glowing particles, no important objects, no strong contrast, and no visually dominant texture. Use only a soft, low-detail watercolor atmosphere/background wash in that region.`;
}

// ============================================================
// Four story-beat scenes, each testing a different pose/interaction/
// emotion axis, continuing directly from Phase 3's Scene B (the golden
// leaf and forest setting carry through as a simple continuity thread).
// ============================================================
const SCENE_1_DISCOVERY = `SCENE (STORY_SCENE_1_DISCOVERY): The young explorer has just discovered something magical — a softly glowing archway formed from twisted old tree roots and gentle light at the base of an ancient tree, hidden among ferns. The character stands facing it, one hand reaching out curiously toward the glow, eyes wide with surprised wonder, mouth slightly open in amazement.

COMPOSITION: Full body visible, natural standing pose with weight shifted forward in curiosity, character is the primary focal point, readable silhouette, no body cropping. The glowing archway sits at a supporting, secondary position in the frame, not overpowering the protagonist. ${textSafeLock('upper-left')} The illustration must contain absolutely no text, letters, words, or logos anywhere in the image.`;

const SCENE_2_INTERACTION = `SCENE (STORY_SCENE_2_INTERACTION): The young explorer kneels gently on the forest floor, cupping both hands together as a small, friendly, softly glowing forest bird lands delicately on their palms. The character looks down at the bird with a warm, gentle smile, completely focused and careful. The mustard-yellow backpack remains visible on the character's back.

COMPOSITION: Character remains clearly readable in a kneeling pose, hands and the small bird clearly visible and not cropped, backpack remains visible, full body visible. ${textSafeLock('upper-right')} The illustration must contain absolutely no text, letters, words, or logos anywhere in the image.`;

const SCENE_3_WONDER = `SCENE (STORY_SCENE_3_WONDER): The young explorer stands at the edge of a hidden clearing at dusk, looking upward in awe as a soft swirl of gently glowing fireflies drifts above a small moss-covered waterfall. The character's arms are relaxed slightly open at their sides, head tilted up, face full of quiet amazement and joy.

COMPOSITION: Full body visible, standing pose, character remains the clear focal point even while looking upward, readable silhouette, no body cropping. The waterfall and fireflies support the scene without overwhelming the protagonist. ${textSafeLock('upper-left')} The illustration must contain absolutely no text, letters, words, or logos anywhere in the image.`;

const SCENE_4_RESOLUTION = `SCENE (STORY_SCENE_4_EMOTIONAL_RESOLUTION): As the day draws to a gentle close, the young explorer sits peacefully on a soft moss-covered log, holding the small fallen golden leaf close to their chest with both hands, the mustard-yellow backpack resting beside them on the log. The character's expression is calm, content, and quietly happy, looking gently off to the side with a soft smile.

COMPOSITION: Seated pose, full body visible including the backpack resting beside the character, no cropping of the head or hands, readable silhouette. ${textSafeLock('upper-right')} The illustration must contain absolutely no text, letters, words, or logos anywhere in the image.`;

const PROMPT_1 = [CHARACTER_BLOCK, STYLE_BLOCK, SCENE_1_DISCOVERY, NEGATIVE_BLOCK].join('\n\n');
const PROMPT_2 = [CHARACTER_BLOCK, STYLE_BLOCK, SCENE_2_INTERACTION, NEGATIVE_BLOCK].join('\n\n');
const PROMPT_3 = [CHARACTER_BLOCK, STYLE_BLOCK, SCENE_3_WONDER, NEGATIVE_BLOCK].join('\n\n');
const PROMPT_4 = [CHARACTER_BLOCK, STYLE_BLOCK, SCENE_4_RESOLUTION, NEGATIVE_BLOCK].join('\n\n');

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

async function runScene(label: string, prompt: string, filenamePrefix: string): Promise<GenerateImageResult & { savedPath?: string }> {
  const start = new Date();
  console.log(`${label}_START_TIME: ${start.toISOString()}`);
  const result = await generateImage({ prompt, ...GEN_CONFIG, n: 1 });
  const end = new Date();
  console.log(`${label}_END_TIME: ${end.toISOString()}`);
  report(label, result);
  if (result.success) {
    const savedPath = path.join(os.tmpdir(), `${filenamePrefix}-${Date.now()}.png`);
    fs.writeFileSync(savedPath, result.buffer);
    console.log(`${label}_LOCAL_TEMP_ARTIFACT_PATH: ${savedPath}`);
    return { ...result, savedPath };
  }
  return result;
}

async function main() {
  if (!isAzureImageConfigured()) {
    console.log('API_KEY_REQUIRED: YES');
    console.log('PLANNED_REQUEST_COUNT: 4 (not consumed — Azure gpt-image-2 is not configured)');
    process.exitCode = 1;
    return;
  }

  console.log('--- Story Sequence Pilot (Phase 4): planned configuration (safe summary, no credentials) ---');
  console.log('characterId: CHARACTER_PILOT_001 (locked), styleId: STORYBOOK_WATERCOLOR (locked)');
  console.log(`deployment: gpt-image-2, n: 1 per request, size: ${GEN_CONFIG.size}, quality: ${GEN_CONFIG.quality}, output_format: ${GEN_CONFIG.outputFormat}`);
  console.log('scenes: 1=DISCOVERY, 2=INTERACTION, 3=WONDER, 4=EMOTIONAL_RESOLUTION');
  console.log('PLANNED_REQUEST_COUNT: 4, MAX_REQUEST_COUNT: 4, RETRY_COUNT: 0');
  console.log('--------------------------------------------------------------------------------------------');

  // ---- Request #1: Scene 1 — DISCOVERY ----
  const r1 = await runScene('SCENE_1_DISCOVERY', PROMPT_1, 'cdc-book-story-scene-1-discovery');
  if (!r1.success) {
    console.log('STOPPING: Scene 1 failed — Scenes 2-4 will NOT be attempted.');
    process.exitCode = 1;
    return;
  }

  // ---- Request #2: Scene 2 — INTERACTION (only reached because Scene 1 succeeded) ----
  const r2 = await runScene('SCENE_2_INTERACTION', PROMPT_2, 'cdc-book-story-scene-2-interaction');
  if (!r2.success) {
    console.log('STOPPING: Scene 2 failed — Scenes 3-4 will NOT be attempted.');
    process.exitCode = 1;
    return;
  }

  // ---- Request #3: Scene 3 — WONDER (only reached because Scenes 1-2 succeeded) ----
  const r3 = await runScene('SCENE_3_WONDER', PROMPT_3, 'cdc-book-story-scene-3-wonder');
  if (!r3.success) {
    console.log('STOPPING: Scene 3 failed — Scene 4 will NOT be attempted.');
    process.exitCode = 1;
    return;
  }

  // ---- Request #4: Scene 4 — EMOTIONAL RESOLUTION (only reached because Scenes 1-3 succeeded) ----
  const r4 = await runScene('SCENE_4_RESOLUTION', PROMPT_4, 'cdc-book-story-scene-4-resolution');
  if (!r4.success) {
    console.log('Scene 4 failed — not retrying.');
    process.exitCode = 1;
    return;
  }

  console.log('All 4 scenes succeeded.');
}

main().catch((err) => {
  console.log('REQUEST_SUCCESS: false');
  console.log(`SAFE_ERROR_MESSAGE: ${err instanceof Error ? err.message : 'Unknown failure before/after an Azure call.'}`);
  process.exitCode = 1;
});
