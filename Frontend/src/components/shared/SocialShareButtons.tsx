import { useState, useEffect, useRef } from 'react';
import { SupportedLocale, pickText } from '../../utils/locale';

interface SocialShareButtonsProps {
  // Absolute URL to share. Falls back to window.location.href when omitted
  // (e.g. on list-page cards that don't have their own canonical route).
  url?: string;
  title: string;
  lang?: SupportedLocale;
  className?: string;
  // 'auto' follows the page's light/dark toggle via Tailwind `dark:`
  // classes (courses, dashboard, etc). 'dark' fixes dark-friendly colors
  // regardless of the toggle state, for pages that are unconditionally
  // dark-themed (blog, gigs, vacancies) and never add the `dark` class to
  // <html> — those pages would otherwise render this in light colors.
  variant?: 'auto' | 'dark';
}

const dictBase = {
  ka: { share: 'გაზიარება', copied: 'ბმული დაკოპირდა!', copyLink: 'ბმულის კოპირება', nativeShare: 'გაზიარება...' },
  en: { share: 'Share', copied: 'Link copied!', copyLink: 'Copy Link', nativeShare: 'Share...' },
};

// pickText's fallback (exact locale if present, else English, never
// Georgian for a non-ka locale) means this dict only needs entries for the
// locales with real copy — de/es/fr/uk/tr/hy/az all resolve to dictBase.en
// automatically without listing them here.
const dict = dictBase;

// Facebook/LinkedIn/X/copy-link (+ native share sheet on mobile, which
// covers WhatsApp/Instagram/etc. without a per-network integration) — used
// on blog posts, course details, gigs/vacancies cards, and forum threads so
// visitors can share a listing without an account.
export default function SocialShareButtons({ url, title, lang = 'ka', className = '', variant = 'auto' }: SocialShareButtonsProps) {
  const t = pickText(dict, lang);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reading window.location.href directly during render would make the
  // server-rendered HTML (window undefined -> empty url) differ from the
  // first client render (window defined -> real url), which React flags as
  // a hydration mismatch and leaves the share links pointing at "u=" until
  // hydration catches up. Deriving it in an effect keeps SSR and the first
  // client paint identical, then fills in the real URL right after mount.
  const [resolvedUrl, setResolvedUrl] = useState(url ?? '');
  useEffect(() => {
    if (!url) setResolvedUrl(window.location.href);
  }, [url]);
  const shareUrl = url ?? resolvedUrl;

  // Feature-detected client-side only — navigator.share doesn't exist during
  // SSR, and its availability differs by browser (mostly mobile Safari/Chrome).
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently no-op,
      // the link is still visible/selectable in the address bar.
    }
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.share({ title, url: shareUrl });
    } catch {
      // AbortError when the user dismisses the OS share sheet — not an error.
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
    <div className={`relative flex items-center gap-2 ${className}`} onClick={stop}>
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
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
        aria-label="X (Twitter)"
        className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-colors no-underline hover:border-cyan-400 ${iconClass}`}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          <path d="M18.9 2H22l-7.6 8.68L23.3 22h-7.02l-5.5-7.19L4.46 22H1.35l8.13-9.29L.9 2h7.2l4.97 6.57L18.9 2Zm-1.23 18h1.74L6.4 3.9H4.53L17.67 20Z" />
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
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className={copiedClass} aria-hidden="true">
            <path d="M5 12.5 10 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.42 1.42" />
            <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.41-1.41" />
          </svg>
        )}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          aria-label={t.nativeShare}
          title={t.nativeShare}
          className={`sm:hidden flex items-center justify-center w-8 h-8 rounded-lg border transition-colors bg-transparent cursor-pointer hover:border-cyan-400 ${iconClass}`}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
          </svg>
        </button>
      )}
      {copied && (
        <div
          role="status"
          className="absolute -top-9 left-0 whitespace-nowrap rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-bold px-3 py-1.5 shadow-lg z-10"
        >
          {t.copied}
        </div>
      )}
    </div>
  );
}
