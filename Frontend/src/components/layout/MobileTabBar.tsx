import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, GraduationCap, Briefcase, Sparkles, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { resolveLocale, SupportedLocale } from '../../utils/locale';

// App-style bottom tab bar, phones only (< sm / 640px). Desktop never sees
// it (`sm:hidden`), so the desktop layout is unchanged.
//
// While it is visible it sets `--tabbar-h` on <html>; other fixed bottom
// widgets (FloatingButtons, ScrollToTop, CookieConsentBanner,
// CourseTutorPanel) read that variable to sit above the bar instead of
// underneath it. A same-height spacer at the end of the flow keeps the last
// bit of every page (footer copyright etc.) from hiding behind the bar.

type TabKey = 'home' | 'courses' | 'jobs' | 'tools' | 'profile';

const LABELS: Record<SupportedLocale, Record<TabKey, string>> = {
  ka: { home: 'მთავარი', courses: 'კურსები', jobs: 'ვაკანსიები', tools: 'AI', profile: 'პროფილი' },
  en: { home: 'Home', courses: 'Courses', jobs: 'Jobs', tools: 'AI tools', profile: 'Profile' },
  de: { home: 'Start', courses: 'Kurse', jobs: 'Jobs', tools: 'KI', profile: 'Profil' },
  es: { home: 'Inicio', courses: 'Cursos', jobs: 'Empleo', tools: 'IA', profile: 'Perfil' },
  fr: { home: 'Accueil', courses: 'Cours', jobs: 'Emplois', tools: 'IA', profile: 'Profil' },
  uk: { home: 'Головна', courses: 'Курси', jobs: 'Вакансії', tools: 'ШІ', profile: 'Профіль' },
};

// Full-screen flows with their own chrome, where a tab bar would get in the
// way (exam proctoring, quizzes, auth screens, the admin panel, course player).
const HIDDEN_PREFIXES = [
  '/admin',
  '/exam',
  '/quiz',
  '/freelancer/exam',
  '/onboarding',
  '/auth',
  '/login',
  '/register',
  '/reset-password',
  '/messages/',
];
const HIDDEN_SUFFIXES = ['/learn', '/exam'];

export function isTabBarRoute(pathname: string): boolean {
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return false;
  if (HIDDEN_SUFFIXES.some((s) => pathname.endsWith(s))) return false;
  return true;
}

const TAB_HEIGHT = 'calc(4rem + env(safe-area-inset-bottom, 0px))';

export default function MobileTabBar() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const t = LABELS[resolveLocale(router.locale)];

  // Admins already get AdminModeBar pinned to the bottom edge.
  const visible = isTabBarRoute(router.pathname) && !user?.adminRole;

  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.style.setProperty('--tabbar-h', TAB_HEIGHT);
    else root.style.removeProperty('--tabbar-h');
    return () => {
      root.style.removeProperty('--tabbar-h');
    };
  }, [visible]);

  if (!visible) return null;

  const path = router.pathname;
  const isActive = (key: TabKey) => {
    switch (key) {
      case 'home':
        return path === '/';
      case 'courses':
        return path.startsWith('/courses') || path.startsWith('/live-trainings') || path.startsWith('/trainings');
      case 'jobs':
        return (
          path.startsWith('/community') ||
          path.startsWith('/vacancies') ||
          path.startsWith('/gigs') ||
          path.startsWith('/projects')
        );
      case 'tools':
        return path.startsWith('/tools') || path.startsWith('/career-test');
      case 'profile':
        return path.startsWith('/dashboard') || path.startsWith('/profile') || path.startsWith('/account');
      default:
        return false;
    }
  };

  const itemClass = (active: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 h-16 min-w-0 no-underline border-none bg-transparent cursor-pointer select-none transition-colors [-webkit-tap-highlight-color:transparent] ${
      active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'
    }`;
  const labelClass = 'block max-w-full truncate px-1 text-[10px] font-bold !leading-tight !tracking-normal';
  const iconWrap = (active: boolean) =>
    `flex items-center justify-center h-7 w-12 rounded-full transition-colors ${
      active ? 'bg-cyan-500/15' : 'bg-transparent'
    }`;

  const tabs: { key: TabKey; href: string; Icon: typeof Home }[] = [
    { key: 'home', href: '/', Icon: Home },
    { key: 'courses', href: '/courses', Icon: GraduationCap },
    { key: 'jobs', href: '/community', Icon: Briefcase },
    { key: 'tools', href: '/tools', Icon: Sparkles },
  ];

  return (
    <>
      <div aria-hidden="true" className="sm:hidden" style={{ height: TAB_HEIGHT }} />
      <nav
        aria-label="Main"
        className="sm:hidden fixed bottom-0 inset-x-0 z-[60] border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0e1422]/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">
          {tabs.map(({ key, href, Icon }) => {
            const active = isActive(key);
            return (
              <Link key={key} href={href} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
                <span className={iconWrap(active)}>
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={labelClass}>{t[key]}</span>
              </Link>
            );
          })}
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              aria-current={isActive('profile') ? 'page' : undefined}
              className={itemClass(isActive('profile'))}
            >
              <span className={iconWrap(isActive('profile'))}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5" strokeWidth={isActive('profile') ? 2.4 : 2} />
                )}
              </span>
              <span className={labelClass}>{t.profile}</span>
            </Link>
          ) : (
            <button type="button" onClick={() => openAuthModal()} className={itemClass(false)}>
              <span className={iconWrap(false)}>
                <User className="w-5 h-5" />
              </span>
              <span className={labelClass}>{t.profile}</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
