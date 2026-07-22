import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ApplicationsReviewList from '../../../src/components/community/ApplicationsReviewList';
import { useAuth } from '../../../src/context/AuthContext';
import { Vacancy, VacancyApplication } from '../../../src/types/community';
import {
  getVacancyById,
  getVacancyApplications,
  reviewVacancyApplication,
} from '../../../src/services/vacancyService';

function VacancyApplicationsContent() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [applications, setApplications] = useState<VacancyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);

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
    return <p className="text-center text-sm text-gray-400 py-10">Loading…</p>;
  }

  if (notFoundOrForbidden || !vacancy) {
    return (
      <p className="text-center text-sm text-gray-500 py-10">
        This vacancy doesn't exist or you don't have permission to view its applications.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900">{vacancy.title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-8">
          {applications.length} application{applications.length !== 1 ? 's' : ''} · {vacancy.location}
        </p>
        <ApplicationsReviewList
          applications={applications}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
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