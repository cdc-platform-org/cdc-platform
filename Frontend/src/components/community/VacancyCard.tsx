import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { Vacancy } from '../../types/community';
import SocialShareButtons from '../shared/SocialShareButtons';
import VerifiedGraduateBadge from './VerifiedGraduateBadge';
import StarRating from './StarRating';
import { jobCategoryLabel } from '../../utils/jobCategory';
import { resolveLocale } from '../../utils/locale';

interface VacancyCardProps {
  vacancy: Vacancy;
  onApply: (vacancy: Vacancy) => void;
  canApply: boolean;
  isOwnerOrAdmin: boolean;
}

export default function VacancyCard({ vacancy, onApply, canApply, isOwnerOrAdmin }: VacancyCardProps) {
  const { t } = useTranslation('proposals');
  const employmentTypeLabels: Record<Vacancy['employmentType'], string> = {
    full_time: t('marketplace.employmentFullTime'),
    part_time: t('marketplace.employmentPartTime'),
    contract: t('marketplace.employmentContract'),
    internship: t('marketplace.employmentInternship'),
  };
  const hasSalaryRange = vacancy.salaryMin !== null || vacancy.salaryMax !== null;
  const router = useRouter();
  const lang = resolveLocale(router.locale);

  return (
    <div className="group relative rounded-3xl p-6 overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/20 hover:-translate-y-1 hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all duration-300">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {vacancy.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {vacancy.postedBy.name}
            {vacancy.postedBy.isVerifiedGraduate && <VerifiedGraduateBadge size="sm" />}
            {vacancy.postedBy.averageRating !== null && (
              <span className="inline-flex items-center gap-1">
                <StarRating value={vacancy.postedBy.averageRating} size="sm" />
                <span className="text-xs text-slate-400">({vacancy.postedBy.reviewCount})</span>
              </span>
            )}
          </p>
        </div>
        <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20">
          {employmentTypeLabels[vacancy.employmentType]}
        </span>
      </div>
      <p className="relative text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">{vacancy.description}</p>
      <div className="relative flex flex-wrap gap-1.5 mt-3">
        {vacancy.category && (
          <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 border border-purple-200/60 dark:border-purple-500/20 px-2 py-0.5 rounded-full">
            {jobCategoryLabel(vacancy.category, lang, vacancy.customCategory)}
          </span>
        )}
        {vacancy.skillsRequired.map((skill) => (
          <span
            key={skill}
            className="text-xs font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200/60 dark:border-cyan-500/20 px-2 py-0.5 rounded-full"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="relative flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
        <div className="text-xs text-slate-400 space-x-3 min-w-0 truncate">
          <span>{vacancy.location}</span>
          {hasSalaryRange && (
            <span>
              {vacancy.salaryMin !== null ? vacancy.salaryMin / 100 : '—'}
              {' – '}
              {vacancy.salaryMax !== null ? vacancy.salaryMax / 100 : '—'} {vacancy.currency}
            </span>
          )}
          {vacancy.applicationDeadline && (
            <span>{t('marketplace.dueDate', { date: new Date(vacancy.applicationDeadline).toLocaleDateString() })}</span>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {isOwnerOrAdmin && (
            <Link
              href={`/vacancies/${vacancy.id}/applications`}
              className="text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              {t('marketplace.viewApplications')}
            </Link>
          )}
          {canApply && vacancy.status === 'open' && (
            <button
              onClick={() => onApply(vacancy)}
              className="text-xs font-bold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-cyan-500 to-sky-600 hover:opacity-90 shadow-sm shadow-cyan-500/20 transition"
            >
              {t('marketplace.apply')}
            </button>
          )}
          {!isOwnerOrAdmin && vacancy.status !== 'open' && (
            <span className="text-xs font-medium text-slate-400 capitalize">{vacancy.status}</span>
          )}
        </div>
      </div>
      {vacancy.status === 'open' && (
        <div className="relative mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <SocialShareButtons title={vacancy.title} lang={lang} />
        </div>
      )}
    </div>
  );
}
