import { useEffect, useRef, useState, ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVerificationDrawer } from '../../context/VerificationDrawerContext';
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
    statusStandard: 'სტანდარტული',
    statusFreelancer: 'ვერიფიცირებული ფრილანსერი',
    statusBusiness: 'ვერიფიცირებული ბიზნესი',
    verifyAccount: 'ექაუნთის ვერიფიკაცია',
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
    statusStandard: 'Standard',
    statusFreelancer: 'Verified Freelancer',
    statusBusiness: 'Verified Business',
    verifyAccount: 'Verify Account',
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
    statusStandard: 'Standard',
    statusFreelancer: 'Verified Freelancer',
    statusBusiness: 'Verified Business',
    verifyAccount: 'Verify Account',
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
    statusStandard: 'Standard',
    statusFreelancer: 'Verified Freelancer',
    statusBusiness: 'Verified Business',
    verifyAccount: 'Verify Account',
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
    statusStandard: 'Standard',
    statusFreelancer: 'Verified Freelancer',
    statusBusiness: 'Verified Business',
    verifyAccount: 'Verify Account',
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
    statusStandard: 'Standard',
    statusFreelancer: 'Verified Freelancer',
    statusBusiness: 'Verified Business',
    verifyAccount: 'Verify Account',
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
  const { openVerificationDrawer } = useVerificationDrawer();
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

  // Freelancer status: earned either via isVerifiedGraduate (course/skill
  // exam) or an approved INDIVIDUAL identity verification — the same
  // hasFreelancerRights() OR-condition the Backend gates gig/vacancy
  // applications with (see utils/freelancerVerification.ts), duplicated
  // here client-side purely for display since this file has no shared
  // import path to that Backend-only module.
  const isVerifiedFreelancer =
    user.isVerifiedGraduate || (user.verificationLevel === 'INDIVIDUAL' && user.verificationStatus === 'APPROVED');
  const isVerifiedBusiness = user.role === 'Client' && user.isVerified;
  const statusLabel = isVerifiedBusiness ? t.statusBusiness : isVerifiedFreelancer ? t.statusFreelancer : t.statusStandard;
  const isFullyVerified = isVerifiedFreelancer || isVerifiedBusiness;

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
          className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0e1422] shadow-xl py-1 z-50"
        >
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{user.name}</p>
            <span
              className={`inline-block mt-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isVerifiedBusiness
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                  : isVerifiedFreelancer
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {statusLabel}
            </span>
          </div>
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
          {!isFullyVerified && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openVerificationDrawer();
              }}
              className="flex items-center gap-1.5 w-full text-left px-4 py-2 text-xs font-black text-emerald-600 dark:text-emerald-400 border-none bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
              {t.verifyAccount}
            </button>
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
