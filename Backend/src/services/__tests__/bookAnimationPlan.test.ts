import {
  ANIMATION_PRICE_TETRI,
  ANIMATION_PROMO_TARGET_ID,
  MIN_SEGMENT_SECONDS,
  SORA_CLIP_SECONDS,
  TRANSITION_SECONDS,
  buildTimeline,
  evenlySpacedPages,
  narrationOffset,
  parseKeyPagesAnswer,
  sanitizeKeyPages,
  segmentDuration,
  wrapSubtitle,
} from '../bookAnimationPlan';
import { buildSoraPrompt, generateSoraClip, normalizeSoraBase, readSoraConfig, SoraError } from '../bookAnimationSora';
import { buildAssemblyGraph } from '../bookAnimationRenderer';
import { MUSIC_THEMES, pickMusicTheme, synthesizeMusicWav } from '../bookAnimationMusic';

jest.mock('../../lib/prisma', () => ({ prisma: {} }));

describe('book animation — product', () => {
  it('costs 10 GEL and is promo-targeted as an AI tool', () => {
    expect(ANIMATION_PRICE_TETRI).toBe(1000);
    expect(ANIMATION_PROMO_TARGET_ID).toBe('book-animation');
  });
});

describe('book animation — key page selection', () => {
  it('spreads the fallback pages evenly and never repeats one', () => {
    expect(evenlySpacedPages(10)).toEqual([3, 5, 8]);
    expect(evenlySpacedPages(20)).toEqual([5, 10, 15]);
    expect(evenlySpacedPages(5)).toEqual([1, 3, 4]);
    expect(evenlySpacedPages(2)).toEqual([1, 2]);
    expect(evenlySpacedPages(0)).toEqual([]);
    for (const n of [4, 5, 7, 10, 15, 20]) {
      const pages = evenlySpacedPages(n);
      expect(new Set(pages).size).toBe(3);
      expect(pages.every((p) => p >= 1 && p <= n)).toBe(true);
    }
  });

  it('keeps valid model picks and repairs bad ones from the fallback', () => {
    expect(sanitizeKeyPages([7, 2, 9], 10)).toEqual([2, 7, 9]);
    expect(sanitizeKeyPages(['4', 4, 99, -1, 1.5, 6], 10)).toEqual([3, 4, 6]);
    expect(sanitizeKeyPages('nope', 10)).toEqual([3, 5, 8]);
    expect(sanitizeKeyPages([1, 2, 3, 4, 5], 10)).toEqual([1, 2, 3]);
  });

  it('parses the JSON answer, with or without code fences', () => {
    expect(parseKeyPagesAnswer('{"pages":[9,4,1]}', 10)).toEqual([1, 4, 9]);
    expect(parseKeyPagesAnswer('```json\n{"pages":[2,3,8]}\n```', 10)).toEqual([2, 3, 8]);
    expect(parseKeyPagesAnswer('[5,6,7]', 10)).toEqual([5, 6, 7]);
    expect(parseKeyPagesAnswer('I think pages 3, 5 and 8', 10)).toEqual([3, 5, 8]);
  });
});

describe('book animation — timeline', () => {
  it('lasts as long as the narration, with a minimum per page', () => {
    expect(segmentDuration({ narrationSeconds: 0, hasSoraClip: false })).toBe(MIN_SEGMENT_SECONDS + TRANSITION_SECONDS);
    expect(segmentDuration({ narrationSeconds: 0, hasSoraClip: true })).toBe(SORA_CLIP_SECONDS - 1);
    const long = segmentDuration({ narrationSeconds: 12, hasSoraClip: false }, 3);
    expect(long).toBeGreaterThan(12 + TRANSITION_SECONDS);
  });

  it('overlaps segments by the transition and never talks over a transition', () => {
    const timeline = buildTimeline([
      { kind: 'cover', pageNumber: 0, narrationSeconds: 2, hasSoraClip: true },
      { kind: 'page', pageNumber: 1, narrationSeconds: 6.4, hasSoraClip: false },
      { kind: 'page', pageNumber: 2, narrationSeconds: 0, hasSoraClip: false },
      { kind: 'page', pageNumber: 3, narrationSeconds: 9.1, hasSoraClip: true },
    ]);
    const segs = timeline.segments;
    expect(segs.map((s) => s.motion)).toEqual(['sora', 'kenburns', 'kenburns', 'sora']);
    expect(segs[0].start).toBe(0);
    expect(segs[0].xfadeOffset).toBeNull();
    for (let i = 1; i < segs.length; i += 1) {
      const prevEnd = segs[i - 1].start + segs[i - 1].duration;
      expect(segs[i].start).toBeCloseTo(prevEnd - TRANSITION_SECONDS, 3);
      expect(segs[i].xfadeOffset).toBe(segs[i].start);
      // The incoming transition is over before the narration starts …
      expect(segs[i].narrationStart).toBeGreaterThanOrEqual(segs[i].start + TRANSITION_SECONDS);
    }
    for (let i = 0; i < segs.length - 1; i += 1) {
      // … and the outgoing one only begins after it has ended.
      const narrationEnd = segs[i].narrationStart + segs[i].narrationSeconds;
      expect(segs[i + 1].start).toBeGreaterThanOrEqual(narrationEnd);
    }
    const last = segs[segs.length - 1];
    expect(timeline.totalDuration).toBeCloseTo(last.start + last.duration, 3);
    expect(narrationOffset(0)).toBeLessThan(narrationOffset(1));
    // Ken Burns variants alternate.
    expect(segs[1].kenBurns).not.toBe(segs[2].kenBurns);
  });

  it('builds an xfade chain plus a ducked music/narration mix', () => {
    const timeline = buildTimeline([
      { kind: 'cover', pageNumber: 0, narrationSeconds: 0, hasSoraClip: false },
      { kind: 'page', pageNumber: 1, narrationSeconds: 3, hasSoraClip: false },
      { kind: 'page', pageNumber: 2, narrationSeconds: 3, hasSoraClip: false },
    ]);
    const { graph, audioLabel } = buildAssemblyGraph(timeline, [{ inputIndex: 3, delayMs: 5000 }, { inputIndex: 4, delayMs: 11000 }], 5);
    expect(graph.match(/xfade=/g)).toHaveLength(2);
    expect(graph).toContain(`offset=${timeline.segments[1].start}`);
    expect(graph).toContain('adelay=5000|5000');
    expect(graph).toContain('sidechaincompress');
    expect(audioLabel).toBe('aout');
    expect(buildAssemblyGraph(timeline, [], null).audioLabel).toBeNull();
  });

  it('wraps subtitles to a few lines with an ellipsis', () => {
    const lines = wrapSubtitle('word '.repeat(60), 20, 3);
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.length <= 21)).toBe(true);
    expect(lines[2].endsWith('…')).toBe(true);
    expect(wrapSubtitle('ერთხელ იყო ერთი პატარა დრაკონი', 64)).toEqual(['ერთხელ იყო ერთი პატარა დრაკონი']);
  });
});

describe('book animation — Sora client', () => {
  it('reads config only when endpoint and key are set and normalises the base URL', () => {
    expect(readSoraConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(readSoraConfig({ AZURE_VIDEO_ENDPOINT: 'https://x.openai.azure.com/', AZURE_VIDEO_API_KEY: 'k' } as any)).toEqual({ endpoint: 'https://x.openai.azure.com/openai/v1', apiKey: 'k', deployment: 'sora-2' });
    expect(normalizeSoraBase('https://x.openai.azure.com/openai')).toBe('https://x.openai.azure.com/openai/v1');
    expect(normalizeSoraBase('https://x.openai.azure.com/openai/v1/')).toBe('https://x.openai.azure.com/openai/v1');
  });

  it('asks for gentle motion without text or new characters', () => {
    const prompt = buildSoraPrompt({ sceneText: 'Nino finds a glowing shell on the beach', styleLine: 'soft watercolor', isCover: false });
    expect(prompt).toMatch(/No text/);
    expect(prompt).toMatch(/Do not add any new characters/);
    expect(prompt).toContain('soft watercolor');
    expect(prompt).toContain('glowing shell');
  });

  it('creates, polls and downloads a clip', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.endsWith('/videos')) {
        const form = init!.body as FormData;
        expect(form.get('size')).toBe('1280x720');
        expect(form.get('seconds')).toBe('8');
        expect(form.get('model')).toBe('sora-2');
        expect(form.get('input_reference')).toBeTruthy();
        return new Response(JSON.stringify({ id: 'video_1', status: 'queued' }), { status: 200 });
      }
      if (url.endsWith('/content')) return new Response(Buffer.alloc(5000, 1), { status: 200 });
      return new Response(JSON.stringify({ id: 'video_1', status: calls.length > 2 ? 'completed' : 'in_progress', seconds: '8' }), { status: 200 });
    }) as unknown as typeof fetch;
    const result = await generateSoraClip({ endpoint: 'https://x/openai/v1', apiKey: 'k', deployment: 'sora-2' }, { prompt: 'p', image: Buffer.from('img'), imageMimeType: 'image/jpeg' }, { fetchImpl, pollIntervalMs: 1 });
    expect(result.seconds).toBe(8);
    expect(result.video.length).toBe(5000);
    expect(calls[0]).toBe('POST https://x/openai/v1/videos');
    expect(calls[calls.length - 1]).toBe('GET https://x/openai/v1/videos/video_1/content');
  });

  it('marks a content-filter failure as not retryable', async () => {
    const fetchImpl = (async (url: string) =>
      url.endsWith('/videos')
        ? new Response(JSON.stringify({ id: 'v', status: 'queued' }), { status: 200 })
        : new Response(JSON.stringify({ id: 'v', status: 'failed', error: { message: 'Blocked by content moderation' } }), { status: 200 })) as unknown as typeof fetch;
    await expect(generateSoraClip({ endpoint: 'https://x/openai/v1', apiKey: 'k', deployment: 'sora-2' }, { prompt: 'p', image: Buffer.from('i'), imageMimeType: 'image/jpeg' }, { fetchImpl, pollIntervalMs: 1 })).rejects.toMatchObject({ retryable: false });
    expect(new SoraError('x', true).retryable).toBe(true);
  });
});

describe('book animation — music', () => {
  it('synthesises a WAV of the requested length and picks a stable theme', () => {
    const wav = synthesizeMusicWav(MUSIC_THEMES[0], 2);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.length).toBe(44 + 2 * 22050 * 2);
    expect(pickMusicTheme('book-a')).toBe(pickMusicTheme('book-a'));
  });
});
