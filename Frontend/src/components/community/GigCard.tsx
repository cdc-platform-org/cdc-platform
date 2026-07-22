import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { Gig } from '../../types/community';
import VerifiedGraduateBadge from './VerifiedGraduateBadge';

interface GigCardProps {
  gig: Gig;
  onApply: (gig: Gig) => void;
  canApply: boolean;
  isOwnerOrAdmin: boolean;
  canReview?: boolean;
  alreadyReviewed?: boolean;
  onReview?: (gig: Gig) => void;
}

export default function GigCard({
  gig,
  onApply,
  canApply,
  isOwnerOrAdmin,
  canReview = false,
  alreadyReviewed = false,
  onReview,
}: GigCardProps) {
  const { t } = useTranslation('proposals');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{gig.title}</h3>
          <Link href={`/profile/${gig.postedBy.id}`} className="text-sm text-gray-500 hover:text-indigo-600 mt-0.5 inline-block">
            {gig.postedBy.name}
          </Link>
        </div>
        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
          {gig.budgetAmount / 100} {gig.currency}
          <span className="text-gray-400 font-normal"> {gig.budgetType === 'hourly' ? '/hr' : ''}</span>
        </span>
      </div>
      {gig.assignedFreelancer && (
        <div className="flex items-center gap-2 mt-2">
          <Link
            href={`/profile/${gig.assignedFreelancer.id}`}
            className="text-xs font-medium text-gray-500 hover:text-indigo-600"
          >
            👤 {gig.assignedFreelancer.name}
          </Link>
          {gig.assignedFreelancer.isVerifiedGraduate && <VerifiedGraduateBadge size="sm" />}
        </div>
      )}
      <p className="text-sm text-gray-600 mt-3 line-clamp-2">{gig.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {gig.skillsRequired.map((skill) => (
          <span
            key={skill}
            className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          {gig.deadline ? `Due ${new Date(gig.deadline).toLocaleDateString()}` : 'No deadline'}
          {gig.applicationsCount > 0 && ` · ${t('proposalsCount', { count: gig.applicationsCount })}`}
        </span>
        <div className="flex items-center gap-4">
          {isOwnerOrAdmin && (
            <Link
              href={`/gigs/${gig.id}/applications`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View Applications
            </Link>
          )}
          {canApply && gig.status === 'open' && (
            <button
              onClick={() => onApply(gig)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {t('applyButton')}
            </button>
          )}
          {canReview &&
            gig.status === 'completed' &&
            (alreadyReviewed ? (
              <span className="text-xs font-medium text-emerald-600">✓ Reviewed</span>
            ) : (
              <button
                onClick={() => onReview?.(gig)}
                className="text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                ⭐ Leave a review
              </button>
            ))}
          {!isOwnerOrAdmin && !canReview && gig.status !== 'open' && (
            <span className="text-xs font-medium text-gray-400 capitalize">{gig.status}</span>
          )}
        </div>
      </div>
    </div>
  );
}