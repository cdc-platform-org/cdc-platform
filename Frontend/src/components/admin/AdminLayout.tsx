import { ReactNode, useLayoutEffect, useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Scale,
  GraduationCap,
  ShieldAlert,
  MessageSquare,
  PenTool,
  Image as ImageIcon,
  Building2,
  ClipboardList,
  FileText,
  BarChart3,
  CreditCard,
  Landmark,
  Wallet,
  Percent,
  Lock,
  ShieldCheck,
  Tag,
  Award,
  UsersRound,
  Layers,
  BrainCircuit,
  Bell,
  ShoppingBag,
  Bug,
  UserCheck,
  PlayCircle,
  Radar,
  Megaphone,
  ShieldBan,
  Star,
  Wrench,
  Sparkles,
  UserCog,
  KeyRound,
  Video,
  Bot,
  Gauge,
  Languages,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminLangProvider, useAdminLang } from '../../context/AdminLangContext';
import { adminDict } from '../../data/adminDict';
import { getSidebarBadgeCounts, markSidebarSectionSeen, AdminSidebarBadgeCounts, AdminSeenSection } from '../../services/adminPanelService';

// RED = action required (a queue only a human decision can clear — pending
// applications/verifications/waitlist signups). BLUE = new
// registrations/leads (informational, clears itself once the admin visits
// the section — see AdminSeenSection). YELLOW = moderation/review queue
// (published content waiting on a moderation decision).
type BadgeColor = 'red' | 'blue' | 'yellow';
const BADGE_COLOR_CLASS: Record<BadgeColor, string> = {
  red: 'bg-red-500 text-white',
  blue: 'bg-sky-500 text-white',
  yellow: 'bg-amber-400 text-slate-900',
};

interface NavItem {
  href: string;
  labelKey: keyof typeof adminDict.en.nav;
  icon: typeof LayoutDashboard;
  tiers?: ('SUPER_ADMIN' | 'MANAGER' | 'MODERATOR')[]; // omit = visible to any admin-team member
  section: keyof typeof adminDict.en.navSections;
  // Pending-count badge sourced from GET /admin-panel/sidebar-badges — omit
  // for every nav item that has no "needs attention now" queue.
  badgeKey?: keyof AdminSidebarBadgeCounts;
  badgeColor?: BadgeColor; // defaults to 'red' when badgeKey is set
  // Set only for a BLUE (time-based "new since I last looked") badge —
  // visiting this href calls POST .../sidebar-badges/seen with this section
  // so the badge clears on the next poll. Omit for RED/YELLOW badges, which
  // are status-based and clear themselves once the underlying row is acted
  // on (no seen-state needed).
  seenSection?: AdminSeenSection;
}

// Grouped to mirror the public site's own menu (src/data/siteNavigation.ts:
// სწავლა · AI ხელსაწყოები · მაღაზია · კარიერა · ბლოგი · ჩვენ შესახებ), plus the
// admin-only areas (people, moderation, finance, system). Every admin page
// that renders inside AdminLayout has exactly one entry here; nested pages
// (e.g. /admin/live-trainings/[id]/leads) highlight their parent entry.
const NAV_ITEMS: NavItem[] = [
  // Overview
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard, section: 'overview' },
  { href: '/admin/analytics', labelKey: 'analytics', icon: BarChart3, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'overview' },

  // Users & verification
  { href: '/admin/users', labelKey: 'users', icon: Users, section: 'people' },
  { href: '/admin/companies', labelKey: 'companies', icon: ShieldCheck, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'people', badgeKey: 'businessVerifications' },
  { href: '/admin/candidate-verifications', labelKey: 'candidateVerifications', icon: UserCheck, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'people' },
  { href: '/admin/mentor-applications', labelKey: 'mentorApplications', icon: UserCheck, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'people', badgeKey: 'pendingMentorApplications' },
  { href: '/admin/trainers', labelKey: 'trainers', icon: UserCog, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'people' },
  { href: '/admin/access-grants', labelKey: 'accessGrants', icon: KeyRound, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'people' },

  // Learning (site: სწავლა)
  { href: '/admin/courses', labelKey: 'courses', icon: GraduationCap, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning', badgeKey: 'newCourseEnrollments', badgeColor: 'blue', seenSection: 'courses' },
  { href: '/admin/course-moderation', labelKey: 'courseModeration', icon: ClipboardList, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning', badgeKey: 'pendingCourseReviews', badgeColor: 'yellow' },
  { href: '/admin/live-trainings', labelKey: 'liveTrainings', icon: Video, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning', badgeKey: 'newLiveTrainingLeads', badgeColor: 'blue', seenSection: 'liveTrainings' },
  { href: '/admin/assignments', labelKey: 'assignments', icon: FileText, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning' },
  { href: '/admin/mentorship', labelKey: 'mentorship', icon: GraduationCap, section: 'learning' },
  { href: '/admin/certificates/issue', labelKey: 'certificates', icon: Award, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning' },
  { href: '/admin/tutorials', labelKey: 'tutorials', icon: PlayCircle, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning' },
  { href: '/admin/tutor', labelKey: 'tutor', icon: BrainCircuit, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning' },
  { href: '/admin/iako/profiles', labelKey: 'iakoProfiles', icon: Bot, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning' },
  { href: '/admin/iako/usage', labelKey: 'iakoUsage', icon: Gauge, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'learning' },

  // AI tools & store (site: AI ხელსაწყოები, მაღაზია)
  { href: '/admin/tools', labelKey: 'toolsCms', icon: Wrench, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'tools' },
  { href: '/admin/products', labelKey: 'products', icon: ShoppingBag, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'tools', badgeKey: 'pendingProducts' },
  { href: '/admin/product-reviews', labelKey: 'productReviews', icon: Star, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'tools' },
  { href: '/admin/cyber-sentinel', labelKey: 'cyberSentinel', icon: Bug, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'tools', badgeKey: 'waitlistEntries', seenSection: 'waitlist' },

  // Career & gigs (site: კარიერა)
  { href: '/admin/gigs', labelKey: 'gigs', icon: Briefcase, section: 'career' },
  { href: '/admin/disputes', labelKey: 'disputes', icon: Scale, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'career' },
  { href: '/admin/opportunities', labelKey: 'opportunities', icon: Radar, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'career' },

  // Site content (site: მთავარი, ბლოგი, ჩვენ შესახებ)
  { href: '/admin/cms/homepage', labelKey: 'cms', icon: PenTool, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },
  { href: '/admin/blog', labelKey: 'blog', icon: FileText, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },
  { href: '/admin/success-stories', labelKey: 'successStories', icon: Award, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },
  { href: '/admin/team-trainers', labelKey: 'teamTrainers', icon: UsersRound, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },
  { href: '/admin/projects', labelKey: 'projects', icon: Sparkles, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },
  { href: '/admin/cms/gallery', labelKey: 'gallery', icon: ImageIcon, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },
  { href: '/admin/bot-knowledge', labelKey: 'botKnowledge', icon: BrainCircuit, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },
  { href: '/admin/marketing', labelKey: 'marketing', icon: Megaphone, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'content' },

  // CDC Studio (agency)
  { href: '/admin/studio', labelKey: 'studio', icon: ClipboardList, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'studio', badgeKey: 'studioInquiries' },
  { href: '/admin/cms/agency', labelKey: 'agencyCms', icon: Building2, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'studio' },
  { href: '/admin/studio-cases', labelKey: 'studioCases', icon: Layers, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'studio' },

  // Communication & moderation
  { href: '/admin/notifications', labelKey: 'notifications', icon: Bell, section: 'moderation' },
  { href: '/admin/messages', labelKey: 'messages', icon: ShieldAlert, section: 'moderation' },
  { href: '/admin/chat-moderation', labelKey: 'chatModeration', icon: ShieldBan, tiers: ['SUPER_ADMIN', 'MANAGER', 'MODERATOR'], section: 'moderation', badgeKey: 'highSeverityChatFlags' },
  { href: '/admin/forum', labelKey: 'forum', icon: MessageSquare, section: 'moderation', badgeKey: 'reportedForumPosts', badgeColor: 'yellow' },

  // Finance
  { href: '/admin/finance', labelKey: 'finance', icon: CreditCard, tiers: ['SUPER_ADMIN'], section: 'financial' },
  { href: '/admin/financials', labelKey: 'financials', icon: Wallet, tiers: ['SUPER_ADMIN'], section: 'financial' },
  { href: '/admin/finance/payouts', labelKey: 'payouts', icon: Landmark, tiers: ['SUPER_ADMIN'], section: 'financial' },
  { href: '/admin/commissions', labelKey: 'commissions', icon: Percent, tiers: ['SUPER_ADMIN'], section: 'financial' },
  { href: '/admin/promos', labelKey: 'promos', icon: Tag, tiers: ['SUPER_ADMIN', 'MANAGER'], section: 'financial' },

  // System
  { href: '/admin/team', labelKey: 'team', icon: Lock, tiers: ['SUPER_ADMIN'], section: 'admin' },
  { href: '/admin/i18n', labelKey: 'i18n', icon: Languages, tiers: ['SUPER_ADMIN'], section: 'admin' },
];

const SECTION_ORDER: (keyof typeof adminDict.en.navSections)[] = [
  'overview',
  'people',
  'learning',
  'tools',
  'career',
  'content',
  'studio',
  'moderation',
  'financial',
  'admin',
];

// The nav entry for the current page: exact match, otherwise the longest
// entry whose href is a path prefix (so /admin/live-trainings/[id]/leads
// highlights "Live Trainings", while /admin/finance/payouts keeps its own).
function activeHref(pathname: string): string | undefined {
  let best: string | undefined;
  for (const item of NAV_ITEMS) {
    const h = item.href;
    if (pathname === h || (h !== '/admin' && pathname.startsWith(`${h}/`))) {
      if (!best || h.length > best.length) best = h;
    }
  }
  return best;
}

const TIER_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
  MANAGER: 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white',
  MODERATOR: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
};

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lang, toggleLang } = useAdminLang();
  const t = adminDict[lang];

  // Quick filter over the menu (matches the label in either language).
  const [navQuery, setNavQuery] = useState('');
  const q = navQuery.trim().toLowerCase();
  const currentHref = activeHref(router.pathname);
  const visibleNav = NAV_ITEMS.filter((item) => !item.tiers || (user?.adminRole && item.tiers.includes(user.adminRole))).filter(
    (item) => !q || adminDict.ka.nav[item.labelKey].toLowerCase().includes(q) || adminDict.en.nav[item.labelKey].toLowerCase().includes(q),
  );
  const groupedNav = SECTION_ORDER.map((section) => ({
    section,
    items: visibleNav.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);

  // Polled independently of the rest of the sidebar (60s, same interval as
  // NotificationBell.tsx's identical pattern) rather than passed down as a
  // prop — nothing above AdminLayout persists across an /admin/* route
  // change (see the sidebar-scroll comment below), so this has to refetch
  // itself on every mount regardless. The count is a live server-side
  // query each time (see adminPanel.ts's /sidebar-badges), so a badge
  // simply disappears/shrinks on the next poll once an admin resolves the
  // underlying item — no client-side decrement bookkeeping needed here.
  const [badgeCounts, setBadgeCounts] = useState<AdminSidebarBadgeCounts | null>(null);
  const loadBadgeCounts = useCallback(() => {
    getSidebarBadgeCounts()
      .then(setBadgeCounts)
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadBadgeCounts();
    const timer = setInterval(loadBadgeCounts, 60000);
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) loadBadgeCounts();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [loadBadgeCounts]);

  // Visiting a BLUE-badged section's own page marks it seen — the next
  // badgeCounts poll (up to 60s later) then shows 0 for it. Keyed off
  // router.pathname (not mount) since AdminLayout remounts on every /admin/*
  // navigation anyway (see the sidebar-scroll comment below).
  useEffect(() => {
    const item = NAV_ITEMS.find((i) => i.href === router.pathname && i.seenSection);
    if (!item?.seenSection) return;
    markSidebarSectionSeen(item.seenSection)
      .then(loadBadgeCounts)
      .catch(() => {});
  }, [router.pathname, loadBadgeCounts]);

  // Each admin page mounts its own <AdminLayout>, so this <aside> is torn
  // down and rebuilt on every route change — losing its scrollTop even
  // though `scroll={false}` on the nav links already stops the outer page
  // from jumping. Persist scrollTop to sessionStorage (survives the
  // unmount/remount) and restore it before paint on the next mount.
  const sidebarRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem('cdc-admin-sidebar-scroll');
    if (saved) el.scrollTop = parseInt(saved, 10);
    const onScroll = () => sessionStorage.setItem('cdc-admin-sidebar-scroll', String(el.scrollTop));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-[#0b0f19] transition-colors">
      {/* SIDEBAR — sticky + independently scrolling so navigating (or a long
          nav list) never yanks the whole page's scroll position back to top. */}
      <aside
        ref={sidebarRef}
        className="w-64 shrink-0 h-screen sticky top-0 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 text-slate-200 flex flex-col"
      >
        <div className="px-6 py-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/40 blur-lg rounded-lg" aria-hidden="true" />
              <div className="relative bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-3 py-1.5 rounded-lg font-black text-sm tracking-wider shadow-lg">
                CDC
              </div>
            </div>
            <span className="font-bold text-sm tracking-wide">{t.chrome.adminPanel}</span>
          </div>
          {user?.adminRole && (
            <span
              className={`inline-block mt-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${TIER_BADGE[user.adminRole]}`}
            >
              {user.adminRole.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="px-3 pt-4">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder={lang === 'ka' ? 'მენიუში ძებნა…' : 'Search menu…'}
              aria-label={lang === 'ka' ? 'მენიუში ძებნა' : 'Search menu'}
              className="w-full rounded-lg bg-slate-800/70 border border-slate-700 pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5">
          {groupedNav.length === 0 && <p className="px-3 text-xs text-slate-500">{t.common.noResults}</p>}
          {groupedNav.map(({ section, items }) => (
            <div key={section}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {t.navSections[section]}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = currentHref === item.href;
                  const Icon = item.icon;
                  const badgeCount = item.badgeKey ? badgeCounts?.[item.badgeKey] : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      scroll={false}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium no-underline transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-600/20 text-white border border-cyan-500/30 shadow-[0_0_16px_rgba(34,211,238,0.15)]'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 min-w-0">{t.nav[item.labelKey]}</span>
                      {!!badgeCount && (
                        <span
                          className={`shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-black ${
                            BADGE_COLOR_CLASS[item.badgeColor ?? 'red']
                          }`}
                        >
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-5 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-black text-white">
              {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
          </div>
          {/* Prominent, real button (not the small text link this used to
              be) — the "exit admin chrome, browse as a regular user"
              affordance. AdminModeBar (rendered globally in _app.tsx)
              is the way back once here. */}
          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 w-full text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 rounded-lg px-3 py-2.5 no-underline transition-opacity"
          >
            {t.chrome.backToSite}
          </Link>
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => { logout(); router.push('/'); }}
              className="text-xs font-medium text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer"
            >
              {t.chrome.logout}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TOPBAR */}
        <header className="h-14 shrink-0 sticky top-0 z-10 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-[#0e1422]/80 backdrop-blur-md flex items-center justify-end px-6 transition-colors">
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden text-xs font-bold">
            <button
              type="button"
              onClick={() => lang !== 'ka' && toggleLang()}
              className={`px-3 py-1.5 border-none cursor-pointer transition-colors ${
                lang === 'ka' ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-900/60 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              KA
            </button>
            <button
              type="button"
              onClick={() => lang !== 'en' && toggleLang()}
              className={`px-3 py-1.5 border-none cursor-pointer transition-colors ${
                lang === 'en' ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-900/60 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              EN
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminLangProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminLangProvider>
  );
}
