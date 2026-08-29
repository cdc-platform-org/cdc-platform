import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Volume2, Square } from 'lucide-react';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';

// Global "select any text, hear it read aloud" widget — mounted once in
// pages/_app.tsx (see that file), works on every page without any
// per-page integration. Pure client-side (Web Speech API), no backend
// call, no API cost.
//
// Minimum selection length of 3 characters — long enough that a stray
// double-click on a single short word or a misclick doesn't pop the
// button up constantly, short enough that a deliberately-selected word
// still triggers it.
const MIN_SELECTION_LENGTH = 3;

// Georgian text is read with a Georgian voice, everything else defaults to
// English — this platform's actual two content languages (see
// utils/locale.ts's contentLocale()), detected from the selection itself
// rather than the site's current locale, since a de/es/fr/uk visitor
// browsing English-fallback content should still hear it read as English,
// not attempted in a de-DE/es-ES/etc. voice that was never the actual
// language of the text.
const GEORGIAN_SCRIPT = /[Ⴀ-ჿ]/;
function detectSpeechLang(text: string): string {
  return GEORGIAN_SCRIPT.test(text) ? 'ka-GE' : 'en-US';
}

interface PopoverPosition {
  top: number;
  left: number;
}

export default function TextToSpeechReader() {
  const router = useRouter();
  const { speak, stop, speaking, supported } = useTextToSpeech();
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const clearSelection = useCallback(() => {
    // Never drop the popover out from under a playing utterance — e.g.
    // clicking the button itself can shift focus in a way that collapses
    // the document selection, which would otherwise instantly hide the
    // only control that can stop the audio. Normal selection-tracking
    // resumes once speaking ends (onend/onerror in useTextToSpeech).
    if (speaking) return;
    setSelectedText(null);
    setPosition(null);
  }, [speaking]);

  const updateFromSelection = useCallback(() => {
    if (speaking) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!selection || selection.rangeCount === 0 || text.length < MIN_SELECTION_LENGTH) {
      clearSelection();
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      clearSelection();
      return;
    }
    setSelectedText(text);
    // Centered above the selection, clamped so the popover never renders
    // off the left/right edge of a narrow (mobile) viewport.
    const left = Math.min(Math.max(rect.left + rect.width / 2, 60), window.innerWidth - 60);
    setPosition({ top: rect.top, left });
  }, [clearSelection]);

  useEffect(() => {
    if (!supported) return;

    // mouseup/touchend fire once the selecting gesture actually ends —
    // the right moment to compute a stable position. selectionchange fires
    // continuously during a drag and also covers keyboard-driven selection
    // (Shift+Arrow) and programmatic deselection (e.g. clicking once,
    // collapsing the range to empty), which mouseup/touchend alone would
    // miss.
    document.addEventListener('mouseup', updateFromSelection);
    document.addEventListener('touchend', updateFromSelection);
    document.addEventListener('selectionchange', updateFromSelection);
    // A selection popover pinned to on-screen coordinates goes stale the
    // instant the page scrolls — hiding it (Medium/Notion's own posture
    // for this exact widget) is simpler and less error-prone than
    // recomputing position on every scroll tick.
    window.addEventListener('scroll', clearSelection, { passive: true });

    return () => {
      document.removeEventListener('mouseup', updateFromSelection);
      document.removeEventListener('touchend', updateFromSelection);
      document.removeEventListener('selectionchange', updateFromSelection);
      window.removeEventListener('scroll', clearSelection);
    };
  }, [supported, updateFromSelection, clearSelection]);

  // Never leave audio playing (or a stale popover showing) after a
  // client-side route change.
  useEffect(() => {
    const handleRouteChange = () => {
      stop();
      clearSelection();
    };
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events, stop, clearSelection]);

  if (!supported || !selectedText || !position) return null;

  const handleToggle = () => {
    if (speaking) {
      stop();
    } else {
      speak(selectedText, detectSpeechLang(selectedText));
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      style={{ position: 'fixed', top: position.top, left: position.left, transform: 'translate(-50%, calc(-100% - 8px))' }}
      className="z-[9999] flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold px-3.5 py-2 shadow-lg shadow-black/20 border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 hover:opacity-90"
    >
      {speaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
      {speaking ? '⏹️ გაჩერება' : '🔊 მოსმენა'}
    </button>
  );
}
