import { useSyncExternalStore } from 'react';
import { currentNotifications, dismiss, subscribe } from './notifications';

/** Стопка уведомлений приложения в углу страницы. */
export function NotificationsViewport() {
  const notifications = useSyncExternalStore(subscribe, currentNotifications);

  return (
    <div className="app-toasts" role="region" aria-label="Уведомления приложения">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          role="status"
          className={`app-toast app-toast--${notification.kind}`}
          data-app-toast={notification.kind}
        >
          <span>{notification.text}</span>
          <button
            type="button"
            className="app-toast__close"
            aria-label="Закрыть уведомление"
            onClick={() => {
              dismiss(notification.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
