/**
 * Уведомления приложения — свои, без библиотек.
 *
 * Хранилище на уровне модуля, а не контекст: уведомление показывает и код вне React — например
 * отправка формы. Рисует их `NotificationsViewport`, который стоит в провайдерах приложения.
 *
 * @module notifications/notifications
 */

export type NotificationKind = 'success' | 'error';

export interface AppNotification {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly text: string;
}

/** Сколько уведомление живёт на экране. */
const LIFETIME_MS = 6000;

let shown: readonly AppNotification[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

const publish = (next: readonly AppNotification[]): void => {
  shown = next;
  for (const listener of listeners) listener();
};

export function dismiss(id: number): void {
  publish(shown.filter((notification) => notification.id !== id));
}

export function notify(text: string, kind: NotificationKind = 'success'): void {
  const id = nextId++;
  publish([...shown, { id, kind, text }]);
  setTimeout(() => {
    dismiss(id);
  }, LIFETIME_MS);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const currentNotifications = (): readonly AppNotification[] => shown;
