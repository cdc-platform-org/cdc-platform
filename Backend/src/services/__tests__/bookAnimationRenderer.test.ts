import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { probeDurationSeconds, renderAnimation, composeFrame } from '../bookAnimationRenderer';
import { MUSIC_THEMES, synthesizeMusicWav } from '../bookAnimationMusic';
import { animateMoments } from '../bookAnimationService';
import { SoraError } from '../bookAnimationSora';

jest.mock('../../lib/prisma', () => ({ prisma: {} }));

// A portrait "illustration": gradient sky, hill and a sun, different hue per page.
async function illustration(hue: number, width = 768, height = 1024): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,75%)"/><stop offset="1" stop-color="hsl(${hue + 40},60%,45%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${width * 0.7}" cy="${height * 0.25}" r="${width * 0.12}" fill="#ffe08a"/>
    <ellipse cx="${width / 2}" cy="${height}" rx="${width * 0.9}" ry="${height * 0.35}" fill="hsl(${hue + 90},45%,40%)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// One ffmpeg integration test: 3 pages (+ cover), Ken Burns only (no Sora).
describe('book animation renderer (ffmpeg)', () => {
  jest.setTimeout(120_000);
  let workDir: string;

  beforeAll(async () => {
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'book-animation-test-'));
  });
  afterAll(async () => {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  });

  it('keeps the illustration aspect on a blurred 16:9 frame', async () => {
    const frame = await composeFrame(await illustration(200), 1280, 720, 'jpeg');
    const meta = await sharp(frame).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1280, 720, 'jpeg']);
  });

  it('renders a 3-page Ken Burns video with narration and music in under 60 s', async () => {
    const started = Date.now();
    const narration = synthesizeMusicWav(MUSIC_THEMES[1], 3); // any 3 s of audio stands in for speech
    const result = await renderAnimation({
      workDir,
      draft: true,
      music: MUSIC_THEMES[0],
      segments: [
        { kind: 'cover', pageNumber: 0, image: await illustration(20), text: 'ნინოს ჯადოსნური ნიჟარა' },
        { kind: 'page', pageNumber: 1, image: await illustration(120), narration, text: 'ერთხელ, ზღვის პირას, ნინომ მოციმციმე ნიჟარა იპოვა.' },
        { kind: 'page', pageNumber: 2, image: await illustration(220, 1024, 1024), text: 'The shell began to sing a quiet song.' },
        { kind: 'page', pageNumber: 3, image: await illustration(300), narration, text: 'And they became friends forever.' },
      ],
    });
    const elapsed = Date.now() - started;
    console.log(`[book-animation test] rendered ${result.duration}s of video in ${elapsed} ms`);
    expect(elapsed).toBeLessThan(60_000);
    expect(result.timeline.segments.every((s) => s.motion === 'kenburns')).toBe(true);
    const stat = await fs.promises.stat(result.outputPath);
    expect(stat.size).toBeGreaterThan(50_000);
    const measured = await probeDurationSeconds('animation.mp4', workDir);
    expect(Math.abs(measured - result.duration)).toBeLessThan(0.3);
    // MP4 with +faststart: the moov atom comes before mdat.
    const head = (await fs.promises.readFile(result.outputPath)).subarray(0, 4096).toString('latin1');
    expect(head.indexOf('moov')).toBeGreaterThan(-1);
  });

  it('falls back to Ken Burns when Sora fails, with at most 2 tries per clip', async () => {
    const image = await illustration(40);
    let calls = 0;
    const outcome = await animateMoments(
      { endpoint: 'https://x/openai/v1', apiKey: 'k', deployment: 'sora-2' },
      [{ pageNumber: 0, image, sceneText: 'cover' }, { pageNumber: 4, image, sceneText: 'page' }],
      null,
      async () => {
        calls += 1;
        throw new SoraError('boom', true);
      }
    );
    expect(outcome.clips.size).toBe(0);
    expect(outcome.secondsUsed).toBe(0);
    expect(calls).toBe(4);

    const none = await animateMoments(null, [{ pageNumber: 0, image, sceneText: 'cover' }], null);
    expect(none.clips.size).toBe(0);
  });
});
