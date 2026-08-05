import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { GEMINI_API_KEY, BUNNY_CDN_HOSTNAME } from '../utils/env';
import { isFfmpegAvailable } from './videoCompressionService';
import { prisma } from '../lib/prisma';
import { uploadBunnyCaption } from './bunnyStreamService';

// ============================================================
// Automated 3-language (ka/en/ru) lesson subtitles — Gemini-powered.
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
// Fire-and-forget, no queue (same posture as videoCompressionService.ts) —
// triggered right after a successful lesson video upload, never blocks that
// request. A hard concurrency cap of 1 keeps a burst of uploads from running
// several ffmpeg extractions + paid Gemini calls in parallel.
// ============================================================

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as string);

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const fileManager = GEMINI_API_KEY ? new GoogleAIFileManager(GEMINI_API_KEY) : null;

// "gemini-1.5-flash" (the model this pipeline was originally specced with)
// no longer exists on this Google Cloud project's API — confirmed via a
// live ListModels call and a direct generateContent 404. "gemini-2.5-pro"/
// "gemini-pro-latest" also return a hard 0 free-tier quota here (see
// aiExamService.ts). gemini-flash-latest is the same model already proven
// working (and multimodal — accepts audio input) for exam generation.
const MODEL_NAME = 'gemini-flash-latest';

export function isSubtitlePipelineConfigured(): boolean {
  return !!GEMINI_API_KEY && isFfmpegAvailable;
}

const TARGET_LANGUAGES: { code: 'ka' | 'en' | 'ru'; label: string }[] = [
  { code: 'ka', label: 'ქართული' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

const LANGUAGE_NAMES: Record<'ka' | 'en' | 'ru', string> = {
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

async function unlinkSafe(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch(() => {});
}

// Extracts the video's audio track as a single low-bitrate mono MP3 — small
// enough to upload quickly, and speech-recognition accuracy doesn't need
// more than this.
async function extractAudio(videoBuffer: Buffer, jobId: string): Promise<string> {
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
// audio this size, but the API is async so this can't be assumed.
async function uploadAudioAndWaitActive(audioPath: string): Promise<{ uri: string; name: string }> {
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
  const model = client!.getGenerativeModel({ model: MODEL_NAME, generationConfig: { temperature: 0.2 } });
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
    const result = await model.generateContent([{ fileData: { mimeType: 'audio/mpeg', fileUri } }, { text: prompt }]);
    raw = result.response.text().trim();
  } catch (err) {
    throw new Error(err instanceof Error ? `Gemini transcription request failed: ${err.message}` : 'Gemini transcription request failed.');
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
  const model = client!.getGenerativeModel({ model: MODEL_NAME, generationConfig: { temperature: 0.2 } });
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
    const result = await model.generateContent(prompt);
    translated = result.response.text().trim().replace(/^```(?:vtt)?|```$/g, '').trim();
  } catch (err) {
    throw new Error(err instanceof Error ? `Gemini translation request failed: ${err.message}` : 'Gemini translation request failed.');
  }
  if (!translated.startsWith('WEBVTT') || countCues(translated) !== countCues(baseVtt)) {
    throw new Error(`Translated VTT for "${targetCode}" failed structural validation (cue count mismatch).`);
  }
  return translated;
}

// Entry point — called fire-and-forget right after a lesson video upload
// succeeds (see POST /lessons/:lessonId/video). Never throws: every failure
// path records subtitlesStatus/subtitlesError on the lesson instead, since
// this must never surface as an error on the upload request that triggered
// it (which has already responded by the time this runs).
export async function processLessonSubtitles(lessonId: string, videoId: string, videoBuffer: Buffer): Promise<void> {
  if (!isSubtitlePipelineConfigured()) {
    await prisma.lesson
      .update({
        where: { id: lessonId },
        data: {
          subtitlesStatus: 'FAILED',
          subtitlesError: 'Subtitle pipeline is not configured (GEMINI_API_KEY missing, or ffmpeg unavailable).',
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
    await prisma.lesson.update({ where: { id: lessonId }, data: { subtitlesStatus: 'PROCESSING', subtitlesError: null } });

    audioPath = await extractAudio(videoBuffer, jobId);
    const uploadedFile = await uploadAudioAndWaitActive(audioPath);
    geminiFileName = uploadedFile.name;

    const { vtt: baseVtt, detectedCode } = await transcribeAudioToVtt(uploadedFile.uri);
    console.log(`[subtitleService] lesson ${lessonId}: transcribed ${countCues(baseVtt)} cues, detected language "${detectedCode ?? 'unknown'}".`);

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
    const message = err instanceof Error ? err.message : 'Subtitle generation failed.';
    console.error(`[subtitleService] lesson ${lessonId} failed:`, message);
    await prisma.lesson
      .update({ where: { id: lessonId }, data: { subtitlesStatus: 'FAILED', subtitlesError: message.slice(0, 1000) } })
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
