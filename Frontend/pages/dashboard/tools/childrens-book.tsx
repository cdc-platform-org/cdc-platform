import { useEffect, useRef, useState, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { BookOpen, Sparkles, CheckCircle2, Loader2, Download, RefreshCw, ArrowLeft, Headphones, PlayCircle } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import SEOHead from '../../../src/components/seo/SEOHead';
import {
  listMyBooks,
  getBook,
  createBook,
  generateStoryPlan,
  generateCharacterPreview,
  fetchCharacterPreviewImageUrl,
  approveCharacter,
  startCheckout,
  devSimulatePayment,
  updateAudioUpgrade,
  getNarrationStatus,
  generateNarration,
  fetchNarrationAudioUrl,
  startFinalGeneration,
  getFinalGenerationStatus,
  requestRevision,
  generatePdf,
  downloadBookPdf,
  BookListItem,
  BookProject,
  AudioNarrationStatus,
  BookLanguage,
  FinalGenerationStatus,
} from '../../../src/services/childrensBookService';

const GENERATING_STATUSES = ['CHARACTER_PREVIEW_GENERATING', 'FINAL_GENERATING', 'FINAL_QA', 'REVISION_REQUESTED', 'REVISION_GENERATING', 'REVISION_QA'];
const POLL_MS = 1500;

function ChildrensBookContent() {
  const { t } = useTranslation('childrensBook');
  const router = useRouter();
  const bookId = typeof router.query.bookId === 'string' ? router.query.bookId : null;

  const [myBooks, setMyBooks] = useState<BookListItem[] | null>(null);
  const [book, setBook] = useState<BookProject | null>(null);
  const [mocked, setMocked] = useState(false);
  const [devPaymentSimulationEnabled, setDevPaymentSimulationEnabled] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioNarrationStatus | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<FinalGenerationStatus | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const loadMyBooks = useCallback(async () => {
    setMyBooks(await listMyBooks().catch(() => []));
  }, []);

  const loadBook = useCallback(async (id: string) => {
    const result = await getBook(id).catch(() => null);
    if (result) {
      setBook(result.book);
      setMocked(result.mocked);
      setDevPaymentSimulationEnabled(result.devPaymentSimulationEnabled);

      if (result.book.audioAddOnPurchased || result.book.status === 'FINAL_READY' || result.book.status === 'COMPLETED') {
        const narration = await getNarrationStatus(id).catch(() => null);
        setAudioStatus(narration);
      }
    }
    return result?.book ?? null;
  }, []);

  const loadAudioStatus = useCallback(async (id: string) => {
    const narration = await getNarrationStatus(id).catch(() => null);
    setAudioStatus(narration);
  }, []);

  useEffect(() => {
    if (!bookId) {
      loadMyBooks();
      setBook(null);
    } else {
      loadBook(bookId);
    }
  }, [bookId, loadMyBooks, loadBook]);

  // Character preview image — fetched as an authenticated blob, revoked on
  // change/unmount (see childrensBookService.fetchCharacterPreviewImageUrl's
  // own comment for why a plain <img src> can't be used here).
  useEffect(() => {
    let cancelled = false;
    if (book?.id && (book.status === 'CHARACTER_PREVIEW_READY' || book.status === 'CHARACTER_APPROVED') && book.characterConfig?.previewImageKey) {
      fetchCharacterPreviewImageUrl(book.id).then((url) => {
        if (cancelled) return;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, book?.status]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  async function handleAudioToggle(nextValue: boolean) {
    if (!book) return;
    await run(async () => {
      const updated = await updateAudioUpgrade(book.id, nextValue);
      setBook(updated);
      if (nextValue) {
        await loadAudioStatus(book.id);
      } else {
        setAudioStatus((current) => current ? { ...current, audioAddOnPurchased: false } : current);
      }
    });
  }

  async function handleGenerateNarration() {
    if (!book) return;
    await run(async () => {
      const narration = await generateNarration(book.id);
      setAudioStatus(narration);
      setBook((current) => current ? { ...current, audioAddOnPurchased: true, audioPriceGel: narration.audioPriceGel, totalPriceGel: narration.totalPriceGel } : current);
    });
  }

  async function playPageAudio(pageNumber: number) {
    if (!book || !book.audioAddOnPurchased) return;
    await run(async () => {
      const url = await fetchNarrationAudioUrl(book.id, pageNumber);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      setAudioUrl(url);
    });
  }

  // Poll while a background transition is in flight.
  useEffect(() => {
    if (!bookId || !book || !GENERATING_STATUSES.includes(book.status)) return;
    const interval = setInterval(async () => {
      const fresh = await loadBook(bookId);
      if (fresh?.status === 'FINAL_GENERATING' || fresh?.status === 'FINAL_QA') {
        setGenStatus(await getFinalGenerationStatus(bookId).catch(() => null));
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [bookId, book?.status, loadBook]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  function openBook(id: string) {
    router.push({ pathname: router.pathname, query: { bookId: id } });
  }

  function backToMyBooks() {
    router.push({ pathname: router.pathname });
  }

  // ---- Create form state ----
  const PAGE_OPTIONS = [5, 10, 15, 20] as const;
  const [form, setForm] = useState({ title: '', name: '', age: '', traits: '', favoriteThing: '', dedication: '', language: 'EN' as BookLanguage, pageCount: 10 as (typeof PAGE_OPTIONS)[number] });

  async function handleCreate() {
    await run(async () => {
      const created = await createBook({
        title: form.title,
        language: form.language,
        pageCount: form.pageCount,
        character: {
          name: form.name,
          age: form.age ? Number(form.age) : undefined,
          traits: form.traits ? form.traits.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          favoriteThing: form.favoriteThing || undefined,
          dedication: form.dedication || null,
        },
      });
      openBook(created.id);
    });
  }

  const [revisionPage, setRevisionPage] = useState(1);
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  // ============================================================
  // MY BOOKS (no bookId)
  // ============================================================
  if (!bookId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SiteHeader />
        <main className="max-w-5xl mx-auto px-4 py-10">
          <BackButton />
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
              <p className="text-gray-600">{t('pageSubtitle')}</p>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('myBooksTitle')}</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
            {myBooks?.map((b) => (
              <article
                key={b.id}
                className="p-4 rounded-xl border border-gray-200 bg-white"
              >
                <div className="font-semibold text-gray-900 truncate">{b.title}</div>
                <div className="text-sm text-gray-500 mt-1">{t(`statusValue.${b.status}`, b.status)}</div>
                <div className="text-xs text-gray-500 mt-2">{b.pageCount} pages · {(b.audioAddOnPurchased ? b.totalPriceGel : b.priceGel) / 100} GEL</div>
                {b.audioAddOnPurchased && <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-purple-700"><Headphones className="w-3.5 h-3.5" /> Audio Story</div>}
                <div className="text-xs text-gray-400 mt-2">{new Date(b.createdAt).toLocaleDateString()}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push({ pathname: '/dashboard/tools/childrens-book/reader/[bookId]', query: { bookId: b.id } })}
                    className="px-3 py-1.5 rounded-md bg-purple-600 text-white text-sm font-medium"
                  >Read</button>
                  <button
                    disabled={b.pdfStatus !== 'CURRENT'}
                    onClick={() => run(async () => downloadBookPdf(b.id, b.title))}
                    className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-sm font-medium disabled:opacity-40"
                  >Download PDF</button>
                  {b.audioAddOnPurchased && (
                    <button
                      onClick={() => router.push({ pathname: '/dashboard/tools/childrens-book/reader/[bookId]', query: { bookId: b.id } })}
                      className="px-3 py-1.5 rounded-md border border-purple-300 text-purple-700 text-sm font-medium"
                    >Listen</button>
                  )}
                </div>
              </article>
            ))}
            {myBooks?.length === 0 && <p className="text-gray-500 col-span-full">{t('noBooksYet')}</p>}
          </div>

          <div className="rounded-xl border border-purple-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> {t('createNew')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Book length</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PAGE_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, pageCount: count }))}
                      className={`rounded-xl border px-3 py-3 text-left transition ${form.pageCount === count ? 'border-purple-500 bg-purple-50 text-purple-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'}`}
                    >
                      <div className="text-lg font-semibold">{count} pages</div>
                      <div className="text-xs opacity-75">{count * 100 / 100} GEL</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('titleLabel')}</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder={t('titlePlaceholder')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('languageLabel')}</label>
                <select className="w-full rounded-lg border border-gray-300 px-3 py-2" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as BookLanguage })}>
                  <option value="EN">English</option>
                  <option value="KA">ქართული</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('characterNameLabel')}</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder={t('characterNamePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('characterAgeLabel')}</label>
                <input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('characterTraitsLabel')}</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder={t('characterTraitsPlaceholder')} value={form.traits} onChange={(e) => setForm({ ...form, traits: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('characterFavoriteThingLabel')}</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2" value={form.favoriteThing} onChange={(e) => setForm({ ...form, favoriteThing: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dedicationLabel')}</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder={t('dedicationPlaceholder')} value={form.dedication} onChange={(e) => setForm({ ...form, dedication: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('illustrationStyleLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 text-sm font-medium">{t('styleWatercolor')}</span>
                  {['Modern 3D', 'Soft Digital Painting', 'Cute Cartoon', 'Magical Fantasy', 'Classic Illustrated'].map((s) => (
                    <span key={s} className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-400 text-sm">{s} — {t('styleComingSoon')}</span>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            <button
              disabled={busy || !form.title || !form.name}
              onClick={handleCreate}
              className="mt-5 w-full sm:w-auto px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('createBookButton')}
            </button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // ============================================================
  // WIZARD (bookId present)
  // ============================================================
  if (!book) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  const acceptedCount = genStatus?.pages.filter((p) => p.accepted).length ?? book.pages?.filter((p) => p.acceptedEventId).length ?? 0;
  const canListenToAudio = (book.audioAddOnPurchased || !!audioStatus?.audioAddOnPurchased) && book.status !== 'DRAFT' && book.status !== 'STORY_PLAN_READY' && book.status !== 'CHARACTER_PREVIEW_GENERATING' && book.status !== 'CHARACTER_PREVIEW_READY' && book.status !== 'CHARACTER_APPROVED' && book.status !== 'PAYMENT_PENDING';

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={backToMyBooks} className="flex items-center gap-1 text-sm text-gray-500 hover:text-purple-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> {t('backToMyBooks')}
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{book.title}</h1>
          <p className="text-sm text-gray-500">{t('statusLabel')}: {t(`statusValue.${book.status}`, book.status)}</p>
        </div>

        {mocked && (
          <div className="mb-4 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2">{t('mockNotice')}</div>
        )}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          {book.status === 'CHARACTER_APPROVED' && (
            <div className="mb-5 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-800">Audio Story add-on</span>
                </div>
                <button
                  disabled={busy}
                  onClick={() => handleAudioToggle(!book.audioAddOnPurchased)}
                  className="px-3 py-1.5 rounded-lg border border-purple-300 bg-white text-purple-700 text-sm font-medium disabled:opacity-50"
                >
                  {book.audioAddOnPurchased ? 'Remove audio' : `Add for ${(book.priceGel + 500) / 100} GEL`}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">Book: {book.priceGel / 100} GEL · Audio: {book.audioAddOnPurchased ? book.audioPriceGel / 100 : 0} GEL · Total: {(book.audioAddOnPurchased ? book.totalPriceGel : book.priceGel) / 100} GEL</p>
              <p className="text-xs text-gray-500 mt-1">Mock audio uses local, browser-playable WAV files; no voice service is contacted.</p>
            </div>
          )}

          {book.status === 'DRAFT' && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step1Title')}</h2>
              <button disabled={busy} onClick={() => run(async () => setBook(await generateStoryPlan(book.id)))} className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('generateStoryPlanButton')}
              </button>
            </>
          )}

          {book.status === 'STORY_PLAN_READY' && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step2Title')}</h2>
              <p className="text-sm text-gray-600 mb-4">{t('storyPlanReady', { count: book.pageCount })}</p>
              <ul className="text-sm text-gray-500 mb-4 space-y-1 list-decimal list-inside">
                {book.storyPlan?.pages?.map((p: any) => <li key={p.pageNumber}>{p.storyText}</li>)}
              </ul>
              <button disabled={busy} onClick={() => run(async () => { const r = await generateCharacterPreview(book.id); setBook(r.book); setMocked(r.mocked); })} className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('generateCharacterPreviewButton')}
              </button>
            </>
          )}

          {book.status === 'CHARACTER_PREVIEW_GENERATING' && (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('generatingPreview')}
            </div>
          )}

          {(book.status === 'CHARACTER_PREVIEW_READY' || book.status === 'CHARACTER_APPROVED') && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step3Title')}</h2>
              {previewUrl && <img src={previewUrl} alt={book.characterConfig?.name || ''} className="w-48 h-48 object-contain rounded-lg border border-gray-200 bg-gray-50 mb-4" />}
              {book.status === 'CHARACTER_PREVIEW_READY' && (
                <div className="flex gap-3">
                  <button disabled={busy} onClick={() => run(async () => setBook(await approveCharacter(book.id)))} className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {t('approveCharacterButton')}
                  </button>
                  <button disabled={busy} onClick={() => run(async () => { const r = await generateCharacterPreview(book.id); setBook(r.book); })} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50 flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" /> {t('regenerateButton')}
                  </button>
                </div>
              )}
              {book.status === 'CHARACTER_APPROVED' && (
                <>
                  <p className="text-sm text-gray-600 mb-4">{t('paymentIntro', { count: book.pageCount })}</p>
                  {devPaymentSimulationEnabled ? (
                    <>
                      <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 mb-3 inline-block">{t('devModeRealPaymentDisabledNotice')}</p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          disabled={busy}
                          onClick={() => run(async () => setBook(await devSimulatePayment(book.id)))}
                          className="px-5 py-2 rounded-lg border border-dashed border-amber-400 text-amber-700 text-sm font-medium disabled:opacity-50"
                        >
                          {t('devSimulateButton')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {book.status === 'CHARACTER_APPROVED' && (
                        <button
                          disabled={busy}
                          onClick={() => handleAudioToggle(!book.audioAddOnPurchased)}
                          className="px-5 py-2 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 font-medium disabled:opacity-50"
                        >
                          {book.audioAddOnPurchased ? 'Audio enabled' : 'Add audio story'}
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => run(async () => {
                          const r = await startCheckout(book.id);
                          if (r.redirectUrl) window.location.href = r.redirectUrl;
                          else setBook(await getBook(book.id).then((x) => x.book));
                        })}
                        className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50"
                      >
                        {t('payButton', { amount: (book.audioAddOnPurchased ? book.totalPriceGel : book.priceGel) / 100 })}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {book.status === 'PAYMENT_PENDING' && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step4Title')}</h2>
              <p className="text-sm text-gray-600 mb-4">{t('waitingForPayment')}</p>
              <div className="flex gap-3">
                <button disabled={busy} onClick={() => run(async () => setBook(await getBook(book.id).then((x) => x.book)))} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium">
                  {t('refreshButton')}
                </button>
                <button
                  disabled={busy}
                  onClick={() => run(async () => {
                    try {
                      setBook(await devSimulatePayment(book.id));
                    } catch (e: any) {
                      if (e?.response?.status === 403) setError(t('devSimulateNotAvailable'));
                      else throw e;
                    }
                  })}
                  className="px-5 py-2 rounded-lg border border-dashed border-amber-400 text-amber-700 text-sm font-medium"
                >
                  {t('devSimulateButton')}
                </button>
              </div>
            </>
          )}

          {(book.status === 'PAID' || book.status === 'FINAL_GENERATING' || book.status === 'FINAL_QA') && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step5Title')}</h2>
              {book.status === 'PAID' ? (
                <button disabled={busy} onClick={() => run(async () => { const r = await startFinalGeneration(book.id); setBook(r.book); })} className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('startGenerationButton')}
                </button>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> {t('generatingPages')}
                  </div>
                  <p className="text-sm text-gray-500">{t('pagesReady', { count: acceptedCount, total: book.pageCount })}</p>
                </div>
              )}
            </>
          )}

          {book.status === 'FAILED' && (
            <>
              <p className="text-red-600 mb-4">{t('generationFailed')}</p>
              <button
                disabled={busy}
                onClick={() => run(async () => {
                  if (!book.characterBible) setBook((await generateCharacterPreview(book.id)).book);
                  else setBook((await startFinalGeneration(book.id)).book);
                })}
                className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50"
              >
                {t('retryButton')}
              </button>
            </>
          )}

          {(book.status === 'FINAL_READY' || book.status === 'COMPLETED' || book.status === 'REVISION_REQUESTED' || book.status === 'REVISION_GENERATING' || book.status === 'REVISION_QA') && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step6Title')}</h2>
              {['REVISION_REQUESTED', 'REVISION_GENERATING', 'REVISION_QA'].includes(book.status) ? (
                <div className="flex items-center gap-2 text-gray-600 mb-4">
                  <Loader2 className="w-5 h-5 animate-spin" /> {t('revisionInProgress')}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {Array.from({ length: book.pageCount }, (_, i) => i + 1).map((n) => {
                      const page = book.pages?.find((p) => p.pageNumber === n);
                      const ready = !!page?.acceptedEventId;
                      return (
                        <div key={n} className={`aspect-square rounded-lg border flex items-center justify-center text-xs ${ready ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                          {t('pageLabel', { number: n })}
                        </div>
                      );
                    })}
                  </div>

                  {book.status === 'COMPLETED' && <p className="text-green-700 font-medium mb-4 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t('bookCompleted')}</p>}

                  <div className="flex flex-wrap gap-3 mb-4">
                    {book.pdfStatus !== 'CURRENT' && (
                      <button disabled={busy} onClick={() => run(async () => setBook(await generatePdf(book.id)))} className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('generatePdfButton')}
                      </button>
                    )}
                    {book.pdfStatus === 'CURRENT' && (
                      <button disabled={busy} onClick={() => run(async () => downloadBookPdf(book.id, book.title))} className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 flex items-center gap-1">
                        <Download className="w-4 h-4" /> {t('downloadPdfButton')}
                      </button>
                    )}

                    {canListenToAudio && (
                      <button
                        disabled={busy}
                        onClick={() => handleGenerateNarration()}
                        className="px-5 py-2 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 font-medium disabled:opacity-50 flex items-center gap-1"
                      >
                        <Headphones className="w-4 h-4" /> {audioStatus?.artifacts?.length ? 'Refresh audio story' : 'Generate audio story'}
                      </button>
                    )}
                  </div>

                  {canListenToAudio && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-2 mb-3 text-gray-800 font-medium">
                        <PlayCircle className="w-4 h-4 text-purple-600" /> Mock story reader
                      </div>
                      <div className="space-y-2">
                        {book.pages?.map((page) => (
                          <button
                            key={page.pageNumber}
                            onClick={() => playPageAudio(page.pageNumber)}
                            className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:border-purple-300"
                          >
                            <span>Page {page.pageNumber}</span>
                            <span className="text-purple-600 font-medium">Listen</span>
                          </button>
                        ))}
                      </div>
                      {audioUrl && (
                        <audio controls src={audioUrl} className="mt-3 w-full" onEnded={() => setAudioUrl(null)} />
                      )}
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-4">
                    {book.revisionUsed ? (
                      <p className="text-sm text-gray-500">{t('revisionUsedNotice')}</p>
                    ) : showRevisionForm ? (
                      <div className="space-y-3 max-w-sm">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('revisionPageLabel')}</label>
                          <select className="w-full rounded-lg border border-gray-300 px-3 py-2" value={revisionPage} onChange={(e) => setRevisionPage(Number(e.target.value))}>
                            {Array.from({ length: book.pageCount }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t('pageLabel', { number: n })}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t('revisionNoteLabel')}</label>
                          <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder={t('revisionNotePlaceholder')} value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={busy}
                            onClick={() => run(async () => {
                              const r = await requestRevision(book.id, { pageNumber: revisionPage, note: revisionNote });
                              setBook(r.book);
                              setShowRevisionForm(false);
                            })}
                            className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50"
                          >
                            {t('submitRevisionButton')}
                          </button>
                          <button onClick={() => setShowRevisionForm(false)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium">
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowRevisionForm(true)} className="text-sm text-purple-600 font-medium hover:underline">
                        {t('revisionAvailableNotice')} — {t('requestRevisionButton')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function ChildrensBookPage() {
  const { t } = useTranslation('childrensBook');
  return (
    <>
      <SEOHead title={t('pageTitle')} description={t('pageSubtitle')} noIndex />
      <ProtectedRoute>
        <ToolErrorBoundary>
          <ChildrensBookContent />
        </ToolErrorBoundary>
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'childrensBook'])) },
});
