import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Bell, BellRing, ShieldCheck, Cpu, CheckCheck } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { getMyNotifications, markNotificationRead, AppNotification } from '../../src/services/notificationService';
import { resolveLocale } from '@/src/utils/locale';

const EN_STRINGS = {
  title: 'Notifications',
  subtitle: 'Everything the CDC team has sent you, in one place.',
  loading: 'Loading…',
  empty: 'No notifications yet.',
  emptyFiltered: 'No notifications match this filter.',
  tabAll: 'All',
  tabUnread: 'Unread',
  tabAdmin: 'Admin',
  tabSystem: 'System',
  markAllRead: 'Mark all as read',
  unreadBadge: 'New',
};

const dict = {
  ka: {
    title: 'შეტყობინებები',
    subtitle: 'ყველაფერი, რაც CDC-ის გუნდმა გამოგიგზავნათ — ერთ ადგილას.',
    loading: 'იტვირთება…',
    empty: 'შეტყობინებები ჯერ არ არის.',
    emptyFiltered: 'ამ ფილტრით შეტყობინება ვერ მოიძებნა.',
    tabAll: 'ყველა',
    tabUnread: 'წაუკითხავი',
    tabAdmin: 'ადმინისტრაცია',
    tabSystem: 'სისტემური',
    markAllRead: 'ყველას წაკითხულად მონიშვნა',
    unreadBadge: 'ახალი',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

type FilterTab = 'ALL' | 'UNREAD' | 'ADMIN' | 'SYSTEM';

// Free-form Notification.type values in this codebase collapse into two
// buckets for the ADMIN/SYSTEM tabs: a human admin manually sending one
// (ADMIN_DIRECT, the only type the admin-team compose form ever sets) vs.
// every automated one (PRODUCT_MODERATION, BUSINESS_KYC, LIVE_TRAINING,
// AI_AGENT, etc.) — anything that isn't ADMIN_DIRECT is System.
function isAdminType(type: string): boolean {
  return type === 'ADMIN_DIRECT';
}

function NotificationsContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const consumedDeepLink = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyNotifications();
      setNotifications(res.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Deep link from NotificationBell (?id=...) — expand that one card,
  // scroll it into view, and mark it read if it wasn't already. Only runs
  // once per page load (not on every notifications re-fetch) so it doesn't
  // keep re-scrolling the page back after the user's already moved on.
  const deepLinkId = typeof router.query.id === 'string' ? router.query.id : null;
  useEffect(() => {
    if (!deepLinkId || loading || consumedDeepLink.current) return;
    const target = notifications.find((n) => n.id === deepLinkId);
    if (!target) return;
    consumedDeepLink.current = true;
    setExpandedId(target.id);
    if (!target.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === target.id ? { ...n, isRead: true } : n)));
      markNotificationRead(target.id).catch(() => {});
    }
    requestAnimationFrame(() => highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [deepLinkId, loading, notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const visibleNotifications = useMemo(() => {
    switch (filter) {
      case 'UNREAD':
        return notifications.filter((n) => !n.isRead);
      case 'ADMIN':
        return notifications.filter((n) => isAdminType(n.type));
      case 'SYSTEM':
        return notifications.filter((n) => !isAdminType(n.type));
      default:
        return notifications;
    }
  }, [notifications, filter]);

  const handleToggle = (n: AppNotification) => {
    setExpandedId((prev) => (prev === n.id ? null : n.id));
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await Promise.all(unread.map((n) => markNotificationRead(n.id)));
    } finally {
      setMarkingAll(false);
    }
  };

  const TAB_ICON: Record<FilterTab, typeof Bell> = { ALL: Bell, UNREAD: BellRing, ADMIN: ShieldCheck, SYSTEM: Cpu };
  const TAB_LABEL: Record<FilterTab, string> = { ALL: t.tabAll, UNREAD: t.tabUnread, ADMIN: t.tabAdmin, SYSTEM: t.tabSystem };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Bell className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              {t.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 disabled:opacity-60"
            >
              <CheckCheck className="w-4 h-4" />
              {t.markAllRead}
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['ALL', 'UNREAD', 'ADMIN', 'SYSTEM'] as const).map((tab) => {
            const Icon = TAB_ICON[tab];
            const count = tab === 'UNREAD' ? unreadCount : undefined;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-full border transition-all duration-200 ${
                  filter === tab
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-transparent shadow-lg shadow-cyan-500/20'
                    : 'bg-white/90 dark:bg-slate-900/70 backdrop-blur-md text-slate-600 dark:text-slate-300 border-gray-200/80 dark:border-white/10 hover:border-cyan-400/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {TAB_LABEL[tab]}
                {count !== undefined && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === tab ? 'bg-white/25' : 'bg-red-500 text-white'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feed */}
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-12">{t.loading}</p>
        ) : visibleNotifications.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">{notifications.length === 0 ? t.empty : t.emptyFiltered}</p>
        ) : (
          <div className="space-y-3">
            {visibleNotifications.map((n) => {
              const isExpanded = expandedId === n.id;
              const isHighlighted = deepLinkId === n.id;
              return (
                <div
                  key={n.id}
                  ref={isHighlighted ? highlightedRef : undefined}
                  onClick={() => handleToggle(n)}
                  className={`group cursor-pointer rounded-2xl border backdrop-blur-md p-5 transition-all duration-300 ${
                    isHighlighted
                      ? 'border-cyan-400 shadow-[0_0_0_3px_rgba(34,211,238,0.25)]'
                      : 'border-gray-200/80 dark:border-white/10 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10'
                  } ${
                    !n.isRead
                      ? 'bg-cyan-50/70 dark:bg-cyan-950/30'
                      : 'bg-white/90 dark:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5 ${
                          isAdminType(n.type)
                            ? 'bg-gradient-to-tr from-cyan-500 to-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isAdminType(n.type) ? <ShieldCheck className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm ${!n.isRead ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-200'}`}>
                          {n.title}
                        </p>
                        <p
                          className={`text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed ${
                            isExpanded ? '' : 'line-clamp-2'
                          }`}
                        >
                          {n.message}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {!n.isRead && (
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-red-500 text-white">
                        {t.unreadBadge}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
