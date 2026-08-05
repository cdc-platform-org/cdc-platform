import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { OPENAI_API_KEY } from '../utils/env';
import { isFfmpegAvailable } from './videoCompressionService';
import { prisma } from '../lib/prisma';
import { uploadBunnyCaption } from './bunnyStreamService';

// ============================================================
// Automated 3-language (ka/en/ru) lesson subtitles.
//
// Pipeline: extract audio from the just-uploaded video buffer (ffmpeg,
// already a dependency — see videoCompressionService.ts) -> transcribe with
// OpenAI Whisper (chunked if the compressed audio would exceed Whisper's
// 25MB request limit) -> build a WebVTT from the returned segments ->
// translate that base VTT into whichever of ka/en/ru wasn't the detected
// spoken language, with GPT-4o-mini -> upload each language to Bunny Stream
// via its Captions API (uploadBunnyCaption). Bunny's own embed player shows
// the CC toggle automatically once captions exist for a video — no custom
// player work needed.
//
// Fire-and-forget, no queue (same posture as videoCompressionService.ts) —
// triggered right after a successful lesson video upload, never blocks that
// request. A hard concurrency cap of 1 keeps a burst of uploads from running
// several ffmpeg extractions + paid OpenAI calls in parallel.
// ============================================================

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as string);

export function isSubtitlePipelineConfigured(): boolean {
  return !!OPENAI_API_KEY && isFfmpegAvailable;
}

const TARGET_LANGUAGES: { code: 'ka' | 'en' | 'ru'; label: string }[] = [
  { code: 'ka', label: 'ქართული' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

// Whisper API's hard cap is 25MB per request — stay comfortably under it so
// container/encoding overhead never tips a chunk over the line.
const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
// 64kbps mono is plenty for speech-recognition accuracy and keeps file size
// low: ~480KB/minute, so a chunk can safely run ~45 minutes before nearing
// the cap above.
const AUDIO_BITRATE_KBPS = 64;

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

function getAudioDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration ?? 0);
    });
  });
}

// Extracts the video's audio track as a single low-bitrate mono MP3 — the
// starting point before deciding whether it needs splitting into chunks.
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
        .audioBitrate(AUDIO_BITRATE_KBPS)
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

// Cuts one audio file into N roughly-equal chunks, each safely under
// WHISPER_MAX_BYTES, re-encoding at the same fixed bitrate so each chunk's
// size is predictable from its duration alone.
async function splitAudioIntoChunks(audioPath: string, jobId: string): Promise<{ path: string; startOffsetSeconds: number }[]> {
  const stat = await fs.promises.stat(audioPath);
  if (stat.size <= WHISPER_MAX_BYTES) {
    return [{ path: audioPath, startOffsetSeconds: 0 }];
  }

  const totalDuration = await getAudioDurationSeconds(audioPath);
  const chunkCount = Math.ceil(stat.size / WHISPER_MAX_BYTES);
  const chunkDuration = totalDuration / chunkCount;

  const chunks: { path: string; startOffsetSeconds: number }[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const startOffsetSeconds = i * chunkDuration;
    const chunkPath = path.join(os.tmpdir(), `subtitle-chunk-${jobId}-${i}.mp3`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(audioPath)
        .setStartTime(startOffsetSeconds)
        .setDuration(chunkDuration)
        .audioCodec('libmp3lame')
        .audioChannels(1)
        .audioBitrate(AUDIO_BITRATE_KBPS)
        .format('mp3')
        .on('error', reject)
        .on('end', () => resolve())
        .save(chunkPath);
    });
    chunks.push({ path: chunkPath, startOffsetSeconds });
  }
  return chunks;
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperResult {
  language: string;
  segments: WhisperSegment[];
}

async function transcribeChunk(chunkPath: string): Promise<WhisperResult> {
  const buffer = await fs.promises.readFile(chunkPath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'audio/mpeg' }), 'audio.mp3');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI Whisper request failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as {
    language: string;
    segments: { start: number; end: number; text: string }[];
  };
  return {
    language: data.language,
    segments: data.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })),
  };
}

function formatVttTimestamp(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function buildVtt(segments: WhisperSegment[]): string {
  const cues = segments
    .filter((s) => s.text.length > 0)
    .map((s) => `${formatVttTimestamp(s.start)} --> ${formatVttTimestamp(s.end)}\n${s.text}`)
    .join('\n\n');
  return `WEBVTT\n\n${cues}\n`;
}

function countCues(vtt: string): number {
  return (vtt.match(/-->/g) || []).length;
}

// OpenAI's detected-language field is a full name ("georgian"/"english"/
// "russian"), not an ISO code — mapped so the pipeline can skip re-
// translating into the language that was actually spoken. Unrecognized
// values fall through to "translate into all three", the safe default.
function detectedLanguageToCode(language: string): 'ka' | 'en' | 'ru' | null {
  const normalized = language.trim().toLowerCase();
  if (normalized === 'georgian') return 'ka';
  if (normalized === 'english') return 'en';
  if (normalized === 'russian') return 'ru';
  return null;
}

const LANGUAGE_NAMES: Record<'ka' | 'en' | 'ru', string> = {
  ka: 'Georgian',
  en: 'English',
  ru: 'Russian',
};

// Translates cue TEXT only — timing lines, cue count, and the WEBVTT header
// must come back byte-for-byte structurally identical, verified by
// countCues() below before this is trusted. A model that reformats/merges/
// drops cues would otherwise silently desync the captions from the audio.
async function translateVtt(baseVtt: string, targetCode: 'ka' | 'en' | 'ru'): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            `You are a professional subtitle translator. You will receive a complete WebVTT file. ` +
            `Translate ONLY the spoken caption text into ${LANGUAGE_NAMES[targetCode]}. ` +
            `Do not change the "WEBVTT" header line. Do not change, merge, split, add, or remove any timestamp lines ` +
            `(lines containing "-->") — copy them exactly as given. Keep the exact same number of cues in the exact ` +
            `same order. Keep standard technical/IT terms that are normally used in English even in translated ` +
            `speech in English (e.g. "API", "SEO", "component"). Return ONLY the resulting VTT file content — no ` +
            `markdown code fences, no explanation, no extra text before or after.`,
        },
        { role: 'user', content: baseVtt },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI translation request failed (${response.status}): ${body}`);
  }
  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  const translated = data.choices[0]?.message?.content?.trim() ?? '';
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
          subtitlesError: 'Subtitle pipeline is not configured (OPENAI_API_KEY missing, or ffmpeg unavailable).',
        },
      })
      .catch(() => {});
    return;
  }

  await acquireSlot();
  const jobId = crypto.randomUUID();
  const tempFiles: string[] = [];
  try {
    await prisma.lesson.update({ where: { id: lessonId }, data: { subtitlesStatus: 'PROCESSING', subtitlesError: null } });

    const audioPath = await extractAudio(videoBuffer, jobId);
    tempFiles.push(audioPath);
    const chunks = await splitAudioIntoChunks(audioPath, jobId);
    chunks.forEach((c) => {
      if (c.path !== audioPath) tempFiles.push(c.path);
    });

    const allSegments: WhisperSegment[] = [];
    let detectedLanguage = '';
    for (const chunk of chunks) {
      const result = await transcribeChunk(chunk.path);
      if (!detectedLanguage) detectedLanguage = result.language;
      for (const seg of result.segments) {
        allSegments.push({ start: seg.start + chunk.startOffsetSeconds, end: seg.end + chunk.startOffsetSeconds, text: seg.text });
      }
    }

    const baseVtt = buildVtt(allSegments);
    if (countCues(baseVtt) === 0) {
      throw new Error('Transcription produced no speech segments (silent or unsupported audio track).');
    }
    const spokenCode = detectedLanguageToCode(detectedLanguage);

    const failures: string[] = [];
    let succeeded = 0;
    for (const { code, label } of TARGET_LANGUAGES) {
      try {
        const vtt = code === spokenCode ? baseVtt : await translateVtt(baseVtt, code);
        await uploadBunnyCaption(videoId, code, label, vtt);
        succeeded += 1;
      } catch (err) {
        failures.push(`${code}: ${err instanceof Error ? err.message : 'unknown error'}`);
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
    await Promise.all(tempFiles.map(unlinkSafe));
  }
}
