import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';

const dict = {
  ka: {
    login: 'შესვლა',
    about: 'ჩვენ შესახებ',
    gallery: 'გალერეა',
    community: 'ვაკანსიები',
    tools: 'ციფრული ხელსაწყოები',
  },
  en: {
    login: 'Log In',
    about: 'About',
    gallery: 'Gallery',
    community: 'Jobs',
    tools: 'Digital Tools',
  },
};

// Shared, theme-aware header for content pages that don't have their own
// full custom nav (the homepage's is inline/bespoke and left untouched) —
// logo/home link, language switcher, dark-mode toggle, auth buttons.
export default function SiteHeader() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true' || document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0e1422]/90 backdrop-blur-md px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline text-current">
          <Image src="/images/cdc-logo.png" alt="CDC" width={40} height={40} className="h-9 w-auto rounded-xl object-cover" />
          <span className="hidden sm:inline font-bold text-sm tracking-wide text-slate-900 dark:text-white">CDC</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Link href="/community" className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
              {t.community}
            </Link>
            <Link href="/tools" className="relative no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5">
              {t.tools}
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse">
                HOT
              </span>
            </Link>
            {!(isAuthenticated && user) && (
              <>
                <Link href="/about" className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                  {t.about}
                </Link>
                <Link href="/gallery" className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                  {t.gallery}
                </Link>
              </>
            )}
          </div>
          <LanguageSwitcher />
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-2 rounded-xl transition text-lg border-none bg-transparent cursor-pointer hover:rotate-12 duration-200"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
          <UserMenu
            loginFallback={
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                👤 {t.login}
              </button>
            }
          />
        </div>
      </div>
    </nav>
  );
}
