/* eslint-disable no-console */
// Renders a book animation from local files, without a database or Sora —
// for QA of the ffmpeg pipeline (Ken Burns, transitions, subtitles,
// narration, music). Usage:
//
//   pnpm exec ts-node scripts/render-book-animation-sample.ts <dir> <out.mp4>
//
// <dir> holds story.json ({"title": "...", "pages": ["...", ...]}),
// art/cover.png + art/p1.png..pN.png and optionally narration/p0..pN.(wav|mp3)
// (p0 = the title). Sora clips can be added as sora/p<N>.mp4 (p0 = cover).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { renderAnimation, RenderSegmentInput } from '../src/services/bookAnimationRenderer';
import { MUSIC_THEMES } from '../src/services/bookAnimationMusic';

function optional(file: string): Buffer | null {
  for (const candidate of [file, file.replace(/\.wav$/, '.mp3')]) if (fs.existsSync(candidate)) return fs.readFileSync(candidate);
  return null;
}

async function main() {
  const [dir, out] = process.argv.slice(2);
  if (!dir || !out) throw new Error('usage: render-book-animation-sample.ts <dir> <out.mp4>');
  const story = JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf8')) as { title: string; pages: string[] };
  const segments: RenderSegmentInput[] = [
    { kind: 'cover', pageNumber: 0, image: fs.readFileSync(path.join(dir, 'art', 'cover.png')), narration: optional(path.join(dir, 'narration', 'p0.wav')), soraClip: optional(path.join(dir, 'sora', 'p0.mp4')), text: story.title },
    ...story.pages.map((text, i) => ({
      kind: 'page' as const,
      pageNumber: i + 1,
      image: fs.readFileSync(path.join(dir, 'art', `p${i + 1}.png`)),
      narration: optional(path.join(dir, 'narration', `p${i + 1}.wav`)),
      soraClip: optional(path.join(dir, 'sora', `p${i + 1}.mp4`)),
      text,
    })),
  ];
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'book-animation-sample-'));
  const started = Date.now();
  const result = await renderAnimation({ workDir, segments, music: MUSIC_THEMES[0], onProgress: (d, t) => console.log(`segment ${d}/${t}`) });
  await fs.promises.copyFile(result.outputPath, out);
  await fs.promises.rm(workDir, { recursive: true, force: true });
  console.log(`rendered ${result.duration}s (${segments.length} segments) in ${((Date.now() - started) / 1000).toFixed(1)} s -> ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
