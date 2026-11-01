import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Menu, X, LayoutDashboard, GraduationCap, LogOut, ShieldCheck, ChevronDown, CalendarClock, Sun, Moon, ArrowRight, Sparkles } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import HeaderSearch from './HeaderSearch';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { resolveLocale } from '../../utils/locale';
import { getSiteNavigation, NAV_DICT, type NavEntry, type NavGroup } from '../../data/siteNavigation';

// Inline dict rather than next-i18next: this header is mounted on ~40 pages
// and can't assume every one of them declares the same namespace in its own
// getStaticProps, so it resolves its own locale (see utils/locale.ts) and
// carries its own strings instead. Menu labels live in data/siteNavigation.ts.
const dict = {
  ka: { login: 'შესვლა', dashboard: 'ჩემი დაშბორდი', myCourses: 'ჩემი კურსები', admin: 'ადმინ პანელი', mentorPanel: 'მენტორის პანელი', logout: 'გამოსვლა', menu: 'მენიუ', account: 'ანგარიში' },
  en: { login: 'Log In', dashboard: 'My Dashboard', myCourses: 'My Courses', admin: 'Admin Panel', mentorPanel: 'Mentor Panel', logout: 'Log Out', menu: 'Menu', account: 'Account' },
  de: { login: 'Anmelden', dashboard: 'Mein Dashboard', myCourses: 'Meine Kurse', admin: 'Admin-Panel', mentorPanel: 'Mentoren-Panel', logout: 'Abmelden', menu: 'Menü', account: 'Konto' },
  es: { login: 'Iniciar Sesión', dashboard: 'Mi Panel', myCourses: 'Mis Cursos', admin: 'Panel de Administración', mentorPanel: 'Panel de Mentor', logout: 'Cerrar Sesión', menu: 'Menú', account: 'Cuenta' },
  fr: { login: 'Connexion', dashboard: 'Mon tableau de bord', myCourses: 'Mes cours', admin: 'Panneau admin', mentorPanel: 'Panneau mentor', logout: 'Déconnexion', menu: 'Menu', account: 'Compte' },
  uk: { login: 'Увійти', dashboard: 'Моя панель', myCourses: 'Мої курси', admin: 'Панель адміністратора', mentorPanel: 'Панель ментора', logout: 'Вийти', menu: 'Меню', account: 'Акаунт' },
};

interface SiteHeaderProps {
  // The homepage owns its own dark-mode state (its sections style off it
  // directly), so it passes it in; every other page lets the header manage
  // the shared localStorage/`.dark` class itself.
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

function isActive(asPath: string, href: string) {
  const path = href.split(/[?#]/)[0];
  if (path === '/') return asPath === '/';
  return asPath === path || asPath.startsWith(`${path}/`) || asPath.startsWith(`${path}?`);
}

function groupActive(asPath: string, group: NavGroup) {
  return isActive(asPath, group.href) || group.items.some((item) => isActive(asPath, item.href));
}

// One shared, theme-aware header for every public page (homepage included):
// logo, the grouped main menu from data/siteNavigation.ts, search, language,
// theme, notifications and account.
export default function SiteHeader({ darkMode: controlledDark, onToggleDarkMode }: SiteHeaderProps = {}) {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const nav = NAV_DICT[lang];
  const entries: NavEntry[] = getSiteNavigation(lang);
  const { user, isAuthenticated, logout } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [ownDark, setOwnDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const darkMode = controlledDark ?? ownDark;

  useEffect(() => {
    if (controlledDark !== undefined) return;
    const isDark = localStorage.getItem('darkMode') === 'true' || document.documentElement.classList.contains('dark');
    setOwnDark(isDark);
  }, [controlledDark]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock page scroll behind the open mobile drawer.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const toggleDarkMode = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
      return;
    }
    const next = !ownDark;
    setOwnDark(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  const handleMobileLogout = () => {
    setMobileMenuOpen(false);
    logout();
    router.push('/');
  };

  const dashboardHref = user?.adminRole ? '/admin' : '/dashboard';
  // Mentor role or any admin-team member — the sessions list at
  // /dashboard/mentorship-sessions is meaningful for both.
  const canSeeMentorPanel = isAuthenticated && (user?.role === 'Mentor' || !!user?.adminRole);
  const asPath = router.asPath;

  const topLinkClass = (active: boolean) =>
    `relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13.5px] font-semibold no-underline transition-colors duration-150 ${
      active
        ? 'text-slate-900 dark:text-white bg-slate-900/[0.06] dark:bg-white/10'
        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
    }`;

  return (
    // Full-bleed edge-to-edge (-mx-4 sm:-mx-6 cancels _app.tsx's app-shell
    // wrapper padding) so the glass background spans the true viewport width.
    <nav
      className={`sticky top-0 z-50 -mx-4 sm:-mx-6 border-b backdrop-blur-xl transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled
          ? 'bg-white/85 dark:bg-[#0b0f19]/80 border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]'
          : 'bg-white/70 dark:bg-[#0b0f19]/60 border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 h-16 sm:h-[72px]">
        <div className="flex-1 flex items-center min-w-fit">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline text-current" aria-label="CDC">
            <Image src="/images/cdc-logo.png" alt="CDC" width={44} height={44} priority className="h-10 w-auto rounded-xl object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10" />
            <span className="hidden sm:inline font-black text-[15px] tracking-tight text-slate-900 dark:text-white">CDC</span>
          </Link>
        </div>

        {/* Desktop menu (1420px+; burger drawer below). Dropdowns open on hover and on keyboard focus
            (focus-within), so they work without a mouse too. */}
        <div className="hidden min-[1420px]:flex items-center gap-0.5 whitespace-nowrap">
          {entries.map((entry) =>
            entry.kind === 'link' ? (
              <Link key={entry.key} href={entry.href} className={topLinkClass(isActive(asPath, entry.href))}>
                {entry.highlight && <Sparkles className="w-3.5 h-3.5 text-cyan-500" />}
                {nav.links[entry.key]}
              </Link>
            ) : (
              <div key={entry.key} className="relative group">
                <Link href={entry.href} className={topLinkClass(groupActive(asPath, entry))} aria-haspopup="true">
                  {nav.groups[entry.key]}
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180" />
                </Link>
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-[60] opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition-all duration-200">
                  <div className="w-[22rem] rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#0e1422]/95 backdrop-blur-xl p-2 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]">
                    {entry.items.map((item) => {
                      const copy = nav.items[item.key];
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          className="flex items-start gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors hover:bg-slate-100/80 dark:hover:bg-white/[0.06] focus-visible:bg-slate-100/80 dark:focus-visible:bg-white/[0.06] outline-none"
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/15 to-purple-600/15 text-cyan-600 dark:text-cyan-300 ring-1 ring-cyan-500/20">
                            <Icon className="w-[18px] h-[18px]" />
                          </span>
                          <span className="min-w-0 whitespace-normal">
                            <span className="block text-sm font-bold text-slate-900 dark:text-white">{copy.title}</span>
                            <span className="block text-xs leading-snug text-slate-500 dark:text-slate-400">{copy.desc}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Actions: search, language, theme, bell, account, burger (< 1420px). */}
        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="hidden md:block">
              <HeaderSearch darkMode={darkMode} lang={lang === 'ka' ? 'GEO' : 'ENG'} />
            </div>
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="p-2 rounded-full border-none bg-transparent cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <NotificationBell />
            <UserMenu
              loginFallback={
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border-none cursor-pointer text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-colors shadow-sm"
                >
                  {t.login}
                  <ArrowRight className="w-4 h-4" />
                </button>
              }
            />
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="sm:hidden rounded-full px-3.5 py-1.5 text-xs font-bold border-none cursor-pointer text-white bg-slate-900 dark:bg-white dark:text-slate-900 whitespace-nowrap"
              >
                {t.login}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              className="min-[1420px]:hidden p-2 rounded-full border-none bg-transparent cursor-pointer text-slate-800 dark:text-slate-200 hover:bg-slate-900/[0.05] dark:hover:bg-white/10"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="min-[1420px]:hidden border-t border-slate-200/80 dark:border-white/10 px-4 sm:px-6 pb-[calc(var(--tabbar-h,0px)+1.5rem)] overflow-y-auto overscroll-contain max-h-[calc(100dvh-4rem)]">
          <div className="max-w-2xl mx-auto">
            {isAuthenticated && user ? (
              <Link href={dashboardHref} className="mt-4 flex items-center gap-3 rounded-2xl p-3 no-underline text-current bg-slate-100/70 dark:bg-white/[0.05]">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black text-slate-500">{(user.name ?? '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="flex-1 text-base font-bold text-slate-900 dark:text-white truncate">{user.name}</span>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal();
                }}
                className="w-full mt-4 text-base font-bold px-4 py-3.5 rounded-2xl border-none cursor-pointer text-white bg-slate-900 dark:bg-white dark:text-slate-900"
              >
                {t.login}
              </button>
            )}

            <div className="md:hidden mt-4">
              <HeaderSearch darkMode={darkMode} lang={lang === 'ka' ? 'GEO' : 'ENG'} />
            </div>
            <div className="sm:hidden mt-3">
              <LanguageSwitcher />
            </div>

            {entries.map((entry) =>
              entry.kind === 'link' ? (
                <Link
                  key={entry.key}
                  href={entry.href}
                  className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-3 text-base font-bold no-underline ${
                    entry.highlight
                      ? 'text-white bg-gradient-to-r from-cyan-500 to-purple-600'
                      : 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {entry.highlight && <Sparkles className="w-5 h-5" />}
                  {nav.links[entry.key]}
                </Link>
              ) : (
                <div key={entry.key} className="mt-5">
                  <p className="px-3 mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{nav.groups[entry.key]}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                    {entry.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 no-underline text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                        >
                          <Icon className="w-5 h-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                          <span className="text-[15px] font-semibold">{nav.items[item.key].title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {isAuthenticated && user && (
              <div className="mt-5 border-t border-slate-200 dark:border-white/10 pt-4">
                <p className="px-3 mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{t.account}</p>
                <Link href="/dashboard" className="flex items-center gap-3 no-underline px-3 py-3 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]">
                  <LayoutDashboard className="w-5 h-5" /> {t.dashboard}
                </Link>
                <Link href="/dashboard?tab=courses" className="flex items-center gap-3 no-underline px-3 py-3 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]">
                  <GraduationCap className="w-5 h-5" /> {t.myCourses}
                </Link>
                {canSeeMentorPanel && (
                  <Link href="/dashboard/mentorship-sessions" className="flex items-center gap-3 no-underline px-3 py-3 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]">
                    <CalendarClock className="w-5 h-5" /> {t.mentorPanel}
                  </Link>
                )}
                {user.adminRole && (
                  <Link href="/admin" className="flex items-center gap-3 no-underline px-3 py-3 rounded-xl text-cyan-700 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]">
                    <ShieldCheck className="w-5 h-5" /> {t.admin}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleMobileLogout}
                  className="w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl border-none bg-transparent cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="w-5 h-5" /> {t.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
