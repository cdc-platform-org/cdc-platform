import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { Gig } from '../../types/community';
import VerifiedGraduateBadge from './VerifiedGraduateBadge';
import SocialShareButtons from '../shared/SocialShareButtons';

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
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';

  return (
    <div className="group relative rounded-3xl p-6 overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20 hover:-translate-y-1 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all duration-300">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {gig.title}
          </h3>
          <span className="flex items-center gap-1.5 mt-0.5">
            <Link
              href={`/profile/${gig.postedBy.id}`}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
            >
              {gig.postedBy.name}
            </Link>
            {gig.postedBy.isVerifiedGraduate && <VerifiedGraduateBadge size="sm" />}
          </span>
        </div>
        <span className="text-sm font-black text-slate-900 dark:text-white whitespace-nowrap">
          {gig.budgetAmount / 100} {gig.currency}
          <span className="text-slate-400 font-normal"> {gig.budgetType === 'hourly' ? '/hr' : ''}</span>
        </span>
      </div>
      {gig.assignedFreelancer && (
        <div className="relative flex items-center gap-2 mt-2">
          <Link
            href={`/profile/${gig.assignedFreelancer.id}`}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
          >
            👤 {gig.assignedFreelancer.name}
          </Link>
          {gig.assignedFreelancer.isVerifiedGraduate && <VerifiedGraduateBadge size="sm" />}
        </div>
      )}
      <p className="relative text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">{gig.description}</p>
      <div className="relative flex flex-wrap gap-1.5 mt-3">
        {gig.skillsRequired.map((skill) => (
          <span
            key={skill}
            className="text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border border-purple-200/60 dark:border-purple-500/20 px-2 py-0.5 rounded-full"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="relative flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
        <span className="text-xs text-slate-400 min-w-0 truncate">
          {gig.deadline ? t('marketplace.dueDate', { date: new Date(gig.deadline).toLocaleDateString() }) : t('marketplace.noDeadline')}
          {gig.applicationsCount > 0 && ` · ${t('proposalsCount', { count: gig.applicationsCount })}`}
        </span>
        <div className="flex items-center gap-4 shrink-0">
          {isOwnerOrAdmin && (
            <Link
              href={`/gigs/${gig.id}/applications`}
              className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              {t('marketplace.viewApplications')}
            </Link>
          )}
          {canApply && gig.status === 'open' && (
            <button
              onClick={() => onApply(gig)}
              className="text-xs font-bold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:opacity-90 shadow-sm shadow-purple-500/20 transition"
            >
              {t('applyButton')}
            </button>
          )}
          {canReview &&
            gig.status === 'completed' &&
            (alreadyReviewed ? (
              <span className="text-xs font-medium text-emerald-500">✓ {t('marketplace.reviewed')}</span>
            ) : (
              <button
                onClick={() => onReview?.(gig)}
                className="text-xs font-bold text-amber-500 hover:underline"
              >
                ⭐ {t('marketplace.leaveReview')}
              </button>
            ))}
          {!isOwnerOrAdmin && !canReview && gig.status !== 'open' && (
            <span className="text-xs font-medium text-slate-400 capitalize">{gig.status}</span>
          )}
        </div>
      </div>
      {gig.status === 'open' && (
        <div className="relative mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <SocialShareButtons title={gig.title} lang={lang} />
        </div>
      )}
    </div>
  );
}
