import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, Play, Pause, Sparkles } from 'lucide-react';

// Reusable narration button built on the native Web Speech API
// (window.speechSynthesis) — no backend call, no API cost, works offline.
// Used on: course lesson notes (conspectus), community forum threads, and
// as a per-message speaker button in CourseTutorPanel's AI replies.
//
// `speechLang` is the actual BCP-47 tag to narrate WITH (e.g. 'ka-GE',
// 'en-US') — deliberately a separate concern from the caller's UI locale.
// Most text in this codebase is only ever stored in Georgian or English
// (see utils/locale.ts's contentLocale()), so a caller should resolve
// speechLang from the actual language of `text`, not blindly from
// router.locale — narrating English fallback text with a Turkish/Armenian/
// etc. voice would mispronounce it.
const SPEEDS = [1, 1.25, 1.5, 2] as const;

function stripMarkdownForSpeech(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~#]/g, ' ')
    .replace(/^\s*[-•]\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// getVoices() can return an empty list on the very first call in Chrome —
// the real list only exists once the async 'voiceschanged' event fires.
// Waits for that (with a short timeout fallback for browsers that never
// fire it, e.g. some Safari versions) rather than reading an empty list
// and concluding no voice is available.
function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(window.speechSynthesis.getVoices());
    }, 500);
  });
}

// Matches on the language's primary subtag only ('ka' out of 'ka-GE') since
// installed voices report their own lang tag inconsistently across OSes/
// browsers. For non-Georgian languages, prefers a voice whose name signals
// a higher-quality engine (Chrome/Edge label these "Google ..."/
// "Microsoft ... Natural/Neural") over a generic platform default, since
// those are audibly better for long-form narration.
function pickVoice(voices: SpeechSynthesisVoice[], bcp47Lang: string): SpeechSynthesisVoice | null {
  const primary = bcp47Lang.split('-')[0].toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(primary));
  if (candidates.length === 0) return null;
  if (primary !== 'ka') {
    const highQuality = candidates.find((v) => /natural|neural|google/i.test(v.name));
    if (highQuality) return highQuality;
  }
  return candidates[0];
}

interface VIPAudioNarratorProps {
  text: string;
  speechLang: string;
  // UI language for the button's own label (independent of speechLang) —
  // defaults to the literal bilingual label design calls for.
  lang?: string;
  label?: string;
  stripMarkdown?: boolean;
  className?: string;
  // Renders only the speaker icon (no label/speed/progress chrome) — for
  // tight spaces like a per-chat-message button.
  compact?: boolean;
}

export default function VIPAudioNarrator({
  text,
  speechLang,
  lang = 'en',
  label,
  stripMarkdown = false,
  className = '',
  compact = false,
}: VIPAudioNarratorProps) {
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const [progress, setProgress] = useState(0);
  const [voiceWarning, setVoiceWarning] = useState(false);
  const cleanTextRef = useRef('');

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof (window as any).SpeechSynthesisUtterance !== 'undefined'
    );
  }, []);

  useEffect(() => {
    cleanTextRef.current = stripMarkdown ? stripMarkdownForSpeech(text) : text;
  }, [text, stripMarkdown]);

  // Stop narration when the underlying content changes (e.g. the student
  // switches lessons) or this button unmounts — never leave a stale
  // utterance talking over new content.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, text]);

  const speak = useCallback(
    async (atRate: number) => {
      if (!supported || !cleanTextRef.current.trim()) return;
      window.speechSynthesis.cancel();

      const voices = await getVoicesAsync();
      const voice = pickVoice(voices, speechLang);

      // Never let the platform fall back to whatever default voice it picks
      // for an unmatched lang — for Georgian specifically that's typically
      // an English voice attempting Georgian text letter-by-letter, which
      // reads as broken rather than merely accented. Skip speaking and say
      // so instead.
      if (speechLang.split('-')[0] === 'ka' && !voice) {
        setVoiceWarning(true);
        setTimeout(() => setVoiceWarning(false), 4000);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanTextRef.current);
      utterance.lang = speechLang;
      utterance.rate = atRate;
      if (voice) utterance.voice = voice;
      utterance.onboundary = (e) => {
        const len = cleanTextRef.current.length;
        if (len > 0) setProgress(Math.min(1, e.charIndex / len));
      };
      utterance.onend = () => {
        setPlaying(false);
        setPaused(false);
        setProgress(1);
      };
      utterance.onerror = () => {
        setPlaying(false);
        setPaused(false);
      };
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
      setPaused(false);
      setProgress(0);
    },
    [supported, speechLang]
  );

  const toggle = () => {
    if (!supported) return;
    if (playing && !paused) {
      window.speechSynthesis.pause();
      setPaused(true);
    } else if (playing && paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      speak(rate);
    }
  };

  const handleRateChange = (next: number) => {
    setRate(next);
    // Most browsers can't change an in-flight utterance's rate — restart
    // from the beginning at the new rate rather than silently ignoring the
    // change, the platform's actual limitation, not a bug to hide.
    if (playing) speak(next);
  };

  const defaultLabel = lang === 'ka' ? '🔊 ტექსტის მოსმენა' : '🔊 Listen to Text';
  const displayLabel = label ?? defaultLabel;
  const isActive = playing && !paused;
  const noVoiceMessage = 'თქვენს ბრაუზერს ქართული ხმის მხარდაჭერა არ აქვს';

  if (!supported) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-slate-300/50 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/40 px-3 py-1.5 text-xs font-semibold text-slate-400 opacity-60 cursor-not-allowed ${className}`}
        title={lang === 'ka' ? 'ხმოვანი წაკითხვა ამ ბრაუზერში მიუწვდომელია' : 'Audio narration is unavailable in this browser'}
      >
        <Volume2 className="w-3.5 h-3.5" />
        {!compact && <span>{displayLabel}</span>}
      </div>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 text-white border-none cursor-pointer shadow-sm shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow ${className}`}
          title={voiceWarning ? noVoiceMessage : displayLabel}
        >
          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        {voiceWarning && <span className="text-[10px] text-amber-500 dark:text-amber-400">{noVoiceMessage}</span>}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
    <div
      className={`inline-flex items-center gap-3 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-400/10 via-purple-500/10 to-cyan-500/10 px-3.5 py-2 shadow-sm shadow-purple-500/10 ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 text-white border-none cursor-pointer shadow-md shadow-purple-500/40"
      >
        {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex flex-col gap-1 min-w-[120px]">
        <span className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Sparkles className="w-3 h-3 text-amber-400" /> {displayLabel}
        </span>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-slate-300/50 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 transition-[width] duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {isActive && (
            <span className="flex items-end gap-[2px] h-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-amber-400 to-cyan-500 animate-[vip-wave_0.9s_ease-in-out_infinite]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          )}
        </div>
      </div>

      <select
        value={rate}
        onChange={(e) => handleRateChange(Number(e.target.value))}
        className="shrink-0 text-[11px] font-bold bg-transparent border border-amber-400/30 rounded-md px-1.5 py-1 text-slate-600 dark:text-slate-300 cursor-pointer"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>

      <style jsx>{`
        @keyframes vip-wave {
          0%,
          100% {
            height: 4px;
          }
          50% {
            height: 12px;
          }
        }
      `}</style>
    </div>
      {voiceWarning && <span className="text-[11px] text-amber-500 dark:text-amber-400 px-1">{noVoiceMessage}</span>}
    </div>
  );
}
