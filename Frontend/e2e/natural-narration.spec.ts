import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/tts';
import { cloudVoiceFor, pickNaturalVoice, splitSpeechText, speakNaturally, stopNaturalSpeech } from '../src/utils/naturalSpeech';

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
const originalKey = process.env.AZURE_SPEECH_KEY;
const originalRegion = process.env.AZURE_SPEECH_REGION;

test.afterEach(() => {
  stopNaturalSpeech();
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of [['window', originalWindow], ['Audio', originalAudio]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  if (originalKey === undefined) delete process.env.AZURE_SPEECH_KEY; else process.env.AZURE_SPEECH_KEY = originalKey;
  if (originalRegion === undefined) delete process.env.AZURE_SPEECH_REGION; else process.env.AZURE_SPEECH_REGION = originalRegion;
});

test('prefers a natural voice in the requested language and never substitutes English for Georgian', () => {
  const voices = [
    { name: 'Generic', lang: 'en-US' },
    { name: 'Microsoft Natural', lang: 'en-GB' },
    { name: 'Google US English', lang: 'en-US' },
  ] as SpeechSynthesisVoice[];
  expect(pickNaturalVoice(voices, 'en-US')?.name).toBe('Microsoft Natural');
  expect(pickNaturalVoice(voices, 'ka-GE')).toBeNull();
  expect(cloudVoiceFor('ka-GE')).toBe('ka-GE-EkaNeural');
  expect(cloudVoiceFor('en-GB')).toBe('en-US-JennyNeural');
  expect(cloudVoiceFor('de-DE')).toBeNull();
});

test('long Georgian narration is split without truncating text or exceeding the per-request limit', () => {
  const text = 'სოფი ტყეში დათვს შეხვდა.\n\nმათ ერთად გზა განაგრძეს. '.repeat(140);
  const chunks = splitSpeechText(text);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((chunk) => chunk.length <= 1500)).toBe(true);
  expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim());
  expect(splitSpeechText('x'.repeat(3500)).map((chunk) => chunk.length)).toEqual([1500, 1500, 500]);
});

async function callApi(body: unknown, method = 'POST') {
  let status = 0;
  let payload: unknown;
  const headers: Record<string, unknown> = {};
  const res = {
    status(code: number) { status = code; return res; },
    json(value: unknown) { payload = value; return res; },
    send(value: unknown) { payload = value; return res; },
    setHeader(key: string, value: unknown) { headers[key] = value; return res; },
  };
  await handler({ method, body, query: method === 'GET' ? body : {} } as NextApiRequest, res as unknown as NextApiResponse);
  return { status, payload, headers };
}

test('the TTS proxy uses the English neural voice, natural paragraphs and synthesis-time speed', async () => {
  process.env.AZURE_SPEECH_KEY = 'test-only'; process.env.AZURE_SPEECH_REGION = 'test-only';
  let ssml = '';
  globalThis.fetch = async (_url, options) => { ssml = String(options?.body); return new Response(new Uint8Array([73, 68, 51])); };
  const result = await callApi({ text: 'First paragraph.\n\nSecond paragraph.', voice: 'en-US-JennyNeural', speed: 0.8 });
  expect(result.status).toBe(200);
  expect(ssml).toContain('name="en-US-JennyNeural"');
  expect(ssml).toContain('<prosody rate="-20%">');
  expect(ssml).toContain('<p>First paragraph.</p><p>Second paragraph.</p>');
  expect(result.headers['Cache-Control']).toBe('private, max-age=86400');
});

test('the proxy rejects invalid speed and oversized text instead of silently truncating narration', async () => {
  process.env.AZURE_SPEECH_KEY = 'test-only'; process.env.AZURE_SPEECH_REGION = 'test-only';
  globalThis.fetch = async () => { throw new Error('Must not call Azure'); };
  expect((await callApi({ text: 'Hello', speed: 0 })).status).toBe(400);
  expect((await callApi({ text: 'x'.repeat(3001) })).status).toBe(400);
  expect((await callApi({}, 'DELETE')).status).toBe(405);
});

test('cancelling an in-flight narration prevents late audio from starting', async () => {
  let audioCreated = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: class { constructor() { audioCreated += 1; } } });
  let respond!: (value: Response) => void;
  globalThis.fetch = () => new Promise<Response>((resolve) => { respond = resolve; });
  const reading = speakNaturally('Hello', 'en-US');
  stopNaturalSpeech();
  respond(new Response(new Uint8Array([73, 68, 51])));
  await reading;
  expect(audioCreated).toBe(0);
});

test('pronunciation requests the selected pace and preserves pitch during playback', async () => {
  let body: any;
  let audio: any;
  let ended = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: class {
    src: string; preservesPitch = false; onended?: () => void;
    constructor(src: string) { this.src = src; audio = this; }
    pause() {}
    async play() { queueMicrotask(() => this.onended?.()); }
  } });
  globalThis.fetch = async (_url, options) => { body = JSON.parse(String(options?.body)); return new Response(new Uint8Array([73, 68, 51])); };
  await speakNaturally('Hello there.', 'en-US', 0.8, { onEnd: () => { ended = true; } });
  expect(body).toMatchObject({ text: 'Hello there.', voice: 'en-US-JennyNeural', speed: 0.8 });
  expect(audio.preservesPitch).toBe(true);
  expect(ended).toBe(true);
});

async function mountNarrator(page: Page, text: string) {
  await page.setContent('<div id="root"></div>');
  for (const packageName of ['react', 'react-dom']) {
    await page.addScriptTag({ path: path.join(path.dirname(require.resolve(packageName)), 'umd', `${packageName}.development.js`) });
  }
  const compile = (file: string) => ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  await page.evaluate(({ sources, text }) => {
    const w = window as any;
    w.ttsRequests = []; w.ttsPending = []; w.audioStarts = 0; w.nativeStarts = 0; w.latestAudio = null;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ lang: 'ka-GE', name: 'Generic Georgian' }],
      cancel() {}, pause() {}, resume() {}, speak() { w.nativeStarts += 1; },
    } });
    w.Audio = class {
      src = ''; duration = 100; currentTime = 0; playbackRate = 1; preservesPitch = false;
      onplay?: () => void; onended?: () => void;
      constructor() { w.latestAudio = this; }
      pause() {} addEventListener() {} removeEventListener() {}
      async play() { w.audioStarts += 1; this.onplay?.(); }
    };
    w.fetch = async (_url: string, options: RequestInit) => {
      w.ttsRequests.push(JSON.parse(String(options.body)));
      return new Promise((resolve) => w.ttsPending.push(resolve));
    };
    w.resolveTts = () => w.ttsPending.shift()(new Response(new Blob(['test mp3'], { type: 'audio/mpeg' })));
    const modules: Record<string, unknown> = {
      react: w.React,
      'lucide-react': { Play: () => null, Pause: () => null, Sparkles: () => null },
    };
    const load = (source: string) => {
      const module = { exports: {} };
      new Function('require', 'module', 'exports', source)((id: string) => modules[id], module, module.exports);
      return module.exports as any;
    };
    modules['../../utils/naturalSpeech'] = load(sources.speech);
    modules['../../utils/speechSsml'] = load(sources.ssml);
    const Narrator = load(sources.component).default;
    w.renderNarrator = (value: string) => w.ReactDOM.render(w.React.createElement(Narrator, { text: value, speechLang: 'ka-GE', lang: 'ka' }), document.querySelector('#root'));
    w.renderNarrator(text);
  }, { sources: {
    speech: compile('../src/utils/naturalSpeech.ts'),
    ssml: compile('../src/utils/speechSsml.ts'),
    component: compile('../src/components/ui/VIPAudioNarrator.tsx'),
  }, text });
}

test('the narrator can pause during synthesis and keeps pitch and speed across chunks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mountNarrator(page, 'სოფი ტყეში დათვს შეხვდა. '.repeat(130));
  const button = page.getByRole('button').first();
  await button.click();
  await expect.poll(() => page.evaluate(() => (window as any).ttsRequests.length)).toBe(1);
  await button.click(); // Pause before the cloud response arrives.
  await page.evaluate(() => (window as any).resolveTts());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).latestAudio))).toBe(true);
  expect(await page.evaluate(() => (window as any).audioStarts)).toBe(0);
  await button.click();
  await page.getByRole('combobox').selectOption('1.5');
  await page.evaluate(() => (window as any).latestAudio.onended());
  await expect.poll(() => page.evaluate(() => (window as any).ttsRequests.length)).toBe(2);
  await page.evaluate(() => (window as any).resolveTts());
  await expect.poll(() => page.evaluate(() => (window as any).audioStarts)).toBe(2);
  expect(await page.evaluate(() => ({
    pitch: (window as any).latestAudio.preservesPitch, rate: (window as any).latestAudio.playbackRate,
    voice: (window as any).ttsRequests[0].voice, native: (window as any).nativeStarts,
  }))).toEqual({ pitch: true, rate: 1.5, voice: 'ka-GE-EkaNeural', native: 0 });
  expect(errors).toEqual([]);
});

test('changing the text discards a late response for the previous narration', async ({ page }) => {
  await mountNarrator(page, 'ძველი ტექსტი.');
  await page.getByRole('button').first().click();
  await expect.poll(() => page.evaluate(() => (window as any).ttsRequests.length)).toBe(1);
  await page.evaluate(() => (window as any).renderNarrator('ახალი ტექსტი.'));
  await page.evaluate(() => (window as any).resolveTts());
  expect(await page.evaluate(() => (window as any).audioStarts)).toBe(0);
  await page.getByRole('button').first().click();
  await expect.poll(() => page.evaluate(() => (window as any).ttsRequests.length)).toBe(2);
  await page.evaluate(() => (window as any).resolveTts());
  await expect.poll(() => page.evaluate(() => (window as any).audioStarts)).toBe(1);
  expect(await page.evaluate(() => (window as any).ttsRequests[1].text)).toBe('ახალი ტექსტი.');
});
