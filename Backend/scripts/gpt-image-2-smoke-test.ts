// CLI: exactly ONE manually-triggered Azure gpt-image-2 smoke-test request.
// REQUEST_COUNT_LIMIT = 1 — no loop, no automatic retry. Saves the result
// as a local temp file only (os.tmpdir(), never under the repo, never
// uploaded anywhere) — this is a connectivity/quality QA artifact, not a
// product asset. Makes zero database writes and zero Azure Blob uploads.
//
// Usage (run from Backend/, requires AZURE_IMAGE_ENDPOINT/API_KEY/DEPLOYMENT
// already set in .env — the key must be added by a human, never invented):
//   npx ts-node scripts/gpt-image-2-smoke-test.ts
//
// Never logs: the API key, any Authorization header, or the base64 image
// payload — only safe structured metadata (see azureImageService.ts).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { isAzureImageConfigured, generateImage } from '../src/services/azureImageService';

// Deliberately generic/original — no real child, no photo, no copyrighted
// or franchise character, per the approved smoke-test content rules.
const SMOKE_TEST_PROMPT =
  'Create an original premium children\'s book illustration of a cheerful young explorer standing in a magical forest, full-body view, warm friendly expression, professional children\'s publishing quality, clean composition, original fictional character, no text, no logos, no copyrighted characters.';

// Cost-conscious: smallest square size and the cheapest gpt-image-1-series
// quality tier — this is a connectivity/format check, not a quality bar.
const SMOKE_TEST_CONFIG = {
  size: '1024x1024',
  quality: 'low',
  outputFormat: 'png',
} as const;

function pngLooksValid(buffer: Buffer): boolean {
  // PNG magic bytes — a cheap, dependency-free sanity check that what came
  // back is actually a decodable image file, not an empty/truncated blob.
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.length > PNG_MAGIC.length && buffer.subarray(0, 8).equals(PNG_MAGIC);
}

async function main() {
  if (!isAzureImageConfigured()) {
    console.log('API_KEY_REQUIRED: YES');
    console.log('Azure gpt-image-2 is not configured (AZURE_IMAGE_ENDPOINT/API_KEY/DEPLOYMENT missing from Backend/.env).');
    console.log('REQUEST_COUNT_LIMIT: 1 (not consumed — no request was sent).');
    process.exitCode = 1;
    return;
  }

  const startTime = new Date();
  console.log(`START_TIME: ${startTime.toISOString()}`);

  const result = await generateImage({ prompt: SMOKE_TEST_PROMPT, ...SMOKE_TEST_CONFIG, n: 1 });

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

  const valid = pngLooksValid(result.buffer);
  console.log(`IMAGE_VALID: ${valid}`);

  const outPath = path.join(os.tmpdir(), `cdc-gpt-image-2-smoke-test-${Date.now()}.png`);
  fs.writeFileSync(outPath, result.buffer);
  console.log(`LOCAL_TEMP_ARTIFACT_PATH: ${outPath}`);
}

main().catch((err) => {
  // Top-level safety net — never log the raw error object (could include
  // request/response headers); only its message.
  console.log('REQUEST_SUCCESS: false');
  console.log(`SAFE_ERROR_MESSAGE: ${err instanceof Error ? err.message : 'Unknown failure before/after the Azure call.'}`);
  process.exitCode = 1;
});
