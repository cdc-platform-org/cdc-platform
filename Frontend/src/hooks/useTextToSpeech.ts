import { useCallback, useEffect, useRef, useState } from 'react';

// Thin wrapper around the native Web Speech API (window.speechSynthesis) —
// no backend call, no API cost, works offline. `supported` is computed
// lazily (not at module scope) since this runs during SSR where `window`
// doesn't exist; every caller must check it before rendering anything
// that implies speech actually works.
export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined');
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string, lang: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;
    // Cancel any in-flight utterance first — speechSynthesis queues by
    // default, which would read the old and new selections back to back
    // instead of replacing one with the other.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, []);

  // Never leave the browser talking after this hook's owner unmounts
  // (e.g. a client-side route change while a selection is being read).
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { speak, stop, speaking, supported };
}
