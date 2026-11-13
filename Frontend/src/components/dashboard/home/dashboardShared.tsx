/**
 * Small shared pieces of the main user dashboard (/dashboard): the tab type,
 * status-badge colours, money formatting and two tiny presentational
 * components used by more than one tab.
 */
import Link from 'next/link';
import { GigStatus } from '../../../types/community';
import { User } from '../../../types/auth';
import { DashboardStrings } from './dashboardDict';

/** Panels that switch in place inside the dashboard (other sidebar entries are links). */
export type DashboardTab = 'overview' | 'purchases' | 'courses' | 'wallet' | 'gigs' | 'products';

/** File types a seller may upload as the purchasable product asset. */
export const PRODUCT_ASSET_ACCEPT = '.zip,.pdf,.epub,.rar,.7z,.fig,.sketch,.psd,.ai,.doc,.docx,.mp4,.mov';

export const GIG_STATUS_BADGE: Record<GigStatus, string> = {
  open: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  assigned: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  submitted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

export const PAYOUT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  APPROVED: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
};

export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  CANCELLED: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  REFUNDED: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
};

/** Shared card styling used by empty states and wallet panels. */
export const CARD_CLASS =
  'rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10';

/** Money is stored in minor units (tetri); this renders e.g. 1250 → "12.50 ₾". */
export function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

export function formatMoney(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency === 'GEL' ? '₾' : currency}`;
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
      <div
        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// isVerifiedGraduate is the app-wide "verified freelancer" flag — set by
// either graduating a course or passing the freelancer skill exam (see
// Backend's routes/freelancerExam.ts and routes/courses.ts) — and gates gig/
// vacancy applications, uncapped forum posting, and mentorship access.
export function FreelancerExamCard({ user, t }: { user: User; t: DashboardStrings }) {
  if (user.isVerifiedGraduate) {
    return (
      <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center justify-between gap-3 h-full">
        <h2 className="text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-100">{t.examTitle}</h2>
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{t.examVerifiedBadge}</span>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 flex flex-wrap items-center justify-between gap-3 h-full">
      <div>
        <h2 className="text-sm font-extrabold tracking-wide text-slate-800 dark:text-slate-100">{t.examTitle}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.examPendingBody}</p>
      </div>
      <Link
        href="/freelancer/exam"
        className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline shrink-0"
      >
        {t.examStart}
      </Link>
    </div>
  );
}
