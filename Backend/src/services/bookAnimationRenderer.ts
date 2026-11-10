// ============================================================
// Children's Book animation — the ffmpeg renderer. Pure media work: takes
// page images, optional Sora clips and narration audio, and returns one
// 1280x720 H.264/AAC MP4. No database, no storage — that is the job
// service's part (bookAnimationService.ts), which keeps this testable with
// local files only (see __tests__/bookAnimationRenderer.test.ts).
//
// Pipeline:
//   1. every illustration is composed onto a 16:9 frame with a blurred,
//      darkened copy of itself as the background (sharp), so portrait and
//      square pictures keep their aspect;
//   2. each segment is rendered on its own: Ken Burns (zoompan) on the
//      still, or the Sora clip (its audio dropped) held on the last frame
//      when the narration runs longer; the page text as a subtitle bar,
//      the title on the cover;
//   3. one final pass joins the segments with xfade transitions, places
//      each narration at its timeline position, ducks the music under it
//      and writes a +faststart MP4.
// ============================================================

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import {
  KenBurnsVariant,
  SegmentKind,
  Timeline,
  TimelineSegment,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  buildTimeline,
  round3,
  wrapSubtitle,
} from './bookAnimationPlan';
import { MusicTheme, synthesizeMusicWav } from './bookAnimationMusic';
import { woffToSfnt } from './woffToSfnt';

export interface RenderSegmentInput {
  kind: SegmentKind;
  pageNumber: number;
  image: Buffer;
  soraClip?: Buffer | null;
  narration?: Buffer | null;
  // Shown as the subtitle bar (pages) or the big title (cover).
  text?: string | null;
}

export interface RenderOptions {
  workDir: string;
  segments: RenderSegmentInput[];
  music?: MusicTheme | null;
  subtitles?: boolean;
  // Parallel segment renders (each ffmpeg is itself multi-threaded).
  concurrency?: number;
  // Faster/lower quality encode for tests.
  draft?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface RenderResult {
  outputPath: string;
  duration: number;
  timeline: Timeline;
}

// Ken Burns works on a 2x still so the zoompan's integer crop steps don't
// jitter visibly at the 1280x720 output.
const KB_SCALE = 2;
const MUSIC_VOLUME = 0.22;

export function ffmpegBinary(): string {
  const bin = process.env.FFMPEG_PATH || (ffmpegPath as unknown as string | null);
  if (!bin || (!process.env.FFMPEG_PATH && !fs.existsSync(bin))) throw new Error('ffmpeg binary not found (ffmpeg-static did not resolve).');
  return bin;
}

export function runFfmpeg(args: string[], cwd: string, timeoutMs = 15 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary(), ['-hide_banner', '-nostdin', '-y', ...args], { cwd, windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited with ${code}: ${stderr.split('\n').filter((l) => !/^Fontconfig/.test(l)).slice(-8).join(' | ')}`));
    });
  });
}

// Media duration in seconds from ffmpeg's own banner (ffmpeg-static ships
// no ffprobe). 0 when unknown.
export async function probeDurationSeconds(file: string, cwd: string): Promise<number> {
  const out = await runFfmpeg(['-i', file, '-f', 'null', '-'], cwd).catch((err: Error) => err.message);
  // "time=" of the decode pass is exact; the header Duration is a fallback.
  const times = [...out.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const match = times.length ? times[times.length - 1] : out.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return round3(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]));
}

// The illustration on a 16:9 canvas: foreground fitted (aspect kept), the
// rest filled with a blurred, slightly darkened copy of the same picture.
export async function composeFrame(image: Buffer, width: number, height: number, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
  const background = await sharp(image)
    .resize(Math.round(width / 10), Math.round(height / 10), { fit: 'cover' })
    .blur(9)
    .modulate({ brightness: 0.7, saturation: 1.1 })
    .resize(width, height, { kernel: 'cubic' })
    .toBuffer();
  const margin = Math.round(height * 0.03);
  const foreground = await sharp(image)
    .resize(width - margin * 2, height - margin * 2, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((width - foreground.info.width) / 2);
  const top = Math.round((height - foreground.info.height) / 2);
  const composed = sharp(background).composite([{ input: foreground.data, left, top }]);
  return format === 'jpeg' ? composed.jpeg({ quality: 92 }).toBuffer() : composed.png({ compressionLevel: 3 }).toBuffer();
}

function kenBurnsFilter(variant: KenBurnsVariant, frames: number): string {
  const n = Math.max(1, frames - 1);
  const center = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'";
  switch (variant) {
    case 'zoom-in':
      return `zoompan=z='1+0.14*on/${n}':${center}`;
    case 'zoom-out':
      return `zoompan=z='1.14-0.14*on/${n}':${center}`;
    case 'pan-right':
      return `zoompan=z='1.12':x='(iw-iw/zoom)*on/${n}':y='ih/2-(ih/zoom/2)'`;
    case 'pan-left':
    default:
      return `zoompan=z='1.12':x='(iw-iw/zoom)*(1-on/${n})':y='ih/2-(ih/zoom/2)'`;
  }
}

// Text overlays. Text goes through files (textfile=) so no user text is
// ever spliced into the filter graph itself.
function overlayFilters(segment: TimelineSegment, input: RenderSegmentInput, textFile: string | null, subtitles: boolean): string[] {
  if (!textFile) return [];
  if (segment.kind === 'cover') {
    return [
      `drawtext=fontfile=font-bold.ttf:textfile=${textFile}:fontsize=58:fontcolor=white:line_spacing=12:x=(w-text_w)/2:y=h*0.08:borderw=3:bordercolor=black@0.55:shadowx=2:shadowy=3:shadowcolor=black@0.5:alpha='min(1,t/1.2)'`,
    ];
  }
  if (!subtitles || !input.text) return [];
  const bar = 132;
  return [
    `drawbox=x=0:y=ih-${bar}:w=iw:h=${bar}:color=black@0.42:t=fill`,
    `drawtext=fontfile=font.ttf:textfile=${textFile}:fontsize=29:fontcolor=white:line_spacing=9:x=(w-text_w)/2:y=h-${bar}+(${bar}-text_h)/2:shadowx=1:shadowy=1:shadowcolor=black@0.6`,
  ];
}

async function renderSegment(
  workDir: string,
  segment: TimelineSegment,
  input: RenderSegmentInput,
  subtitles: boolean,
  draft: boolean
): Promise<string> {
  const id = String(segment.index).padStart(2, '0');
  const out = `seg-${id}.mp4`;
  const frames = Math.round(segment.duration * VIDEO_FPS);

  let textFile: string | null = null;
  const text = (input.text ?? '').trim();
  if (text) {
    textFile = `text-${id}.txt`;
    const lines = segment.kind === 'cover' ? wrapSubtitle(text, 30, 3) : wrapSubtitle(text, 70, 3);
    await fs.promises.writeFile(path.join(workDir, textFile), lines.join('\n'), 'utf8');
  }
  const overlays = overlayFilters(segment, input, textFile, subtitles);
  const encode = ['-c:v', 'libx264', '-preset', draft ? 'ultrafast' : 'veryfast', '-crf', draft ? '26' : '18', '-pix_fmt', 'yuv420p', '-r', String(VIDEO_FPS), '-frames:v', String(frames), '-an', out];

  if (segment.motion === 'sora' && input.soraClip) {
    const clip = `sora-${id}.mp4`;
    await fs.promises.writeFile(path.join(workDir, clip), input.soraClip);
    const vf = [
      `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase`,
      `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}`,
      `fps=${VIDEO_FPS}`,
      'setsar=1',
      `tpad=stop_mode=clone:stop_duration=${Math.ceil(segment.duration) + 1}`,
      `trim=duration=${segment.duration}`,
      'setpts=PTS-STARTPTS',
      ...overlays,
      'format=yuv420p',
    ].join(',');
    // -an: Sora's own soundtrack is always dropped.
    await runFfmpeg(['-i', clip, '-an', '-vf', vf, ...encode], workDir);
    return out;
  }

  const still = `still-${id}.png`;
  await fs.promises.writeFile(path.join(workDir, still), await composeFrame(input.image, VIDEO_WIDTH * KB_SCALE, VIDEO_HEIGHT * KB_SCALE));
  const vf = [
    `${kenBurnsFilter(segment.kenBurns, frames)}:d=${frames}:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:fps=${VIDEO_FPS}`,
    'setsar=1',
    ...overlays,
    'format=yuv420p',
  ].join(',');
  await runFfmpeg(['-i', still, '-vf', vf, ...encode], workDir);
  return out;
}

const TRANSITIONS = ['fade', 'smoothleft', 'fade', 'circleopen'];

// The final filter graph: xfade chain for the video, delayed narrations
// mixed together, music ducked under the narration.
export function buildAssemblyGraph(timeline: Timeline, narrationInputs: Array<{ inputIndex: number; delayMs: number }>, musicInputIndex: number | null): { graph: string; videoLabel: string; audioLabel: string | null } {
  const parts: string[] = [];
  const segs = timeline.segments;
  let prev = '0:v';
  segs.forEach((segment, i) => {
    if (i === 0) return;
    const label = `v${i}`;
    const transition = segment.kind === 'page' && segs[i - 1].kind === 'cover' ? 'fade' : TRANSITIONS[i % TRANSITIONS.length];
    parts.push(`[${prev}][${i}:v]xfade=transition=${transition}:duration=${timeline.transition}:offset=${segment.xfadeOffset}[${label}]`);
    prev = label;
  });
  const fadeStart = Math.max(0, round3(timeline.totalDuration - 1.2));
  parts.push(`[${prev}]fade=t=out:st=${fadeStart}:d=1.2,format=yuv420p[vout]`);

  let audioLabel: string | null = null;
  if (narrationInputs.length) {
    narrationInputs.forEach((n, k) => {
      parts.push(`[${n.inputIndex}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${n.delayMs}|${n.delayMs}[n${k}]`);
    });
    const mixInputs = narrationInputs.map((_, k) => `[n${k}]`).join('');
    parts.push(narrationInputs.length > 1 ? `${mixInputs}amix=inputs=${narrationInputs.length}:duration=longest:normalize=0[narr]` : `${mixInputs}anull[narr]`);
    audioLabel = 'narr';
  }
  if (musicInputIndex !== null) {
    parts.push(`[${musicInputIndex}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${MUSIC_VOLUME},afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, round3(timeline.totalDuration - 2.5))}:d=2.5[music]`);
    if (audioLabel) {
      parts.push('[narr]asplit=2[narrA][narrB]');
      parts.push('[music][narrA]sidechaincompress=threshold=0.015:ratio=8:attack=40:release=700[ducked]');
      parts.push('[ducked][narrB]amix=inputs=2:duration=longest:normalize=0[mixed]');
      audioLabel = 'mixed';
    } else {
      audioLabel = 'music';
    }
  }
  if (audioLabel) {
    parts.push(`[${audioLabel}]apad,atrim=0:${timeline.totalDuration},alimiter=limit=0.95[aout]`);
    audioLabel = 'aout';
  }
  return { graph: parts.join(';'), videoLabel: 'vout', audioLabel };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function writeFonts(workDir: string): Promise<void> {
  // FiraGO covers Georgian and Latin in one file (see bookFonts.ts).
  const regular = require.resolve('@fontsource/firago/files/firago-latin-500-normal.woff');
  const bold = require.resolve('@fontsource/firago/files/firago-latin-700-normal.woff');
  await fs.promises.writeFile(path.join(workDir, 'font.ttf'), woffToSfnt(await fs.promises.readFile(regular)));
  await fs.promises.writeFile(path.join(workDir, 'font-bold.ttf'), woffToSfnt(await fs.promises.readFile(bold)));
}

export async function renderAnimation(options: RenderOptions): Promise<RenderResult> {
  const { workDir, segments: inputs } = options;
  const subtitles = options.subtitles !== false;
  const draft = !!options.draft;
  if (!inputs.length) throw new Error('Nothing to render.');
  await fs.promises.mkdir(workDir, { recursive: true });
  await writeFonts(workDir);

  // Narration files + their lengths decide every segment's duration.
  const narrationFiles: Array<string | null> = [];
  const narrationSeconds: number[] = [];
  for (let i = 0; i < inputs.length; i += 1) {
    const buffer = inputs[i].narration;
    if (!buffer?.length) {
      narrationFiles.push(null);
      narrationSeconds.push(0);
      continue;
    }
    const ext = buffer.toString('ascii', 0, 4) === 'RIFF' ? 'wav' : 'mp3';
    const file = `narration-${String(i).padStart(2, '0')}.${ext}`;
    await fs.promises.writeFile(path.join(workDir, file), buffer);
    const seconds = await probeDurationSeconds(file, workDir);
    narrationFiles.push(seconds > 0 ? file : null);
    narrationSeconds.push(seconds);
  }

  const timeline = buildTimeline(
    inputs.map((input, i) => ({ kind: input.kind, pageNumber: input.pageNumber, narrationSeconds: narrationSeconds[i], hasSoraClip: !!input.soraClip?.length }))
  );

  let done = 0;
  const segmentFiles = await mapLimit(timeline.segments, options.concurrency ?? 2, async (segment, i) => {
    const file = await renderSegment(workDir, segment, inputs[i], subtitles, draft);
    done += 1;
    options.onProgress?.(done, timeline.segments.length);
    return file;
  });

  const args: string[] = [];
  for (const file of segmentFiles) args.push('-i', file);
  const narrationInputs: Array<{ inputIndex: number; delayMs: number }> = [];
  timeline.segments.forEach((segment, i) => {
    const file = narrationFiles[i];
    if (!file) return;
    narrationInputs.push({ inputIndex: args.filter((a) => a === '-i').length, delayMs: Math.round(segment.narrationStart * 1000) });
    args.push('-i', file);
  });
  let musicInputIndex: number | null = null;
  if (options.music) {
    await fs.promises.writeFile(path.join(workDir, 'music.wav'), synthesizeMusicWav(options.music, timeline.totalDuration + 1));
    musicInputIndex = args.filter((a) => a === '-i').length;
    args.push('-i', 'music.wav');
  }

  const { graph, videoLabel, audioLabel } = buildAssemblyGraph(timeline, narrationInputs, musicInputIndex);
  await fs.promises.writeFile(path.join(workDir, 'graph.txt'), graph, 'utf8');
  const output = 'animation.mp4';
  await runFfmpeg(
    [
      ...args,
      '-filter_complex_script', 'graph.txt',
      '-map', `[${videoLabel}]`,
      ...(audioLabel ? ['-map', `[${audioLabel}]`, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100'] : []),
      '-c:v', 'libx264', '-preset', draft ? 'ultrafast' : 'veryfast', '-crf', draft ? '28' : '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-r', String(VIDEO_FPS),
      '-t', String(timeline.totalDuration),
      '-movflags', '+faststart',
      output,
    ],
    workDir
  );
  return { outputPath: path.join(workDir, output), duration: timeline.totalDuration, timeline };
}
