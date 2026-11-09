import { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { ArrowLeft, Headphones, Loader2 } from 'lucide-react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import ProtectedRoute from '../../../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../../../src/components/layout/SiteFooter';
import SEOHead from '../../../../../src/components/seo/SEOHead';
import FlipBook from '../../../../../src/components/tools/childrensBook/FlipBook';
import {
  AudioNarrationStatus,
  BookProject,
  downloadFullStoryMp3,
  fetchBookPageImageUrl,
  fetchCharacterPreviewImageUrl,
  fetchCoverImageUrl,
  fetchNarrationAudioUrl,
  generateNarration,
  getBook,
  getNarrationStatus,
} from '../../../../../src/services/childrensBookService';

// The owner's reader: the finished book as a flip book that opens on its
// cover (see FlipBook). Pictures and narration need the owner's login, so
// they are fetched here as blob URLs.

function BookReaderContent() {
  const { t } = useTranslation('childrensBook');
  const tRef = useRef(t);
  tRef.current = t;
  const router = useRouter();
  const bookId = typeof router.query.bookId === 'string' ? router.query.bookId : null;
  const [book, setBook] = useState<BookProject | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioNarrationStatus | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [downloadingMp3, setDownloadingMp3] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);
  const track = (url: string) => {
    objectUrls.current.push(url);
    return url;
  };

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    getBook(bookId).then(async ({ book: loadedBook }) => {
      if (cancelled) return;
      setBook(loadedBook);
      if (loadedBook.audioAddOnPurchased) setAudioStatus(await getNarrationStatus(bookId).catch(() => null));
    }).catch(() => {
      if (!cancelled) setError(tRef.current('readerLoadFailed'));
    });
    return () => { cancelled = true; };
  }, [bookId]);

  // Cover and portrait first (the book opens on them), then every page.
  useEffect(() => {
    if (!bookId || !book?.pages?.length) return;
    let cancelled = false;
    (async () => {
      const [cover, portrait] = await Promise.all([
        fetchCoverImageUrl(bookId).catch(() => null),
        fetchCharacterPreviewImageUrl(bookId).catch(() => null),
      ]);
      if (cancelled) return;
      if (cover) setCoverUrl(track(cover));
      if (portrait) setPortraitUrl(track(portrait));
      for (const page of book.pages ?? []) {
        const url = await fetchBookPageImageUrl(bookId, page.pageNumber).catch(() => null);
        if (cancelled) return;
        if (url) setImageUrls((current) => ({ ...current, [page.pageNumber]: track(url) }));
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, book?.pages]);

  useEffect(() => {
    if (!bookId || !audioStatus?.eligible) return;
    let cancelled = false;
    const ready = [...new Set(audioStatus.artifacts.filter((a) => a.status === 'READY').map((a) => a.pageNumber))].filter((n) => !audioUrls[n]);
    Promise.all(ready.map(async (number) => [number, await fetchNarrationAudioUrl(bookId, number)] as const))
      .then((entries) => {
        if (cancelled) return;
        setAudioUrls((current) => ({ ...current, ...Object.fromEntries(entries.map(([n, url]) => [n, track(url)])) }));
      })
      .catch(() => {
        if (!cancelled) setError(tRef.current('readerAudioLoadFailed'));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, audioStatus?.eligible, audioStatus?.artifacts]);

  // Narration is produced on the server right after the pictures; poll for
  // it for a while. After ~10 minutes a manual button appears as a fallback.
  const [audioPollGaveUp, setAudioPollGaveUp] = useState(false);
  const readyAudioCount = new Set(audioStatus?.artifacts.filter((a) => a.status === 'READY').map((a) => a.pageNumber) ?? []).size;
  useEffect(() => {
    if (!bookId || !book?.audioAddOnPurchased || !audioStatus?.eligible || readyAudioCount >= book.pageCount) return;
    let polls = 0;
    const interval = setInterval(async () => {
      polls += 1;
      if (polls > 60) {
        setAudioPollGaveUp(true);
        clearInterval(interval);
        return;
      }
      const fresh = await getNarrationStatus(bookId).catch(() => null);
      if (fresh) setAudioStatus(fresh);
    }, 10_000);
    return () => clearInterval(interval);
  }, [bookId, book?.audioAddOnPurchased, book?.pageCount, audioStatus?.eligible, readyAudioCount]);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function handleGenerateAudio() {
    if (!bookId) return;
    setGeneratingAudio(true);
    setError(null);
    try {
      await generateNarration(bookId);
      setAudioStatus(await getNarrationStatus(bookId));
    } catch {
      setError(t('readerAudioGenerateFailed'));
    } finally {
      setGeneratingAudio(false);
    }
  }

  async function handleDownloadMp3() {
    if (!book) return;
    setDownloadingMp3(true);
    try {
      await downloadFullStoryMp3(book.id, book.title);
    } catch {
      setError(t('flipDownloadMp3Failed'));
    } finally {
      setDownloadingMp3(false);
    }
  }

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <Loader2 className="w-6 h-6 animate-spin text-purple-600" />}
        {error && <button onClick={() => router.push('/dashboard/tools/childrens-book')} className="text-sm text-purple-700">{t('backToMyBooks')}</button>}
      </div>
    );
  }

  // Readable as soon as every page has its picture: a finished book that is
  // mid-revision or whose status lags behind must not say "still preparing".
  const acceptedPages = book.pages?.filter((entry) => !!entry.acceptedEventId).length ?? 0;
  const readable = book.status === 'FINAL_READY' || book.status === 'COMPLETED' || (book.pageCount > 0 && acceptedPages >= book.pageCount);
  const narrationOn = !!book.audioAddOnPurchased && !!audioStatus?.eligible;
  const audioPreparing = narrationOn && readyAudioCount < book.pageCount;
  const config = book.characterConfig as (Record<string, unknown> & { name?: string; dedication?: string | null; fontId?: string | null }) | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f2fd] to-white">
      <SEOHead title={`${book.title} · ${t('readerLabel')}`} description={book.title} noIndex />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => router.push(`/dashboard/tools/childrens-book?bookId=${book.id}`)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-purple-700">
            <ArrowLeft className="w-4 h-4" /> {t('backToMyBooks')}
          </button>
          {book.audioAddOnPurchased && <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700"><Headphones className="w-4 h-4" /> {t('audioStoryBadge')}</span>}
        </div>
        {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
        {!readable ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('readerStillPreparing')}</p>
        ) : (
          <FlipBook
            book={{
              title: book.title,
              heroName: (book.characterBible as { name?: string } | null)?.name ?? config?.name ?? null,
              dedication: config?.dedication ?? null,
              blurb: book.storyPlan?.extras?.blurb ?? null,
              fontId: config?.fontId ?? null,
              coverUrl,
              portraitUrl,
              pages: (book.pages ?? []).map((page) => ({
                pageNumber: page.pageNumber,
                storyText: page.storyText ?? '',
                imageUrl: imageUrls[page.pageNumber] ?? null,
                audioUrl: audioUrls[page.pageNumber] ?? null,
              })),
            }}
            hasNarration={narrationOn}
            audioPreparing={audioPreparing}
            onDownloadMp3={narrationOn ? handleDownloadMp3 : null}
            downloadingMp3={downloadingMp3}
            createUrl={`${router.locale && router.locale !== 'ka' ? `/${router.locale}` : ''}/dashboard/tools/childrens-book`}
            footer={audioPreparing && audioPollGaveUp ? (
              <div className="mx-auto mt-3 max-w-[1100px]">
                <button disabled={generatingAudio} onClick={handleGenerateAudio} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-40">{generatingAudio ? t('readerPreparingAudio') : t('generateAudioStory')}</button>
              </div>
            ) : null}
          />
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
