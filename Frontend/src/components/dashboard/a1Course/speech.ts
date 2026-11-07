// Browser-native speech helpers for the A1 course. Both run entirely in
// the browser (no backend call, no per-use cost): speechSynthesis for
// listening exercises, the Web Speech recognition API for speaking ones.

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function englishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  cachedVoice =
    voices.find((v) => v.lang === 'en-US' && /google|natural|online/i.test(v.name)) ||
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null;
  return cachedVoice;
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakEnglish(text: string, slow = false): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = slow ? 0.55 : 0.85;
  const voice = englishVoice();
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

// ---- Recognition ----

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function canRecognize(): boolean {
  return !!recognitionCtor();
}

/**
 * Listens once and resolves with every alternative transcript the browser
 * heard (best first). Rejects with the browser's error code
 * ('not-allowed', 'no-speech', …).
 */
export function listenOnce(): { promise: Promise<string[]>; stop: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { promise: Promise.reject(new Error('unsupported')), stop: () => {} };
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 5;
  let settled = false;
  const promise = new Promise<string[]>((resolve, reject) => {
    rec.onresult = (e) => {
      settled = true;
      const first = e.results[0];
      const alts: string[] = [];
      for (let i = 0; i < first.length; i++) alts.push(first[i].transcript);
      resolve(alts);
    };
    rec.onerror = (e) => {
      if (settled) return;
      settled = true;
      reject(new Error(e.error));
    };
    rec.onend = () => {
      if (settled) return;
      settled = true;
      reject(new Error('no-speech'));
    };
  });
  rec.start();
  return { promise, stop: () => rec.abort() };
}
