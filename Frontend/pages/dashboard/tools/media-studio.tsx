import { useEffect, useMemo, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Mic, Video, Link2, Download, Copy, Mail, FileText, FileDown, Loader2, X, AlertCircle } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import FileDropzone from '../../../src/components/shared/FileDropzone';
import SEOHead from '../../../src/components/seo/SEOHead';
import { useAuth } from '../../../src/context/AuthContext';
import {
  getTtsVoices,
  synthesizeSpeech,
  transcribeVideoUpload,
  transcribeYoutubeUrl,
  sendMediaStudioEmail,
  TtsVoice,
} from '../../../src/services/mediaStudioService';

// Mirrors Backend's azureSpeechService.MAX_TTS_TEXT_LENGTH — duplicated as a
// plain constant rather than fetched, same "just a constant" posture as
// productService.ts's own pricing-rule mirrors.
const MAX_TTS_CHARS = 8000;

// Maps this site's own locale codes to a BCP-47 voice locale prefix, purely
// to pick a sensible default voice for whichever language the visitor is
// already browsing in — the language/voice pickers below are otherwise
// completely independent of the site's own UI language.
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

function MediaStudioContent() {
  const { t } = useTranslation('mediaStudio');
  const { user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'tts' | 'video'>('tts');
  const [xp, setXp] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    // Fetch initial progress on component mount
    const fetchProgress = async () => {
      try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        setXp(data.xp);
        setHearts(data.hearts);
        setStreak(data.streak);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      }
    };

    fetchProgress();
  }, []);

  // ---------------- Feature A: Text to Speech ----------------
  const [voices, setVoices] = useState<TtsVoice[] | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [voiceShortName, setVoiceShortName] = useState<string>('');
  const [speed, setSpeed] = useState(1);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    getTtsVoices()
      .then(setVoices)
      .catch(async (err) => setVoicesError(await extractErrorMessage(err, t('ttsNoVoicesConfigured'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const languageOptions = useMemo(() => {
    if (!voices) return [];
    const byLocale = new Map<string, string>();
    for (const v of voices) if (!byLocale.has(v.locale)) byLocale.set(v.locale, v.localName);
    return Array.from(byLocale.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
      window.speechSynthesis.cancel(); // Stop speech synthesis completely
    },
    []
  );

  const selectedVoice = voices?.find((v) => v.shortName === voiceShortName) ?? null;

  const handleGenerateSpeech = async () => {
    const updateProgress = async (newXp: number, newHearts: number, newStreak: number) => {
      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id, xp: newXp, hearts: newHearts, streak: newStreak }),
        });
      } catch (error) {
        console.error('Failed to update progress:', error);
      }
    };
    if (!selectedVoice || !text.trim()) return;
    setTtsLoading(true);
    setTtsError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

      let blob;
      try {
        blob = await synthesizeSpeech(
          { text: text.trim(), voiceShortName: selectedVoice.shortName, voiceLocale: selectedVoice.locale, speed },
          { signal: controller.signal }
        );
      } catch (err) {
        if (controller.signal.aborted) {
          setTtsError(t('ttsTimeoutError')); // User-friendly timeout error
        } else {
          setTtsError(await extractErrorMessage(err, t('ttsError')));
        }
        return;
      } finally {
        clearTimeout(timeoutId);
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (audioBlob && text.trim() === audioBlob.text) {
        // Reuse cached audio if the text matches
        setAudioUrl(audioUrlRef.current);
      } else {
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setAudioBlob({ blob, text: text.trim() }); // Cache the blob and text
      }
      setAudioBlob(blob);
      // Update progress on successful task completion
      const newXp = xp + 10; // Example XP increment
      const newStreak = streak + 1;
      setXp(newXp);
      setStreak(newStreak);
      await updateProgress(newXp, hearts, newStreak);
    } catch (err) {
      // Update progress on error (lose a heart)
      const newHearts = hearts - 1;
      setHearts(newHearts);
      await updateProgress(xp, newHearts, streak);
      setTtsError(await extractErrorMessage(err, t('ttsError')));
    } finally {
      setTtsLoading(false);
    }
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
                  placeholder={t('ttsTextareaPlaceholder') as string}
                  rows={8}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-slate-400 mt-1 text-right">
                  {text.length} / {MAX_TTS_CHARS} {t('ttsCharsCount')}
                </p>

                <div className="flex flex-col items-center justify-center mt-4">
                  <div className="text-center">
                    <h2 className="text-xl font-bold">{t('duolingoCardTitle')}</h2>
                    <p className="text-sm text-slate-500">{t('duolingoCardSubtitle')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateSpeech}
                    className="mt-6 inline-flex items-center justify-center w-20 h-20 bg-cyan-500 text-white rounded-full shadow-lg hover:bg-cyan-600 transition-all"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                  <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: '50%' }}></div>
                  </div>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-sm font-bold text-red-500">❤️❤️❤️</span>
                    <span className="text-sm font-bold text-cyan-500">XP: 120</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleSlowPlayback}
                    className="mt-6 inline-flex items-center justify-center w-20 h-20 bg-cyan-500 text-white rounded-full shadow-lg hover:bg-cyan-600 transition-all"
                  >
                    {isSlowPlayback ? 'Normal Speed' : 'Slow Speed'}
                  </button>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                    {t('ttsSpeedLabel')}: {speed.toFixed(2)}x
                  </label>
                  <input type="range" min={0.5} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full" />
                </div>
                <div className="mt-4 flex flex-col items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleSlowPlayback}
                    className="mt-6 inline-flex items-center justify-center w-20 h-20 bg-cyan-500 text-white rounded-full shadow-lg hover:bg-cyan-600 transition-all"
                  >
                    {isSlowPlayback ? 'Normal Speed' : 'Slow Speed'}
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!text.trim() || !selectedVoice || ttsLoading}
                    onClick={handleGenerateSpeech}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                  >
                    {ttsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                    {ttsLoading ? t('ttsGenerating') : t('ttsGenerateButton')}
                  </button>
                </div>

                const LoadingGame: React.FC = () => {
                  const canvasRef = useRef<HTMLCanvasElement | null>(null);
                
                  useEffect(() => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const context = canvas.getContext('2d');
                    if (!context) return;
                
                    // Game logic and rendering goes here
                    const draw = () => {
                      context.clearRect(0, 0, canvas.width, canvas.height);
                      // Draw CDC logo girl and other game elements
                      requestAnimationFrame(draw);
                    };
                    draw();
                  }, []);
                
                  return <canvas ref={canvasRef} width={800} height={600} />;
                };
                  <div className="text-center mb-4">
                    <p className="text-sm text-slate-500">{t('loadingNotice')}</p>
                  </div>
                  <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <audio controls src={audioUrl} className="w-full sm:w-auto" />
                    <button
                      type="button"
                      onClick={() => audioBlob && downloadBlob(audioBlob, 'narration.mp3')}
                      className="inline-flex items-center gap-2 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-bold text-sm px-4 py-2.5 rounded-xl bg-transparent cursor-pointer hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      {t('ttsDownloadButton')}
                    </button>
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
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
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
      {/* See english-tutor/index.tsx's identical comment: rendered above
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
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['mediaStudio'])) },
});
