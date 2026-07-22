import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { getBogPaymentStatus, BogPaymentStatusData } from '../../../src/services/paymentService';

const dict = {
  ka: {
    title: 'გადახდის სტატუსი',
    waiting: 'ველოდებით ბანკისგან დადასტურებას…',
    completed: 'გადახდა წარმატებით დასრულდა!',
    failed: 'გადახდა ვერ განხორციელდა ან გაუქმდა.',
    pendingLong:
      'გადახდა ჯერ კიდევ მუშავდება. თუ ეს გვერდი დიდხანს არ განახლდება, დაუკავშირდით მხარდაჭერას.',
    course: 'კურსზე წვდომა',
    mentorship: 'მენტორის სესია',
    gig: 'გარიგების ესქროუ დაფინანსება',
    backHome: 'მთავარ გვერდზე დაბრუნება',
    amount: 'თანხა',
    checkAgain: 'ხელახლა შემოწმება',
    missingId: 'გადახდის ID ვერ მოიძებნა.',
  },
  en: {
    title: 'Payment Status',
    waiting: 'Waiting for confirmation from the bank…',
    completed: 'Payment completed successfully!',
    failed: 'Payment failed or was cancelled.',
    pendingLong:
      'Your payment is still being processed. If this page doesn’t update soon, please contact support.',
    course: 'Course access',
    mentorship: 'Mentorship session',
    gig: 'Gig escrow funding',
    backHome: 'Back to home',
    amount: 'Amount',
    checkAgain: 'Check again',
    missingId: 'No payment ID was found.',
  },
};

const purposeKey: Record<string, keyof typeof dict.en> = {
  COURSE: 'course',
  MENTORSHIP: 'mentorship',
  GIG_ESCROW_FUNDING: 'gig',
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">{t.title}</h1>

        {typeof paymentId !== 'string' ? (
          <p className="text-sm text-red-600">{t.missingId}</p>
        ) : error ? (
          <p className="text-sm text-red-600">{t.failed}</p>
        ) : !status ? (
          <p className="text-sm text-gray-400">{t.waiting}</p>
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
            <p className="text-sm font-medium text-gray-900">
              {status.status === 'COMPLETED' ? t.completed : status.status === 'PENDING' ? t.waiting : t.failed}
            </p>
            {status.status === 'PENDING' && !polling && <p className="text-xs text-gray-400">{t.pendingLong}</p>}
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-4 space-y-1">
              <p>{purposeKey[status.purpose] ? t[purposeKey[status.purpose]] : status.purpose}</p>
              <p>
                {t.amount}: {(status.amount / 100).toFixed(2)} {status.currency}
              </p>
            </div>
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
