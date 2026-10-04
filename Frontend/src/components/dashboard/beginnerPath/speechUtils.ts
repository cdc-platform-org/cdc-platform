// ============================================================
// Zero-cost, device-only speech for the IMIAKO Beginner Path — deliberately
// NOT VIPAudioNarrator's Azure-fallback model (src/components/ui/
// VIPAudioNarrator.tsx): that fallback exists specifically because most
// browsers ship zero GEORGIAN speechSynthesis voices. English is the
// opposite case — virtually every modern desktop/mobile browser (Chrome,
// Edge, Safari, Firefox) ships at least one English voice out of the box —
// so word/sentence playback here never needs a paid TTS call at all. See
// the product spec's "cost safety" section: this is the FREE_DEVICE_FEATURE
// path, not EXISTING_BACKEND_AI or PAID_EXTERNAL_API.
// ============================================================

export function supportsSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let cachedEnglishVoice: SpeechSynthesisVoice | null | undefined;
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedEnglishVoice !== undefined) return cachedEnglishVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedEnglishVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en')) ?? null;
  return cachedEnglishVoice;
}

// Speaks a short word/phrase/sentence in English. Cancels any in-flight
// utterance first — a learner tapping several words quickly must hear the
// LATEST tap, not a queue of overlapping voices.
export function speakEnglish(text: string, rate = 0.95): void {
  if (!supportsSpeechSynthesis() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  const voice = pickEnglishVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

// Voice lists load asynchronously in some browsers (notably Chrome) — this
// re-resolves the cached voice once the real list is ready, so the very
// first speakEnglish() call of a session doesn't permanently miss a voice
// that simply hadn't loaded yet.
export function primeEnglishVoice(): void {
  if (!supportsSpeechSynthesis()) return;
  cachedEnglishVoice = undefined;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedEnglishVoice = undefined;
  };
}

// Basic listen-and-repeat only — see the product spec's own instruction:
// "if reliable scoring is NOT currently available, do not fake pronunciation
// accuracy scores." This never scores anything; it only reports back what
// the browser's speech recognizer actually heard, so the learner can
// compare it themselves. SpeechRecognition is Chrome/Edge-only today (not
// Firefox/Safari) — callers must feature-detect via supportsSpeechRecognition()
// and simply not offer the 🎤 control when it returns false.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function supportsSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function createSpeechRecognizer(onHeard: (heardText: string) => void, onError: () => void): SpeechRecognitionLike | null {
  if (!supportsSpeechRecognition()) return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognizer: SpeechRecognitionLike = new Ctor();
  recognizer.lang = 'en-US';
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recognizer.onresult = (event: any) => {
    const heard = event?.results?.[0]?.[0]?.transcript ?? '';
    onHeard(heard);
  };
  recognizer.onerror = () => onError();
  return recognizer;
}
