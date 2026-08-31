import { useEffect, useState } from 'react';
import { useNotificationContext } from '@/src/context/NotificationContext';

<nav className="flex items-center justify-center gap-5 mx-auto text-xs lg:text-sm font-medium">
import { ReactComponent as HomeIcon } from '@/src/assets/icons/home-icon.svg';
import { ReactComponent as ProfileIcon } from '@/src/assets/icons/profile-icon.svg';
import { ReactComponent as SettingsIcon } from '@/src/assets/icons/settings-icon.svg';
import { ReactComponent as BellIcon } from '@/src/assets/icons/bell-icon.svg';

function NotificationBell() {
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
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount}
        </span>
      )}
    </div>
  );
}
