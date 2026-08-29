import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import {
  isSubtitlePipelineConfigured,
  extractAudio,
  uploadAudioAndWaitActive,
  deleteGeminiFile,
  unlinkSafe,
  extractConspectusFromAudio,
  translateConspectus,
  TARGET_LANGUAGES,
} from './subtitleService';

// ============================================================
// LiveTraining "conspectus" (AI synopsis) — same underlying pipeline as
// Lesson subtitles/conspectus (subtitleService.ts), reused rather than
// reimplemented: ffmpeg audio extraction, Gemini File API upload, and the
// extract-then-translate-to-the-other-two-languages shape. The one real
// difference is the source step — a Lesson upload hands this an in-memory
// video buffer directly; a LiveTraining only has recordingUrl, an
// admin-pasted external link (Drive/Bunny/direct MP4/etc.), so this fetches
// that URL itself first. There is also no captions/WebVTT step at all — a
// LiveTraining isn't shown through a captioned player, so
// extractConspectusFromAudio() summarizes the audio directly in one call
// rather than transcribing to VTT first and summarizing that transcript
// (see that function's own comment for why the two features' pipelines
// diverge at that exact point).
//
// Fire-and-forget, no queue — triggered right after an admin sets/updates
// recordingUrl (routes/adminLiveTrainings.ts), never blocks that request.
// Own concurrency gate, independent of subtitleService.ts's — LiveTraining
// recording uploads are a rare, admin-only action (nothing like the
// potential burst of concurrent lesson-video uploads that gate protects
// against), so sharing state across the two files wasn't worth the coupling.
// ============================================================

const MAX_CONCURRENT_JOBS = 1;
let activeJobs = 0;
const waitQueue: Array<() => void> = [];
async function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT_JOBS) {
    activeJobs++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeJobs++;
}
function releaseSlot(): void {
  activeJobs--;
  const next = waitQueue.shift();
  if (next) next();
}

const SYNOPSIS_FIELD: Record<'ka' | 'en' | 'ru', 'synopsisKa' | 'synopsisEn' | 'synopsisRu'> = {
  ka: 'synopsisKa',
  en: 'synopsisEn',
  ru: 'synopsisRu',
};

export function isLiveTrainingSynopsisConfigured(): boolean {
  return isSubtitlePipelineConfigured();
}

// Entry point — called fire-and-forget whenever an admin sets/changes
// recordingUrl on a LiveTraining. Never throws: every failure path records
// synopsisStatus/synopsisError on the row instead, since this runs after
// the admin's save request has already responded.
export async function processLiveTrainingSynopsis(liveTrainingId: string, recordingUrl: string): Promise<void> {
  if (!isLiveTrainingSynopsisConfigured()) {
    const notConfigured = 'Synopsis pipeline is not configured (GEMINI_API_KEY missing, or ffmpeg unavailable).';
    await prisma.liveTraining
      .update({ where: { id: liveTrainingId }, data: { synopsisStatus: 'FAILED', synopsisError: notConfigured } })
      .catch(() => {});
    return;
  }

  await acquireSlot();
  const jobId = crypto.randomUUID();
  let audioPath: string | null = null;
  let geminiFileName: string | null = null;
  try {
    await prisma.liveTraining.update({
      where: { id: liveTrainingId },
      data: { synopsisStatus: 'PROCESSING', synopsisError: null },
    });

    // recordingUrl is a plain admin-pasted link, not something already in
    // memory the way a fresh lesson-video upload is — has to be fetched
    // first. Works for a direct MP4/Bunny link; a Google Drive "share" URL
    // needs its own export/download URL format, which this deliberately
    // doesn't attempt to resolve (out of scope — same posture as not
    // building a real Zoom/Meet API integration for meetingUrl).
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      throw new Error(`Could not download the recording (HTTP ${response.status}) from the URL on file.`);
    }
    const videoBuffer = Buffer.from(await response.arrayBuffer());

    // extractAudio writes/cleans up its own temp input file — no need to
    // persist the raw download separately.
    audioPath = await extractAudio(videoBuffer, jobId);
    const uploadedFile = await uploadAudioAndWaitActive(audioPath);
    geminiFileName = uploadedFile.name;

    const { conspectus: baseSynopsis, detectedCode } = await extractConspectusFromAudio(uploadedFile.uri);
    console.log(`[liveTrainingSynopsisService] training ${liveTrainingId}: synopsis generated, detected language "${detectedCode ?? 'unknown'}".`);

    const sourceCode = detectedCode ?? 'en';
    const data: Record<string, string> = { [SYNOPSIS_FIELD[sourceCode]]: baseSynopsis };
    const failures: string[] = [];
    let succeeded = 1;
    for (const { code } of TARGET_LANGUAGES) {
      if (code === sourceCode) continue;
      try {
        data[SYNOPSIS_FIELD[code]] = await translateConspectus(baseSynopsis, code);
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        console.error(`[liveTrainingSynopsisService] training ${liveTrainingId}: synopsis "${code}" FAILED —`, message);
        failures.push(`${code}: ${message}`);
      }
    }

    if (succeeded === 0) {
      throw new Error(`All languages failed: ${failures.join('; ')}`);
    }
    await prisma.liveTraining.update({
      where: { id: liveTrainingId },
      data: {
        ...data,
        synopsisStatus: 'COMPLETED',
        synopsisError: failures.length > 0 ? `Partial success — failed: ${failures.join('; ')}` : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Synopsis generation failed.';
    console.error(`[liveTrainingSynopsisService] training ${liveTrainingId} failed:`, message);
    await prisma.liveTraining
      .update({ where: { id: liveTrainingId }, data: { synopsisStatus: 'FAILED', synopsisError: message.slice(0, 1000) } })
      .catch(() => {});
  } finally {
    releaseSlot();
    if (audioPath) await unlinkSafe(audioPath);
    if (geminiFileName) await deleteGeminiFile(geminiFileName);
  }
}
