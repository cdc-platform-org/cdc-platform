import { useEffect, useRef, useState, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    logout: 'გამოსვლა',
    dashboard: 'ჩემი დაშბორდი',
    myCourses: 'ჩემი კურსები',
    notifications: 'შეტყობინებები',
    admin: 'ადმინ პანელი',
    billing: 'ბილინგი',
    cyberSecurity: 'კიბერუსაფრთხოება',
    settings: 'პარამეტრები',
  },
  en: {
    logout: 'Log Out',
    dashboard: 'My Dashboard',
    myCourses: 'My Courses',
    notifications: 'Notifications',
    admin: 'Admin Panel',
    billing: 'Billing',
    cyberSecurity: 'Cyber Security',
    settings: 'Settings',
  },
  de: {
    logout: 'Log Out',
    dashboard: 'My Dashboard',
    myCourses: 'My Courses',
    notifications: 'Notifications',
    admin: 'Admin Panel',
    billing: 'Billing',
    cyberSecurity: 'Cyber Security',
    settings: 'Settings',
  },
  es: {
    logout: 'Log Out',
    dashboard: 'My Dashboard',
    myCourses: 'My Courses',
    notifications: 'Notifications',
    admin: 'Admin Panel',
    billing: 'Billing',
    cyberSecurity: 'Cyber Security',
    settings: 'Settings',
  },
  fr: {
    logout: 'Log Out',
    dashboard: 'My Dashboard',
    myCourses: 'My Courses',
    notifications: 'Notifications',
    admin: 'Admin Panel',
    billing: 'Billing',
    cyberSecurity: 'Cyber Security',
    settings: 'Settings',
  },
  uk: {
    logout: 'Log Out',
    dashboard: 'My Dashboard',
    myCourses: 'My Courses',
    notifications: 'Notifications',
    admin: 'Admin Panel',
    billing: 'Billing',
    cyberSecurity: 'Cyber Security',
    settings: 'Settings',
  },
};

// Single shared source of truth for the "logged in" state of the header
// avatar/name/dropdown — used by both SiteHeader (content pages) and the
// homepage's bespoke nav so every route reads the exact same useAuth()
// state instead of each maintaining its own auth-button markup.
export default function UserMenu({ loginFallback, className }: { loginFallback: ReactNode; className?: string }) {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push('/');
  };

  if (!(isAuthenticated && user)) {
    return <>{loginFallback}</>;
  }

  return (
    <div className={`relative ${className ?? ''}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-lg border-none bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-black text-slate-400">{(user.name ?? '?').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 hidden sm:inline max-w-[10rem] truncate">
          {user.name}
        </span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0e1422] shadow-xl py-1 z-50"
        >
          <Link
            href="/dashboard"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t.dashboard}
          </Link>
          <Link
            href="/dashboard?tab=courses"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t.myCourses}
          </Link>
          <Link
            href="/dashboard/notifications"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t.notifications}
          </Link>
          {user.adminRole && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-2 text-xs font-bold text-cyan-600 dark:text-cyan-400 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.admin}
            </Link>
          )}
          {user.role === 'Client' && (
            <>
              <Link
                href="/dashboard/billing"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.billing}
              </Link>
              <Link
                href="/dashboard/cyber-security"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.cyberSecurity}
              </Link>
            </>
          )}
          <Link
            href="/dashboard/settings"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t.settings}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border-none bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t.logout}
          </button>
        </div>
      )}
    </div>
  );
}
