import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ApplicationsReviewList from '../../../src/components/community/ApplicationsReviewList';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import BackButton from '../../../src/components/common/BackButton';
import { useAuth } from '../../../src/context/AuthContext';
import { Gig, GigApplication } from '../../../src/types/community';
import {
  getGigById,
  getGigApplications,
  approveGigApplication,
  rejectGigApplication,
} from '../../../src/services/gigService';
import { checkoutGigEscrow } from '../../../src/services/paymentService';
import { resolveLocale } from '../../../src/utils/locale';

const EN_STRINGS = {
  loading: 'Loading…',
  notFound: "This gig doesn't exist or you don't have permission to view its applications.",
  applications: (n: number) => `${n} application${n !== 1 ? 's' : ''}`,
  budget: 'Budget',
  assignedNotice: 'This gig is assigned. Fund escrow via Bank of Georgia to let work begin — funds are held until you approve the delivered work.',
  fundEscrow: 'Fund Escrow with BOG',
  redirecting: 'Redirecting to BOG…',
  fundingError: 'Unable to start payment. Please try again.',
};

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'ეს შეკვეთა არ არსებობს ან არ გაქვთ განაცხადების ნახვის უფლება.',
    applications: (n: number) => `${n} განაცხადი`,
    budget: 'ბიუჯეტი',
    assignedNotice: 'ეს შეკვეთა დანიშნულია. დააფინანსეთ ესქროუ Bank of Georgia-ს მეშვეობით სამუშაოს დასაწყებად — თანხა ინახება, სანამ არ დაამტკიცებთ შესრულებულ სამუშაოს.',
    fundEscrow: 'ესქროუს დაფინანსება BOG-ით',
    redirecting: 'გადამისამართება BOG-ზე…',
    fundingError: 'გადახდის დაწყება ვერ მოხერხდა. სცადეთ თავიდან.',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function GigApplicationsContent() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const t = dict[resolveLocale(router.locale)];
  const [gig, setGig] = useState<Gig | null>(null);
  const [applications, setApplications] = useState<GigApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (typeof id !== 'string') return;
    setLoading(true);
    try {
      const [gigData, applicationsData] = await Promise.all([
        getGigById(id),
        getGigApplications(id),
      ]);
      const isOwner = gigData.postedBy.id === user?.id;
      const isAdmin = user?.role === 'SuperAdmin';
      if (!isOwner && !isAdmin) {
        setNotFoundOrForbidden(true);
        return;
      }
      setGig(gigData);
      setApplications(applicationsData);
    } catch {
      setNotFoundOrForbidden(true);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (applicationId: string) => {
    if (typeof id !== 'string') return;
    const updatedGig = await approveGigApplication(id, applicationId);
    setGig(updatedGig);
    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId ? { ...app, status: 'accepted' } : app
      )
    );
  };

  const handleReject = async (applicationId: string) => {
    if (typeof id !== 'string') return;
    await rejectGigApplication(id, applicationId);
    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId ? { ...app, status: 'rejected' } : app
      )
    );
  };

  const handleFundEscrow = async () => {
    if (typeof id !== 'string') return;
    setFunding(true);
    setFundingError(null);
    try {
      const { redirectUrl } = await checkoutGigEscrow(id, router.locale === 'en' ? 'en' : 'ka');
      window.location.href = redirectUrl;
    } catch (err: any) {
      setFundingError(err?.response?.data?.message || t.fundingError);
      setFunding(false);
    }
  };

  if (loading) {
    return <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">{t.loading}</p>;
  }

  if (notFoundOrForbidden || !gig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-100 dark:bg-[#0b0f19] py-10">
        <SiteHeader />
        <p className="text-center text-sm text-gray-500 dark:text-slate-400">{t.notFound}</p>
        <BackButton fallbackHref="/gigs" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] px-4 py-10">
      <SiteHeader />
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <BackButton fallbackHref="/gigs" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{gig.title}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 mb-8">
          {t.applications(applications.length)} · {t.budget}:{' '}
          {(gig.budgetAmount / 100).toFixed(2)} {gig.currency}
          {gig.budgetType === 'hourly' ? '/hr' : ''}
        </p>
        {gig.status === 'assigned' && gig.assignedFreelancerId && (
          <div className="mb-8 rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 p-4">
            <p className="text-sm text-indigo-900 dark:text-indigo-200 mb-3">{t.assignedNotice}</p>
            {fundingError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{fundingError}</p>}
            <button
              onClick={handleFundEscrow}
              disabled={funding}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {funding ? t.redirecting : t.fundEscrow}
            </button>
          </div>
        )}
        <ApplicationsReviewList
          applications={applications}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
    </div>
  );
}

export default function GigApplicationsPage() {
  return (
    <ProtectedRoute>
      <GigApplicationsContent />
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});