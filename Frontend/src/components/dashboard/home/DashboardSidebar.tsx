/**
 * Left-hand navigation of /dashboard. Grouped the way people think about
 * their account: learning, what they bought / use, money, workspace and
 * account settings. 2026-11 redesign: cdc-* tokens, violet active item. "tab" items switch the panel in place; "link" items go
 * to their own /dashboard/* pages. Entries hidden for a user are `false`
 * in the list and filtered out; an empty section is not rendered.
 */
import Link from 'next/link';
import {
  Award,
  Briefcase,
  CalendarClock,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Sparkles,
  Store,
  Users,
  Video,
  Wallet,
  Wifi,
} from 'lucide-react';
import { User } from '../../../types/auth';
import { SupportedLocale } from '../../../utils/locale';
import { DashboardStrings } from './dashboardDict';
import { DashboardTab } from './dashboardShared';

type SideItem =
  | { kind: 'tab'; key: DashboardTab; label: string; icon: typeof LayoutDashboard; badge?: number }
  | { kind: 'link'; href: string; label: string; icon: typeof LayoutDashboard };

interface DashboardSidebarProps {
  t: DashboardStrings;
  lang: SupportedLocale;
  user: User | null | undefined;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  purchasesLabel: string;
  purchasesCount: number;
  /** Show "My gigs" (user has gigs, or signed up as talent). */
  showGigs: boolean;
  canSubmitProduct: boolean;
  isTrainer: boolean;
  onOpenMentorship: () => void;
  onLogout: () => void;
}

const sideItemClass = (active: boolean) =>
  `w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition border-none cursor-pointer no-underline ${
    active
      ? 'bg-cdc-primary text-white shadow-sm'
      : 'bg-transparent text-cdc-muted hover:text-cdc-ink hover:bg-cdc-bg'
  }`;

export default function DashboardSidebar({
  t,
  lang,
  user,
  activeTab,
  setActiveTab,
  purchasesLabel,
  purchasesCount,
  showGigs,
  canSubmitProduct,
  isTrainer,
  onOpenMentorship,
  onLogout,
}: DashboardSidebarProps) {
  const ka = lang === 'ka';
  const learningTitle = ka ? 'სწავლა' : 'Learning';
  const sections: { title: string | null; items: (SideItem | false)[] }[] = [
    { title: null, items: [{ kind: 'tab', key: 'overview', label: t.tabOverview, icon: LayoutDashboard }] },
    {
      title: learningTitle,
      items: [
        { kind: 'tab', key: 'courses', label: t.tabCourses, icon: GraduationCap },
        { kind: 'link', href: '/dashboard/passport', label: ka ? 'ციფრული პასპორტი' : 'Digital Skill Passport', icon: Award },
        { kind: 'link', href: '/dashboard/live-trainings', label: ka ? 'ლაივ ტრენინგები' : 'Live trainings', icon: Video },
        { kind: 'link', href: '/dashboard/mentorship-sessions', label: t.tabMentorshipSessions, icon: CalendarClock },
        { kind: 'link', href: '/dashboard/career-quiz', label: ka ? 'ჩემი კარიერული ტესტი' : 'My Career Test', icon: Award },
      ],
    },
    {
      title: ka ? 'შენაძენები და ხელსაწყოები' : 'Purchases & tools',
      items: [
        { kind: 'tab', key: 'purchases', label: purchasesLabel, icon: Receipt, badge: purchasesCount },
        { kind: 'link', href: '/dashboard/tools', label: ka ? 'ჩემი AI ხელსაწყოები' : 'My AI tools', icon: Sparkles },
      ],
    },
    {
      title: ka ? 'ფინანსები და გაყიდვები' : 'Money & selling',
      items: [
        { kind: 'tab', key: 'wallet', label: t.tabWallet, icon: Wallet },
        showGigs && { kind: 'tab', key: 'gigs', label: t.tabGigs, icon: Briefcase },
        canSubmitProduct && { kind: 'tab', key: 'products', label: ka ? 'ჩემი პროდუქტების გაყიდვა' : 'Sell products', icon: Store },
      ],
    },
    {
      title: ka ? 'სამუშაო სივრცე' : 'Workspace',
      items: [
        user?.role === 'Mentor' && { kind: 'link', href: '/dashboard/mentorship', label: t.mentorWorkspace, icon: Users },
        isTrainer && { kind: 'link', href: '/dashboard/trainer', label: ka ? 'ტრენერის პანელი' : 'Trainer Control Center', icon: GraduationCap },
      ],
    },
    {
      title: ka ? 'ანგარიში' : 'Account',
      items: [{ kind: 'link', href: '/dashboard/settings', label: t.tabSettings, icon: Settings }],
    },
  ];

  return (
    <nav className="order-last md:order-none md:sticky md:top-24 self-start min-w-0 rounded-card border border-cdc-border bg-cdc-surface shadow-card p-2.5 space-y-3">
      {sections.map((section, sectionIndex) => {
        const items = section.items.filter((item): item is SideItem => Boolean(item));
        if (items.length === 0) return null;
        return (
          <div key={section.title ?? sectionIndex} className="space-y-0.5">
            {section.title && (
              <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-cdc-muted/80">{section.title}</p>
            )}
            {items.map((item) => {
              const Icon = item.icon;
              if (item.kind === 'link') {
                return (
                  <Link key={item.href} href={item.href} className={sideItemClass(false)}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              }
              const active = activeTab === item.key;
              return (
                <button key={item.key} type="button" onClick={() => setActiveTab(item.key)} className={sideItemClass(active)}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className={`text-[11px] font-bold px-1.5 rounded ${active ? 'bg-white/20' : 'bg-cdc-primary-soft text-cdc-primary-ink'}`}>{item.badge}</span>
                  )}
                </button>
              );
            })}
            {/* Verified graduates get a "talk to a mentor" shortcut under Learning. */}
            {section.title === learningTitle && user?.isVerifiedGraduate && (
              <button type="button" onClick={onOpenMentorship} className={`${sideItemClass(false)} !text-cdc-primary-ink`}>
                <Wifi className="w-4 h-4 shrink-0" />
                <span className="flex-1">{t.mentorshipButton}</span>
              </button>
            )}
          </div>
        );
      })}
      <div className="border-t border-cdc-border pt-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-sm font-semibold bg-transparent border-none cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t.logout}
        </button>
      </div>
    </nav>
  );
}
