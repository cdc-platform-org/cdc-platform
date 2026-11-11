import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { Gig, Vacancy } from '../../types/community';
import VerificationBadges from './VerificationBadges';
import ShareMenu from '../shared/ShareMenu';
import { jobCategoryLabel } from '../../utils/jobCategory';
import { resolveLocale } from '../../utils/locale';
import { stripMarkdown } from '../../utils/markdownLite';
import {
  PosterHeader,
  formatDate,
  SkillChips,
  gigPriceLabel,
  vacancySalaryLabel,
  primaryBtn,
  secondaryBtn,
} from './jobPostShared';

// One card layout for every job-board listing (gigs, service offers,
// vacancies) — used by GigCard, VacancyCard and CommunityListingCard so the
// three listing pages look identical. Neutral surface + subtle border, brand
// gradient only on the primary action.

export type JobPost = { kind: 'gig'; data: Gig } | { kind: 'vacancy'; data: Vacancy };

export interface JobPostCardProps {
  post: JobPost;
  canApply: boolean;
  onApply: () => void;
  isOwnerOrAdmin: boolean;
  canReview?: boolean;
  alreadyReviewed?: boolean;
  onReview?: () => void;
}

export function jobPostHref(post: JobPost): string {
  return post.kind === 'gig' ? `/gigs/${post.data.id}` : `/vacancies/${post.data.id}`;
}

export function useJobPostLabels(post: JobPost) {
  const { t } = useTranslation('proposals');
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const isVacancy = post.kind === 'vacancy';
  const employment: Record<Vacancy['employmentType'], string> = {
    full_time: t('marketplace.employmentFullTime'),
    part_time: t('marketplace.employmentPartTime'),
    contract: t('marketplace.employmentContract'),
    internship: t('marketplace.employmentInternship'),
  };
  const typeLabel = isVacancy
    ? employment[(post.data as Vacancy).employmentType]
    : (post.data as Gig).offerType === 'FREELANCER_OFFER'
    ? t('marketplace.serviceOffer')
    : t('marketplace.gigRequest');
  const price = isVacancy ? vacancySalaryLabel(post.data as Vacancy) : gigPriceLabel(post.data as Gig, t('postCard.perHour'));
  const category = jobCategoryLabel(post.data.category, lang, post.data.customCategory);
  const primaryLabel = isVacancy ? t('marketplace.apply') : t('applyButton');
  return { t, lang, isVacancy, typeLabel, price, category, primaryLabel };
}

export default function JobPostCard({
  post,
  canApply,
  onApply,
  isOwnerOrAdmin,
  canReview = false,
  alreadyReviewed = false,
  onReview,
}: JobPostCardProps) {
  const { t, lang, isVacancy, typeLabel, price, category, primaryLabel } = useJobPostLabels(post);
  const data = post.data;
  const isOpen = data.status === 'open';
  const href = jobPostHref(post);
  const applicationsHref = `${href}/applications`;
  const gig = !isVacancy ? (data as Gig) : null;
  const vacancy = isVacancy ? (data as Vacancy) : null;
  const showReview = !!gig && canReview && gig.status === 'completed';
  const showApply = canApply && isOpen;
  const excerpt = stripMarkdown(data.description);

  const metaBits: string[] = [];
  if (vacancy?.location) metaBits.push(vacancy.location);
  if (gig?.deliveryDays) metaBits.push(t('postCard.delivery', { count: gig.deliveryDays }));
  const deadline = gig?.deadline ?? vacancy?.applicationDeadline;
  if (deadline) metaBits.push(t('marketplace.dueDate', { date: formatDate(deadline, lang) }));
  if (gig && gig.applicationsCount > 0) metaBits.push(t('proposalsCount', { count: gig.applicationsCount }));

  return (
    <article
      data-testid="job-post-card"
      className="group relative flex flex-col min-w-0 h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-shadow hover:shadow-md hover:shadow-slate-900/5 dark:hover:border-slate-700"
    >
      <div className="flex items-start justify-between gap-3">
        <PosterHeader poster={data.postedBy} createdAt={data.createdAt} lang={lang} />
        <ShareMenu url={href} title={data.title} />
      </div>

      <h3 className="mt-4 text-base font-semibold leading-snug text-slate-900 dark:text-white line-clamp-2 break-words">
        <Link href={href} className="no-underline text-inherit hover:underline focus:outline-none focus-visible:underline">
          {data.title}
        </Link>
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        {price && (
          <span
            data-testid="job-post-price"
            className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-sm font-semibold whitespace-nowrap"
          >
            {price}
          </span>
        )}
        <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-medium text-slate-600 dark:text-slate-300">
          {typeLabel}
        </span>
        {category && <span className="font-medium text-slate-600 dark:text-slate-300 min-w-0 truncate">{category}</span>}
      </div>

      {excerpt && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3 break-words">{excerpt}</p>
      )}

      <SkillChips skills={data.skillsRequired} max={4} className="mt-3" />

      {gig?.assignedFreelancer && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
          <span aria-hidden="true">👤</span>
          <Link href={`/profile/${gig.assignedFreelancer.id}`} className="truncate hover:underline no-underline text-inherit">
            {gig.assignedFreelancer.name}
          </Link>
          <VerificationBadges user={gig.assignedFreelancer} size="sm" />
        </div>
      )}

      {metaBits.length > 0 && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 break-words">{metaBits.join(' · ')}</p>
      )}

      {/* Footer: grid so buttons share the width and always fit; a single
          button spans the whole row; stacks under ~360px via min widths. */}
      <div className="mt-auto pt-4">
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {isOwnerOrAdmin && (
            <Link href={applicationsHref} className={`${secondaryBtn} w-full sm:w-auto sm:flex-1 sm:basis-40 min-w-0`}>
              {t('marketplace.viewApplications')}
            </Link>
          )}
          {showApply && (
            <button type="button" onClick={onApply} className={`${primaryBtn} w-full sm:w-auto sm:flex-1 sm:basis-40 min-w-0`}>
              {primaryLabel}
            </button>
          )}
          {showReview &&
            (alreadyReviewed ? (
              <span className="w-full sm:w-auto sm:flex-1 sm:basis-40 inline-flex items-center justify-center min-h-[2.5rem] text-sm font-medium text-emerald-600 dark:text-emerald-400">
                ✓ {t('marketplace.reviewed')}
              </span>
            ) : (
              <button type="button" onClick={onReview} className={`${secondaryBtn} w-full sm:w-auto sm:flex-1 sm:basis-40 min-w-0`}>
                ⭐ {t('marketplace.leaveReview')}
              </button>
            ))}
          {!isOwnerOrAdmin && !showApply && !showReview && (
            <Link href={href} className={`${secondaryBtn} w-full sm:w-auto sm:flex-1 sm:basis-40 min-w-0`}>
              {isOpen ? t('postCard.viewDetails') : `${t('postCard.viewDetails')} · ${data.status}`}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
