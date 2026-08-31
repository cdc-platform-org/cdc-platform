import { useEffect, useState } from 'react';
import { useNotificationContext } from '@/src/context/NotificationContext';

<nav className="flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-md fixed top-0 left-0 right-0 z-50 shadow-md">
import { ReactComponent as HomeIcon } from '@/src/assets/icons/home-icon.svg';
import { ReactComponent as ProfileIcon } from '@/src/assets/icons/profile-icon.svg';
import { ReactComponent as SettingsIcon } from '@/src/assets/icons/settings-icon.svg';
import { ReactComponent as BellIcon } from '@/src/assets/icons/bell-icon.svg';

function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="lg:hidden p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sr-only">{t('header.openMenu', 'Open menu')}</span>
        <svg
          className="w-6 h-6 text-gray-700 dark:text-gray-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </button>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
      )}
      <div
        className={`fixed top-0 left-0 w-64 bg-white dark:bg-gray-800 h-full z-50 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out`}
      >
        <button
          className="absolute top-4 right-4 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
          onClick={() => setIsOpen(false)}
        >
          <span className="sr-only">{t('header.closeMenu', 'Close menu')}</span>
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <nav className="mt-10 space-y-4">
          <a href="/" className="block px-4 py-2 text-gray-700 dark:text-gray-300">
            {t('header.home', 'Home')}
          </a>
          <a href="/profile" className="block px-4 py-2 text-gray-700 dark:text-gray-300">
            {t('header.profile', 'Profile')}
          </a>
          <a href="/settings" className="block px-4 py-2 text-gray-700 dark:text-gray-300">
            {t('header.settings', 'Settings')}
          </a>
        </nav>
      </div>
    </>
  );
}
  const { unreadCount } = useNotificationContext();
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    if (unreadCount > 0) {
      setGlow(true);
      const timeout = setTimeout(() => setGlow(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [unreadCount]);

  return (
    <div className={`relative ${glow ? 'animate-pulse' : ''}`}>
      <BellIcon className="w-6 h-6 text-gray-500 dark:text-gray-300" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
          aria-label={t('header.unreadNotifications', 'Unread notifications')}
        >
          {unreadCount}
        </span>
      )}
    </div>
  );
}
