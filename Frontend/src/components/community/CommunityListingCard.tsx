import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { Vacancy, Gig } from '../../types/community';
import VerificationBadges from './VerificationBadges';
import SocialShareButtons from '../shared/SocialShareButtons';
import StarRating from './StarRating';
import { jobCategoryLabel } from '../../utils/jobCategory';
import { resolveLocale } from '../../utils/locale';

export type CommunityListing = { kind: 'vacancy'; data: Vacancy } | { kind: 'gig'; data: Gig };

interface CommunityListingCardProps {
  item: CommunityListing;
  darkMode: boolean;
  canApply: boolean;
  onApply: (item: CommunityListing) => void;
  isOwnerOrAdmin: boolean;
  canReview?: boolean;
  alreadyReviewed?: boolean;
  onReview?: (item: CommunityListing) => void;
}

export default function CommunityListingCard({
  item,
  darkMode,
  canApply,
  onApply,
  isOwnerOrAdmin,
  canReview = false,
  alreadyReviewed = false,
  onReview,
}: CommunityListingCardProps) {
  const { t } = useTranslation('proposals');
  const router = useRouter();
  const lang = resolveLocale(router.locale);

  const isVacancy = item.kind === 'vacancy';
  const data = item.data;
  const isOpen = data.status === 'open';

  const employmentTypeLabels: Record<Vacancy['employmentType'], string> = {
    full_time: t('marketplace.employmentFullTime'),
    part_time: t('marketplace.employmentPartTime'),
    contract: t('marketplace.employmentContract'),
    internship: t('marketplace.employmentInternship'),
  };

  // Gigs: distinguish a client's request ("შეკვეთა") from a freelancer's
  // own service listing ("მომსახურების შეთავაზება") — see the GigOfferType
  // comment in Backend/prisma/schema.prisma for why both share this model.
  const badgeLabel = isVacancy
    ? employmentTypeLabels[(data as Vacancy).employmentType]
    : (data as Gig).offerType === 'FREELANCER_OFFER'
    ? t('marketplace.serviceOffer')
    : t('marketplace.gigRequest');
  const badgeColor = isVacancy
    ? darkMode
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-amber-700 bg-amber-50 border-amber-100'
    : darkMode
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : 'text-emerald-700 bg-emerald-50 border-emerald-100';

  const priceLabel = isVacancy
    ? (() => {
        const v = data as Vacancy;
        if (v.salaryMin === null && v.salaryMax === null) return null;
        const min = v.salaryMin !== null ? v.salaryMin / 100 : '—';
        const max = v.salaryMax !== null ? v.salaryMax / 100 : '—';
        return `${min} – ${max} ${v.currency ?? ''}`;
      })()
    : (() => {
        const g = data as Gig;
        return `${g.budgetAmount / 100} ${g.currency}${g.budgetType === 'hourly' ? '/hr' : ''}`;
      })();
  const priceColor = isVacancy ? 'text-cyan-500' : 'text-purple-500';

  const postedDate = new Date(data.createdAt).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const detailHref = isVacancy ? `/vacancies/${data.id}/applications` : `/gigs/${data.id}/applications`;
  const assignedFreelancer = !isVacancy ? (data as Gig).assignedFreelancer : null;
  const showReview = !isVacancy && canReview && (data as Gig).status === 'completed';

  return (
    <div
      className={`border rounded-3xl p-6 transition-all duration-300 transform hover:scale-[1.005] flex flex-col justify-between min-h-[220px] ${
        darkMode ? 'bg-[#0e1422] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:shadow-md'
      }`}
    >
      <div>
        <div className="flex justify-between items-start mb-4 gap-3">
          <div className="space-y-1">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border inline-block ${badgeColor}`}>
              {badgeLabel}
            </span>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 pt-1 flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile/${data.postedBy.id}`} className="hover:underline text-current no-underline">
                {data.postedBy.name}
              </Link>
              {!data.postedBy.isVerifiedGraduate && data.postedBy._count.courseEnrollments > 0 && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/30">
                  {t('profilePage.studentBadge')}
                </span>
              )}
              {data.postedBy.averageRating !== null && (
                <span className="inline-flex items-center gap-1 font-normal">
                  <StarRating value={data.postedBy.averageRating} size="sm" />
                  <span className="text-[10px] text-slate-400">({data.postedBy.reviewCount})</span>
                </span>
              )}
              {assignedFreelancer && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-normal opacity-70">
                  → {assignedFreelancer.name}
                  <VerificationBadges user={assignedFreelancer} size="sm" />
                </span>
              )}
              <span className="text-[10px] text-slate-400 font-normal">· {postedDate}</span>
            </h4>
          </div>
          {priceLabel && (
            <div className="text-right shrink-0">
              <span className={`text-base font-black tracking-tight ${priceColor}`}>{priceLabel}</span>
            </div>
          )}
        </div>

        <h3 className={`text-base font-bold mb-2 tracking-wide leading-snug ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {data.title}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed font-normal mb-6 line-clamp-3">{data.description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60">
        <div className="flex flex-wrap gap-2">
          {data.category && (
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border font-sans ${
                darkMode ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' : 'bg-cyan-50 border-cyan-100 text-cyan-700'
              }`}
            >
              {jobCategoryLabel(data.category, lang, data.customCategory)}
            </span>
          )}
          {data.skillsRequired.map((skill) => (
            <span
              key={skill}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border font-sans ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200/60 text-slate-600'
              }`}
            >
              {skill}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isOwnerOrAdmin && (
            <Link href={detailHref} className="text-xs font-bold text-cyan-500 hover:underline no-underline">
              {t('marketplace.viewApplications')}
            </Link>
          )}
          {canApply && isOpen && (
            <button
              type="button"
              onClick={() => onApply(item)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition border border-transparent cursor-pointer shadow-sm ${
                isVacancy
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white hover:opacity-95'
                  : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700'
              }`}
            >
              {isVacancy ? t('marketplace.apply') : t('applyButton')}
            </button>
          )}
          {showReview &&
            (alreadyReviewed ? (
              <span className="text-xs font-medium text-emerald-500">✓ {t('marketplace.reviewed')}</span>
            ) : (
              <button type="button" onClick={() => onReview?.(item)} className="text-xs font-bold text-amber-500 hover:underline">
                ⭐ {t('marketplace.leaveReview')}
              </button>
            ))}
          {!isOwnerOrAdmin && !isOpen && !showReview && (
            <span className="text-[10px] font-bold text-slate-400 uppercase">{data.status}</span>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <SocialShareButtons title={data.title} lang={lang} />
        </div>
      )}
    </div>
  );
}
