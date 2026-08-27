import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Users, ChevronRight } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import { getMyHRSupportRequests } from '../../../src/services/hrSupportService';
import { HRSupportRequest, HRSupportRequestStatus } from '../../../src/types/hrSupport';
import { resolveLocale } from '../../../src/utils/locale';

const EN_STRINGS = {
  title: 'HR Assistance Requests',
  subtitle: 'Track the screening requests you have purchased for your vacancies.',
  loading: 'Loading…',
  empty: 'You have not requested HR Assistance for any vacancy yet.',
  candidates: (n: number) => `${n} candidate${n !== 1 ? 's' : ''}`,
  status: {
    PENDING_PAYMENT: 'Payment pending',
    AWAITING_ASSIGNMENT: 'Awaiting specialist',
    IN_PROGRESS: 'In progress',
    DELIVERED: 'Delivered — action needed',
    CANCELLED: 'Cancelled',
  } as Record<HRSupportRequestStatus, string>,
};

const dict = {
  ka: {
    title: 'HR დახმარების მოთხოვნები',
    subtitle: 'თვალი ადევნეთ თქვენი ვაკანსიებისთვის შეძენილ სკრინინგის მოთხოვნებს.',
    loading: 'იტვირთება…',
    empty: 'თქვენ ჯერ არცერთი ვაკანსიისთვის არ მოგითხოვიათ HR დახმარება.',
    candidates: (n: number) => `${n} კანდიდატი`,
    status: {
      PENDING_PAYMENT: 'გადახდა მიმდინარეობს',
      AWAITING_ASSIGNMENT: 'სპეციალისტის მოლოდინში',
      IN_PROGRESS: 'მიმდინარეობს',
      DELIVERED: 'მზადაა — საჭიროებს თქვენს რეაქციას',
      CANCELLED: 'გაუქმებულია',
    } as Record<HRSupportRequestStatus, string>,
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

const STATUS_BADGE_CLASS: Record<HRSupportRequestStatus, string> = {
  PENDING_PAYMENT: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  AWAITING_ASSIGNMENT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
  IN_PROGRESS: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400',
  DELIVERED: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  CANCELLED: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
};

function formatGel(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

function HRSupportListContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const [requests, setRequests] = useState<HRSupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getMyHRSupportRequests());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-wide flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-500" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-10 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/hr-support/${r.id}`}
                className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 no-underline hover:border-cyan-400/50 dark:hover:border-cyan-400/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">{r.vacancy.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t.candidates(r.candidateCount)} · {formatGel(r.grossAmount)} {r.currency}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-full ${STATUS_BADGE_CLASS[r.status]}`}>
                    {t.status[r.status]}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export default function HRSupportListPage() {
  return (
    <ProtectedRoute>
      <HRSupportListContent />
    </ProtectedRoute>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});
