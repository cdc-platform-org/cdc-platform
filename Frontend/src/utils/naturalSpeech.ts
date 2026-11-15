// Shared voice selection for browser-only readers and cloud fallback.
export function pickNaturalVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const primary = locale.split('-')[0].toLowerCase();
  const candidates = voices.filter((voice) => voice.lang.toLowerCase().split(/[-_]/)[0] === primary);
  const score = (voice: SpeechSynthesisVoice) =>
    (/natural|neural/i.test(voice.name) ? 20 : /google|online/i.test(voice.name) ? 10 : 0) +
    (voice.lang.toLowerCase() === locale.toLowerCase() ? 3 : 0);
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function cloudVoiceFor(locale: string): string | null {
  const language = locale.split('-')[0].toLowerCase();
  return language === 'ka' ? 'ka-GE-EkaNeural' : language === 'en' ? 'en-US-JennyNeural' : null;
}

export function splitSpeechText(text: string, limit = 1500): string[] {
  const pieces = text.match(/[^.!?։\n]+[.!?։]*\s*/g) ?? [];
  const chunks: string[] = [];
  let chunk = '';
  for (let piece of pieces) {
    if ((chunk + piece).length > limit && chunk.trim()) { chunks.push(chunk.trim()); chunk = ''; }
    while (piece.length > limit) {
      const candidate = piece.slice(0, limit);
      const space = candidate.lastIndexOf(' ');
      const cut = space > limit / 2 ? space + 1 : limit;
      chunks.push(piece.slice(0, cut).trim());
      piece = piece.slice(cut);
    }
    chunk += piece;
  }
  if (chunk.trim()) chunks.push(chunk.trim());
  return chunks;
}

let activeAudio: HTMLAudioElement | null = null;
let activeUrl: string | null = null;
let request: AbortController | null = null;

export function stopNaturalSpeech(): void {
  request?.abort();
  request = null;
  if (activeAudio) { activeAudio.pause(); activeAudio.src = ''; }
  activeAudio = null;
  if (activeUrl) URL.revokeObjectURL(activeUrl);
  activeUrl = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Short pronunciation exercises: synthesize the desired pace, keeping pitch
// intact. The matching browser voice remains available when cloud is offline.
export async function speakNaturally(text: string, locale: string, speed = 1, options: { onEnd?: () => void; onError?: () => void } = {}): Promise<void> {
  stopNaturalSpeech();
  const current = new AbortController();
  request = current;
  const voice = cloudVoiceFor(locale);
  const chunks = splitSpeechText(text);
  let index = 0;
  try {
    if (!voice) throw new Error('No cloud voice for this language.');
    for (; index < chunks.length; index += 1) {
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: chunks[index], voice, speed }), signal: current.signal });
      if (!response.ok) throw new Error('Cloud speech unavailable.');
      const blob = await response.blob();
      if (current.signal.aborted) return;
      activeUrl = URL.createObjectURL(blob);
      const audio = new Audio(activeUrl);
      activeAudio = audio;
      audio.preservesPitch = true;
      await new Promise<void>((resolve, reject) => {
        const abort = () => resolve();
        current.signal.addEventListener('abort', abort, { once: true });
        audio.onended = () => { current.signal.removeEventListener('abort', abort); resolve(); };
        audio.onerror = () => { current.signal.removeEventListener('abort', abort); reject(new Error('Audio playback failed.')); };
        audio.play().catch((error) => { current.signal.removeEventListener('abort', abort); reject(error); });
      });
      if (current.signal.aborted) return;
      URL.revokeObjectURL(activeUrl);
      activeUrl = null;
    }
    if (request === current) stopNaturalSpeech();
    options.onEnd?.();
  } catch {
    if (current.signal.aborted) return;
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = null;
    const nativeVoice = 'speechSynthesis' in window ? pickNaturalVoice(window.speechSynthesis.getVoices(), locale) : null;
    if (!nativeVoice) { options.onError?.(); return; }
    const utterance = new SpeechSynthesisUtterance(chunks.slice(index).join(' '));
    utterance.lang = locale;
    utterance.voice = nativeVoice;
    utterance.rate = speed;
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onError?.();
    window.speechSynthesis.speak(utterance);
  }
}
