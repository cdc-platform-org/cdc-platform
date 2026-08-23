import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { setCookie } from '../../utils/cookies';
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY } from '../../utils/locale';

// Each language labeled in its own script/name (matching how "ქართული"/
// "English" already worked before this was a dropdown) — never translate a
// language's own name into another language. Every entry carries its own
// flag now (trigger button included, not just the dropdown) — flag and
// label kept as separate fields rather than baked into one string so the
// trigger button can show just the flag without re-parsing label text.
const locales = [
  { code: 'ka', flag: '🇬🇪', label: 'ქართული' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'uk', flag: '🇺🇦', label: 'Українська' },
  { code: 'tr', flag: '🇹🇷', label: 'Türkçe' },
  { code: 'hy', flag: '🇦🇲', label: 'Հայերեն' },
  { code: 'az', flag: '🇦🇿', label: 'Azərbaycan' },
];

// Was 6 inline buttons before this file grew from 2 languages to 6 — that
// stopped fitting in SiteHeader's already-tight actions cluster (language +
// theme toggle + notifications + user menu + burger, all shrink-0). Same
// click-outside dropdown pattern as UserMenu.tsx for consistency.
export default function LanguageSwitcher() {
  const router = useRouter();
  const { pathname, asPath, query, locale: currentLocale } = router;
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const current = locales.find((l) => l.code === currentLocale) ?? locales[0];

  const switchLocale = (nextLocale: string) => {
    setOpen(false);
    // Persist the choice so it survives a full refresh — see the comment on
    // LOCALE_COOKIE in utils/locale.ts for why the cookie is what actually
    // makes Next.js's automatic locale detection respect it.
    setCookie(LOCALE_COOKIE, nextLocale, 365);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Ignore (private-browsing storage restrictions, etc.) — the cookie
      // above is what actually drives persistence.
    }
    router.push({ pathname, query }, asPath, { locale: nextLocale });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change language"
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg border-none bg-transparent cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <span aria-hidden="true">{current.flag}</span>
        <span className="uppercase">{current.code}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0e1422] shadow-xl py-1 z-50"
        >
          {locales.map(({ code, flag, label }) => (
            <button
              key={code}
              type="button"
              role="menuitem"
              onClick={() => switchLocale(code)}
              disabled={currentLocale === code}
              className={
                currentLocale === code
                  ? 'w-full flex items-center gap-2 text-left px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-none cursor-default'
                  : 'w-full flex items-center gap-2 text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800'
              }
            >
              <span aria-hidden="true">{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
