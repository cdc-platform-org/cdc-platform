import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Video, CalendarClock } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import BackButton from '../../../src/components/common/BackButton';
import { getBogPaymentStatus, BogPaymentStatusData } from '../../../src/services/paymentService';

const dict = {
  ka: {
    title: 'გადახდის სტატუსი',
    waiting: 'ველოდებით ბანკისგან დადასტურებას…',
    completed: 'გადახდა წარმატებით დასრულდა!',
    failed: 'გადახდა ვერ განხორციელდა.',
    cancelled: 'გადახდა გაუქმებულია.',
    checkFailed: 'სტატუსის შემოწმება ვერ მოხერხდა. შეამოწმეთ ინტერნეტ კავშირი და სცადეთ თავიდან.',
    pendingLong:
      'გადახდა ჯერ კიდევ მუშავდება. თუ ეს გვერდი დიდხანს არ განახლდება, დაუკავშირდით მხარდაჭერას.',
    redirectingToCourse: 'გადამისამართება კურსზე…',
    redirectingToProduct: 'გადამისამართება პროდუქტზე…',
    course: 'კურსზე წვდომა',
    mentorship: 'მენტორის სესია',
    gig: 'გარიგების ესქროუ დაფინანსება',
    product: 'ციფრული პროდუქტი',
    backHome: 'მთავარ გვერდზე დაბრუნება',
    amount: 'თანხა',
    checkAgain: 'ხელახლა შემოწმება',
    missingId: 'გადახდის ID ვერ მოიძებნა.',
    sessionScheduledFor: 'სესია დაგეგმილია',
    joinMeet: 'Google Meet-ზე გადასვლა',
    calendarPending: 'კალენდარში დამატება მიმდინარეობს — მალე მიიღებთ მოწვევას ელფოსტაზე.',
  },
  en: {
    title: 'Payment Status',
    waiting: 'Waiting for confirmation from the bank…',
    completed: 'Payment completed successfully!',
    failed: 'Payment failed.',
    cancelled: 'Payment was cancelled.',
    checkFailed: 'Unable to check payment status. Check your connection and try again.',
    pendingLong:
      'Your payment is still being processed. If this page doesn’t update soon, please contact support.',
    redirectingToCourse: 'Redirecting to your course…',
    redirectingToProduct: 'Redirecting to your product…',
    course: 'Course access',
    mentorship: 'Mentorship session',
    gig: 'Gig escrow funding',
    product: 'Digital product',
    backHome: 'Back to home',
    amount: 'Amount',
    checkAgain: 'Check again',
    missingId: 'No payment ID was found.',
    sessionScheduledFor: 'Your session is scheduled for',
    joinMeet: 'Join Google Meet',
    calendarPending: 'Adding it to your calendar — you\'ll get an email invite shortly.',
  },
};

const purposeKey: Record<string, keyof typeof dict.en> = {
  COURSE: 'course',
  MENTORSHIP: 'mentorship',
  GIG_ESCROW_FUNDING: 'gig',
  PRODUCT: 'product',
};

function BogResultContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { paymentId } = router.query;

  const [status, setStatus] = useState<BogPaymentStatusData | null>(null);
  const [error, setError] = useState(false);
  const [polling, setPolling] = useState(true);

  const poll = useCallback(async () => {
    if (typeof paymentId !== 'string') return;
    try {
      const data = await getBogPaymentStatus(paymentId);
      setStatus(data);
      if (data.status !== 'PENDING') {
        setPolling(false);
      }
    } catch {
      setError(true);
      setPolling(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (typeof paymentId !== 'string') return;
    poll();
    const interval = setInterval(poll, 3000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 60_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentId, poll]);

  // Course purchases go straight to the learn page once payment clears —
  // no separate "continue" click needed. Product purchases go to the
  // product detail page, which now shows the download button.
  useEffect(() => {
    if (status?.status === 'COMPLETED' && status.purpose === 'COURSE') {
      const redirect = setTimeout(() => {
        router.push(`/courses/${status.referenceId}/learn`);
      }, 1800);
      return () => clearTimeout(redirect);
    }
    if (status?.status === 'COMPLETED' && status.purpose === 'PRODUCT') {
      const redirect = setTimeout(() => {
        router.push(`/store/${status.referenceId}`);
      }, 1800);
      return () => clearTimeout(redirect);
    }
  }, [status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19] px-4">
      <div className="max-w-md w-full bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-none p-8 text-center transition-colors">
        <div className="mb-4 text-left">
          <BackButton fallbackHref="/" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t.title}</h1>

        {typeof paymentId !== 'string' ? (
          <p className="text-sm text-red-600">{t.missingId}</p>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{t.checkFailed}</p>
            <button
              onClick={() => {
                setError(false);
                setPolling(true);
                poll();
              }}
              className="text-sm text-indigo-600 hover:underline"
            >
              {t.checkAgain}
            </button>
          </div>
        ) : !status ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">{t.waiting}</p>
        ) : (
          <div className="space-y-4">
            <div
              className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                status.status === 'COMPLETED'
                  ? 'bg-emerald-100 text-emerald-600'
                  : status.status === 'PENDING'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {status.status === 'COMPLETED' ? '✓' : status.status === 'PENDING' ? '…' : '✕'}
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {status.status === 'COMPLETED'
                ? t.completed
                : status.status === 'PENDING'
                ? t.waiting
                : status.status === 'CANCELLED'
                ? t.cancelled
                : t.failed}
            </p>
            {status.status === 'COMPLETED' && status.purpose === 'COURSE' && (
              <p className="text-xs text-gray-400 dark:text-slate-500">{t.redirectingToCourse}</p>
            )}
            {status.status === 'COMPLETED' && status.purpose === 'PRODUCT' && (
              <p className="text-xs text-gray-400 dark:text-slate-500">{t.redirectingToProduct}</p>
            )}
            {status.status === 'PENDING' && !polling && <p className="text-xs text-gray-400 dark:text-slate-500">{t.pendingLong}</p>}
            <div className="text-xs text-gray-500 dark:text-slate-400 border-t border-gray-100 dark:border-slate-800 pt-4 space-y-1">
              <p>{purposeKey[status.purpose] ? t[purposeKey[status.purpose]] : status.purpose}</p>
              <p>
                {t.amount}: {(status.amount / 100).toFixed(2)} {status.currency}
              </p>
            </div>

            {status.status === 'COMPLETED' && status.purpose === 'MENTORSHIP' && status.booking && (
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-4 text-left space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  <span>
                    {t.sessionScheduledFor}:{' '}
                    {new Date(status.booking.scheduledAt).toLocaleString(lang === 'en' ? 'en-GB' : 'ka-GE', {
                      timeZone: 'Asia/Tbilisi',
                    })}
                  </span>
                </div>
                {status.booking.googleMeetLink ? (
                  <a
                    href={status.booking.googleMeetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full text-sm font-bold px-4 py-2.5 rounded-lg bg-indigo-600 text-white no-underline hover:bg-indigo-700"
                  >
                    <Video className="w-4 h-4" />
                    {t.joinMeet}
                  </a>
                ) : (
                  <p className="text-xs text-indigo-700">{t.calendarPending}</p>
                )}
              </div>
            )}
            {status.status === 'PENDING' && !polling && (
              <button
                onClick={() => {
                  setPolling(true);
                  poll();
                }}
                className="text-sm text-indigo-600 hover:underline"
              >
                {t.checkAgain}
              </button>
            )}
          </div>
        )}

        <Link href="/" className="block mt-6 text-sm text-indigo-600 hover:underline">
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}

export default function BogResultPage() {
  return (
    <ProtectedRoute>
      <BogResultContent />
    </ProtectedRoute>
  );
}
