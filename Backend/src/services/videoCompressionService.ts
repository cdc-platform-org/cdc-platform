import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

// `-movflags +faststart` moves the MP4 moov atom (metadata) to the front of
// the file so playback can start before the whole file has downloaded — but
// doing that requires ffmpeg to seek backward in the OUTPUT after encoding,
// which only works against a real seekable file, not a pipe/stream. That's
// why this service writes to temp files rather than streaming in-memory —
// it's the one setting in this spec that rules out the simpler pipe approach.
const isFfmpegAvailable = !!ffmpegPath && fs.existsSync(ffmpegPath);
if (isFfmpegAvailable) {
  ffmpeg.setFfmpegPath(ffmpegPath as string);
} else {
  // Not fatal — see shouldCompress()/compressVideoToFile() below, both of
  // which no-op instead of throwing when this is false. Logged once at
  // startup so a misconfigured host is obvious without every upload failing
  // silently into the logs.
  console.warn(
    '[videoCompressionService] ffmpeg binary not found (ffmpeg-static failed to resolve) — video compression is disabled; uploads will keep their original, uncompressed file.'
  );
}

export { isFfmpegAvailable };

// Below this, the compression pass isn't worth the CPU time — small clips
// are already close to their practical floor, and re-encoding risks making
// them *bigger* once container/codec overhead is counted.
const MIN_SIZE_TO_COMPRESS_BYTES = 10 * 1024 * 1024; // 10MB

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const CRF = 23; // middle of the 22–24 "web-optimal" range — crisp quality, ~70-80% smaller than typical camera-export bitrates

// fire-and-forget background compression has no queue to spread load across,
// so this is the only thing standing between "one big upload" and "N
// concurrent ffmpeg processes fighting over the same CPU" — caps how many
// run at once; anything beyond that just waits its turn.
const MAX_CONCURRENT_COMPRESSIONS = 2;
let activeCompressions = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeCompressions < MAX_CONCURRENT_COMPRESSIONS) {
    activeCompressions++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeCompressions++;
}

function releaseSlot(): void {
  activeCompressions--;
  const next = waitQueue.shift();
  if (next) next();
}

export function shouldCompress(buffer: Buffer): boolean {
  return isFfmpegAvailable && buffer.length >= MIN_SIZE_TO_COMPRESS_BYTES;
}

async function unlinkSafe(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch(() => {});
}

// Re-encodes a video buffer to a web-optimized H.264/AAC MP4 (CRF 23, capped
// at 1920x1080, +faststart) via temp files, and resolves with the compressed
// buffer. Rejects if ffmpeg fails for any reason (corrupt input, unsupported
// codec, binary missing, etc.) — callers should fall back to keeping the
// original on rejection rather than losing the upload.
export async function compressVideoBuffer(buffer: Buffer): Promise<Buffer> {
  if (!isFfmpegAvailable) {
    throw new Error('ffmpeg is not available on this host.');
  }

  await acquireSlot();
  const jobId = crypto.randomUUID();
  const inputPath = path.join(os.tmpdir(), `compress-in-${jobId}`);
  const outputPath = path.join(os.tmpdir(), `compress-out-${jobId}.mp4`);

  try {
    await fs.promises.writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-crf ${CRF}`,
          '-preset veryfast', // this runs in-process on a shared server, not a dedicated encoding box — favor throughput over ratio
          // Downscale only if larger than the cap in either dimension —
          // force_original_aspect_ratio=decrease keeps aspect ratio intact
          // and never upscales a smaller source.
          `-vf scale='min(${MAX_WIDTH},iw)':'min(${MAX_HEIGHT},ih)':force_original_aspect_ratio=decrease`,
          '-movflags +faststart',
        ])
        .format('mp4')
        .on('error', reject)
        .on('end', () => resolve())
        .save(outputPath);
    });

    return await fs.promises.readFile(outputPath);
  } finally {
    releaseSlot();
    await unlinkSafe(inputPath);
    await unlinkSafe(outputPath);
  }
}
