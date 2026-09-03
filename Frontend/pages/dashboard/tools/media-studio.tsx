import { useEffect, useMemo, useRef, useState, SyntheticEvent } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import {
  Mic,
  Video,
  Link2,
  Download,
  Copy,
  Mail,
  FileText,
  FileDown,
  Loader2,
  X,
  AlertCircle,
  ChevronDown,
  Search,
  Play,
  Pause,
  Square,
} from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SEOHead from '../../../src/components/seo/SEOHead';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import FileDropzone from '../../../src/components/shared/FileDropzone';
import { useAuth } from '../../../src/context/AuthContext';
import {
  getTtsVoices,
  synthesizeSpeech,
  transcribeVideoUpload,
  transcribeYoutubeUrl,
  sendMediaStudioEmail,
  TtsVoice,
} from '../../../src/services/mediaStudioService';

// ============================================================
// AI Voice & Video Media Studio.
// Feature A (this page's "tts" tab) talks to Backend's routes/tts.ts;
// Feature B ("video" tab) talks to routes/mediaStudio.ts.
// ============================================================

// Mirrors Backend's azureSpeechService.MAX_TTS_TEXT_LENGTH — duplicated as a
// plain constant rather than fetched, same "just a constant" posture as
// productService.ts's own pricing-rule mirrors.
const MAX_TTS_CHARS = 8000;

// Maps this site's own locale codes to a BCP-47 voice locale, purely to pick
// a sensible default voice for whichever language the visitor is already
// browsing in — the pickers below are otherwise independent of the site's UI
// language.
const SITE_LOCALE_TO_VOICE_LOCALE: Record<string, string> = {
  ka: 'ka-GE',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  uk: 'uk-UA',
  tr: 'tr-TR',
  hy: 'hy-AM',
  az: 'az-AZ',
};

// Locales pinned to the top of the searchable language list, in this order —
// the rest of Azure's ~140 voice locales are sorted alphabetically by their
// human-readable label underneath. Hand-picked labels for these (and for any
// other locale whose Intl.DisplayNames output wouldn't read naturally) live
// in LOCALE_LABEL_OVERRIDES below.
const PRIMARY_LOCALES = ['ka-GE', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'tr-TR'];

const LOCALE_LABEL_OVERRIDES: Record<string, string> = {
  'ka-GE': 'ქართული (Georgian)',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'es-ES': 'Español',
  'tr-TR': 'Türkçe',
};

// Everything outside the overrides above is derived from Intl.DisplayNames
// so the rest of Azure's voice locales never fall back to a raw BCP-47 code
// like "ar-EG" or "bn-IN" in the UI.
let languageNames: Intl.DisplayNames | null = null;
let regionNames: Intl.DisplayNames | null = null;
try {
  languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {
  // Intl.DisplayNames unsupported in this runtime — humanizeLocale falls
  // back to the bare language subtag below instead of a full locale code.
}

function humanizeLocale(locale: string, showRegion: boolean): string {
  if (LOCALE_LABEL_OVERRIDES[locale]) return LOCALE_LABEL_OVERRIDES[locale];
  const [lang, region] = locale.split('-');
  const langLabel = languageNames?.of(lang) ?? lang;
  if (!showRegion || !region) return langLabel;
  const regionLabel = regionNames?.of(region) ?? region;
  return `${langLabel} (${regionLabel})`;
}

interface LanguageOption {
  locale: string;
  label: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// axios still deserializes an error *body* as a Blob when the request itself
// asked for responseType: 'blob' (synthesizeSpeech) — the real JSON message
// the backend sent (e.g. a 501 "not configured") is otherwise invisible.
async function extractErrorMessage(err: any, fallback: string): Promise<string> {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed?.message) return parsed.message;
    } catch {
      // fall through to fallback
    }
  } else if (data?.message) {
    return data.message;
  }
  return fallback;
}

const PLAYBACK_RATES: Array<{ value: number; label: string }> = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1.0x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2.0x' },
];

// Searchable, pinned-then-alphabetical language combobox — Azure exposes
// ~140 voice locales, far too many for a plain <select> to stay usable, and
// raw locale codes ("ar-EG") are never acceptable as a displayed label.
function LanguageSelect({
  options,
  value,
  onChange,
  allLabel,
  searchPlaceholder,
}: {
  options: LanguageOption[];
  value: string;
  onChange: (locale: string) => void;
  allLabel: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedLabel = value === 'all' ? allLabel : (options.find((o) => o.locale === value)?.label ?? value);

  const selectOption = (locale: string) => {
    onChange(locale);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-left cursor-pointer"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg flex flex-col overflow-hidden">
          <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => selectOption('all')}
              className={`w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${
                value === 'all' ? 'text-cyan-600 dark:text-cyan-400 font-bold' : ''
              }`}
            >
              {allLabel}
            </button>
            {filtered.map((o) => (
              <button
                key={o.locale}
                type="button"
                onClick={() => selectOption(o.locale)}
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 truncate ${
                  value === o.locale ? 'text-cyan-600 dark:text-cyan-400 font-bold' : ''
                }`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">—</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function MediaStudioContent() {
  const { t } = useTranslation('mediaStudio');
  const { user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'tts' | 'video'>('tts');

  // ---------------- Feature A: Text to Speech ----------------
  const [voices, setVoices] = useState<TtsVoice[] | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [voiceShortName, setVoiceShortName] = useState<string>('');
  const [speed, setSpeed] = useState(1);
  const [ttsLoading, setTtsLoading] = useState<'main' | 'selection' | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    getTtsVoices()
      .then(setVoices)
      .catch(async (err) => setVoicesError(await extractErrorMessage(err, t('ttsNoVoicesConfigured'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const languageOptions = useMemo<LanguageOption[]>(() => {
    if (!voices) return [];
    const locales = Array.from(new Set(voices.map((v) => v.locale)));
    const baseLanguageCounts = new Map<string, number>();
    for (const locale of locales) {
      const base = locale.split('-')[0];
      baseLanguageCounts.set(base, (baseLanguageCounts.get(base) ?? 0) + 1);
    }
    const options = locales.map((locale) => {
      const base = locale.split('-')[0];
      const showRegion = (baseLanguageCounts.get(base) ?? 1) > 1;
      return { locale, label: humanizeLocale(locale, showRegion) };
    });

    const pinned = PRIMARY_LOCALES.map((locale) => options.find((o) => o.locale === locale)).filter(
      (o): o is LanguageOption => !!o
    );
    const pinnedSet = new Set(pinned.map((o) => o.locale));
    const rest = options.filter((o) => !pinnedSet.has(o.locale)).sort((a, b) => a.label.localeCompare(b.label));

    return [...pinned, ...rest];
  }, [voices]);

  const filteredVoices = useMemo(() => {
    if (!voices) return [];
    return voices.filter(
      (v) => (languageFilter === 'all' || v.locale === languageFilter) && (genderFilter === 'all' || v.gender === genderFilter)
    );
  }, [voices, languageFilter, genderFilter]);

  // Preselect a voice matching the current site locale the first time the
  // voice list loads; otherwise fall back to the first available voice.
  useEffect(() => {
    if (!voices || voices.length === 0 || voiceShortName) return;
    const preferredLocale = SITE_LOCALE_TO_VOICE_LOCALE[router.locale ?? 'ka'] ?? '';
    const preferred = voices.find((v) => v.locale === preferredLocale);
    setVoiceShortName((preferred ?? voices[0]).shortName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices]);

  useEffect(() => {
    // Selected voice fell out of the current filter — snap to the first
    // still-visible option rather than leaving a stale, hidden selection.
    if (filteredVoices.length > 0 && !filteredVoices.some((v) => v.shortName === voiceShortName)) {
      setVoiceShortName(filteredVoices[0].shortName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVoices]);

  useEffect(
    () => () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    []
  );

  const selectedVoice = voices?.find((v) => v.shortName === voiceShortName) ?? null;
  const selectedText = text.slice(selection.start, selection.end);

  const handleTextSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    setSelection({ start: target.selectionStart, end: target.selectionEnd });
  };

  const runSynthesis = async (source: string, which: 'main' | 'selection') => {
    if (!selectedVoice || !source.trim()) return;
    setTtsLoading(which);
    setTtsError(null);
    try {
      const blob = await synthesizeSpeech({
        text: source.trim(),
        voiceShortName: selectedVoice.shortName,
        voiceLocale: selectedVoice.locale,
        speed,
      });
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
      setAudioBlob(blob);
      setPlaybackRate(1);
    } catch (err) {
      setTtsError(await extractErrorMessage(err, t('ttsError')));
    } finally {
      setTtsLoading(null);
    }
  };

  const handleGenerateSpeech = () => runSynthesis(text, 'main');
  const handleSpeakSelected = () => runSynthesis(selectedText, 'selection');

  useEffect(() => {
    if (audioElRef.current) audioElRef.current.playbackRate = playbackRate;
  }, [playbackRate, audioUrl]);

  const handlePlay = () => audioElRef.current?.play();
  const handlePause = () => audioElRef.current?.pause();
  const handleStop = () => {
    const el = audioElRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
  };

  // ---------------- Feature B: Video → Transcript + Notes ----------------
  const [videoSource, setVideoSource] = useState<'youtube' | 'upload'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');
  const [copiedField, setCopiedField] = useState<'transcript' | 'notes' | null>(null);

  const handleTranscribe = async () => {
    setVideoLoading(true);
    setVideoError(null);
    try {
      const result = videoSource === 'upload' && videoFile ? await transcribeVideoUpload(videoFile) : await transcribeYoutubeUrl(youtubeUrl.trim());
      setTranscript(result.transcript);
      setNotes(result.notes);
    } catch (err) {
      setVideoError(await extractErrorMessage(err, t('videoError')));
    } finally {
      setVideoLoading(false);
    }
  };

  const canTranscribe = videoSource === 'youtube' ? youtubeUrl.trim().length > 0 : !!videoFile;

  const handleCopy = async (field: 'transcript' | 'notes') => {
    const value = field === 'transcript' ? transcript : notes;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExportTxt = () => {
    const parts = [];
    if (notes) parts.push(`${t('videoNotesHeading')}\n\n${notes}`);
    if (transcript) parts.push(`${t('videoTranscriptHeading')}\n\n${transcript}`);
    downloadBlob(new Blob([parts.join('\n\n---\n\n')], { type: 'text/plain;charset=utf-8' }), 'media-studio-export.txt');
  };

  const handleExportDocx = async () => {
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
    const toParagraphs = (text: string) => text.split('\n').map((line) => new Paragraph({ children: [new TextRun(line)] }));
    const children: any[] = [];
    if (notes) {
      children.push(new Paragraph({ text: t('videoNotesHeading'), heading: HeadingLevel.HEADING_1 }));
      children.push(...toParagraphs(notes));
    }
    if (transcript) {
      children.push(new Paragraph({ text: t('videoTranscriptHeading'), heading: HeadingLevel.HEADING_1 }));
      children.push(...toParagraphs(transcript));
    }
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, 'media-studio-export.docx');
  };

  // ---------------- Email export modal ----------------
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState(user?.email ?? '');
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'success' | 'error' | null>(null);

  const handleSendEmail = async () => {
    setEmailSending(true);
    setEmailStatus(null);
    try {
      await sendMediaStudioEmail({ to: emailTo.trim(), transcript: transcript || undefined, notes: notes || undefined, lang: router.locale === 'ka' ? 'ka' : 'en' });
      setEmailStatus('success');
    } catch {
      setEmailStatus('error');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/tools" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Mic className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            {t('pageTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('pageSubtitle')}</p>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('tts')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer flex items-center gap-1.5 ${
              tab === 'tts' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Mic className="w-4 h-4" />
            {t('tabTts')}
          </button>
          <button
            type="button"
            onClick={() => setTab('video')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer flex items-center gap-1.5 ${
              tab === 'video' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Video className="w-4 h-4" />
            {t('tabVideo')}
          </button>
        </div>

        {tab === 'tts' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            {voicesError ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {voicesError}
              </p>
            ) : (
              <>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{t('ttsTextareaLabel')}</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_TTS_CHARS))}
                  onSelect={handleTextSelect}
                  placeholder={t('ttsTextareaPlaceholder') as string}
                  rows={8}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-slate-400 mt-1 text-right">
                  {text.length} / {MAX_TTS_CHARS} {t('ttsCharsCount')}
                </p>

                <div className="grid sm:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{t('ttsLanguageLabel')}</label>
                    <LanguageSelect
                      options={languageOptions}
                      value={languageFilter}
                      onChange={setLanguageFilter}
                      allLabel={t('ttsLanguageAll') as string}
                      searchPlaceholder={t('ttsLanguageSearchPlaceholder') as string}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{t('ttsGenderLabel')}</label>
                    <select
                      value={genderFilter}
                      onChange={(e) => setGenderFilter(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
                    >
                      <option value="all">{t('ttsGenderAll')}</option>
                      <option value="Female">{t('ttsGenderFemale')}</option>
                      <option value="Male">{t('ttsGenderMale')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{t('ttsVoiceLabel')}</label>
                    <select
                      value={voiceShortName}
                      onChange={(e) => setVoiceShortName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm"
                    >
                      {filteredVoices.map((v) => (
                        <option key={v.shortName} value={v.shortName}>
                          {v.displayName} ({v.gender === 'Female' ? t('ttsGenderFemale') : t('ttsGenderMale')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                    {t('ttsSpeedLabel')}: {speed.toFixed(2)}x
                  </label>
                  <input type="range" min={0.5} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full" />
                </div>

                {ttsError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{ttsError}</p>}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!text.trim() || !selectedVoice || ttsLoading !== null}
                    onClick={handleGenerateSpeech}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                  >
                    {ttsLoading === 'main' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                    {ttsLoading === 'main' ? t('ttsGenerating') : t('ttsGenerateButton')}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedText.trim() || !selectedVoice || ttsLoading !== null}
                    onClick={handleSpeakSelected}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                  >
                    {ttsLoading === 'selection' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t('ttsSpeakSelectedButton')}
                  </button>
                </div>

                {audioUrl && (
                  <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">{t('playerTitle')}</p>
                    <audio
                      ref={audioElRef}
                      src={audioUrl}
                      controls
                      className="w-full mb-3"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePlay}
                        disabled={isPlaying}
                        className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {t('playerPlay')}
                      </button>
                      <button
                        type="button"
                        onClick={handlePause}
                        disabled={!isPlaying}
                        className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        {t('playerPause')}
                      </button>
                      <button
                        type="button"
                        onClick={handleStop}
                        className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Square className="w-3.5 h-3.5" />
                        {t('playerStop')}
                      </button>
                      <select
                        value={playbackRate}
                        onChange={(e) => setPlaybackRate(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-xs font-bold"
                        aria-label={t('playerSpeedLabel') as string}
                      >
                        {PLAYBACK_RATES.map((rate) => (
                          <option key={rate.value} value={rate.value}>
                            {rate.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => audioBlob && downloadBlob(audioBlob, 'narration.mp3')}
                        className="ml-auto inline-flex items-center gap-2 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-bold text-xs px-3 py-2 rounded-lg bg-transparent cursor-pointer hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t('ttsDownloadButton')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'video' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setVideoSource('youtube')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                  videoSource === 'youtube' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30' : 'bg-transparent border border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <Link2 className="w-4 h-4" />
                {t('videoYoutubeTab')}
              </button>
              <button
                type="button"
                onClick={() => setVideoSource('upload')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                  videoSource === 'upload' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30' : 'bg-transparent border border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <Video className="w-4 h-4" />
                {t('videoUploadTab')}
              </button>
            </div>

            {videoSource === 'youtube' ? (
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder={t('videoYoutubePlaceholder') as string}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            ) : (
              <FileDropzone
                accept="video/*,audio/*,.mp4,.mov,.webm,.mp3,.wav,.m4a"
                uploading={false}
                selectedFileName={videoFile?.name ?? null}
                onFile={setVideoFile}
                label={t('videoUploadCta') as string}
                hint={t('videoUploadHint') as string}
                uploadingLabel={t('videoProcessing') as string}
              />
            )}

            {videoError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{videoError}</p>}

            <div className="mt-6">
              <button
                type="button"
                disabled={!canTranscribe || videoLoading}
                onClick={handleTranscribe}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                {videoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {videoLoading ? t('videoProcessing') : t('videoTranscribeButton')}
              </button>
            </div>

            {!transcript && !notes && !videoLoading && <p className="text-sm text-slate-400 mt-6">{t('videoEmptyState')}</p>}

            {(transcript || notes) && (
              <div className="mt-8 space-y-8">
                {notes && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('videoNotesHeading')}</h2>
                      <button type="button" onClick={() => handleCopy('notes')} className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-transparent border-none cursor-pointer hover:underline">
                        <Copy className="w-3.5 h-3.5" />
                        {copiedField === 'notes' ? t('videoCopiedToast') : t('videoCopyNotes')}
                      </button>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={10}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}
                {transcript && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('videoTranscriptHeading')}</h2>
                      <button type="button" onClick={() => handleCopy('transcript')} className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-transparent border-none cursor-pointer hover:underline">
                        <Copy className="w-3.5 h-3.5" />
                        {copiedField === 'transcript' ? t('videoCopiedToast') : t('videoCopyTranscript')}
                      </button>
                    </div>
                    <textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={14}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    className="inline-flex items-center gap-2 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-bold text-sm px-4 py-2.5 rounded-xl bg-transparent cursor-pointer hover:bg-cyan-500/10 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {t('videoEmailButton')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportDocx}
                    className="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm px-4 py-2.5 rounded-xl bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                    {t('videoExportDocxButton')}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportTxt}
                    className="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm px-4 py-2.5 rounded-xl bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                    {t('videoExportTxtButton')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SiteFooter />

      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowEmailModal(false)}>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-black tracking-wide mb-4">{t('emailModalTitle')}</h3>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{t('emailModalRecipientLabel')}</label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            {emailStatus === 'success' && <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">{t('emailModalSuccess')}</p>}
            {emailStatus === 'error' && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{t('emailModalError')}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!emailTo.trim() || emailSending}
                onClick={handleSendEmail}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-4 py-2.5 rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {emailSending ? t('emailModalSending') : t('emailModalSendButton')}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold bg-transparent cursor-pointer text-slate-600 dark:text-slate-300"
              >
                {t('emailModalCancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MediaStudioPage() {
  const { t } = useTranslation('mediaStudio');
  return (
    <>
      {/* See educator-hub.tsx's identical comment: rendered above
          ProtectedRoute, not inside it, so the noindex tag actually reaches
          an unauthenticated crawler's DOM. */}
      <SEOHead title={t('pageTitle')} description={t('catalogDesc')} noIndex />
      <ProtectedRoute>
        <MediaStudioContent />
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'mediaStudio'])) },
});
