import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { GEMINI_API_KEY, BUNNY_CDN_HOSTNAME } from '../utils/env';
import { callTextModelPlain, AiAgentError } from './aiAgentService';
import { isFfmpegAvailable } from './videoCompressionService';
import { prisma } from '../lib/prisma';
import { uploadBunnyCaption } from './bunnyStreamService';

// ============================================================
// Automated 3-language (ka/en/ru) lesson subtitles AND conspectus —
// Gemini-powered, both produced from the same transcription pass.
//
// Pipeline: extract audio from the just-uploaded video buffer (ffmpeg,
// already a dependency — see videoCompressionService.ts) -> upload it to
// Gemini's File API (handles audio far larger than would fit inline in a
// single request, so no chunking is needed for anything in the realistic
// range of a course lesson) -> gemini-1.5-flash transcribes it directly into
// a WebVTT with timing cues and reports the detected spoken language ->
// gemini-1.5-flash translates that base VTT into whichever of ka/en/ru
// wasn't the detected language, with the timing cues preserved -> each
// language is uploaded to Bunny Stream via its Captions API. Bunny's own
// embed player shows the CC toggle automatically once captions exist — no
// custom player work needed.
//
// The conspectus stage reuses that same transcript rather than re-touching
// the audio: the plain-text transcript is fed to Gemini once more to
// extract only actionable takeaways/step-by-step details (filtering filler
// talk), in the detected language, then translated into whichever of
// ka/en/ru wasn't detected — same base-then-translate shape as the
// subtitles above, just for a summary instead of timed cues, and cheaper
// since it's a text-only call rather than a second audio upload. Tracked
// independently (Lesson.conspectusStatus/Error) so a conspectus failure
// never blocks subtitles succeeding, or vice versa.
//
// Fire-and-forget, no queue (same posture as videoCompressionService.ts) —
// triggered right after a successful lesson video upload, never blocks that
// request. A hard concurrency cap of 1 keeps a burst of uploads from running
// several ffmpeg extractions + paid Gemini calls in parallel.
// ============================================================

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as string);

// Only needed for the File API upload/polling now — every actual text
// generation call (transcription, translation, conspectus) goes through
// aiAgentService.callTextModelPlain(), which owns its own client/model-name/
// retry-sequence config in exactly one place (see that file's own comment).
// A temporary Gemini overload used to fail this entire pipeline outright;
// now each of those four calls gets the same 3-model retry chain the rest
// of the codebase's AI features already rely on.
const fileManager = GEMINI_API_KEY ? new GoogleAIFileManager(GEMINI_API_KEY) : null;

export function isSubtitlePipelineConfigured(): boolean {
  return !!GEMINI_API_KEY && isFfmpegAvailable;
}

// Exported — liveTrainingSynopsisService.ts reuses this exact language set/
// naming for its own per-language synopsis, so both features stay in sync
// if a language is ever added or renamed.
export const TARGET_LANGUAGES: { code: 'ka' | 'en' | 'ru'; label: string }[] = [
  { code: 'ka', label: 'ქართული' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

export const LANGUAGE_NAMES: Record<'ka' | 'en' | 'ru', string> = {
  ka: 'Georgian',
  en: 'English',
  ru: 'Russian',
};

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

export async function unlinkSafe(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch(() => {});
}

// Exported so liveTrainingSynopsisService.ts can release its own Gemini
// File API upload the same way this file's own pipeline does.
export async function deleteGeminiFile(name: string): Promise<void> {
  await fileManager!.deleteFile(name).catch(() => {});
}

// Extracts the video's audio track as a single low-bitrate mono MP3 — small
// enough to upload quickly, and speech-recognition accuracy doesn't need
// more than this. Exported — liveTrainingSynopsisService.ts reuses this
// exact extraction for a LiveTraining's recordingUrl.
export async function extractAudio(videoBuffer: Buffer, jobId: string): Promise<string> {
  const inputPath = path.join(os.tmpdir(), `subtitle-in-${jobId}`);
  const outputPath = path.join(os.tmpdir(), `subtitle-audio-${jobId}.mp3`);
  await fs.promises.writeFile(inputPath, videoBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioChannels(1)
        .audioBitrate(64)
        .format('mp3')
        .on('error', reject)
        .on('end', () => resolve())
        .save(outputPath);
    });
    return outputPath;
  } finally {
    await unlinkSafe(inputPath);
  }
}

// Uploads the audio to Gemini's File API and waits for it to leave
// PROCESSING state — files are typically ready within a few seconds for
// audio this size, but the API is async so this can't be assumed. Exported
// — liveTrainingSynopsisService.ts reuses this for its own recording audio.
export async function uploadAudioAndWaitActive(audioPath: string): Promise<{ uri: string; name: string }> {
  const uploaded = await fileManager!.uploadFile(audioPath, { mimeType: 'audio/mpeg' });
  let file = uploaded.file;
  const deadline = Date.now() + 60_000;
  while (file.state === FileState.PROCESSING && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    file = await fileManager!.getFile(file.name);
  }
  if (file.state === FileState.FAILED) {
    throw new Error('Gemini failed to process the uploaded audio file.');
  }
  if (file.state !== FileState.ACTIVE) {
    throw new Error('Timed out waiting for Gemini to finish processing the uploaded audio file.');
  }
  return { uri: file.uri, name: file.name };
}

function countCues(vtt: string): number {
  return (vtt.match(/-->/g) || []).length;
}

// Whichever of ka/en/ru was actually spoken doesn't need a translation
// pass — this parses the "LANGUAGE: xx" line the transcription prompt
// requires as its first line of output.
function parseLanguageCode(line: string): 'ka' | 'en' | 'ru' | null {
  const match = line.trim().match(/^LANGUAGE:\s*([a-zA-Z]{2,3})/i);
  if (!match) return null;
  const code = match[1].toLowerCase();
  return code === 'ka' || code === 'en' || code === 'ru' ? code : null;
}

interface TranscriptionResult {
  vtt: string;
  detectedCode: 'ka' | 'en' | 'ru' | null;
}

// Transcribes the uploaded audio directly into a timed WebVTT — a single
// multimodal call rather than a dedicated ASR API, so cue boundaries are
// Gemini's own segmentation rather than a purpose-built speech model's; the
// structural checks below (real WEBVTT header, at least one cue) are the
// safety net against a malformed response, not against imprecise timing.
async function transcribeAudioToVtt(fileUri: string): Promise<TranscriptionResult> {
  const prompt =
    `Listen to this audio and produce a complete, accurate transcript formatted as a valid WebVTT file. ` +
    `Break the transcript into natural speech-based cues (roughly 3-10 seconds each) with accurate timestamps ` +
    `matching the audio. Use the exact WebVTT cue format "HH:MM:SS.mmm --> HH:MM:SS.mmm" followed by the cue ` +
    `text, with a blank line between cues.\n\n` +
    `Respond with EXACTLY this shape and nothing else (no markdown code fences, no explanation):\n` +
    `LANGUAGE: <two-letter ISO 639-1 code of the spoken language>\n` +
    `WEBVTT\n\n` +
    `<cues>`;

  let raw: string;
  try {
    raw = (await callTextModelPlain(prompt, 0.2, { mimeType: 'audio/mpeg', fileUri })).trim();
  } catch (err) {
    throw new Error(err instanceof AiAgentError ? `Gemini transcription request failed: ${err.message}` : 'Gemini transcription request failed.');
  }

  const lines = raw.split('\n');
  const detectedCode = parseLanguageCode(lines[0] ?? '');
  const vtt = lines.slice(1).join('\n').trim().replace(/^```(?:vtt)?|```$/g, '').trim();

  if (!vtt.startsWith('WEBVTT') || countCues(vtt) === 0) {
    throw new Error('Gemini returned an unexpected transcription format (missing WEBVTT header or no cues).');
  }
  return { vtt, detectedCode };
}

// Translates cue TEXT only — timing lines, cue count, and the WEBVTT header
// must come back structurally identical, verified by countCues() below
// before this is trusted. A model that reformats/merges/drops cues would
// otherwise silently desync the captions from the audio.
async function translateVtt(baseVtt: string, targetCode: 'ka' | 'en' | 'ru'): Promise<string> {
  const prompt =
    `You are a professional subtitle translator. Below is a complete WebVTT file. Translate ONLY the spoken ` +
    `caption text into ${LANGUAGE_NAMES[targetCode]}. Do not change the "WEBVTT" header line. Do not change, ` +
    `merge, split, add, or remove any timestamp lines (lines containing "-->") — copy them exactly as given. ` +
    `Keep the exact same number of cues in the exact same order. Keep standard technical/IT terms that are ` +
    `normally used in English even in translated speech in English (e.g. "API", "SEO", "component"). Respond ` +
    `with ONLY the resulting VTT file content — no markdown code fences, no explanation, no extra text before ` +
    `or after.\n\n${baseVtt}`;

  let translated: string;
  try {
    translated = (await callTextModelPlain(prompt, 0.2)).trim().replace(/^```(?:vtt)?|```$/g, '').trim();
  } catch (err) {
    throw new Error(err instanceof AiAgentError ? `Gemini translation request failed: ${err.message}` : 'Gemini translation request failed.');
  }
  if (!translated.startsWith('WEBVTT') || countCues(translated) !== countCues(baseVtt)) {
    throw new Error(`Translated VTT for "${targetCode}" failed structural validation (cue count mismatch).`);
  }
  return translated;
}

// Strips VTT structure (header, cue timing lines, blank lines) down to the
// plain spoken text — the conspectus extraction below cares about content,
// not timing, so it reads far more naturally (and cheaply) as prose than as
// a cue-by-cue transcript.
function vttToPlainText(vtt: string): string {
  return vtt
    .split('\n')
    .filter((line) => line.trim() && line.trim() !== 'WEBVTT' && !line.includes('-->'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CONSPECTUS_FIELD: Record<'ka' | 'en' | 'ru', 'conspectusKa' | 'conspectusEn' | 'conspectusRu'> = {
  ka: 'conspectusKa',
  en: 'conspectusEn',
  ru: 'conspectusRu',
};

// Extracts the actionable-takeaways summary from the plain-text transcript,
// in whatever language that transcript is already in — filler talk,
// digressions, and small talk are deliberately excluded, per the "clean
// conspectus" requirement.
async function extractConspectus(transcriptText: string, languageName: string): Promise<string> {
  const prompt =
    `The following is a raw speech transcript (in ${languageName}) of a course lesson video. Produce a clean, ` +
    `well-organized "conspectus" (study notes) from it: extract ONLY actionable takeaways, step-by-step ` +
    `technical instructions, and core concept/feature explanations. Completely omit filler talk, small talk, ` +
    `verbal digressions, and anything not substantively teaching the viewer something. Use clear headings and ` +
    `bullet points where that helps readability. Write the conspectus in ${languageName} — do not translate it. ` +
    `Respond with ONLY the conspectus text (plain text or simple markdown — headings/bullets only, no code ` +
    `fences), no preamble, no explanation of what you did.\n\n${transcriptText}`;

  const text = (await callTextModelPlain(prompt, 0.2)).trim();
  if (!text) throw new Error('Gemini returned an empty conspectus.');
  return text;
}

// Same extraction prompt as extractConspectus above, but reads the audio
// directly via the Gemini File API instead of a pre-made transcript —
// liveTrainingSynopsisService.ts's own pipeline has no WebVTT/captions step
// to produce a transcript from (a LiveTraining isn't captioned), so this
// combines "transcribe" and "summarize" into the single call it actually
// needs, the same "LANGUAGE: xx" first-line convention as
// transcribeAudioToVtt for detecting the spoken language.
export async function extractConspectusFromAudio(fileUri: string): Promise<{ conspectus: string; detectedCode: 'ka' | 'en' | 'ru' | null }> {
  const prompt =
    `Listen to this audio recording of a live training session. Produce a clean, well-organized "conspectus" ` +
    `(study notes/synopsis) from it: extract ONLY actionable takeaways, step-by-step instructions, and core ` +
    `concept/feature explanations. Completely omit filler talk, small talk, verbal digressions, and anything not ` +
    `substantively teaching the listener something. Use clear headings and bullet points where that helps ` +
    `readability. Write the conspectus in the same language the audio is spoken in.\n\n` +
    `Respond with EXACTLY this shape and nothing else (no markdown code fences around the whole response, no ` +
    `explanation):\n` +
    `LANGUAGE: <two-letter ISO 639-1 code of the spoken language>\n` +
    `<conspectus text>`;

  const raw = (await callTextModelPlain(prompt, 0.2, { mimeType: 'audio/mpeg', fileUri })).trim();
  const lines = raw.split('\n');
  const detectedCode = parseLanguageCode(lines[0] ?? '');
  const conspectus = lines.slice(1).join('\n').trim();
  if (!conspectus) throw new Error('Gemini returned an empty conspectus.');
  return { conspectus, detectedCode };
}

// Simple prose translation — unlike translateVtt, there's no cue structure
// to preserve, just meaning and the same heading/bullet formatting.
// Exported — liveTrainingSynopsisService.ts reuses this verbatim.
export async function translateConspectus(baseConspectus: string, targetCode: 'ka' | 'en' | 'ru'): Promise<string> {
  const prompt =
    `Translate the following study notes ("conspectus") into ${LANGUAGE_NAMES[targetCode]}. Preserve the ` +
    `heading/bullet structure. Keep standard technical/IT terms that are normally used in English even in ` +
    `translated text (e.g. "API", "SEO", "component"). Respond with ONLY the translated text, no preamble.\n\n${baseConspectus}`;

  const translated = (await callTextModelPlain(prompt, 0.2)).trim();
  if (!translated) throw new Error(`Gemini returned an empty conspectus translation for "${targetCode}".`);
  return translated;
}

// Runs the extraction + per-language translation and persists the result.
// Wrapped in its own try/catch by the caller — a conspectus failure must
// never abort the subtitle pipeline it runs alongside, and vice versa.
async function processConspectus(lessonId: string, baseVtt: string, detectedCode: 'ka' | 'en' | 'ru' | null): Promise<void> {
  await prisma.lesson.update({ where: { id: lessonId }, data: { conspectusStatus: 'PROCESSING', conspectusError: null } });

  const sourceCode = detectedCode ?? 'en';
  const baseConspectus = await extractConspectus(vttToPlainText(baseVtt), LANGUAGE_NAMES[sourceCode]);

  const data: Record<string, string> = { [CONSPECTUS_FIELD[sourceCode]]: baseConspectus };
  const failures: string[] = [];
  let succeeded = 1;
  for (const { code } of TARGET_LANGUAGES) {
    if (code === sourceCode) continue;
    try {
      data[CONSPECTUS_FIELD[code]] = await translateConspectus(baseConspectus, code);
      succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      console.error(`[subtitleService] lesson ${lessonId}: conspectus "${code}" FAILED —`, message);
      failures.push(`${code}: ${message}`);
    }
  }

  if (succeeded === 0) {
    throw new Error(`All languages failed: ${failures.join('; ')}`);
  }
  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...data,
      conspectusStatus: 'COMPLETED',
      conspectusError: failures.length > 0 ? `Partial success — failed: ${failures.join('; ')}` : null,
    },
  });
}

// Entry point — called fire-and-forget right after a lesson video upload
// succeeds (see POST /lessons/:lessonId/video). Never throws: every failure
// path records subtitlesStatus/subtitlesError on the lesson instead, since
// this must never surface as an error on the upload request that triggered
// it (which has already responded by the time this runs).
export async function processLessonSubtitles(lessonId: string, videoId: string, videoBuffer: Buffer): Promise<void> {
  if (!isSubtitlePipelineConfigured()) {
    const notConfigured = 'Subtitle pipeline is not configured (GEMINI_API_KEY missing, or ffmpeg unavailable).';
    await prisma.lesson
      .update({
        where: { id: lessonId },
        data: {
          subtitlesStatus: 'FAILED',
          subtitlesError: notConfigured,
          conspectusStatus: 'FAILED',
          conspectusError: notConfigured,
        },
      })
      .catch(() => {});
    return;
  }

  await acquireSlot();
  const jobId = crypto.randomUUID();
  let audioPath: string | null = null;
  let geminiFileName: string | null = null;
  try {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { subtitlesStatus: 'PROCESSING', subtitlesError: null, conspectusStatus: 'PROCESSING', conspectusError: null },
    });

    audioPath = await extractAudio(videoBuffer, jobId);
    const uploadedFile = await uploadAudioAndWaitActive(audioPath);
    geminiFileName = uploadedFile.name;

    const { vtt: baseVtt, detectedCode } = await transcribeAudioToVtt(uploadedFile.uri);
    console.log(`[subtitleService] lesson ${lessonId}: transcribed ${countCues(baseVtt)} cues, detected language "${detectedCode ?? 'unknown'}".`);

    // Independent of the caption loop below — a conspectus failure must
    // never mark subtitles as failed, or vice versa (see processConspectus's
    // own comment). Not awaited-with-Promise.all alongside the caption loop
    // on purpose: keeping this sequential and separately try/caught makes
    // which stage failed unambiguous in the logs.
    try {
      await processConspectus(lessonId, baseVtt, detectedCode);
      console.log(`[subtitleService] lesson ${lessonId}: conspectus generated.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Conspectus generation failed.';
      console.error(`[subtitleService] lesson ${lessonId}: conspectus failed —`, message);
      await prisma.lesson
        .update({ where: { id: lessonId }, data: { conspectusStatus: 'FAILED', conspectusError: message.slice(0, 1000) } })
        .catch(() => {});
    }

    const failures: string[] = [];
    let succeeded = 0;
    for (const { code, label } of TARGET_LANGUAGES) {
      try {
        const vtt = code === detectedCode ? baseVtt : await translateVtt(baseVtt, code);
        await uploadBunnyCaption(videoId, code, label, vtt);
        succeeded += 1;
        console.log(`[subtitleService] lesson ${lessonId}: "${code}" caption uploaded to Bunny (${label}).`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        // Logged individually and immediately — previously only surfaced via
        // the aggregated subtitlesError DB field, so an en/ru-only failure
        // (course still marked COMPLETED, since ka succeeded) never showed
        // up in server logs at all until someone thought to check the DB.
        console.error(`[subtitleService] lesson ${lessonId}: "${code}" caption FAILED —`, message);
        failures.push(`${code}: ${message}`);
      }
    }

    if (succeeded === 0) {
      throw new Error(`All languages failed: ${failures.join('; ')}`);
    }
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        subtitlesStatus: 'COMPLETED',
        subtitlesError: failures.length > 0 ? `Partial success — failed: ${failures.join('; ')}` : null,
      },
    });
  } catch (err) {
    // Reaches here only for a failure before/outside the conspectus stage
    // (audio extraction, upload, or transcription itself) — those are
    // prerequisites conspectus also needs, so it's marked failed too. A
    // failure inside processConspectus itself is caught closer to its own
    // call and never reaches this block, so it can't overwrite a
    // conspectusStatus that already reached COMPLETED.
    const message = err instanceof Error ? err.message : 'Subtitle generation failed.';
    console.error(`[subtitleService] lesson ${lessonId} failed:`, message);
    await prisma.lesson
      .update({
        where: { id: lessonId },
        data: { subtitlesStatus: 'FAILED', subtitlesError: message.slice(0, 1000), conspectusStatus: 'FAILED', conspectusError: message.slice(0, 1000) },
      })
      .catch(() => {});
  } finally {
    releaseSlot();
    if (audioPath) await unlinkSafe(audioPath);
    if (geminiFileName) await fileManager!.deleteFile(geminiFileName).catch(() => {});
  }
}

export class SourceVideoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceVideoUnavailableError';
  }
}

// Re-runs the pipeline for a lesson whose video was already uploaded to
// Bunny (the original upload buffer only ever existed in-memory for that
// one request — never persisted on our side — so this re-downloads the
// video from Bunny's own CDN instead). Requires BUNNY_CDN_HOSTNAME and the
// library's "MP4 Fallback" storage option to be enabled — that's what
// actually generates the play_720p.mp4 file this fetches; 720p is plenty
// for extracting an audio track and keeps the download small.
export async function regenerateLessonSubtitles(lessonId: string, videoId: string): Promise<void> {
  if (!BUNNY_CDN_HOSTNAME) {
    throw new SourceVideoUnavailableError('BUNNY_CDN_HOSTNAME is not configured — cannot fetch the source video back from Bunny.');
  }
  const url = `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_720p.mp4`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new SourceVideoUnavailableError(
      `Could not fetch the source video from Bunny (${response.status}) at ${url} — MP4 Fallback may not be enabled on this Stream library.`
    );
  }
  const videoBuffer = Buffer.from(await response.arrayBuffer());
  console.log(`[subtitleService] lesson ${lessonId}: re-fetched ${videoBuffer.length} bytes from Bunny for subtitle regeneration.`);
  await processLessonSubtitles(lessonId, videoId, videoBuffer);
}
