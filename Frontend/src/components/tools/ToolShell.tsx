import { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import BackButton from '../common/BackButton';

// Shared frame for every digital tool page (/dashboard/tools/*,
// /dashboard/english-tutor). Before this each tool hand-rolled its own
// header, width, background and colors, so the tools looked like separate
// products. The rules this file encodes:
//   - one page width (max-w-6xl) and one background for every tool;
//   - the tool's own color appears only on its icon tile (`accent`);
//     everything else (buttons, focus rings, active tabs) uses the brand
//     cyan → purple;
//   - status (trial / active / VIP price) sits in the header as chips, and
//     the page's one primary action sits on the right of the header.

export type ToolAccent = 'cyan' | 'purple' | 'amber' | 'pink' | 'emerald' | 'indigo';

const ACCENT_TILE: Record<ToolAccent, string> = {
  cyan: 'from-cyan-500 to-blue-600 shadow-cyan-500/25',
  purple: 'from-purple-500 to-indigo-600 shadow-purple-500/25',
  amber: 'from-amber-400 to-orange-500 shadow-amber-500/25',
  pink: 'from-pink-500 to-purple-600 shadow-pink-500/25',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/25',
  indigo: 'from-indigo-500 to-violet-600 shadow-indigo-500/25',
};

export function ToolIconTile({ icon: Icon, accent = 'cyan', size = 'md' }: { icon: LucideIcon; accent?: ToolAccent; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-16 h-16 rounded-2xl' : size === 'sm' ? 'w-10 h-10 rounded-xl' : 'w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl';
  const glyph = size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-5 h-5' : 'w-5 h-5 md:w-7 md:h-7';
  return (
    <div className={`${box} shrink-0 bg-gradient-to-br ${ACCENT_TILE[accent]} shadow-lg flex items-center justify-center`}>
      <Icon className={`${glyph} text-white`} aria-hidden />
    </div>
  );
}

export type ToolChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'vip';

const CHIP_TONE: Record<ToolChipTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  brand: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
  vip: 'bg-gradient-to-r from-amber-50 to-purple-50 text-purple-700 border-purple-200 dark:from-amber-500/10 dark:to-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',
};

export function ToolChip({ tone = 'neutral', icon: Icon, children }: { tone?: ToolChipTone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${CHIP_TONE[tone]}`}>
      {Icon && <Icon className="w-3.5 h-3.5" aria-hidden />}
      {children}
    </span>
  );
}

interface ToolPageHeaderProps {
  icon: LucideIcon;
  accent?: ToolAccent;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Status chips shown above the title (trial, active, price…). */
  chips?: ReactNode;
  /** Primary action(s), right-aligned on desktop, full row on mobile. */
  actions?: ReactNode;
}

export function ToolPageHeader({ icon, accent = 'cyan', title, subtitle, chips, actions }: ToolPageHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 mb-8 no-print">
      <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
        <ToolIconTile icon={icon} accent={accent} />
        <div className="min-w-0 flex-1">
          {chips && <div className="flex flex-wrap items-center gap-2 mb-2">{chips}</div>}
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">{title}</h1>
          {subtitle && <p className="text-sm md:text-[15px] text-slate-600 dark:text-slate-400 mt-1.5 max-w-3xl leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">{actions}</div>}
    </header>
  );
}

interface ToolShellProps {
  children: ReactNode;
  /** BackButton fallback when there is no history (direct link / new tab). */
  backHref?: string;
  /** Narrower column for reading-heavy tools; default is the shared 6xl. */
  width?: 'default' | 'narrow';
  /** Hide the back button (e.g. a page with its own in-tool navigation). */
  hideBack?: boolean;
}

export default function ToolShell({ children, backHref = '/dashboard/tools', width = 'default', hideBack = false }: ToolShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />
      <main className={`${width === 'narrow' ? 'max-w-4xl' : 'max-w-6xl'} mx-auto px-4 sm:px-6 pt-6 md:pt-8 pb-16 flex-1 w-full`}>
        {!hideBack && (
          <div className="mb-5 no-print">
            <BackButton fallbackHref={backHref} className="dark:text-slate-400 dark:hover:text-slate-100" />
          </div>
        )}
        {children}
      </main>
      <div className="no-print">
        <SiteFooter />
      </div>
    </div>
  );
}

export interface ToolTab<K extends string> {
  key: K;
  label: ReactNode;
  icon?: LucideIcon;
}

// Segmented tab bar: one row that scrolls sideways on phones instead of
// wrapping into a wall of pills (the educator hub's 8 tabs used to take a
// whole phone screen before the form even started).
export function ToolTabs<K extends string>({ tabs, active, onChange, ariaLabel }: { tabs: ToolTab<K>[]; active: K; onChange: (k: K) => void; ariaLabel?: string }) {
  return (
    <div className="-mx-4 sm:mx-0 mb-6 no-print">
      <div role="tablist" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto px-4 sm:px-1 py-1 sm:rounded-2xl sm:bg-white sm:dark:bg-slate-900 sm:border sm:border-slate-200 sm:dark:border-slate-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ key, label, icon: Icon }) => {
          const selected = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(key)}
              className={`shrink-0 inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-bold border-none cursor-pointer transition-colors ${
                selected
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-white sm:bg-transparent dark:bg-slate-900 sm:dark:bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" aria-hidden />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Shared look for "you can't use this yet" / "nothing here yet" blocks.
export function ToolStateCard({ icon, accent = 'cyan', title, body, children }: { icon: LucideIcon; accent?: ToolAccent; title: ReactNode; body?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-6 py-12 md:py-16 text-center shadow-sm">
      <div className="flex justify-center mb-5"><ToolIconTile icon={icon} accent={accent} size="lg" /></div>
      <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">{title}</h2>
      {body && <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{body}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export const toolPrimaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm px-5 py-3 no-underline border-none cursor-pointer shadow-md shadow-cyan-500/20 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed';
export const toolSecondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-sm px-5 py-3 no-underline cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800';

export function ToolLinkButton({ href, children, variant = 'primary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  const cls = variant === 'primary' ? toolPrimaryButton : toolSecondaryButton;
  if (href.startsWith('mailto:') || href.startsWith('http')) return <a href={href} className={cls}>{children}</a>;
  return <Link href={href} className={cls}>{children}</Link>;
}
