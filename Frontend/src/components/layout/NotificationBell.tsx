import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyNotifications, markNotificationRead, AppNotification } from '../../services/notificationService';

const EMPTY_LABEL: Record<string, string> = { ka: 'შეტყობინებები არ არის', en: 'No notifications' };

// One-way admin -> user notifications (sent from /admin/notifications) —
// deliberately no reply affordance. Polls every 60s so the badge updates
// without the user needing to refresh the page.
export default function NotificationBell() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getMyNotifications()
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
    const timer = setInterval(load, 60000);
    // See useAuth.ts's own pageshow listener — a bfcache-restored page
    // (Back/Forward nav) resumes this exact timer instead of re-running it,
    // so the badge could otherwise sit stale for up to 60s after a restore.
    // Refetching immediately on a real bfcache restore keeps it current
    // without polling any more aggressively on a normal page.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) load();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isAuthenticated, load]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    router.push(`/dashboard/notifications?id=${n.id}`);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
        className="relative p-2 rounded-xl transition border-none bg-transparent cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0e1422] shadow-xl py-1 z-50"
        >
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-xs text-slate-400 text-center">{EMPTY_LABEL.ka}</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`block w-full text-left px-4 py-3 border-b last:border-0 border-slate-100 dark:border-slate-800 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  !n.isRead ? 'bg-cyan-50/60 dark:bg-cyan-950/20' : ''
                }`}
              >
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{n.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
