import { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { ArrowLeft, ChevronLeft, ChevronRight, Headphones, Loader2, Pause, Play, Repeat } from 'lucide-react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import ProtectedRoute from '../../../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../../../src/components/layout/SiteFooter';
import SEOHead from '../../../../../src/components/seo/SEOHead';
import {
  AudioNarrationStatus,
  BookProject,
  fetchBookPageImageUrl,
  fetchNarrationAudioUrl,
  generateNarration,
  getBook,
  getNarrationStatus,
} from '../../../../../src/services/childrensBookService';

function BookReaderContent() {
  const { t } = useTranslation('childrensBook');
  const router = useRouter();
  const bookId = typeof router.query.bookId === 'string' ? router.query.bookId : null;
  const [book, setBook] = useState<BookProject | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioNarrationStatus | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [playing, setPlaying] = useState(false);
  const [playingFullStory, setPlayingFullStory] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const audioUrlsRef = useRef<Record<number, string>>({});

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    getBook(bookId).then(async ({ book: loadedBook }) => {
      if (cancelled) return;
      setBook(loadedBook);
      if (loadedBook.audioAddOnPurchased) {
        setAudioStatus(await getNarrationStatus(bookId).catch(() => null));
      }
    }).catch(() => {
      if (!cancelled) setError('This book could not be loaded.');
    });
    return () => { cancelled = true; };
  }, [bookId]);

  useEffect(() => {
    if (!bookId || !book?.pages?.length) return;
    let cancelled = false;
    fetchBookPageImageUrl(bookId, pageNumber).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = url;
      setImageUrl(url);
    }).catch(() => setImageUrl(null));
    return () => { cancelled = true; };
  }, [bookId, book?.pages?.length, pageNumber]);

  useEffect(() => {
    if (!bookId || !book?.audioAddOnPurchased || !audioStatus?.eligible) return;
    let cancelled = false;
    const pageNumbers = [...new Set(audioStatus.artifacts.filter((artifact) => artifact.status === 'READY').map((artifact) => artifact.pageNumber))];
    Promise.all(pageNumbers.map(async (number) => [number, await fetchNarrationAudioUrl(bookId, number)] as const))
      .then((entries) => {
        const nextUrls = Object.fromEntries(entries);
        if (cancelled) {
          Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
        audioUrlsRef.current = nextUrls;
        setAudioUrls(nextUrls);
      })
      .catch(() => {
        if (!cancelled) setError('Some page audio could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [bookId, book?.audioAddOnPurchased, audioStatus?.eligible, audioStatus?.artifacts]);

  useEffect(() => () => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function togglePlayback() {
    const player = audioRef.current;
    if (playing && player) {
      player.pause();
      setPlayingFullStory(false);
      return;
    }
    if (audioUrls[pageNumber] && player) {
      try {
        await player.play();
      } catch {
        setError('Audio playback could not start.');
      }
    }
  }

  function changePage(nextPage: number) {
    if (!book) return;
    audioRef.current?.pause();
    setPlaying(false);
    setPlayingFullStory(false);
    setCurrentTime(0);
    setDuration(0);
    setPageNumber(Math.max(1, Math.min(book.pageCount, nextPage)));
  }

  async function handleAudioEnded() {
    setPlaying(false);
    setCurrentTime(0);
    if (playingFullStory && book && pageNumber < book.pageCount) {
      setPageNumber(pageNumber + 1);
    } else if (playingFullStory) {
      setPlayingFullStory(false);
    }
  }

  async function startFullStory() {
    if (!book || !audioStatus?.eligible || !audioUrls[1]) return;
    audioRef.current?.pause();
    setError(null);
    setCurrentTime(0);
    setPlayingFullStory(true);
    setPageNumber(1);
  }

  async function handleGenerateAudio() {
    if (!bookId) return;
    setGeneratingAudio(true);
    setError(null);
    try {
      setAudioStatus(await generateNarration(bookId));
    } catch {
      setError('Audio story could not be generated.');
    } finally {
      setGeneratingAudio(false);
    }
  }

  useEffect(() => {
    if (!playingFullStory || !audioUrls[pageNumber]) return;
    const player = audioRef.current;
    if (!player) return;
    player.currentTime = 0;
    player.play().catch(() => {
      setPlayingFullStory(false);
      setError('Audio playback could not continue.');
    });
  }, [audioUrls, pageNumber, playingFullStory]);

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-purple-600" />}
        {error && <button onClick={() => router.push('/dashboard/tools/childrens-book')} className="text-sm text-purple-700">{t('backToMyBooks')}</button>}
      </div>
    );
  }

  const page = book.pages?.find((entry) => entry.pageNumber === pageNumber);
  const audioReady = (audioStatus?.artifacts.some((artifact) => artifact.pageNumber === pageNumber && artifact.status === 'READY') ?? false) && !!audioUrls[pageNumber];
  const fullStoryReady = !!book && Array.from({ length: book.pageCount }, (_, index) => index + 1).every((number) =>
    audioStatus?.artifacts.some((artifact) => artifact.pageNumber === number && artifact.status === 'READY') && !!audioUrls[number]
  );
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead title={`${book.title} · Reader`} description={book.title} noIndex />
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => router.push('/dashboard/tools/childrens-book')} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-purple-700 mb-5">
          <ArrowLeft className="w-4 h-4" /> {t('backToMyBooks')}
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
            <p className="text-sm text-gray-500 mt-1">Page {pageNumber} / {book.pageCount}</p>
          </div>
          {book.audioAddOnPurchased && <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700"><Headphones className="w-4 h-4" /> Audio Story</span>}
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {book.status !== 'FINAL_READY' && book.status !== 'COMPLETED' ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This book is still being prepared.</p>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
              <div className="min-w-0">
                <div className="aspect-[4/3] rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                  {imageUrl ? <img src={imageUrl} alt={`${book.title}, page ${pageNumber}`} className="w-full h-full object-contain" /> : <span className="text-sm text-gray-400">Illustration unavailable</span>}
                </div>
                <div className="flex items-center justify-between gap-3 mt-4">
                  <button disabled={pageNumber <= 1} onClick={() => changePage(pageNumber - 1)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40"><ChevronLeft className="w-4 h-4" />Previous</button>
                  <span className="text-sm font-medium text-gray-600">Page {pageNumber} / {book.pageCount}</span>
                  <button disabled={pageNumber >= book.pageCount} onClick={() => changePage(pageNumber + 1)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-40">Next<ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>

              <article className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-gray-500">Page {pageNumber}</h2>
                <p className="mt-4 whitespace-pre-wrap text-lg leading-8 text-gray-800">{page?.storyText || 'Story text unavailable.'}</p>
              </article>
            </section>

            {book.audioAddOnPurchased && audioStatus?.eligible && (
              <section className="mt-6 border-t border-gray-200 pt-5" aria-label="Audio controls">
                <div className="flex flex-wrap items-center gap-3">
                  <button disabled={!audioReady} onClick={togglePlayback} className="inline-flex items-center gap-2 rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{playing ? 'Pause' : 'Play'}
                  </button>
                  <button disabled={!fullStoryReady} onClick={startFullStory} className="inline-flex items-center gap-2 rounded-md border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 disabled:opacity-40">
                    <Repeat className="w-4 h-4" />Play Full Story
                  </button>
                  <span className="text-sm text-gray-500">Page {pageNumber} narration</span>
                  {audioStatus.artifacts.length === 0 && <button disabled={generatingAudio} onClick={handleGenerateAudio} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">{generatingAudio ? 'Preparing audio…' : 'Generate audio story'}</button>}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-gray-200" role="progressbar" aria-label="Audio progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                  <div className="h-full bg-purple-600 transition-[width]" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-500"><span>{Math.floor(currentTime)} sec</span><span>{Math.floor(duration)} sec</span></div>
                <audio
                  ref={audioRef}
                  src={audioUrls[pageNumber]}
                  preload="none"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
                  onEnded={handleAudioEnded}
                  className="sr-only"
                />
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BookReaderPage() {
  const { t } = useTranslation('childrensBook');
  return <><SEOHead title={t('pageTitle')} description={t('pageSubtitle')} noIndex /><ProtectedRoute><BookReaderContent /></ProtectedRoute></>;
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'childrensBook'])) },
});