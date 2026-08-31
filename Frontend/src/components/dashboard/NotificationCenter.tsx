import { useNotificationContext } from '@/src/context/NotificationContext';
import { ReactComponent as VipBadgeIcon } from '@/src/assets/icons/vip-badge-icon.svg';

export default function NotificationCenter() {
  const { notifications, markAllAsRead } = useNotificationContext();

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Notifications</h3>
        <button
          onClick={markAllAsRead}
          className="text-sm text-blue-500 hover:underline"
        >
          Mark all as read
        </button>
      </div>
      <ul className="space-y-3">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
          >
            {notification.isVip && <VipBadgeIcon className="w-5 h-5 text-yellow-500" />}
            <div>
              <p className="text-sm font-medium">{notification.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {notification.message}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {notification.timeAgo}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
