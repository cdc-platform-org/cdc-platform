import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Link from 'next/link';
import { Users, ClipboardList } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ApplicationsReviewList from '../../../src/components/community/ApplicationsReviewList';
import HRSupportRequestModal from '../../../src/components/community/HRSupportRequestModal';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import BackButton from '../../../src/components/common/BackButton';
import { useAuth } from '../../../src/context/AuthContext';
import { Vacancy, VacancyApplication } from '../../../src/types/community';
import {
  getVacancyById,
  getVacancyApplications,
  reviewVacancyApplication,
} from '../../../src/services/vacancyService';
import { resolveLocale } from '../../../src/utils/locale';

const EN_STRINGS = {
  loading: 'Loading…',
  notFound: "This vacancy doesn't exist or you don't have permission to view its applications.",
  applications: (n: number) => `${n} application${n !== 1 ? 's' : ''}`,
  requestHrHelp: 'Request HR Screening Support',
  viewHrRequests: 'My HR Assistance Requests',
};

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'ეს ვაკანსია არ არსებობს ან არ გაქვთ განაცხადების ნახვის უფლება.',
    applications: (n: number) => `${n} განაცხადი`,
    requestHrHelp: 'HR დახმარების მოთხოვნა',
    viewHrRequests: 'ჩემი HR დახმარების მოთხოვნები',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function VacancyApplicationsContent() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const t = dict[resolveLocale(router.locale)];
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [applications, setApplications] = useState<VacancyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);
  const [showHrModal, setShowHrModal] = useState(false);

  const loadData = useCallback(async () => {
    if (typeof id !== 'string') return;
    setLoading(true);
    try {
      const [vacancyData, applicationsData] = await Promise.all([
        getVacancyById(id),
        getVacancyApplications(id),
      ]);
      const isOwner = vacancyData.postedBy.id === user?.id;
      const isAdmin = user?.role === 'SuperAdmin';
      if (!isOwner && !isAdmin) {
        setNotFoundOrForbidden(true);
        return;
      }
      setVacancy(vacancyData);
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
    await reviewVacancyApplication(id, applicationId, 'accepted');
    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId ? { ...app, status: 'accepted' } : app
      )
    );
  };

  const handleReject = async (applicationId: string) => {
    if (typeof id !== 'string') return;
    await reviewVacancyApplication(id, applicationId, 'rejected');
    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId ? { ...app, status: 'rejected' } : app
      )
    );
  };

  if (loading) {
    return <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-10">{t.loading}</p>;
  }

  if (notFoundOrForbidden || !vacancy) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-100 dark:bg-[#0b0f19] py-10">
        <SiteHeader />
        <p className="text-center text-sm text-gray-500 dark:text-slate-400">{t.notFound}</p>
        <BackButton fallbackHref="/vacancies" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] px-4 py-10">
      <SiteHeader />
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <BackButton fallbackHref="/vacancies" />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="blog-heading-safe text-2xl font-semibold text-gray-900 dark:text-white">{vacancy.title}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {t.applications(applications.length)} · {vacancy.location}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard/hr-support"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              {t.viewHrRequests}
            </Link>
            {applications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHrModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-90 transition-opacity"
              >
                <Users className="w-3.5 h-3.5" />
                {t.requestHrHelp}
              </button>
            )}
          </div>
        </div>
        <ApplicationsReviewList
          applications={applications}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>

      {showHrModal && (
        <HRSupportRequestModal
          vacancyId={vacancy.id}
          vacancyTitle={vacancy.title}
          onClose={() => setShowHrModal(false)}
        />
      )}
    </div>
  );
}

export default function VacancyApplicationsPage() {
  return (
    <ProtectedRoute>
      <VacancyApplicationsContent />
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});