import { useState } from 'react';
import { VacancyApplication, GigApplication, ApplicationStatus } from '../../types/community';
import VerifiedGraduateBadge from './VerifiedGraduateBadge';

type ReviewableApplication = VacancyApplication | GigApplication;

interface ApplicationsReviewListProps {
  applications: ReviewableApplication[];
  onApprove: (applicationId: string) => Promise<void>;
  onReject: (applicationId: string) => Promise<void>;
}

const statusBadgeClass = (status: ApplicationStatus) => {
  switch (status) {
    case 'submitted':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'reviewed':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'accepted':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'rejected':
      return 'bg-gray-100 text-gray-500 border-gray-200';
  }
};

function hasBid(app: ReviewableApplication): app is GigApplication {
  return 'bidAmount' in app;
}

export default function ApplicationsReviewList({
  applications,
  onApprove,
  onReject,
}: ApplicationsReviewListProps) {
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    setError(null);
    try {
      await onApprove(id);
    } catch {
      setError('Unable to approve this application. Please try again.');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioningId(id);
    setError(null);
    try {
      await onReject(id);
    } catch {
      setError('Unable to reject this application. Please try again.');
    } finally {
      setActioningId(null);
    }
  };

  if (applications.length === 0) {
    return <p className="text-sm text-gray-500">No applications yet.</p>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <ul className="space-y-3">
        {applications.map((app) => {
          const isPending = app.status === 'submitted' || app.status === 'reviewed';
          const isActioning = actioningId === app.id;
          return (
            <li
              key={app.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {hasBid(app) ? app.applicant.name : app.applicantName}
                    </p>
                    {hasBid(app) && app.applicant.isVerifiedGraduate && <VerifiedGraduateBadge size="sm" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied {new Date(hasBid(app) ? app.createdAt : app.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {hasBid(app) && (
                    <span className="text-sm font-medium text-gray-900">
                      {(app.bidAmount / 100).toFixed(2)}
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${statusBadgeClass(app.status)}`}
                  >
                    {app.status}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                {hasBid(app) ? app.proposalNote : app.coverNote}
              </p>
              {isPending && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={isActioning}
                    className="text-sm font-medium text-white bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isActioning ? 'Working…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(app.id)}
                    disabled={isActioning}
                    className="text-sm font-medium text-gray-600 border border-gray-300 px-4 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                  >
                    {isActioning ? 'Working…' : 'Reject'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}