import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ApplicationsReviewList from '../../../src/components/community/ApplicationsReviewList';
import { useAuth } from '../../../src/context/AuthContext';
import { Gig, GigApplication } from '../../../src/types/community';
import {
  getGigById,
  getGigApplications,
  approveGigApplication,
  rejectGigApplication,
} from '../../../src/services/gigService';
import { checkoutGigEscrow } from '../../../src/services/paymentService';

function GigApplicationsContent() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
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
      const { redirectUrl } = await checkoutGigEscrow(id);
      window.location.href = redirectUrl;
    } catch {
      setFundingError('Unable to start payment. Please try again.');
      setFunding(false);
    }
  };

  if (loading) {
    return <p className="text-center text-sm text-gray-400 py-10">Loading…</p>;
  }

  if (notFoundOrForbidden || !gig) {
    return (
      <p className="text-center text-sm text-gray-500 py-10">
        This gig doesn't exist or you don't have permission to view its applications.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900">{gig.title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-8">
          {applications.length} application{applications.length !== 1 ? 's' : ''} · Budget:{' '}
          {(gig.budgetAmount / 100).toFixed(2)} {gig.currency}
          {gig.budgetType === 'hourly' ? '/hr' : ''}
        </p>
        {gig.status === 'assigned' && gig.assignedFreelancerId && (
          <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm text-indigo-900 mb-3">
              This gig is assigned. Fund escrow via Bank of Georgia to let work begin — funds are held until you
              approve the delivered work.
            </p>
            {fundingError && <p className="text-sm text-red-600 mb-2">{fundingError}</p>}
            <button
              onClick={handleFundEscrow}
              disabled={funding}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {funding ? 'Redirecting to BOG…' : 'Fund Escrow with BOG'}
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