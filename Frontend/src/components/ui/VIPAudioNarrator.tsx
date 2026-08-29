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

// Georgian narration fallback, for the large share of browsers that ship
// zero Georgian speechSynthesis voices — proxied server-side through
// /api/tts to Azure Cognitive Services Speech (see that route's own
// comment for why: a real, documented TTS API with genuine Georgian neural
// voices, unlike an earlier attempt at Google Translate's undocumented
// translate_tts endpoint, which turned out to reject Georgian outright).
// Azure's REST TTS endpoint accepts thousands of characters per request,
// comfortably more than any single lesson conspectus/forum post here, but
// text is still split on sentence boundaries and played back-to-back —
// mainly so the progress bar has more than one waypoint on long narrations,
// not because of a hard per-request limit like the old Google endpoint had.
const TTS_CHUNK_LIMIT = 1500;
const AZURE_VOICE = 'ka-GE-EkaNeural';

// Average speaking rate used to estimate a narration's total duration for
// the seek bar's timestamp display ("0:45 / 2:10") — neither playback
// engine exposes a real duration up front. The Web Speech API has no
// duration/currentTime concept at all (nothing to query before/during
// playback beyond onboundary's character offset); the Azure fallback's
// real per-chunk <audio> duration only becomes known once that chunk has
// actually been fetched, and later chunks haven't been fetched yet. ~15
// characters/second at rate 1 approximates a natural reading pace closely
// enough for a progress display — it is deliberately an estimate, not a
// precise media duration, and is used identically by both engines so the
// bar behaves consistently regardless of which one is narrating.
const CHARS_PER_SECOND_AT_RATE_1 = 15;

function estimateDurationSeconds(text: string, rate: number): number {
  return Math.max(1, text.length / CHARS_PER_SECOND_AT_RATE_1 / rate);
}

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Extracts clientX from either a mouse or touch DOM event — the seek bar's
// drag handlers are attached as native window listeners (not React
// SyntheticEvents, since the drag must keep tracking even once the pointer
// leaves the track/thumb element itself), so this normalizes both event
// shapes in one place rather than duplicating the touches/changedTouches
// branching at every call site.
function extractClientX(e: MouseEvent | TouchEvent): number | null {
  if ('touches' in e) {
    const touch = e.touches[0] ?? e.changedTouches[0];
    return touch ? touch.clientX : null;
  }
  return e.clientX;
}

function splitForTts(input: string): string[] {
  const sentences = input.match(/[^.!?։\n]+[.!?։]*\s*/g) ?? [input];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > TTS_CHUNK_LIMIT) {
      if (current.trim()) chunks.push(current.trim());
      if (sentence.length > TTS_CHUNK_LIMIT) {
        for (let i = 0; i < sentence.length; i += TTS_CHUNK_LIMIT) {
          chunks.push(sentence.slice(i, i + TTS_CHUNK_LIMIT).trim());
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
  // null = no failure. Distinguished so the UI can tell "Azure isn't
  // configured/the key is bad" (an operator problem) apart from a plain
  // transient failure, per the explicit ask.
  const [fallbackFailure, setFallbackFailure] = useState<'not_configured' | 'unauthorized' | 'error' | null>(null);
  const cleanTextRef = useRef('');
  // Non-null while narrating via the /api/tts (Azure Speech) fallback
  // instead of native speechSynthesis — toggle()/handleRateChange() branch
  // on this so the same play/pause/speed controls drive whichever engine is
  // active.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackChunksRef = useRef<string[]>([]);
  const fallbackIndexRef = useRef(0);
  // The <audio> element plays a blob: URL (from the fetched response), not
  // the /api/tts URL directly — fetching first lets us read the actual HTTP
  // status (401/403/501/etc.) to distinguish failure reasons, which an
  // <audio src> load's onerror alone can't expose. Revoked on every chunk
  // change/stop to avoid leaking one blob URL per sentence.
  const objectUrlRef = useRef<string | null>(null);
  // Explicit flag rather than checking audio.src truthiness — an emptied
  // `audio.src = ''` resolves back to the page's own URL (a truthy string),
  // not an empty one, so that check would stay "true" forever after the
  // first fallback use.
  const fallbackActiveRef = useRef(false);

  // ---- Seek bar state ----
  // 0-1 fraction of the whole narration while a drag is in progress; null
  // when not dragging (the bar then just reflects `progress`). A ref
  // mirrors the state so the window-level move/up listeners (added
  // imperatively on pointerdown, see handleSeekPointerDown) always read the
  // latest value instead of a stale closure from when the drag started.
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const dragFractionRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  // Guards against the synthetic 'click' that some mobile browsers fire
  // ~300ms after a 'touchend' on the same element — without this, one tap
  // on the play/pause button could toggle it, then have the trailing click
  // toggle it right back.
  const lastTouchToggleRef = useRef(0);

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
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
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

  const reportFallbackFailure = (reason: 'not_configured' | 'unauthorized' | 'error') => {
    setPlaying(false);
    setPaused(false);
    setFallbackFailure(reason);
    setTimeout(() => setFallbackFailure(null), 4000);
  };

  // Plays fallbackChunksRef sequentially from fallbackIndexRef through one
  // <audio> element, fetching each chunk from /api/tts first (rather than
  // pointing audio.src at it directly) so a non-2xx response's actual
  // status is visible to JS — an <audio src> load failure's onerror alone
  // doesn't expose the HTTP status, which is what reportFallbackFailure
  // needs to distinguish "not configured" from "bad key" from "other".
  const playFallbackChunk = useCallback(async (atRate: number, seekToFraction?: number) => {
    const chunks = fallbackChunksRef.current;
    const index = fallbackIndexRef.current;
    if (index >= chunks.length) {
      setPlaying(false);
      setPaused(false);
      setProgress(1);
      return;
    }

    let response: Response;
    try {
      response = await fetch(`/api/tts?text=${encodeURIComponent(chunks[index])}&voice=${encodeURIComponent(AZURE_VOICE)}`);
    } catch {
      reportFallbackFailure('error');
      return;
    }

    if (!response.ok) {
      if (response.status === 501) reportFallbackFailure('not_configured');
      else if (response.status === 401 || response.status === 403) reportFallbackFailure('unauthorized');
      else reportFallbackFailure('error');
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(await response.blob());
    objectUrlRef.current = objectUrl;

    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.src = objectUrl;
    audio.playbackRate = atRate;
    // The seek bar's "jump to a different, not-yet-loaded chunk" path (see
    // performSeek) — the target chunk's real duration isn't known until its
    // metadata loads, so the jump-to-position within it happens here, once,
    // right after that fires, rather than guessing before the browser has
    // actually parsed the audio.
    if (seekToFraction != null) {
      const onLoadedMetadata = () => {
        audio.currentTime = seekToFraction * (audio.duration || 0);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
    }
    audio.onplay = () => setFallbackFailure(null);
    audio.ontimeupdate = () => {
      const chunkProgress = audio.duration ? audio.currentTime / audio.duration : 0;
      setProgress(Math.min(1, (index + chunkProgress) / chunks.length));
    };
    audio.onended = () => {
      fallbackIndexRef.current += 1;
      playFallbackChunk(atRate);
    };
    audio.onerror = () => reportFallbackFailure('error');
    audio.play().catch(() => reportFallbackFailure('error'));
  }, []);

  const startFallback = useCallback(
    (atRate: number) => {
      const chunks = splitForTts(cleanTextRef.current);
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
      const isGeorgian = speechLang.split('-')[0].toLowerCase() === 'ka';

      // Never let the platform fall back to whatever default voice it picks
      // for an unmatched lang — for Georgian specifically that's typically
      // an English voice attempting Georgian text letter-by-letter, which
      // reads as broken rather than merely accented. Seamlessly hand off to
      // the Azure Speech fallback instead of just erroring out — most
      // browsers ship zero Georgian speechSynthesis voices, so this is the
      // common path for `ka`, not a rare edge case. /api/tts only knows a
      // Georgian voice, so a non-Georgian text on a browser with no
      // speechSynthesis support at all has no working engine either way —
      // reported directly rather than attempted against the wrong voice.
      if (isGeorgian && !voice) {
        startFallback(atRate);
        return;
      }
      if (!supported) {
        reportFallbackFailure('error');
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

  // Jumps playback to `fraction` (0-1 of the whole narration) — the seek
  // bar's drag-release/click handler. Only ever called while something is
  // already playing/paused (the bar is inert until then, see the render
  // below), so both branches can assume an engine is already active.
  //
  // Neither engine supports a real seek natively: the Web Speech API has no
  // "resume from character N" primitive at all, so the native branch
  // restarts speech from a text SUBSTRING at the target character offset —
  // functionally a seek, since onboundary's charIndex is then re-anchored
  // to that offset to keep the global progress fraction correct. The Azure
  // fallback branch gets a real, precise HTMLAudioElement.currentTime seek
  // when the target falls inside the already-loaded chunk; jumping into a
  // different chunk re-fetches it first (see playFallbackChunk's
  // seekToFraction param) since an unfetched chunk has no audio to seek
  // within yet.
  const performSeek = useCallback(
    (fraction: number) => {
      const clamped = Math.min(1, Math.max(0, fraction));
      const fullText = cleanTextRef.current;
      if (!fullText.trim()) return;
      const targetCharIndex = Math.round(clamped * fullText.length);

      if (usingFallback()) {
        const chunks = fallbackChunksRef.current;
        let charsBefore = 0;
        let targetChunkIndex = chunks.length - 1;
        let localFraction = 1;
        for (let i = 0; i < chunks.length; i++) {
          const chunkLen = chunks[i].length;
          if (targetCharIndex <= charsBefore + chunkLen || i === chunks.length - 1) {
            targetChunkIndex = i;
            localFraction = chunkLen > 0 ? Math.min(1, Math.max(0, (targetCharIndex - charsBefore) / chunkLen)) : 0;
            break;
          }
          charsBefore += chunkLen;
        }

        if (targetChunkIndex === fallbackIndexRef.current && audioRef.current && audioRef.current.duration) {
          audioRef.current.currentTime = localFraction * audioRef.current.duration;
          audioRef.current.play().catch(() => reportFallbackFailure('error'));
        } else {
          fallbackIndexRef.current = targetChunkIndex;
          playFallbackChunk(rate, localFraction);
        }
        setPlaying(true);
        setPaused(false);
        setProgress(clamped);
        return;
      }

      if (!supported) return;
      window.speechSynthesis.cancel();
      const remainder = fullText.slice(targetCharIndex);
      if (!remainder.trim()) {
        setPlaying(false);
        setPaused(false);
        setProgress(1);
        return;
      }

      fallbackActiveRef.current = false;
      const utterance = new SpeechSynthesisUtterance(remainder);
      utterance.lang = speechLang;
      utterance.rate = rate;
      getVoicesAsync().then((voices) => {
        const voice = pickVoice(voices, speechLang);
        if (voice) utterance.voice = voice;
      });
      utterance.onboundary = (e) => {
        const len = fullText.length;
        if (len > 0) setProgress(Math.min(1, (targetCharIndex + e.charIndex) / len));
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
      setProgress(clamped);
    },
    [rate, speechLang, supported, playFallbackChunk]
  );

  const fractionFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  // Shared entry point for both onMouseDown and onTouchStart on the seek
  // track/thumb. Attaches window-level move/up listeners imperatively
  // (rather than via React state + a useEffect) so the drag keeps tracking
  // smoothly even once the pointer moves outside the track's own bounds —
  // the standard pattern for a draggable slider. A plain tap/click with no
  // movement in between naturally ends up calling performSeek with the same
  // position it started at, which is what implements "click anywhere on the
  // track to jump there" without a separate handler.
  const handleSeekPointerDown = (clientX: number) => {
    if (!(playing || paused)) return; // nothing loaded to scrub yet
    draggingRef.current = true;
    const startFraction = fractionFromClientX(clientX);
    dragFractionRef.current = startFraction;
    setDragFraction(startFraction);

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const x = extractClientX(e);
      if (x == null) return;
      const f = fractionFromClientX(x);
      dragFractionRef.current = f;
      setDragFraction(f);
    };
    const handleUp = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const x = extractClientX(e);
      const finalFraction = x != null ? fractionFromClientX(x) : dragFractionRef.current ?? 0;
      dragFractionRef.current = null;
      setDragFraction(null);
      performSeek(finalFraction);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleUp);
  };

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

  // iOS/Android fire a synthetic 'click' shortly after 'touchend' on the
  // same element — bound alongside onClick (never a plain onClick alone),
  // this pair stops that trailing click from toggling play/pause a second
  // time and immediately undoing the tap. preventDefault on touchend
  // already suppresses the ghost click in most current mobile browsers;
  // the timestamp guard in handleToggleClick is the defensive backstop for
  // the ones where it doesn't.
  const handleToggleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    lastTouchToggleRef.current = Date.now();
    toggle();
  };
  const handleToggleClick = () => {
    if (Date.now() - lastTouchToggleRef.current < 500) return;
    toggle();
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
  const scrubbable = playing || paused;
  // The dragged position while actively scrubbing takes over the display
  // immediately (so the thumb/timestamps track the pointer in real time,
  // not just the last committed seek) — falls back to the real playback
  // `progress` the rest of the time.
  const displayFraction = dragFraction ?? progress;
  const estimatedDuration = estimateDurationSeconds(cleanTextRef.current || text, rate);
  // 'not_configured'/'unauthorized' mean /api/tts itself is unusable
  // (AZURE_SPEECH_KEY/REGION missing, or a bad key returning 401/403) — an
  // operator problem, distinct from 'error' (a plain transient failure:
  // network blip, Azure outage, or no engine at all for a non-Georgian
  // narration with no native voice — see speak()'s `!supported` branch).
  const unavailableMessage =
    fallbackFailure === 'not_configured' || fallbackFailure === 'unauthorized'
      ? lang === 'ka'
        ? 'ხმოვანი წაკითხვებისთვის საჭიროა Azure API გასაღები'
        : 'Audio narration requires an Azure API key to be configured'
      : lang === 'ka'
        ? 'ხმოვანი წაკითხვა დროებით მიუწვდომელია'
        : 'Audio narration is temporarily unavailable';

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggleClick}
          onTouchEnd={handleToggleTouchEnd}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 text-white border-none cursor-pointer shadow-sm shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow ${className}`}
          title={fallbackFailure !== null ? unavailableMessage : displayLabel}
        >
          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>
        {fallbackFailure !== null && <span className="text-[10px] text-amber-500 dark:text-amber-400">{unavailableMessage}</span>}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
    <div
      className={`inline-flex flex-col gap-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/10 via-purple-500/10 to-cyan-500/10 px-3.5 py-2.5 shadow-sm shadow-purple-500/10 min-w-[240px] ${className}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggleClick}
          onTouchEnd={handleToggleTouchEnd}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 text-white border-none cursor-pointer shadow-md shadow-purple-500/40"
        >
          {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <span className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" /> {displayLabel}
        </span>

        {isActive && (
          <span className="flex items-end gap-[2px] h-3 shrink-0" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-gradient-to-t from-amber-400 to-cyan-500 animate-[vip-wave_0.9s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}

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
      </div>

      {/* YouTube-style seek bar — draggable glowing thumb, click-anywhere-
          on-track to jump, formatted current/total timestamps either side.
          Inert (no thumb, dimmed, non-interactive) until playback has
          actually started at least once — see handleSeekPointerDown's own
          "nothing loaded to scrub yet" guard. */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400 w-8 text-right shrink-0">
          {formatTime(displayFraction * estimatedDuration)}
        </span>
        <div
          ref={trackRef}
          onMouseDown={(e) => handleSeekPointerDown(e.clientX)}
          onTouchStart={(e) => handleSeekPointerDown(e.touches[0].clientX)}
          className={`relative flex-1 h-1.5 rounded-full bg-slate-300/50 dark:bg-slate-700 ${scrubbable ? 'cursor-pointer' : 'cursor-default opacity-50'}`}
          style={{ touchAction: 'none' }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500"
            style={{ width: `${displayFraction * 100}%` }}
          />
          {scrubbable && (
            <div
              className="absolute top-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.9)] -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${displayFraction * 100}%` }}
            />
          )}
        </div>
        <span className="text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400 w-8 shrink-0">
          {formatTime(estimatedDuration)}
        </span>
      </div>

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
      {fallbackFailure !== null && <span className="text-[11px] text-amber-500 dark:text-amber-400 px-1">{unavailableMessage}</span>}
    </div>
  );
}
