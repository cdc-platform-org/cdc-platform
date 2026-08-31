import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Menu, X, LayoutDashboard, GraduationCap, LogOut, ShieldCheck, ChevronDown, ShoppingBag, CalendarClock, PlayCircle, Users, GalleryHorizontal } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { MARKETPLACE_CATEGORIES } from '../../data/marketplaceCategories';
import { resolveLocale } from '../../utils/locale';

// Inline dict rather than next-i18next: this header is mounted on ~40 pages
// and can't assume every one of them declares the same namespace in its own
// getStaticProps, so it resolves its own locale (see utils/locale.ts) and
// carries its own strings instead.
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
    tutorials: 'ვიდეო ინსტრუქციები',
    dashboard: 'ჩემი დაშბორდი',
    myCourses: 'ჩემი კურსები',
    admin: 'ადმინ პანელი',
    mentorPanel: 'მენტორის პანელი',
    more: 'მეტი',
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
    tutorials: 'Video Tutorials',
    dashboard: 'My Dashboard',
    myCourses: 'My Courses',
    admin: 'Admin Panel',
    mentorPanel: 'Mentor Panel',
    more: 'More',
    logout: 'Log Out',
  },
  de: {
    login: 'Anmelden',
    about: 'Über uns',
    gallery: 'Galerie',
    community: 'Jobs',
    mentors: 'Mentoren',
    marketplace: 'Marktplatz',
    categories: 'Kategorien',
    viewAllProducts: 'Alle Produkte ansehen',
    tools: 'Digitale Tools',
    tutorials: 'Video-Tutorials',
    dashboard: 'Mein Dashboard',
    myCourses: 'Meine Kurse',
    admin: 'Admin-Panel',
    mentorPanel: 'Mentoren-Panel',
    more: 'Mehr',
    logout: 'Abmelden',
  },
  es: {
    login: 'Iniciar Sesión',
    about: 'Sobre Nosotros',
    gallery: 'Galería',
    community: 'Empleos',
    mentors: 'Mentores',
    marketplace: 'Mercado',
    categories: 'Categorías',
    viewAllProducts: 'Ver Todos los Productos',
    tools: 'Herramientas Digitales',
    tutorials: 'Video Tutoriales',
    dashboard: 'Mi Panel',
    myCourses: 'Mis Cursos',
    admin: 'Panel de Administración',
    mentorPanel: 'Panel de Mentor',
    more: 'Más',
    logout: 'Cerrar Sesión',
  },
  fr: {
    login: 'Connexion',
    about: 'À propos',
    gallery: 'Galerie',
    community: 'Emplois',
    mentors: 'Mentors',
    marketplace: 'Marché',
    categories: 'Catégories',
    viewAllProducts: 'Voir tous les produits',
    tools: 'Outils numériques',
    tutorials: 'Tutoriels vidéo',
    dashboard: 'Mon tableau de bord',
    myCourses: 'Mes cours',
    admin: 'Panneau admin',
    mentorPanel: 'Panneau mentor',
    more: 'Plus',
    logout: 'Déconnexion',
  },
  uk: {
    login: 'Увійти',
    about: 'Про нас',
    gallery: 'Галерея',
    community: 'Вакансії',
    mentors: 'Ментори',
    marketplace: 'Маркетплейс',
    categories: 'Категорії',
    viewAllProducts: 'Переглянути всі товари',
    tools: 'Цифрові інструменти',
    tutorials: 'Відеоуроки',
    dashboard: 'Моя панель',
    myCourses: 'Мої курси',
    admin: 'Панель адміністратора',
    mentorPanel: 'Панель ментора',
    more: 'Більше',
    logout: 'Вийти',
  },
};

// Shared, theme-aware header for content pages that don't have their own
// full custom nav (the homepage's is inline/bespoke and left untouched) —
// logo/home link, language switcher, dark-mode toggle, auth buttons.
export default function SiteHeader() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  // MARKETPLACE_CATEGORIES.value only ever carries ka/en fields — it's the
  // literal ?category= filter value, which must match DigitalProduct.category
  // exactly as sellers type it (ka or en, never de/es/fr/uk), so category
  // links always resolve through this ka/en-only pair regardless of `lang`.
  const catLocale = lang === 'ka' ? 'ka' : 'en';
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
  // Mentor role or any admin-team member (SUPER_ADMIN/MANAGER — user.adminRole,
  // same convention as the Admin Panel link below) — the sessions list at
  // /dashboard/mentorship-sessions shows "with student" rows for mentors and
  // "with mentor" rows for everyone else, so it's meaningful for both.
  const canSeeMentorPanel = isAuthenticated && (user?.role === 'Mentor' || !!user?.adminRole);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0e1422]/90 backdrop-blur-md px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 lg:gap-2 xl:gap-3">
        <Link href="/" className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 shrink-0 no-underline text-current">
          <Image src="/images/cdc-logo.png" alt="CDC" width={40} height={40} className="h-9 w-auto rounded-xl object-cover" />
          <span className="hidden sm:inline font-bold text-xs xl:text-sm tracking-wide text-slate-900 dark:text-white">CDC</span>
        </Link>

        {/* The nav-links block below is sized to genuinely fit (tight gap +
            a small text size) rather than relying on overflow-hidden to
            clip it — overflow-hidden here previously also clipped the
            About/Marketplace dropdown panels, which are absolutely-
            positioned descendants that extend below the row. The actions
            group at the end (lang/theme/login/burger) stays shrink-0 so
            it's always fully visible regardless of how long the KA nav
            labels get. Bumped text-xs -> text-xs xl:text-sm for Georgian legibility;
            still just as reliant on that tight gap/shrink-0 layout as
            before, watch this row first if a future viewport ever needs
            the nav links to fit tighter again. */}
        <div className="flex items-center gap-1 lg:gap-2 xl:gap-3 sm:gap-1 lg:gap-2 xl:gap-3 min-w-0">
          <div className="hidden md:flex items-center gap-1 lg:gap-2 xl:gap-3 lg:gap-1 lg:gap-2 xl:gap-3 text-xs xl:text-sm font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
            {/* Community/Mentors/MentorPanel/About all collapsed into one
                "More" dropdown (same hover-dropdown mechanics as
                Marketplace/About already used below) instead of sitting as
                separate always-visible items — at viewports between the
                md breakpoint and ~1440px, the previous flat list of ~6-7
                items plus the Marketplace/About dropdown triggers could
                add up to wider than the space actually available between
                the logo and the shrink-0 actions cluster, overflowing the
                row horizontally and pushing the avatar/actions off-screen
                under the scrollbar. Only Marketplace and Tools (this
                site's two primary traffic drivers) stay always-visible. */}
            <div className="relative group py-2 -my-2">
              <button type="button" className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1 lg:gap-2 xl:gap-3 bg-transparent border-none cursor-pointer font-bold text-xs xl:text-sm p-0 text-inherit">
                {t.more}
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute left-0 top-full pt-2 w-56 z-[60] opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150">
                <div className="rounded-xl border shadow-lg shadow-cyan-500/5 overflow-hidden text-xs xl:text-sm bg-white/95 backdrop-blur-md border-slate-200 dark:bg-[#0e1422]/95 dark:border-white/10">
                  <Link href="/community" className="block px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    {t.community}
                  </Link>
                  <Link href="/mentors" className="flex items-center gap-1 lg:gap-2 xl:gap-3 px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <Users className="w-4 h-4 shrink-0" />
                    {t.mentors}
                  </Link>
                  {canSeeMentorPanel && (
                    <Link
                      href="/dashboard/mentorship-sessions"
                      className="flex items-center gap-1 lg:gap-2 xl:gap-3 px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <CalendarClock className="w-4 h-4 shrink-0" />
                      {t.mentorPanel}
                    </Link>
                  )}
                  {!(isAuthenticated && user) && (
                    <>
                      <Link href="/about" className="block px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                        {t.about}
                      </Link>
                      <Link href="/gallery" className="flex items-center gap-1 lg:gap-2 xl:gap-3 px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                        <GalleryHorizontal className="w-4 h-4 shrink-0" />
                        {t.gallery}
                      </Link>
                    </>
                  )}
                  <Link href="/tutorials" className="flex items-center gap-1 lg:gap-2 xl:gap-3 px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <PlayCircle className="w-4 h-4 shrink-0" />
                    {t.tutorials}
                  </Link>
                </div>
              </div>
            </div>
            <div className="relative group py-2 -my-2">
              <Link
                href="/marketplace"
                className="no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1 lg:gap-2 xl:gap-3"
              >
                {t.marketplace}
                <ChevronDown className="w-3 h-3" />
              </Link>
              <div className="absolute left-0 top-full pt-2 w-64 z-[60] opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150">
                <div className="rounded-xl border shadow-lg shadow-cyan-500/5 overflow-hidden text-xs xl:text-sm bg-white/95 backdrop-blur-md border-slate-200 dark:bg-[#0e1422]/95 dark:border-white/10">
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t.categories}</p>
                  {MARKETPLACE_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.value.en}
                      href={`/marketplace?category=${encodeURIComponent(cat.value[catLocale])}`}
                      className="block px-4 py-2.5 no-underline text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      {cat.value[catLocale]}
                    </Link>
                  ))}
                  <Link
                    href="/marketplace"
                    className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 px-4 py-2.5 no-underline font-bold text-cyan-600 dark:text-cyan-400 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {t.viewAllProducts}
                  </Link>
                </div>
              </div>
            </div>
            {/* Visible to every visitor/role — Students/Mentors should be
                able to see and browse what's on offer here even though
                the tools themselves are still Business-account-gated (see
                tools.tsx's own canUseAiAssistant check and its "Business
                Verification Required"/"Available for Business Accounts
                Only" modals, both left fully intact). This is a
                visibility fix, not a paywall removal — actually using a
                tool still requires the same verification it always did. */}
            <Link href="/tools" className="relative no-underline hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1 lg:gap-2 xl:gap-3.5">
              {t.tools}
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse">
                HOT
              </span>
            </Link>
          </div>

          {/* Actions cluster — deliberately shrink-0 (see the comment on
              this row's parent) so language/theme/login/burger are always
              fully rendered, never the thing that gets clipped when the KA
              nav labels above run long. Order left-to-right: Language,
              Theme, Bell (authenticated only), Login (mobile-only compact
              pill, guests only — desktop guests get the same login button
              via UserMenu's loginFallback below), Burger. */}
          <div className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 sm:gap-1 lg:gap-2 xl:gap-3 shrink-0">
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
            {/* Was `hidden md:block` — on mobile that left a logged-in user
                with NO visible profile entry point in the header row at all
                (their avatar only ever appeared after opening the hamburger
                drawer below). UserMenu's own avatar-only-on-narrow-screens
                sizing (name is `hidden sm:inline`) already made it compact
                enough to sit directly in the actions cluster on every
                viewport, same as the bell — it just hadn't been un-hidden. */}
            <UserMenu
              loginFallback={
                <button type="button" onClick={() => openAuthModal()} className="vip-btn-secondary !px-4 !py-2 hidden md:inline-flex">
                  👤 {t.login}
                </button>
              }
            />
            {!isAuthenticated && (
              <button type="button" onClick={() => openAuthModal()} className="vip-btn-secondary md:hidden !px-3 !py-2 whitespace-nowrap">
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
              className="flex items-center gap-1 lg:gap-2 xl:gap-3 px-2 pb-4 no-underline text-current"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs xl:text-sm font-black text-slate-400">{(user.name ?? '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="text-xs xl:text-sm font-bold text-slate-900 dark:text-white">{user.name}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openAuthModal();
              }}
              className="w-full mb-4 text-xs xl:text-sm font-bold px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-transparent cursor-pointer"
            >
              👤 {t.login}
            </button>
          )}

          <div className="flex flex-col gap-1 lg:gap-2 xl:gap-3 text-xs xl:text-sm font-bold text-slate-700 dark:text-slate-300">
            <Link href="/community" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {t.community}
            </Link>
            <Link href="/mentors" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {t.mentors}
            </Link>
            <Link href="/marketplace" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {t.marketplace}
            </Link>
            <div className="pl-4 flex flex-col gap-1 lg:gap-2 xl:gap-3.5">
              {MARKETPLACE_CATEGORIES.map((cat) => (
                <Link
                  key={cat.value.en}
                  href={`/marketplace?category=${encodeURIComponent(cat.value[catLocale])}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="no-underline px-2 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {cat.value[catLocale]}
                </Link>
              ))}
            </div>
            {/* Same visibility-for-everyone fix as the desktop nav above —
                the tools themselves stay Business-account-gated inside
                tools.tsx. */}
            <Link href="/tools" onClick={() => setMobileMenuOpen(false)} className="no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              {t.tools}
            </Link>
            <Link href="/tutorials" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1 lg:gap-2 xl:gap-3 no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <PlayCircle className="w-4 h-4 shrink-0" />
              {t.tutorials}
            </Link>
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
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <LayoutDashboard className="w-4 h-4" /> {t.dashboard}
                </Link>
                <Link href="/dashboard?tab=courses" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <GraduationCap className="w-4 h-4" /> {t.myCourses}
                </Link>
                {canSeeMentorPanel && (
                  <Link
                    href="/dashboard/mentorship-sessions"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 no-underline px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <CalendarClock className="w-4 h-4" /> {t.mentorPanel}
                  </Link>
                )}
                {user.adminRole && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 no-underline px-2 py-2.5 rounded-lg text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ShieldCheck className="w-4 h-4" /> {t.admin}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleMobileLogout}
                  className="flex items-center gap-1 lg:gap-2 xl:gap-3.5 text-left px-2 py-2.5 rounded-lg border-none bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
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
