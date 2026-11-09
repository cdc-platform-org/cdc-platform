import { useEffect, useRef, useState, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { BookOpen, Sparkles, CheckCircle2, Loader2, Download, RefreshCw, ArrowLeft, ArrowRight, Headphones, PlayCircle, PenLine } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import GiftThisButton from '../../../src/components/giftCards/GiftThisButton';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import SEOHead from '../../../src/components/seo/SEOHead';
import {
  listMyBooks,
  getBook,
  createBook,
  generateStoryPlan,
  hasPlaceholderStoryText,
  rewriteStoryText,
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
  downloadFullStoryMp3,
  uploadCharacterPhoto,
  removeCharacterPhoto,
  fetchCharacterPhotoUrl,
  confirmBookPreview,
  updateStoryText,
  approveStoryText,
  regenerateStoryText,
  downloadPrintPdf,
  BookListItem,
  BookProject,
  AudioNarrationStatus,
  BookLanguage,
  FinalGenerationStatus,
  updateBookFont,
} from '../../../src/services/childrensBookService';
import PromoCodeField, { localizePromoError } from '../../../src/components/shared/PromoCodeField';
import BookPreview from '../../../src/components/tools/childrensBook/BookPreview';
import CharacterPhotoField from '../../../src/components/tools/childrensBook/CharacterPhotoField';
import SiblingsFields, { SiblingDraft, SiblingPhotoEditor } from '../../../src/components/tools/childrensBook/SiblingsFields';
import PageThumbnail from '../../../src/components/tools/childrensBook/PageThumbnail';
import StoryTextEditor from '../../../src/components/tools/childrensBook/StoryTextEditor';
import PrintSettingsPanel from '../../../src/components/tools/childrensBook/PrintSettingsPanel';
import BookSharePanel from '../../../src/components/tools/childrensBook/BookSharePanel';
import BookFontPicker from '../../../src/components/tools/childrensBook/BookFontPicker';
import { BookFontId, DEFAULT_BOOK_FONT, bookFontFamily, bookFontOptions } from '../../../src/components/tools/childrensBook/bookFonts';
// Style keys must match Backend/src/services/bookIllustrationStyles.ts.
import StylePicker, { IllustrationStyleValue } from '../../../src/components/tools/childrensBook/StylePicker';
import { PromoValidationResult, validatePromoCode } from '../../../src/services/paymentService';
import ToolMediaBanner from '../../../src/components/tools/ToolMediaBanner';
import ToolShell, { ToolPageHeader, ToolChip } from '../../../src/components/tools/ToolShell';

const GENERATING_STATUSES = ['CHARACTER_PREVIEW_GENERATING', 'PAID', 'FINAL_GENERATING', 'FINAL_QA', 'REVISION_REQUESTED', 'REVISION_GENERATING', 'REVISION_QA'];
const POLL_MS = 1500;
const PHOTO_EDITABLE_STATUSES = ['DRAFT', 'STORY_PLAN_READY', 'CHARACTER_PREVIEW_READY'];
// Story text stays editable until payment (no page picture exists yet).
const TEXT_EDITABLE_STATUSES = ['STORY_PLAN_READY', 'CHARACTER_PREVIEW_READY', 'CHARACTER_APPROVED'];
const TEXT_FIELD_MAX = 500;

// Promo code typed on the create form, kept per book until the payment step
// applies it. Browser storage can be unavailable (private mode), so every
// access is guarded; the payment step's own promo field still works then.
const BOOK_PROMO_KEY = (bookId: string) => `cdc_book_promo_${bookId}`;
function savePendingBookPromo(bookId: string, code: string) {
  try { localStorage.setItem(BOOK_PROMO_KEY(bookId), code); } catch { /* ignore */ }
}
function readPendingBookPromo(bookId: string): string | null {
  try { return localStorage.getItem(BOOK_PROMO_KEY(bookId)); } catch { return null; }
}
function clearPendingBookPromo(bookId: string) {
  try { localStorage.removeItem(BOOK_PROMO_KEY(bookId)); } catch { /* ignore */ }
}
const bookPromoCopy = {
  ka: { label: 'პრომო კოდი (არასავალდებულო)', placeholder: 'მაგ. SALE20', hint: 'ფასდაკლება ავტომატურად გამოიყენება გადახდის ნაბიჯზე.', failed: 'შენახული პრომო კოდი ვერ გამოვიყენეთ' },
  en: { label: 'Promo code (optional)', placeholder: 'e.g. SALE20', hint: 'The discount is applied automatically at the payment step.', failed: 'Could not apply your saved promo code' },
};

function GenerationProgress({ accepted, total }: { accepted: number; total: number }) {
  const { t } = useTranslation('childrensBook');
  const percent = total > 0 ? Math.round((accepted / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
      <div className="mb-2 flex items-center gap-2 font-medium text-purple-900">
        <Loader2 className="h-5 w-5 animate-spin text-purple-600" /> {t('generatingPages')}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={accepted}>
        <div className="h-full rounded-full bg-purple-600 transition-[width] duration-700" style={{ width: `${Math.max(percent, 4)}%` }} />
      </div>
      <p className="mt-2 text-sm text-gray-600">{t('pagesReady', { count: accepted, total })}</p>
      <p className="mt-1 text-xs text-gray-500">{t('generatingCanLeave')}</p>
    </div>
  );
}

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
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult | null>(null);
  const promoLang: 'ka' | 'en' = router.locale === 'ka' ? 'ka' : 'en';
  // Code typed on the create form. A book's price only exists once the book
  // does, so the code is saved per book and applied automatically when the
  // payment step opens (validated server-side against the real book there).
  const [formPromo, setFormPromo] = useState('');
  const [savedPromoNotice, setSavedPromoNotice] = useState<string | null>(null);

  // Any not-yet-paid stage: the book (and so its price) exists, so the saved
  // code can already be priced — the preview's total shows it too, not only
  // the pay button.
  const promoApplicable = !!book && TEXT_EDITABLE_STATUSES.includes(book.status) && !devPaymentSimulationEnabled;
  const bookTotal = book ? (book.audioAddOnPurchased ? book.totalPriceGel : book.priceGel) : 0;
  // Apply the create-form code as soon as the book can be priced (and again
  // after the audio add-on changes the price, which clears the preview).
  useEffect(() => {
    if (!book || !promoApplicable || appliedPromo) return;
    const code = readPendingBookPromo(book.id);
    if (!code) return;
    let cancelled = false;
    validatePromoCode(code, 'CHILDRENS_BOOK', book.id)
      .then((result) => { if (!cancelled) { setAppliedPromo(result); setSavedPromoNotice(null); } })
      .catch((err: any) => {
        if (cancelled) return;
        clearPendingBookPromo(book.id);
        setSavedPromoNotice(`${bookPromoCopy[promoLang].failed} (${code}): ${localizePromoError(err?.response?.data?.message, promoLang) ?? ''}`.replace(/: $/, ''));
      });
    return () => { cancelled = true; };
  }, [book?.id, promoApplicable, bookTotal, appliedPromo, promoLang]); // eslint-disable-line react-hooks/exhaustive-deps
  const previewUrlRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const [showPreviewAgain, setShowPreviewAgain] = useState(false);
  const [editingText, setEditingText] = useState(false);
  // Photo picked in the create form, uploaded right after the book is created.
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [siblingDrafts, setSiblingDrafts] = useState<SiblingDraft[]>([]);

  function replacePhotoUrl(url: string | null) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = url;
    setPhotoUrl(url);
  }

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
      // previewImageKey changes on every regeneration, so this effect
      // re-runs and shows the new portrait.
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
  }, [book?.id, book?.status, book?.characterConfig?.previewImageKey]);

  // The parent's uploaded photo (thumbnail only while it can still change).
  useEffect(() => {
    let cancelled = false;
    if (book?.id && book.characterConfig?.photoKey && PHOTO_EDITABLE_STATUSES.includes(book.status)) {
      fetchCharacterPhotoUrl(book.id).then((url) => {
        if (cancelled) URL.revokeObjectURL(url);
        else replacePhotoUrl(url);
      }).catch(() => {});
    } else {
      replacePhotoUrl(null);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, book?.status, book?.characterConfig?.photoKey]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  useEffect(() => () => {
    if (pendingPhotoUrl) URL.revokeObjectURL(pendingPhotoUrl);
  }, [pendingPhotoUrl]);

  function selectPendingPhoto(file: File | null) {
    setPendingPhoto(file);
    setPendingPhotoUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handlePhotoSelect(file: File) {
    if (!book) return;
    await run(async () => setBook(await uploadCharacterPhoto(book.id, file)));
  }

  async function handlePhotoRemove() {
    if (!book) return;
    await run(async () => setBook(await removeCharacterPhoto(book.id)));
  }

  async function handleAudioToggle(nextValue: boolean) {
    if (!book) return;
    await run(async () => {
      const updated = await updateAudioUpgrade(book.id, nextValue);
      setBook(updated);
      // The previewed discount was priced against the old total — make the
      // buyer re-apply it so the button never shows a stale amount.
      setAppliedPromo(null);
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

  // A paid book starts drawing on its own (payment webhook / server resume
  // sweep). If the page still sees PAID, nudge it once instead of asking the
  // parent to press a start button; the server ignores duplicate starts.
  const nudgedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!book || book.status !== 'PAID' || nudgedRef.current === book.id) return;
    nudgedRef.current = book.id;
    startFinalGeneration(book.id).then((r) => setBook(r.book)).catch(() => { /* the server resume sweep picks it up */ });
  }, [book?.id, book?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while a background transition is in flight.
  useEffect(() => {
    const paidAndRecovering = book?.status === 'FAILED' && !!book.characterBible;
    if (!bookId || !book || (!GENERATING_STATUSES.includes(book.status) && !paidAndRecovering)) return;
    const interval = setInterval(async () => {
      const fresh = await loadBook(bookId);
      if (fresh?.status === 'FINAL_GENERATING' || fresh?.status === 'FINAL_QA' || fresh?.status === 'FAILED') {
        setGenStatus(await getFinalGenerationStatus(bookId).catch(() => null));
      }
    }, paidAndRecovering ? 15_000 : POLL_MS);
    return () => clearInterval(interval);
  }, [bookId, book?.status, book?.characterBible, loadBook]);

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
  const [createStep, setCreateStep] = useState(0);
  const createFormRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ title: '', name: '', age: '', traits: '', favoriteThing: '', dedication: '', appearance: '', extraCharacters: '', language: 'EN' as BookLanguage, pageCount: 10 as (typeof PAGE_OPTIONS)[number], illustrationStyle: 'STORYBOOK_WATERCOLOR' as IllustrationStyleValue, fontId: DEFAULT_BOOK_FONT as BookFontId });
  const [fontNotice, setFontNotice] = useState<string | null>(null);

  async function handleCreate() {
    const namedSiblings = siblingDrafts.filter((s) => s.name.trim());
    await run(async () => {
      const created = await createBook({
        title: form.title,
        language: form.language,
        pageCount: form.pageCount,
        illustrationStyle: form.illustrationStyle,
        fontId: form.fontId,
        character: {
          name: form.name,
          age: form.age ? Number(form.age) : undefined,
          traits: form.traits ? form.traits.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          favoriteThing: form.favoriteThing || undefined,
          dedication: form.dedication || null,
          appearance: form.appearance.trim() || undefined,
          extraCharacters: form.extraCharacters.trim() || undefined,
          siblings: namedSiblings.map((s) => ({
            name: s.name.trim(),
            age: s.age ? Number(s.age) : undefined,
            appearance: s.appearance.trim() || undefined,
          })),
        },
      });
      if (formPromo.trim()) savePendingBookPromo(created.id, formPromo.trim().toUpperCase());
      // Photos go up after the book exists. Sibling index = position among
      // the named siblings, the same order the server stored them in.
      const uploads: Array<{ file: File; sibling?: number }> = [];
      if (pendingPhoto) uploads.push({ file: pendingPhoto });
      namedSiblings.forEach((s, index) => { if (s.photo) uploads.push({ file: s.photo, sibling: index }); });
      try {
        for (const u of uploads) await uploadCharacterPhoto(created.id, u.file, u.sibling);
      } catch (err: any) {
        // The book exists either way; photos can be re-added on the next screen.
        openBook(created.id);
        throw err;
      } finally {
        selectPendingPhoto(null);
        siblingDrafts.forEach((s) => { if (s.photoUrl) URL.revokeObjectURL(s.photoUrl); });
        setSiblingDrafts([]);
      }
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
    const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500';
    const labelCls = 'block text-sm font-semibold text-gray-700 mb-1.5';
    const steps = [
      { title: t('formSectionBook'), hint: t('formSectionBookHint') },
      { title: t('formSectionHero'), hint: t('formSectionHeroHint') },
      { title: t('formSectionDetails'), hint: t('formSectionDetailsHint') },
      { title: t('formSectionOrder'), hint: t('formSectionOrderHint') },
    ];
    // Required fields per step; the create button is on the last step.
    const stepReady = [!!form.title.trim(), !!form.name.trim(), true, true];
    const lastStep = steps.length - 1;
    const goTo = (i: number) => {
      setCreateStep(i);
      createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const hasBooks = (myBooks?.length ?? 0) > 0;
    return (
      <ToolShell>
        <ToolPageHeader
          icon={BookOpen}
          accent="pink"
          title={t('pageTitle')}
          subtitle={t('pageSubtitle')}
          chips={<ToolChip tone="vip">{t('catalogTag')}</ToolChip>}
          actions={
            // 20 GEL covers a 20-page book; the card works on any product.
            <GiftThisButton priceMinor={2000} itemTitle={router.locale === 'ka' ? 'ინდივიდუალური AI საბავშვო წიგნი' : "Custom AI children's book"} itemPath="/dashboard/tools/childrens-book" lang={router.locale === 'ka' ? 'ka' : 'en'} design="kids" className="shrink-0" />
          }
        />
        <ToolMediaBanner slug="childrens-book" alt={t('pageTitle')} />

        {hasBooks && (
          <section className="mb-10">
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">{t('myBooksTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myBooks?.map((b) => {
                // A finished book always offers the PDF: if it isn't
                // built yet (older books), the click builds it first.
                const finished = b.status === 'FINAL_READY' || b.status === 'COMPLETED';
                const pdfBuilding = b.pdfStatus === 'GENERATING';
                return (
                  <article key={b.id} className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-bold text-gray-900 truncate">{b.title}</div>
                      <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border ${finished ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                        {t(`statusValue.${b.generationRecovering ? 'FINAL_GENERATING' : b.status}`, b.status)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{t('pagesCount', { value: b.pageCount })} · {t('priceGel', { amount: (b.audioAddOnPurchased ? b.totalPriceGel : b.priceGel) / 100 })} · {new Date(b.createdAt).toLocaleDateString()}</div>
                    {b.audioAddOnPurchased && <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-purple-700"><Headphones className="w-3.5 h-3.5" /> {t('audioStoryBadge')}</div>}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                      <button
                        onClick={() => router.push({ pathname: '/dashboard/tools/childrens-book/reader/[bookId]', query: { bookId: b.id } })}
                        className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold"
                      >{t('readButton')}</button>
                      <button
                        disabled={busy || !finished || pdfBuilding}
                        onClick={() => run(async () => {
                          if (b.pdfStatus !== 'CURRENT') await generatePdf(b.id);
                          await downloadBookPdf(b.id, b.title);
                          await loadMyBooks();
                        })}
                        className="px-3.5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                      ><Download className="w-3.5 h-3.5" />{pdfBuilding ? t('pdfPreparing') : t('downloadPdfButton')}</button>
                      {b.audioAddOnPurchased && (
                        <button
                          onClick={() => router.push({ pathname: '/dashboard/tools/childrens-book/reader/[bookId]', query: { bookId: b.id } })}
                          className="px-3.5 py-2 rounded-lg border border-purple-300 text-purple-700 text-sm font-semibold"
                        >{t('listenButton')}</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Create form as a 4-step wizard (it used to be one ~4000px page
            with every optional field open at once). The values live in the
            same `form` state, so moving between steps never loses input. */}
        <div ref={createFormRef} className="scroll-mt-24 grid gap-6 lg:grid-cols-[1fr_300px] items-start">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> {t('createNew')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t('createIntro')}</p>

            <ol className="mt-5 mb-6 grid grid-cols-4 gap-2" aria-label={t('createNew')}>
              {steps.map((s, i) => {
                const done = i < createStep;
                const current = i === createStep;
                const reachable = i <= createStep || stepReady.slice(0, i).every(Boolean);
                return (
                  <li key={s.title}>
                    <button
                      type="button"
                      disabled={!reachable}
                      onClick={() => goTo(i)}
                      aria-current={current ? 'step' : undefined}
                      className="w-full text-left disabled:cursor-not-allowed"
                    >
                      <span className={`block h-1.5 rounded-full mb-2 ${done || current ? 'bg-gradient-to-r from-cyan-500 to-purple-600' : 'bg-gray-200'}`} />
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${current ? 'text-purple-700' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${done ? 'bg-emerald-500 text-white' : current ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                        </span>
                        <span className="hidden sm:inline truncate">{s.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <h3 className="text-base font-bold text-gray-900">{steps[createStep].title}</h3>
            <p className="mb-5 text-sm text-gray-500">{steps[createStep].hint}</p>

            {createStep === 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('bookLengthLabel')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PAGE_OPTIONS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, pageCount: count }))}
                        className={`rounded-xl border-2 px-3 py-3 text-left transition ${form.pageCount === count ? 'border-purple-500 bg-purple-50 text-purple-800 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'}`}
                      >
                        <div className="text-lg font-bold">{t('pagesCount', { value: count })}</div>
                        <div className="text-xs opacity-75">{t('priceGel', { amount: count * 100 / 100 })}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('titleLabel')} *</label>
                  <input className={inputCls} placeholder={t('titlePlaceholder')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{t('languageLabel')}</label>
                  <select className={inputCls} value={form.language} onChange={(e) => {
                    const language = e.target.value as BookLanguage;
                    // A Georgian book only offers the fonts that look different in Georgian.
                    setForm({ ...form, language, fontId: bookFontOptions(language).includes(form.fontId) ? form.fontId : DEFAULT_BOOK_FONT });
                  }}>
                    <option value="EN">English</option>
                    <option value="KA">ქართული</option>
                  </select>
                </div>
              </div>
            )}

            {createStep === 1 && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{t('characterNameLabel')} *</label>
                  <input className={inputCls} placeholder={t('characterNamePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{t('characterAgeLabel')}</label>
                  <input type="number" className={inputCls} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('characterTraitsLabel')}</label>
                  <input className={inputCls} placeholder={t('characterTraitsPlaceholder')} value={form.traits} onChange={(e) => setForm({ ...form, traits: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('characterFavoriteThingLabel')}</label>
                  <input className={inputCls} value={form.favoriteThing} onChange={(e) => setForm({ ...form, favoriteThing: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>{t('appearanceLabel')}</label>
                  <textarea rows={2} maxLength={TEXT_FIELD_MAX} className={inputCls} placeholder={t('appearancePlaceholder')} value={form.appearance} onChange={(e) => setForm({ ...form, appearance: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <CharacterPhotoField photoUrl={pendingPhotoUrl} disabled={busy} onSelect={(file) => selectPendingPhoto(file)} onRemove={() => selectPendingPhoto(null)} />
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="grid gap-5">
                <SiblingsFields value={siblingDrafts} onChange={setSiblingDrafts} disabled={busy} />
                <div>
                  <label className={labelCls}>{t('extraCharactersLabel')}</label>
                  <textarea rows={2} maxLength={TEXT_FIELD_MAX} className={inputCls} placeholder={t('extraCharactersPlaceholder')} value={form.extraCharacters} onChange={(e) => setForm({ ...form, extraCharacters: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{t('dedicationLabel')}</label>
                  <input className={inputCls} placeholder={t('dedicationPlaceholder')} value={form.dedication} onChange={(e) => setForm({ ...form, dedication: e.target.value })} />
                </div>
                <BookFontPicker value={form.fontId} language={form.language} disabled={busy} onChange={(fontId) => setForm({ ...form, fontId })} />
              </div>
            )}

            {createStep === 3 && (
              <div className="grid gap-5">
                <div>
                  <label className={labelCls}>{t('illustrationStyleLabel')}</label>
                  <p className="-mt-1 mb-3 text-sm text-gray-500">{t('illustrationStyleHint')}</p>
                  <StylePicker value={form.illustrationStyle} onChange={(value) => setForm({ ...form, illustrationStyle: value })} />
                </div>
                <div data-testid="book-form-promo">
                  <label htmlFor="book-form-promo" className={labelCls}>{bookPromoCopy[promoLang].label}</label>
                  <input
                    id="book-form-promo"
                    value={formPromo}
                    onChange={(e) => setFormPromo(e.target.value.toUpperCase())}
                    placeholder={bookPromoCopy[promoLang].placeholder}
                    className={`${inputCls} sm:max-w-xs text-sm`}
                  />
                  <p className="text-xs text-gray-500 mt-1">{bookPromoCopy[promoLang].hint}</p>
                </div>
              </div>
            )}

            {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

            <div className="mt-7 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goTo(createStep - 1)}
                className={`px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold inline-flex items-center gap-1.5 ${createStep === 0 ? 'invisible' : ''}`}
              >
                <ArrowLeft className="w-4 h-4" /> {t('wizardBack')}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {createStep === 2 && (
                  <button type="button" onClick={() => goTo(3)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:text-gray-900">
                    {t('wizardSkip')}
                  </button>
                )}
                {createStep < lastStep ? (
                  <button
                    type="button"
                    disabled={!stepReady[createStep]}
                    onClick={() => goTo(createStep + 1)}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {t('wizardNext')} <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    disabled={busy || !form.title || !form.name}
                    onClick={handleCreate}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <Sparkles className="w-4 h-4" />} {t('createBookButton')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Running summary: what the customer has chosen so far and the
              price, so it is clear before the last step what they'll pay. */}
          <aside className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-4">{t('summaryTitle')}</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-gray-500">{t('titleLabel')}</dt><dd className="font-semibold text-gray-900 text-right truncate max-w-[160px]">{form.title || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">{t('characterNameLabel')}</dt><dd className="font-semibold text-gray-900 text-right truncate max-w-[160px]">{form.name || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">{t('languageLabel')}</dt><dd className="font-semibold text-gray-900">{form.language === 'KA' ? 'ქართული' : 'English'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500">{t('bookLengthLabel')}</dt><dd className="font-semibold text-gray-900">{t('pagesCount', { value: form.pageCount })}</dd></div>
            </dl>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-gray-700">{t('summaryPrice')}</span>
              <span className="text-2xl font-black text-gray-900">{t('priceGel', { amount: form.pageCount })}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">{t('summaryNote')}</p>
          </aside>
        </div>

      </ToolShell>
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

  const showingBookPreview = book.status === 'CHARACTER_APPROVED' && (!book.previewConfirmedAt || showPreviewAgain);
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
          <p className="text-sm text-gray-500">{t('statusLabel')}: {t(`statusValue.${book.status === 'FAILED' && book.characterBible ? 'FINAL_GENERATING' : book.status}`, book.status)}</p>
        </div>

        {mocked && (
          <div className="mb-4 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2">{t('mockNotice')}</div>
        )}
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          {PHOTO_EDITABLE_STATUSES.includes(book.status) && (
            <div className="mb-5 pb-5 border-b border-gray-100">
              <CharacterPhotoField photoUrl={photoUrl} disabled={busy} onSelect={handlePhotoSelect} onRemove={handlePhotoRemove} />
              {book.characterConfig?.siblings?.map((sibling, index) => (
                <div key={`${sibling.name}-${index}`} className="mt-4">
                  <SiblingPhotoEditor book={book} index={index} disabled={busy} run={run} onUpdated={setBook} />
                </div>
              ))}
              {book.status === 'CHARACTER_PREVIEW_READY' && <p className="text-xs text-purple-700 mt-2">{t('photoRegenerateHint')}</p>}
            </div>
          )}

          {book.status === 'CHARACTER_APPROVED' && (
            <div className="mb-5 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-800">{t('audioAddonTitle')}</span>
                </div>
                <button
                  disabled={busy}
                  onClick={() => handleAudioToggle(!book.audioAddOnPurchased)}
                  className="px-3 py-1.5 rounded-lg border border-purple-300 bg-white text-purple-700 text-sm font-medium disabled:opacity-50"
                >
                  {book.audioAddOnPurchased ? t('removeAudio') : t('addAudioFor', { amount: (book.priceGel + 500) / 100 })}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">{t('priceBreakdown', { book: book.priceGel / 100, audio: book.audioAddOnPurchased ? book.audioPriceGel / 100 : 0, total: (book.audioAddOnPurchased ? book.totalPriceGel : book.priceGel) / 100 })}</p>
              {mocked && <p className="text-xs text-gray-500 mt-1">{t('mockAudioNotice')}</p>}
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

          {editingText && TEXT_EDITABLE_STATUSES.includes(book.status) && (
            <StoryTextEditor
              book={book}
              busy={busy}
              mode="edit"
              onSave={(pages) => run(async () => { setBook(await updateStoryText(book.id, pages)); setEditingText(false); })}
              onCancel={() => setEditingText(false)}
            />
          )}

          {!editingText && book.status === 'STORY_PLAN_READY' && !book.storyPlan?.textApprovedAt && (
            <StoryTextEditor
              book={book}
              busy={busy}
              mode="review"
              onSave={(pages) => run(async () => setBook(await updateStoryText(book.id, pages)))}
              onRegenerate={() => run(async () => setBook(await regenerateStoryText(book.id)))}
              onApprove={(pages) => run(async () => {
                try {
                  setBook(await approveStoryText(book.id, pages));
                } catch (err: any) {
                  // The site can go live a little before the server update
                  // that adds this step; an older server has no approval
                  // route and no approval gate, so continue straight on.
                  if (err?.response?.status !== 404) throw err;
                }
                const r = await generateCharacterPreview(book.id);
                setBook(r.book);
                setMocked(r.mocked);
              })}
            />
          )}

          {!editingText && book.status === 'STORY_PLAN_READY' && !!book.storyPlan?.textApprovedAt && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step2Title')}</h2>
              <p className="text-sm text-green-700 mb-4 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t('storyApprovedNotice')}</p>
              <ul className="text-sm text-gray-500 mb-4 space-y-1 list-decimal list-inside" style={{ fontFamily: bookFontFamily(book.characterConfig?.fontId) }}>
                {book.storyPlan?.pages?.map((p: any) => <li key={p.pageNumber} className="whitespace-pre-line">{p.storyText}</li>)}
              </ul>
              <div className="flex flex-wrap gap-3">
                <button disabled={busy} onClick={() => run(async () => { const r = await generateCharacterPreview(book.id); setBook(r.book); setMocked(r.mocked); })} className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('generateCharacterPreviewButton')}
                </button>
                <button disabled={busy} onClick={() => setEditingText(true)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50 flex items-center gap-1">
                  <PenLine className="w-4 h-4" /> {t('storyEditButton')}
                </button>
              </div>
            </>
          )}

          {book.status === 'CHARACTER_PREVIEW_GENERATING' && (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('generatingPreview')}
            </div>
          )}

          {!editingText && (book.status === 'CHARACTER_PREVIEW_READY' || book.status === 'CHARACTER_APPROVED') && (
            <>
              {!showingBookPreview && (
                <>
                  <h2 className="font-semibold text-gray-800 mb-3">{t('step3Title')}</h2>
                  {previewUrl && <img src={previewUrl} alt={book.characterConfig?.name || ''} className="w-48 h-48 object-contain rounded-lg border border-gray-200 bg-gray-50 mb-4" />}
                </>
              )}
              {book.status === 'CHARACTER_PREVIEW_READY' && (
                <div className="flex gap-3">
                  <button disabled={busy} onClick={() => run(async () => setBook(await approveCharacter(book.id)))} className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {t('approveCharacterButton')}
                  </button>
                  <button disabled={busy} onClick={() => run(async () => { const r = await generateCharacterPreview(book.id); setBook(r.book); })} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50 flex items-center gap-1">
                    <RefreshCw className="w-4 h-4" /> {t('regenerateButton')}
                  </button>
                  <button disabled={busy} onClick={() => setEditingText(true)} className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50 flex items-center gap-1">
                    <PenLine className="w-4 h-4" /> {t('storyEditButton')}
                  </button>
                </div>
              )}
              {showingBookPreview && (
                <div>
                  <BookPreview
                    book={book}
                    portraitUrl={previewUrl}
                    busy={busy}
                    onConfirm={book.previewConfirmedAt ? null : () => run(async () => setBook(await confirmBookPreview(book.id)))}
                    onClose={book.previewConfirmedAt ? () => setShowPreviewAgain(false) : undefined}
                    onEditText={() => { setShowPreviewAgain(false); setEditingText(true); }}
                    promo={appliedPromo}
                  />
                </div>
              )}
              {book.status === 'CHARACTER_APPROVED' && book.previewConfirmedAt && !showPreviewAgain && (
                <>
                  <p className="text-sm text-gray-600 mb-2">{t('paymentIntro', { count: book.pageCount })}</p>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <button onClick={() => setShowPreviewAgain(true)} className="text-sm text-purple-600 font-medium hover:underline">{t('previewViewAgain')}</button>
                    <button onClick={() => setEditingText(true)} className="text-sm text-purple-600 font-medium hover:underline inline-flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> {t('storyEditButton')}</button>
                  </div>
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
                          {book.audioAddOnPurchased ? t('audioEnabled') : t('addAudioStory')}
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => run(async () => {
                          const r = await startCheckout(book.id, appliedPromo?.code);
                          if (r.redirectUrl) window.location.href = r.redirectUrl;
                          else setBook(await getBook(book.id).then((x) => x.book));
                        })}
                        className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50"
                      >
                        {t('payButton', { amount: (appliedPromo ? appliedPromo.discountedAmount : (book.audioAddOnPurchased ? book.totalPriceGel : book.priceGel)) / 100 })}
                      </button>
                      <div className="basis-full">
                        <PromoCodeField
                          targetType="CHILDRENS_BOOK"
                          targetId={book.id}
                          lang={promoLang}
                          applied={appliedPromo}
                          onChange={(promo) => {
                            setAppliedPromo(promo);
                            setSavedPromoNotice(null);
                            // A code removed by hand must not come back on its own.
                            if (!promo) clearPendingBookPromo(book.id);
                          }}
                          disabled={busy}
                        />
                        {savedPromoNotice && <p className="text-xs text-red-500 mt-1">{savedPromoNotice}</p>}
                      </div>
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
              <GenerationProgress accepted={acceptedCount} total={book.pageCount} />
            </>
          )}

          {book.status === 'FAILED' && !book.characterBible && (
            <>
              <p className="text-red-600 mb-4">{t('previewFailed')}</p>
              <button
                disabled={busy}
                onClick={() => run(async () => setBook((await generateCharacterPreview(book.id)).book))}
                className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50"
              >
                {t('retryButton')}
              </button>
            </>
          )}

          {/* A paid book is never shown as "failed": the server keeps retrying
              on its own (see recoverStalledBooks), so the parent just sees the
              book is still being drawn, plus an optional way to nudge it. */}
          {book.status === 'FAILED' && !!book.characterBible && (
            <>
              <h2 className="font-semibold text-gray-800 mb-3">{t('step5Title')}</h2>
              <GenerationProgress accepted={acceptedCount} total={book.pageCount} />
              <p className="mt-3 text-sm text-gray-600">{t('generationAutoRetrying')}</p>
              <button
                disabled={busy}
                onClick={() => run(async () => setBook((await startFinalGeneration(book.id)).book))}
                className="mt-3 text-sm font-medium text-purple-700 hover:underline disabled:opacity-50"
              >
                {t('generationContinueNow')}
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
                      if (!ready) {
                        return (
                          <div key={n} className="aspect-square rounded-lg border flex items-center justify-center text-xs border-gray-200 bg-gray-50 text-gray-400">
                            {t('pageLabel', { number: n })}
                          </div>
                        );
                      }
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => router.push({ pathname: '/dashboard/tools/childrens-book/reader/[bookId]', query: { bookId: book.id } })}
                          className="aspect-square rounded-lg border flex items-center justify-center text-xs border-green-300 bg-green-50 text-green-700 overflow-hidden hover:ring-2 hover:ring-purple-400"
                        >
                          <PageThumbnail bookId={book.id} pageNumber={n} version={page?.acceptedEventId} label={t('pageLabel', { number: n })} alt={t('readerImageAlt', { title: book.title, number: n })} />
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push({ pathname: '/dashboard/tools/childrens-book/reader/[bookId]', query: { bookId: book.id } })}
                    className="mb-4 px-5 py-2 rounded-lg bg-purple-600 text-white font-medium inline-flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" /> {t('readButton')}
                  </button>

                  {book.status === 'COMPLETED' && <p className="text-green-700 font-medium mb-4 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t('bookCompleted')}</p>}

                  {hasPlaceholderStoryText(book) && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm text-amber-800 mb-3">{t('storyTextMissing')}</p>
                      <button disabled={busy} onClick={() => run(async () => setBook(await rewriteStoryText(book.id)))} className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50 inline-flex items-center gap-2">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <Sparkles className="w-4 h-4" />} {t('writeStoryTextButton')}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 mb-4">
                    {book.pdfStatus !== 'CURRENT' && (
                      <button disabled={busy || book.pdfStatus === 'GENERATING'} onClick={() => run(async () => { const updated = await generatePdf(book.id); setBook(updated); await downloadBookPdf(book.id, book.title); })} className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 flex items-center gap-1">
                        {busy || book.pdfStatus === 'GENERATING' ? <Loader2 className="w-4 h-4 animate-spin inline" /> : <Download className="w-4 h-4" />} {book.pdfStatus === 'GENERATING' ? t('pdfPreparing') : t('downloadPdfButton')}
                      </button>
                    )}
                    {book.pdfStatus === 'CURRENT' && (
                      <button disabled={busy} onClick={() => run(async () => downloadBookPdf(book.id, book.title))} className="px-5 py-2 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 flex items-center gap-1">
                        <Download className="w-4 h-4" /> {t('downloadPdfButton')}
                      </button>
                    )}

                    {canListenToAudio && new Set(audioStatus?.artifacts?.filter((a) => a.status === 'READY').map((a) => a.pageNumber) ?? []).size >= book.pageCount && (
                      <button disabled={busy} onClick={() => run(async () => downloadFullStoryMp3(book.id, book.title))} className="px-5 py-2 rounded-lg border border-purple-300 bg-white text-purple-700 font-medium disabled:opacity-50 flex items-center gap-1">
                        <Download className="w-4 h-4" /> {t('flipDownloadMp3')}
                      </button>
                    )}

                    {canListenToAudio && (
                      <button
                        disabled={busy}
                        onClick={() => handleGenerateNarration()}
                        className="px-5 py-2 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 font-medium disabled:opacity-50 flex items-center gap-1"
                      >
                        <Headphones className="w-4 h-4" /> {audioStatus?.artifacts?.length ? t('refreshAudioStory') : t('generateAudioStory')}
                      </button>
                    )}
                  </div>

                  {canListenToAudio && new Set(audioStatus?.artifacts?.filter((a) => a.status === 'READY').map((a) => a.pageNumber) ?? []).size < book.pageCount && (
                    <p className="mb-4 -mt-2 flex items-center gap-1.5 text-sm text-purple-700"><Loader2 className="h-4 w-4 animate-spin" /> {t('audioPreparingAuto')}</p>
                  )}

                  {(book.status === 'FINAL_READY' || book.status === 'COMPLETED') && acceptedCount === book.pageCount && (
                    <BookSharePanel
                      bookId={book.id}
                      language={book.language}
                      token={book.storyPlan?.extras?.shareToken ?? null}
                      disabled={!!book.storyPlan?.extras?.shareDisabled}
                      onChanged={() => { getBook(book.id).then((x) => setBook(x.book)).catch(() => {}); }}
                    />
                  )}

                  {(book.status === 'FINAL_READY' || book.status === 'COMPLETED') && acceptedCount === book.pageCount && (
                    <PrintSettingsPanel
                      busy={busy}
                      onDownload={(settings, suffix) => run(async () => downloadPrintPdf(book.id, settings, `${book.title}-${suffix}`))}
                    />
                  )}

                  {canListenToAudio && (
                    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-2 mb-3 text-gray-800 font-medium">
                        <PlayCircle className="w-4 h-4 text-purple-600" /> {t('storyReaderTitle')}
                      </div>
                      <div className="space-y-2">
                        {book.pages?.map((page) => (
                          <button
                            key={page.pageNumber}
                            onClick={() => playPageAudio(page.pageNumber)}
                            className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:border-purple-300"
                          >
                            <span>{t('pageLabel', { number: page.pageNumber })}</span>
                            <span className="text-purple-600 font-medium">{t('listenButton')}</span>
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

        {book.status !== 'FAILED' && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6" data-testid="book-font-panel">
            <BookFontPicker
              value={book.characterConfig?.fontId}
              language={book.language}
              disabled={busy || book.pdfStatus === 'GENERATING'}
              onChange={(fontId) => run(async () => {
                const hadPdf = book.pdfStatus === 'CURRENT';
                const updated = await updateBookFont(book.id, fontId);
                setBook(updated);
                setFontNotice(hadPdf && updated.pdfStatus === 'STALE' ? t('fontChangedPdfStale', { button: t('generatePdfButton') }) : null);
              })}
            />
            {fontNotice && <p className="text-sm text-purple-700 mt-3">{fontNotice}</p>}
          </div>
        )}
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
