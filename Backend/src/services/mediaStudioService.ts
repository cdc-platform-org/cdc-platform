import crypto from 'crypto';
import { callTextModelPlain, AiAgentError, GeminiFileRef } from './aiAgentService';
import { isSubtitlePipelineConfigured, extractAudio, uploadAudioAndWaitActive, deleteGeminiFile, unlinkSafe } from './subtitleService';
import { GEMINI_API_KEY } from '../utils/env';

// ============================================================
// AI Voice & Video Media Studio — Feature B: video/audio transcription +
// structured notes. Reuses subtitleService.ts's existing Gemini File API
// audio pipeline (ffmpeg extraction, upload-and-wait-active, cleanup)
// rather than re-implementing it — see that file's own header comment for
// why those pieces are exported for cross-feature reuse.
//
// Two independent input paths:
//  - An uploaded video/audio file: extract audio -> upload to Gemini's
//    File API -> transcribe/summarize from the resulting fileUri, exactly
//    like a lesson video's captions pipeline.
//  - A YouTube URL: Gemini's own video-understanding feature accepts a
//    public YouTube watch/shorts URL directly as a file_data.file_uri, no
//    download/ffmpeg/upload step at all. Confirmed live against this
//    project's own GEMINI_API_KEY (gemini-flash-lite-latest correctly
//    described the actual content of a known short public video) — see
//    aiAgentService.ts's GeminiFileRef comment for why mimeType is
//    deliberately omitted for this path.
//
// Unlike subtitleService's lesson pipeline, this does NOT translate the
// output into a fixed language set — the transcript is inherently tied to
// whatever language was actually spoken, and the notes are generated in
// that same detected language rather than a 3-way translation matrix
// (no product requirement for translated notes here, and it would roughly
// triple the Gemini cost of every request for a feature nobody asked for).
// ============================================================

const MAX_CONCURRENT_JOBS = 2;
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

export class MediaStudioError extends Error {
  status: number;
  constructor(message: string, status: number = 502) {
    super(message);
    this.name = 'MediaStudioError';
    this.status = status;
  }
}

// Upload path needs ffmpeg (audio extraction) on top of Gemini; the
// YouTube path doesn't touch ffmpeg at all, so it's configured whenever
// Gemini alone is available — a deployment with GEMINI_API_KEY set but no
// ffmpeg binary (unlikely, but see videoCompressionService.ts's own
// isFfmpegAvailable check) can still serve the YouTube path.
export function isMediaStudioUploadConfigured(): boolean {
  return isSubtitlePipelineConfigured();
}
export function isMediaStudioYoutubeConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

// Deliberately strict — this fileUri is handed straight to Gemini as a
// file_data reference. Without a tight allow-list, this endpoint would
// double as an open "make Gemini fetch and analyze any URL I give it"
// proxy for an authenticated user, which is not what a "paste a YouTube
// link" feature is supposed to expose.
const YOUTUBE_URL_PATTERN = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{6,}([?&].*)?$/i;

export function isValidYoutubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERN.test(url.trim());
}

function buildTranscriptPrompt(): string {
  return (
    `Produce a complete, accurate, word-for-word verbatim transcript of everything spoken in this video/audio. ` +
    `Preserve natural sentence and paragraph structure. Do not summarize, paraphrase, or omit any spoken content. ` +
    `If multiple distinct speakers are clearly audible, label them "Speaker 1:", "Speaker 2:", etc. at each turn — ` +
    `otherwise write plain paragraphs with no labels. Do not include timestamps. Respond with ONLY the transcript ` +
    `text, no preamble, no markdown code fences, no explanation of what you did.`
  );
}

function buildNotesPrompt(): string {
  return (
    `Watch/listen to this video and produce a clean, well-organized set of structured notes, in the same ` +
    `language the content is actually spoken in: a short summary paragraph first, then a "Key Points" section ` +
    `with bullet points covering the main ideas, then an "Action Points" section listing any concrete next ` +
    `steps, decisions, or to-dos mentioned (omit this section entirely if none were mentioned). Use markdown ` +
    `headings (##) and bullet points (-). Do not include filler talk or small talk. Respond with ONLY the notes, ` +
    `no preamble, no code fences, no explanation of what you did.`
  );
}

async function runTranscriptAndNotes(fileRef: GeminiFileRef): Promise<{ transcript: string; notes: string }> {
  let transcript: string;
  try {
    transcript = (await callTextModelPlain(buildTranscriptPrompt(), 0.1, fileRef)).trim();
  } catch (err) {
    throw new MediaStudioError(
      err instanceof AiAgentError ? `Transcription failed: ${err.message}` : 'Transcription failed.',
      err instanceof AiAgentError ? err.status : 502
    );
  }
  if (!transcript) throw new MediaStudioError('Gemini returned an empty transcript — the video may have no audible speech.', 422);

  let notes: string;
  try {
    notes = (await callTextModelPlain(buildNotesPrompt(), 0.2, fileRef)).trim();
  } catch (err) {
    // The transcript is still useful on its own — a notes failure
    // shouldn't discard it, same "partial success over total failure"
    // posture as subtitleService.ts's per-language failure handling.
    console.error('[mediaStudioService] notes generation failed:', err instanceof Error ? err.message : err);
    notes = '';
  }

  return { transcript, notes };
}

export async function transcribeFromYoutube(youtubeUrl: string): Promise<{ transcript: string; notes: string }> {
  if (!isMediaStudioYoutubeConfigured()) {
    throw new MediaStudioError('Video transcription is not configured (GEMINI_API_KEY missing).', 501);
  }
  if (!isValidYoutubeUrl(youtubeUrl)) {
    throw new MediaStudioError('Please provide a valid YouTube video URL (youtube.com/watch, youtube.com/shorts, or youtu.be).', 400);
  }

  await acquireSlot();
  try {
    return await runTranscriptAndNotes({ fileUri: youtubeUrl.trim() });
  } finally {
    releaseSlot();
  }
}

export async function transcribeFromUpload(videoBuffer: Buffer): Promise<{ transcript: string; notes: string }> {
  if (!isMediaStudioUploadConfigured()) {
    throw new MediaStudioError('Video transcription is not configured (GEMINI_API_KEY missing, or ffmpeg unavailable).', 501);
  }

  await acquireSlot();
  const jobId = crypto.randomUUID();
  let audioPath: string | null = null;
  let geminiFileName: string | null = null;
  try {
    audioPath = await extractAudio(videoBuffer, jobId);
    const uploadedFile = await uploadAudioAndWaitActive(audioPath);
    geminiFileName = uploadedFile.name;
    return await runTranscriptAndNotes({ mimeType: 'audio/mpeg', fileUri: uploadedFile.uri });
  } catch (err) {
    if (err instanceof MediaStudioError) throw err;
    throw new MediaStudioError(err instanceof Error ? `Could not process the uploaded video: ${err.message}` : 'Could not process the uploaded video.');
  } finally {
    releaseSlot();
    if (audioPath) await unlinkSafe(audioPath);
    if (geminiFileName) await deleteGeminiFile(geminiFileName);
  }
}
