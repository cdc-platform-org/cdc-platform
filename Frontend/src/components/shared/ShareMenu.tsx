import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Share2, Link2, Check } from 'lucide-react';

// Compact share control for job-post cards and detail pages: one icon
// button that opens a small menu with the same targets SocialShareButtons
// offers (Facebook, LinkedIn, X, Telegram, WhatsApp, copy link, plus the
// OS share sheet when available) — instead of a row of six icons per card.

interface ShareMenuProps {
  // Relative ("/gigs/abc") or absolute URL. Relative paths are resolved
  // against window.location.origin after mount (avoids SSR mismatch).
  url: string;
  title: string;
  align?: 'left' | 'right';
  // 'icon' = square icon button (cards); 'button' = full-width labelled
  // outline button (detail sidebar).
  variant?: 'icon' | 'button';
  // 'up' opens the menu above the trigger (e.g. inside a bottom action bar).
  direction?: 'down' | 'up';
  className?: string;
}

const NETWORKS: { key: string; name: string; href: (u: string, t: string) => string; path: string }[] = [
  {
    key: 'facebook',
    name: 'Facebook',
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    path: 'M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
    path: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21H18v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V21H10V9Z',
  },
  {
    key: 'x',
    name: 'X',
    href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    path: 'M18.9 2H22l-7.6 8.68L23.3 22h-7.02l-5.5-7.19L4.46 22H1.35l8.13-9.29L.9 2h7.2l4.97 6.57L18.9 2Zm-1.23 18h1.74L6.4 3.9H4.53L17.67 20Z',
  },
  {
    key: 'telegram',
    name: 'Telegram',
    href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    path: 'M21.94 4.6 18.66 20.2c-.25 1.1-.9 1.38-1.83.86l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.15 9.37-8.47c.41-.36-.09-.56-.63-.2L6.4 12.6l-5.02-1.57c-1.09-.34-1.11-1.09.23-1.61L20.5 3.4c.91-.34 1.7.2 1.44 1.2Z',
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    href: (u, t) => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${t} ${u}`)}`,
    path: 'M12.02 2c-5.5 0-9.97 4.46-9.97 9.96 0 1.76.46 3.48 1.33 5L2 22l5.2-1.36a9.96 9.96 0 0 0 4.82 1.23h.01c5.5 0 9.97-4.46 9.97-9.96S17.52 2 12.02 2Zm5.84 14.24c-.25.7-1.24 1.28-2.02 1.44-.55.12-1.26.21-3.65-.78-3.06-1.27-5.03-4.38-5.18-4.58-.15-.2-1.24-1.65-1.24-3.15s.78-2.23 1.06-2.54c.28-.31.6-.38.8-.38.2 0 .4.002.57.01.18.008.43-.07.67.51.25.6.85 2.07.92 2.22.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.18-.31.4-.44.53-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.06 1.13 1.01 2.09 1.33 2.38 1.48.3.15.47.13.64-.07.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.28.1 1.75.83 2.05.98.3.15.5.23.57.35.08.13.08.72-.17 1.42Z',
  },
];

export default function ShareMenu({ url, title, align = 'right', variant = 'icon', direction = 'down', className = '' }: ShareMenuProps) {
  const { t } = useTranslation('proposals');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [absUrl, setAbsUrl] = useState(url);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAbsUrl(/^https?:\/\//.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`);
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, [url]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absUrl);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure context) — the URL stays in the address bar.
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url: absUrl });
      setOpen(false);
    } catch {
      // User dismissed the OS sheet.
    }
  };

  const itemClass =
    'flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg no-underline bg-transparent border-none cursor-pointer text-left';

  return (
    <div ref={rootRef} className={`relative ${variant === 'button' ? 'w-full' : ''} ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('postCard.share')}
        title={t('postCard.share')}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={
          variant === 'icon'
            ? 'inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-transparent transition-colors cursor-pointer'
            : 'inline-flex w-full items-center justify-center gap-2 min-h-[2.5rem] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 bg-transparent transition-colors cursor-pointer'
        }
      >
        <Share2 className="w-4 h-4" aria-hidden="true" />
        {variant === 'button' && <span>{t('postCard.share')}</span>}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-30 ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-56 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg shadow-slate-900/10 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {NETWORKS.map((n) => (
            <a
              key={n.key}
              role="menuitem"
              href={n.href(absUrl, title)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" className="text-slate-500 shrink-0">
                <path d={n.path} />
              </svg>
              {n.name}
            </a>
          ))}
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <button type="button" role="menuitem" onClick={copy} className={itemClass}>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
            ) : (
              <Link2 className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            )}
            <span role={copied ? 'status' : undefined}>{copied ? t('postCard.linkCopied') : t('postCard.copyLink')}</span>
          </button>
          {canNativeShare && (
            <button type="button" role="menuitem" onClick={nativeShare} className={`${itemClass} sm:hidden`}>
              <Share2 className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              {t('postCard.share')}…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
