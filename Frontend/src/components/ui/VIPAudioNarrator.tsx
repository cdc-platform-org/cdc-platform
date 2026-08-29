import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Sparkles } from 'lucide-react';

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

// translate.google.com/translate_tts is the undocumented endpoint the
// Google Translate web UI itself calls for its speaker-icon button — not a
// real API (no key, no SLA, not sanctioned for automated use by Google's
// ToS). Used here only as a client-side, no-credentials stopgap for the
// large share of browsers that ship zero Georgian speechSynthesis voices;
// it can be rate-limited or blocked without notice. A real TTS API (Google
// Cloud Text-to-Speech, Azure Speech) is the durable replacement if this
// ever needs to be production-load-bearing rather than a fallback.
// The endpoint silently truncates/fails past ~200 chars per request, so
// long text (lesson conspectus, forum posts) is split into sentence-sized
// chunks and played back-to-back rather than as one request.
const GOOGLE_TTS_CHUNK_LIMIT = 190;

function splitForGoogleTts(input: string): string[] {
  const sentences = input.match(/[^.!?։\n]+[.!?։]*\s*/g) ?? [input];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > GOOGLE_TTS_CHUNK_LIMIT) {
      if (current.trim()) chunks.push(current.trim());
      if (sentence.length > GOOGLE_TTS_CHUNK_LIMIT) {
        for (let i = 0; i < sentence.length; i += GOOGLE_TTS_CHUNK_LIMIT) {
          chunks.push(sentence.slice(i, i + GOOGLE_TTS_CHUNK_LIMIT).trim());
        }
        current = '';
      } else {
        current = sentence;
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

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
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const cleanTextRef = useRef('');
  // Non-null while narrating via the Google Translate TTS fallback instead
  // of native speechSynthesis — toggle()/handleRateChange() branch on this
  // so the same play/pause/speed controls drive whichever engine is active.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackChunksRef = useRef<string[]>([]);
  const fallbackIndexRef = useRef(0);
  // Explicit flag rather than checking audio.src truthiness — an emptied
  // `audio.src = ''` resolves back to the page's own URL (a truthy string),
  // not an empty one, so that check would stay "true" forever after the
  // first fallback use.
  const fallbackActiveRef = useRef(false);

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

  const stopFallbackAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    fallbackChunksRef.current = [];
    fallbackIndexRef.current = 0;
    fallbackActiveRef.current = false;
  }, []);

  // Stop narration when the underlying content changes (e.g. the student
  // switches lessons) or this button unmounts — never leave a stale
  // utterance/audio chunk talking over new content.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
      stopFallbackAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, text]);

  // Plays fallbackChunksRef sequentially from fallbackIndexRef through one
  // <audio> element — Google's translate_tts endpoint only accepts short
  // text per request (see the module comment above), so long narrations are
  // stitched together chunk-by-chunk rather than sent as one request.
  const playFallbackChunk = useCallback(
    (atRate: number) => {
      const chunks = fallbackChunksRef.current;
      const index = fallbackIndexRef.current;
      if (index >= chunks.length) {
        setPlaying(false);
        setPaused(false);
        setProgress(1);
        return;
      }
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.src = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ka&client=tw-ob&q=${encodeURIComponent(chunks[index])}`;
      audio.playbackRate = atRate;
      audio.ontimeupdate = () => {
        const chunkProgress = audio.duration ? audio.currentTime / audio.duration : 0;
        setProgress(Math.min(1, (index + chunkProgress) / chunks.length));
      };
      audio.onended = () => {
        fallbackIndexRef.current += 1;
        playFallbackChunk(atRate);
      };
      audio.onerror = () => {
        setPlaying(false);
        setPaused(false);
        setAudioUnavailable(true);
        setTimeout(() => setAudioUnavailable(false), 4000);
      };
      audio.play().catch(() => {
        setPlaying(false);
        setPaused(false);
        setAudioUnavailable(true);
        setTimeout(() => setAudioUnavailable(false), 4000);
      });
    },
    []
  );

  const startFallback = useCallback(
    (atRate: number) => {
      const chunks = splitForGoogleTts(cleanTextRef.current);
      if (chunks.length === 0) return;
      fallbackActiveRef.current = true;
      fallbackChunksRef.current = chunks;
      fallbackIndexRef.current = 0;
      setPlaying(true);
      setPaused(false);
      setProgress(0);
      playFallbackChunk(atRate);
    },
    [playFallbackChunk]
  );

  const speak = useCallback(
    async (atRate: number) => {
      if (!cleanTextRef.current.trim()) return;
      if (supported) window.speechSynthesis.cancel();
      stopFallbackAudio();

      const voice = supported ? pickVoice(await getVoicesAsync(), speechLang) : null;

      // Never let the platform fall back to whatever default voice it picks
      // for an unmatched lang — for Georgian specifically that's typically
      // an English voice attempting Georgian text letter-by-letter, which
      // reads as broken rather than merely accented. Seamlessly hand off to
      // the Google Translate audio fallback instead of just erroring out —
      // most browsers ship zero Georgian speechSynthesis voices, so this is
      // the common path for `ka`, not a rare edge case.
      if (!supported || (speechLang.split('-')[0] === 'ka' && !voice)) {
        startFallback(atRate);
        return;
      }

      fallbackActiveRef.current = false;
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
    [supported, speechLang, stopFallbackAudio, startFallback]
  );

  const usingFallback = () => fallbackActiveRef.current;

  const toggle = () => {
    if (usingFallback()) {
      const audio = audioRef.current!;
      if (playing && !paused) {
        audio.pause();
        setPaused(true);
      } else if (playing && paused) {
        audio.play();
        setPaused(false);
      } else {
        startFallback(rate);
      }
      return;
    }
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
    if (!playing) return;
    if (usingFallback()) {
      // Unlike SpeechSynthesisUtterance, HTMLAudioElement.playbackRate can
      // change live without restarting the current chunk.
      if (audioRef.current) audioRef.current.playbackRate = next;
      return;
    }
    // Most browsers can't change an in-flight utterance's rate — restart
    // from the beginning at the new rate rather than silently ignoring the
    // change, the platform's actual limitation, not a bug to hide.
    speak(next);
  };

  const defaultLabel = lang === 'ka' ? '🔊 ტექსტის მოსმენა' : '🔊 Listen to Text';
  const displayLabel = label ?? defaultLabel;
  const isActive = playing && !paused;
  // Only shown when BOTH native speechSynthesis and the Google Translate
  // audio fallback have failed (e.g. the fallback request itself is
  // network-blocked) — no longer the old "browser has no Georgian voice"
  // message, since that case is now handled seamlessly via the fallback
  // instead of surfacing a warning.
  const unavailableMessage =
    lang === 'ka' ? 'ხმოვანი წაკითხვა დროებით მიუწვდომელია' : 'Audio narration is temporarily unavailable';

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 text-white border-none cursor-pointer shadow-sm shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow ${className}`}
          title={audioUnavailable ? unavailableMessage : displayLabel}
        >
          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        {audioUnavailable && <span className="text-[10px] text-amber-500 dark:text-amber-400">{unavailableMessage}</span>}
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
      {audioUnavailable && <span className="text-[11px] text-amber-500 dark:text-amber-400 px-1">{unavailableMessage}</span>}
    </div>
  );
}
