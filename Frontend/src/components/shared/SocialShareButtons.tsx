import { useState } from 'react';

interface SocialShareButtonsProps {
  // Absolute URL to share. Falls back to window.location.href when omitted
  // (e.g. on list-page cards that don't have their own canonical route).
  url?: string;
  title: string;
  lang?: 'ka' | 'en';
  className?: string;
  // 'auto' follows the page's light/dark toggle via Tailwind `dark:`
  // classes (courses, dashboard, etc). 'dark' fixes dark-friendly colors
  // regardless of the toggle state, for pages that are unconditionally
  // dark-themed (blog, gigs, vacancies) and never add the `dark` class to
  // <html> — those pages would otherwise render this in light colors.
  variant?: 'auto' | 'dark';
}

const dict = {
  ka: { share: 'გაზიარება', copied: 'დაკოპირდა ✓', copyLink: 'ბმულის კოპირება' },
  en: { share: 'Share', copied: 'Copied ✓', copyLink: 'Copy Link' },
};

// Facebook/LinkedIn/copy-link — used on blog posts, course details, and
// gigs/vacancies cards so visitors can share a listing without an account.
export default function SocialShareButtons({ url, title, lang = 'ka', className = '', variant = 'auto' }: SocialShareButtonsProps) {
  const t = dict[lang];
  const [copied, setCopied] = useState(false);

  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently no-op,
      // the link is still visible/selectable in the address bar.
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const labelClass = variant === 'dark' ? 'text-slate-500' : 'text-slate-500 dark:text-slate-500';
  const iconClass =
    variant === 'dark'
      ? 'border-slate-700 text-slate-400 hover:text-cyan-400'
      : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400';
  const copiedClass = variant === 'dark' ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className={`flex items-center gap-2 ${className}`} onClick={stop}>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>{t.share}</span>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        aria-label="Facebook"
        className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors no-underline hover:border-cyan-400 ${iconClass}`}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
        </svg>
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        aria-label="LinkedIn"
        className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors no-underline hover:border-cyan-400 ${iconClass}`}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21H18v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V21H10V9Z" />
        </svg>
      </a>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t.copyLink}
        title={t.copyLink}
        className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors bg-transparent cursor-pointer hover:border-cyan-400 ${iconClass}`}
      >
        {copied ? (
          <span className={`text-[9px] font-bold whitespace-nowrap px-0.5 ${copiedClass}`}>{t.copied}</span>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.42 1.42" />
            <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.41-1.41" />
          </svg>
        )}
      </button>
    </div>
  );
}
