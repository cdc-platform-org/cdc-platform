import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, Download, GraduationCap, ShoppingBag, Loader2, Clock, ArrowRight } from 'lucide-react';
import { MyCourseWithProgress } from '../../types/lms';
import { DigitalProduct, productTitle } from '../../services/productService';
import { BookListItem, downloadBookPdf } from '../../services/childrensBookService';
import { MyPaymentRow } from '../../services/paymentService';

// One place that lists everything the signed-in user owns: children's books,
// courses and digital products, each with its open / download action.
// Before this, purchased books were not shown anywhere on /dashboard, and
// purchased products were buried at the bottom of the seller-oriented
// "Digital Products" tab.

const copy = {
  ka: {
    title: 'ჩემი შენაძენები',
    subtitle: 'აქ არის ყველაფერი, რაც შეიძინე: წიგნები, კურსები და ციფრული პროდუქტები.',
    books: 'საბავშვო წიგნები',
    courses: 'კურსები',
    products: 'ციფრული პროდუქტები',
    open: 'გახსნა',
    read: 'წაკითხვა',
    continue: 'გაგრძელება',
    download: 'ჩამოტვირთვა',
    preparePdf: 'PDF-ის მომზადება',
    downloadFailed: 'ჩამოტვირთვა ვერ მოხერხდა. სცადე თავიდან.',
    statusPaymentPending: 'გადახდა მოწმდება…',
    statusPreparing: 'გადახდილია. წიგნი მზადდება, რამდენიმე წუთი დასჭირდება.',
    statusReady: 'მზადაა',
    statusProblem: 'მომზადება შეფერხდა. გახსენი წიგნი თავიდან საცდელად ან დაგვიკავშირდი.',
    empty: 'ჯერ არაფერი გიყიდია.',
    browseCourses: 'კურსების ნახვა',
    browseStore: 'მაღაზიის ნახვა',
    createBook: 'წიგნის შექმნა',
    seeAll: 'ყველას ნახვა',
    progress: 'პროგრესი',
  },
  en: {
    title: 'My purchases',
    subtitle: 'Everything you have bought: books, courses and digital products.',
    books: "Children's books",
    courses: 'Courses',
    products: 'Digital products',
    open: 'Open',
    read: 'Read',
    continue: 'Continue',
    download: 'Download',
    preparePdf: 'Prepare PDF',
    downloadFailed: 'Download failed. Please try again.',
    statusPaymentPending: 'Confirming payment…',
    statusPreparing: 'Paid. Your book is being created, this takes a few minutes.',
    statusReady: 'Ready',
    statusProblem: 'Something went wrong while creating it. Open the book to retry, or contact us.',
    empty: "You haven't bought anything yet.",
    browseCourses: 'Browse courses',
    browseStore: 'Browse the store',
    createBook: 'Create a book',
    seeAll: 'See all',
    progress: 'Progress',
  },
};

const READY_STATUSES = new Set(['FINAL_READY', 'COMPLETED', 'REVISION_REQUESTED', 'REVISION_GENERATING', 'REVISION_QA']);
const PREPARING_STATUSES = new Set(['PAID', 'FINAL_GENERATING', 'FINAL_QA']);

type BookState = 'pending' | 'preparing' | 'ready' | 'problem';

// A book counts as "purchased" once its own state machine is past payment,
// or while payment is being confirmed. FAILED is ambiguous (it can also be
// a pre-payment preview failure), so it only counts when a completed
// payment for that book exists.
export function purchasedBooks(books: BookListItem[], payments: MyPaymentRow[]): { book: BookListItem; state: BookState }[] {
  const paidIds = new Set(
    payments.filter((p) => p.purpose === 'CHILDRENS_BOOK' && p.status === 'COMPLETED').map((p) => p.referenceId)
  );
  const result: { book: BookListItem; state: BookState }[] = [];
  for (const book of books) {
    let state: BookState | null = null;
    if (READY_STATUSES.has(book.status)) state = 'ready';
    else if (PREPARING_STATUSES.has(book.status)) state = 'preparing';
    else if (book.status === 'PAYMENT_PENDING') state = paidIds.has(book.id) ? 'preparing' : 'pending';
    else if (paidIds.has(book.id)) state = book.status === 'FAILED' ? 'problem' : 'preparing';
    if (state) result.push({ book, state });
  }
  return result;
}

interface Props {
  lang: string;
  books: { book: BookListItem; state: BookState }[];
  courses: MyCourseWithProgress[];
  products: DigitalProduct[];
  onDownloadProduct: (productId: string) => void;
  downloadingProductId: string | null;
  productDownloadError: string | null;
  // Overview shows a short preview (a few rows + "See all"); the
  // Purchases tab shows the full list.
  compact?: boolean;
  onSeeAll?: () => void;
}

const btnPrimary =
  'inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-cyan-600 text-white no-underline border-none cursor-pointer disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-transparent no-underline cursor-pointer disabled:opacity-50';

function Row({ icon: Icon, title, meta, children }: { icon: typeof BookOpen; title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex-wrap">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</p>
        {meta && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta}</div>}
      </div>
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto pl-12 sm:pl-0">{children}</div>
    </div>
  );
}

export default function MyPurchasesPanel({
  lang,
  books,
  courses,
  products,
  onDownloadProduct,
  downloadingProductId,
  productDownloadError,
  compact = false,
  onSeeAll,
}: Props) {
  const t = lang === 'ka' ? copy.ka : copy.en;
  const titleLang = lang === 'ka' ? 'ka' : 'en';
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  const handleBookPdf = async (book: BookListItem) => {
    setBookError(null);
    setDownloadingBookId(book.id);
    try {
      await downloadBookPdf(book.id, book.title || 'book');
    } catch {
      setBookError(t.downloadFailed);
    } finally {
      setDownloadingBookId(null);
    }
  };

  const total = books.length + courses.length + products.length;
  const bookPage = (id: string) => ({ pathname: '/dashboard/tools/childrens-book', query: { bookId: id } });
  const readerPage = (id: string) => ({ pathname: '/dashboard/tools/childrens-book/reader/[bookId]', query: { bookId: id } });

  const bookRows = books.map(({ book, state }) => (
    <Row
      key={`b-${book.id}`}
      icon={BookOpen}
      title={book.title || t.books}
      meta={
        state === 'ready' ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{t.statusReady}</span>
        ) : state === 'problem' ? (
          <span className="text-red-600 dark:text-red-400">{t.statusProblem}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            {state === 'pending' ? <Clock className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
            {state === 'pending' ? t.statusPaymentPending : t.statusPreparing}
          </span>
        )
      }
    >
      {state === 'ready' ? (
        <>
          <Link href={readerPage(book.id)} className={btnPrimary}>
            <BookOpen className="w-3.5 h-3.5" /> {t.read}
          </Link>
          {book.pdfStatus === 'CURRENT' ? (
            <button type="button" className={btnSecondary} disabled={downloadingBookId === book.id} onClick={() => handleBookPdf(book)}>
              {downloadingBookId === book.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {t.download}
            </button>
          ) : (
            <Link href={bookPage(book.id)} className={btnSecondary}>
              <Download className="w-3.5 h-3.5" /> {t.preparePdf}
            </Link>
          )}
        </>
      ) : (
        <Link href={bookPage(book.id)} className={btnSecondary}>
          {t.open}
        </Link>
      )}
    </Row>
  ));

  const courseRows = courses.map(({ course, progress }) => (
    <Row
      key={`c-${course.id}`}
      icon={GraduationCap}
      title={course.title}
      meta={`${t.progress}: ${progress.percent}%`}
    >
      <Link href={`/courses/${course.id}/learn`} className={btnPrimary}>
        {progress.percent > 0 && progress.percent < 100 ? t.continue : t.open}
      </Link>
    </Row>
  ));

  const productRows = products.map((product) => (
    <Row key={`p-${product.id}`} icon={ShoppingBag} title={productTitle(product, titleLang)} meta={product.category}>
      <Link href={`/store/${product.id}`} className={btnSecondary}>
        {t.open}
      </Link>
      <button
        type="button"
        className={btnPrimary}
        disabled={downloadingProductId === product.id}
        onClick={() => onDownloadProduct(product.id)}
      >
        {downloadingProductId === product.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {t.download}
      </button>
    </Row>
  ));

  const errors = [bookError, productDownloadError].filter(Boolean) as string[];

  if (compact) {
    // Books first (the newest kind of purchase and the one people most
    // often come back for), then courses, then products.
    const preview = [...bookRows, ...courseRows, ...productRows].slice(0, 4);
    return (
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-extrabold">{t.title}</h2>
          {total > 0 && onSeeAll && (
            <button type="button" onClick={onSeeAll} className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-transparent border-none cursor-pointer">
              {t.seeAll} ({total}) <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {errors.map((e) => (
          <p key={e} className="text-xs text-red-600 dark:text-red-400 mb-2">{e}</p>
        ))}
        {total === 0 ? <EmptyState t={t} /> : <div className="space-y-2">{preview}</div>}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-extrabold">{t.title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
      </div>
      {errors.map((e) => (
        <div key={e} className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">{e}</div>
      ))}
      {total === 0 && <EmptyState t={t} />}
      {bookRows.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{t.books}</h3>
          <div className="space-y-2">{bookRows}</div>
        </div>
      )}
      {courseRows.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{t.courses}</h3>
          <div className="space-y-2">{courseRows}</div>
        </div>
      )}
      {productRows.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{t.products}</h3>
          <div className="space-y-2">{productRows}</div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ t }: { t: typeof copy.ka }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.empty}</p>
      <div className="flex justify-center gap-2 flex-wrap">
        <Link href="/courses" className={btnPrimary}>{t.browseCourses}</Link>
        <Link href="/store" className={btnSecondary}>{t.browseStore}</Link>
        <Link href="/dashboard/tools/childrens-book" className={btnSecondary}>{t.createBook}</Link>
      </div>
    </div>
  );
}
