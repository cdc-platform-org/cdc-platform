import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { AdminLangProvider, useAdminLang } from '../../context/AdminLangContext';
import { adminDict } from '../../data/adminDict';

interface NavItem {
  href: string;
  labelKey: keyof typeof adminDict.en.nav;
  icon: string;
  tiers?: ('SUPER_ADMIN' | 'MANAGER' | 'MODERATOR')[]; // omit = visible to any admin-team member
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', labelKey: 'dashboard', icon: '📊' },
  { href: '/admin/users', labelKey: 'users', icon: '👥' },
  { href: '/admin/gigs', labelKey: 'gigs', icon: '💼' },
  { href: '/admin/disputes', labelKey: 'disputes', icon: '⚖️', tiers: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/admin/mentorship', labelKey: 'mentorship', icon: '🧑‍🏫' },
  { href: '/admin/messages', labelKey: 'messages', icon: '🛡️' },
  { href: '/admin/forum', labelKey: 'forum', icon: '💬' },
  { href: '/admin/cms/homepage', labelKey: 'cms', icon: '🖋️', tiers: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/admin/cms/gallery', labelKey: 'gallery', icon: '🖼️', tiers: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/admin/blog', labelKey: 'blog', icon: '📝', tiers: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/admin/courses', labelKey: 'courses', icon: '🎓', tiers: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/admin/analytics', labelKey: 'analytics', icon: '📈', tiers: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/admin/finance', labelKey: 'finance', icon: '💳', tiers: ['SUPER_ADMIN'] },
  { href: '/admin/finance/payouts', labelKey: 'payouts', icon: '🏦', tiers: ['SUPER_ADMIN'] },
  { href: '/admin/financials', labelKey: 'financials', icon: '💰', tiers: ['SUPER_ADMIN'] },
  { href: '/admin/team', labelKey: 'team', icon: '🔐', tiers: ['SUPER_ADMIN'] },
];

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

  const visibleNav = NAV_ITEMS.filter((item) => !item.tiers || (user?.adminRole && item.tiers.includes(user.adminRole)));

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* SIDEBAR */}
      <aside className="w-64 shrink-0 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-200 flex flex-col">
        <div className="px-6 py-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-3 py-1.5 rounded-lg font-black text-sm tracking-wider">
              CDC
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

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium no-underline transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-600/20 text-white border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {t.nav[item.labelKey]}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-5 border-t border-slate-800 space-y-3">
          <div className="text-xs text-slate-400 truncate">{user?.email}</div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs font-medium text-slate-400 hover:text-white no-underline">
              {t.chrome.backToSite}
            </Link>
            <button
              type="button"
              onClick={logout}
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
        <header className="h-14 shrink-0 border-b border-gray-200 bg-white flex items-center justify-end px-6">
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
            <button
              type="button"
              onClick={() => lang !== 'ka' && toggleLang()}
              className={`px-3 py-1.5 border-none cursor-pointer transition-colors ${
                lang === 'ka' ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              KA
            </button>
            <button
              type="button"
              onClick={() => lang !== 'en' && toggleLang()}
              className={`px-3 py-1.5 border-none cursor-pointer transition-colors ${
                lang === 'en' ? 'bg-slate-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
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
