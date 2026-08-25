import { useState } from 'react';
import { useRouter } from 'next/router';
import { FileText, Check, X } from 'lucide-react';
import { VacancyApplication, GigApplication, ApplicationStatus } from '../../types/community';
import { resolveLocale } from '../../utils/locale';
import VerificationBadges, { hasAnyVerificationBadge } from './VerificationBadges';
import StarRating from './StarRating';

type ReviewableApplication = VacancyApplication | GigApplication;

interface ApplicationsReviewListProps {
  applications: ReviewableApplication[];
  onApprove: (applicationId: string) => Promise<void>;
  onReject: (applicationId: string) => Promise<void>;
}

// Inline dict (same convention as SiteHeader.tsx/SoftVerificationNudge.tsx)
// rather than next-i18next: this list is shared by the gig- and
// vacancy-applications pages, neither of which currently loads the
// 'proposals' namespace, and every string here is simple enough not to need
// interpolation beyond what's handled inline below.
const EN_STRINGS = {
  noApplications: 'No applications yet.',
  applied: 'Applied',
  viewCv: 'View CV',
  verified: 'Verified',
  studentBadge: 'Student',
  standard: 'Standard',
  approve: 'Approve',
  reject: 'Reject',
  working: 'Working…',
  approveError: 'Unable to approve this application. Please try again.',
  rejectError: 'Unable to reject this application. Please try again.',
  status: {
    submitted: 'Submitted',
    reviewed: 'Reviewed',
    accepted: 'Accepted',
    rejected: 'Rejected',
  } as Record<ApplicationStatus, string>,
};

const dict = {
  ka: {
    noApplications: 'ჯერ არცერთი განაცხადი არ არის.',
    applied: 'განაცხადის თარიღი:',
    viewCv: 'რეზიუმეს ნახვა',
    verified: 'ვერიფიცირებული',
    studentBadge: 'სტუდენტი',
    standard: 'სტანდარტული',
    approve: 'დამტკიცება',
    reject: 'უარყოფა',
    working: 'მუშავდება…',
    approveError: 'დამტკიცება ვერ მოხერხდა. სცადეთ თავიდან.',
    rejectError: 'უარყოფა ვერ მოხერხდა. სცადეთ თავიდან.',
    status: {
      submitted: 'გაგზავნილია',
      reviewed: 'განხილულია',
      accepted: 'დამტკიცებულია',
      rejected: 'უარყოფილია',
    } as Record<ApplicationStatus, string>,
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

const statusBadgeClass = (status: ApplicationStatus) => {
  switch (status) {
    case 'submitted':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/30';
    case 'reviewed':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30';
    case 'accepted':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30';
    case 'rejected':
      return 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
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
  const router = useRouter();
  const t = dict[resolveLocale(router.locale)];
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setActioningId(id);
    setError(null);
    try {
      await onApprove(id);
    } catch {
      setError(t.approveError);
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
      setError(t.rejectError);
    } finally {
      setActioningId(null);
    }
  };

  if (applications.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-400">{t.noApplications}</p>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
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
              className="bg-white dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800 p-5"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {app.applicant.name}
                    </p>
                    {hasAnyVerificationBadge(app.applicant) ? (
                      <VerificationBadges user={app.applicant} size="sm" />
                    ) : app.applicant._count.courseEnrollments > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/30">
                        {t.studentBadge}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border text-gray-500 bg-gray-100 border-gray-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700">
                        {t.standard}
                      </span>
                    )}
                    {app.applicant.averageRating !== null && (
                      <span className="inline-flex items-center gap-1">
                        <StarRating value={app.applicant.averageRating} size="sm" />
                        <span className="text-xs text-gray-400 dark:text-slate-500">({app.applicant.reviewCount})</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {t.applied} {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {hasBid(app) && (
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {(app.bidAmount / 100).toFixed(2)}
                    </span>
                  )}
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusBadgeClass(app.status)}`}
                  >
                    {t.status[app.status]}
                  </span>
                </div>
              </div>

              {/* Big, unmissable CV button — its own full-width row, not a
                  small link buried under the timestamp. */}
              {app.applicant.cvUrl && (
                <a
                  href={app.applicant.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2.5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-bold text-sm px-4 py-3.5 no-underline transition-opacity"
                >
                  <FileText className="w-5 h-5 shrink-0" />
                  📄 {t.viewCv} / რეზიუმეს ნახვა
                </a>
              )}

              <p className="text-sm text-gray-600 dark:text-slate-300 mt-3">
                {hasBid(app) ? app.proposalNote : app.coverNote}
              </p>
              {isPending && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={isActioning}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-emerald-600 px-4 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    {isActioning ? t.working : t.approve}
                  </button>
                  <button
                    onClick={() => handleReject(app.id)}
                    disabled={isActioning}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                    {isActioning ? t.working : t.reject}
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
