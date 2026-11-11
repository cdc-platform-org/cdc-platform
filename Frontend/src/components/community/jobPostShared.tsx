import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { Gig, Vacancy } from '../../types/community';
import VerificationBadges from './VerificationBadges';
import StarRating from './StarRating';

// Shared building blocks for the job-board card (JobPostCard) and the
// detail page (JobPostDetail): poster header, price formatting, skill chips.

type Poster = Gig['postedBy'];

const CURRENCY_SYMBOL: Record<string, string> = { GEL: '₾', USD: '$', EUR: '€' };

export function formatMoney(minor: number, currency: string | null | undefined): string {
  const amount = minor / 100;
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const sym = currency ? CURRENCY_SYMBOL[currency.toUpperCase()] : undefined;
  return sym ? `${n} ${sym}` : `${n}${currency ? ` ${currency}` : ''}`;
}

export function gigPriceLabel(gig: Gig, perHour: string): string {
  return `${formatMoney(gig.budgetAmount, gig.currency)}${gig.budgetType === 'hourly' ? perHour : ''}`;
}

export function vacancySalaryLabel(v: Vacancy): string | null {
  if (v.salaryMin === null && v.salaryMax === null) return null;
  if (v.salaryMin !== null && v.salaryMax !== null && v.salaryMin !== v.salaryMax) {
    return `${formatMoney(v.salaryMin, null)} – ${formatMoney(v.salaryMax, v.currency)}`;
  }
  return formatMoney((v.salaryMin ?? v.salaryMax)!, v.currency);
}

const intlLocale = (lang: string) => (lang === 'ka' ? 'ka-GE' : lang === 'en' ? 'en-GB' : lang);

export function relativeTime(iso: string, lang: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  // Browsers ship incomplete ICU data for Georgian (Chromium renders "-5 h"),
  // so ka gets explicit wording.
  if (lang === 'ka' && diffSec <= 0) {
    if (abs < 60) return 'ახლახან';
    if (abs < 3600) return `${Math.round(abs / 60)} წუთის წინ`;
    if (abs < 86400) return `${Math.round(abs / 3600)} საათის წინ`;
    const days = Math.round(abs / 86400);
    if (days === 1) return 'გუშინ';
    if (days < 30) return `${days} დღის წინ`;
    return formatDate(iso, lang);
  }
  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: 'auto' });
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60) || 0, 'minute');
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  } catch {
    // Fall through to an absolute date.
  }
  return formatDate(iso, lang);
}

const KA_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

export function formatDate(iso: string, lang: string): string {
  if (lang === 'ka') {
    // Same ICU gap as relativeTime — Chromium prints "2026 M11 11".
    const d = new Date(iso);
    return `${d.getDate()} ${KA_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  }
  return new Date(iso).toLocaleDateString(intlLocale(lang), { year: 'numeric', month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <span
      aria-hidden="true"
      className={`${dim} shrink-0 inline-flex items-center justify-center rounded-full font-semibold text-white bg-gradient-to-br from-cyan-500 to-purple-600`}
    >
      {initials(name)}
    </span>
  );
}

// "სტუდენტი" chip for posters who bought a course but aren't a verified
// graduate yet — VerificationBadges covers the verified tracks.
export function PosterBadges({ poster }: { poster: Poster }) {
  const { t } = useTranslation('proposals');
  return (
    <>
      <VerificationBadges user={poster} size="sm" />
      {!poster.isVerifiedGraduate && poster._count?.courseEnrollments > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-cyan-400/70 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
          <span aria-hidden="true">🎓</span> {t('profilePage.studentBadge')}
        </span>
      )}
    </>
  );
}

export function PosterHeader({
  poster,
  createdAt,
  lang,
  size = 'md',
}: {
  poster: Poster;
  createdAt: string;
  lang: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <Avatar name={poster.name} size={size} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Link
            href={`/profile/${poster.id}`}
            className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline no-underline truncate max-w-full"
          >
            {poster.name}
          </Link>
          <PosterBadges poster={poster} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
          <time dateTime={createdAt} title={formatDate(createdAt, lang)}>
            {relativeTime(createdAt, lang)}
          </time>
          {poster.averageRating !== null && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">·</span>
              <StarRating value={poster.averageRating} size="sm" />
              <span>({poster.reviewCount})</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SkillChips({ skills, max, className = '' }: { skills: string[]; max?: number; className?: string }) {
  const { t } = useTranslation('proposals');
  const shown = max ? skills.slice(0, max) : skills;
  const rest = skills.length - shown.length;
  if (skills.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 list-none p-0 m-0 ${className}`}>
      {shown.map((s) => (
        <li
          key={s}
          className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 max-w-full truncate"
        >
          {s}
        </li>
      ))}
      {rest > 0 && (
        <li className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400" title={skills.slice(shown.length).join(', ')}>
          {t('postCard.moreSkills', { count: rest })}
        </li>
      )}
    </ul>
  );
}

// Button styles shared by card + detail page. whitespace-normal + text-center
// + min-h let long Georgian labels wrap instead of overflowing the card.
export const primaryBtn =
  'inline-flex items-center justify-center text-center whitespace-normal leading-tight min-h-[2.5rem] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 shadow-sm transition-colors border-none cursor-pointer no-underline';
export const secondaryBtn =
  'inline-flex items-center justify-center text-center whitespace-normal leading-tight min-h-[2.5rem] px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-transparent border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer no-underline';
