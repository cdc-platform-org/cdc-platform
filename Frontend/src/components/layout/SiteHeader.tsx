import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Menu, X, LayoutDashboard, GraduationCap, LogOut, ShieldCheck, ChevronDown, ShoppingBag } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { MARKETPLACE_CATEGORIES } from '../../data/marketplaceCategories';

const dict = {
  ka: {
    login: 'შესვლა',
    about: 'ჩვენ შესახებ',
    gallery: 'გალერეა',
    community: 'ვაკანსიები',
    mentors: 'მენტორები',
    marketplace: 'ციფრული მაღაზია',
    categories: 'კატეგორიები',
    viewAllProducts: 'ყველა პროდუქტი',
    tools: 'ციფრული ხელსაწყოები',
    dashboard: 'ჩემი დაშბორდი',
    myCourses: 'ჩემი კურსები',
    admin: 'ადმინ პანელი',
    logout: 'გამოსვლა',
  },
  en: {
    login: 'Log In',
    about: 'About',
    gallery: 'Gallery',
    community: 'Jobs',
    mentors: 'Mentors',
    marketplace: 'Marketplace',
    categories: 'Categories',
    viewAllProducts: 'View All Products',
    tools: 'Digital Tools',
    dashboard: 'My Dashboard',
    myCourses: 'My Courses',
    admin: 'Admin Panel',
    logout: 'Log Out',
  },
};

// Shared, theme-aware header for content pages that don't have their own
// full custom nav (the homepage's is inline/bespoke and left untouched) —
// logo/home link, language switcher, dark-mode toggle, auth buttons.
export default function SiteHeader() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, isAuthenticated, logout } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true' || document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [router.asPath]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  const handleMobileLogout = () => {
    setMobileMenuOpen(false);
    logout();
    router.push('/');
  };

  const dashboardHref = user?.adminRole ? '/admin' : '/dashboard';

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0e1422]/90 backdrop-blur-md px-4 sm:px-6 py-4 overflow-x-hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline text-current">
          <Image src="/images/cdc-logo.png" alt="CDC" width={40} height={40} className="h-9 w-auto rounded-xl object-cover" />
          <span className="hidden sm:inline font-bold text-sm tracking-wide text-slate-900 dark:text-white">CDC</span>
        </Link>

        {/* min-w-0 (not shrink-0) lets this whole cluster actually shrink
            under pressure — the nav-links block below is the one allowed to
            clip (overflow-hidden), never the actions group at the end
            (lang/theme/login/burger), which stays shrink-0 so it's always
            fully visible regardless of how long the KA nav labels get. */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="hidden md:flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300 min-w-0 overflow-hidden">
            <Link href="/community" className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
              {t.community}
            </Link>
            <Link href="/mentors" className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
              {t.mentors}
            </Link>
            <div className="relative group py-2 -my-2">
              <Link
                href="/marketplace"
                className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1"
              >
                {t.marketplace}
                <ChevronDown className="w-3 h-3" />
              </Link>
              <div className="absolute left-0 top-full pt-2 w-64 z-[60] opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150">
                <div className="rounded-xl border shadow-lg overflow-hidden text-sm bg-white dark:bg-[#0e1422] border-slate-200 dark:border-slate-800">
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t.categories}</p>
                  {MARKETPLACE_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.value.en}
                      href={`/marketplace?category=${encodeURIComponent(cat.value[lang])}`}
                      className="block px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {cat.value[lang]}
                    </Link>
                  ))}
                  <Link
                    href="/marketplace"
                    className="flex items-center gap-1.5 px-4 py-2.5 no-underline font-bold text-cyan-600 dark:text-cyan-400 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {t.viewAllProducts}
                  </Link>
                </div>
              </div>
            </div>
            {/* Public/guest promo item — restricted to Client (business)
                accounts once logged in, since it's a B2B product line
                (see tools.tsx). Not shown to Student/Mentor dashboards. */}
            {(!isAuthenticated || user?.role === 'Client') && (
              <Link href="/tools" className="relative no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5">
                {t.tools}
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse">
                  HOT
                </span>
              </Link>
            )}
            {!(isAuthenticated && user) && (
              <div className="relative group py-2 -my-2">
                <Link
                  href="/about"
                  className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1"
                >
                  {t.about}
                  <ChevronDown className="w-3 h-3" />
                </Link>
                <div className="absolute left-0 top-full pt-2 w-48 z-[60] opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150">
                  <div className="rounded-xl border shadow-lg overflow-hidden text-sm bg-white dark:bg-[#0e1422] border-slate-200 dark:border-slate-800">
                    <Link
                      href="/gallery"
                      className="block px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {t.gallery}
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions cluster — deliberately shrink-0 (see the comment on
              this row's parent) so language/theme/login/burger are always
              fully rendered, never the thing that gets clipped when the KA
              nav labels above run long. Order left-to-right: Language,
              Theme, Bell (authenticated only), Login (mobile-only compact
              pill, guests only — desktop guests get the same login button
              via UserMenu's loginFallback below), Burger. */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
            <div className="hidden md:block">
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
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="md:hidden text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {t.login}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-xl border-none bg-transparent cursor-pointer text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden mt-4 border-t border-slate-200 dark:border-slate-800 pt-4">
          {isAuthenticated && user ? (
            <Link
              href={dashboardHref}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-2 pb-4 no-underline text-current"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-slate-400">{(user.name ?? '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openAuthModal();
              }}
              className="w-full mb-4 text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-transparent cursor-pointer"
            >
              👤 {t.login}
            </button>
          )}

          <div className="flex flex-col gap-1 text-sm font-bold text-slate-700 dark:text-slate-300">
            <Link href="/community" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {t.community}
            </Link>
            <Link href="/mentors" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {t.mentors}
            </Link>
            <Link href="/marketplace" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {t.marketplace}
            </Link>
            <div className="pl-4 flex flex-col gap-0.5">
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <Link
                  key={cat.value.en}
                  href={`/marketplace?category=${encodeURIComponent(cat.value[lang])}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="no-underline px-2 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {cat.value[lang]}
                </Link>
              ))}
            </div>
            {(!isAuthenticated || user?.role === 'Client') && (
              <Link href="/tools" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                {t.tools}
              </Link>
            )}
            {!(isAuthenticated && user) && (
              <>
                <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  {t.about}
                </Link>
                <Link
                  href="/gallery"
                  onClick={() => setMobileMenuOpen(false)}
                  className="no-underline pl-6 pr-2 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t.gallery}
                </Link>
              </>
            )}

            {isAuthenticated && user && (
              <>
                <div className="border-t border-slate-200 dark:border-slate-800 my-1" />
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <LayoutDashboard className="w-4 h-4" /> {t.dashboard}
                </Link>
                <Link href="/dashboard?tab=courses" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <GraduationCap className="w-4 h-4" /> {t.myCourses}
                </Link>
                {user.adminRole && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 no-underline px-2 py-2.5 rounded-lg text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ShieldCheck className="w-4 h-4" /> {t.admin}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleMobileLogout}
                  className="flex items-center gap-2.5 text-left px-2 py-2.5 rounded-lg border-none bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <LogOut className="w-4 h-4" /> {t.logout}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
