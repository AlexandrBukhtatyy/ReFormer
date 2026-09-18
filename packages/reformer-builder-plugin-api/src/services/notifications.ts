/**
 * Уведомления: ключ сообщения, уровень и действия — а не готовая фраза.
 *
 * Здесь ОБЪЯВЛЕНИЕ. Очередь и её показ живут в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/services/notifications
 */

import type { Disposable } from '../primitives/disposable.js';
import { defineService } from '../primitives/service.js';

/** Уровень тоста. Определяет вид и озвучку для скринридера, но не поведение очереди. */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

/** Необязательное действие: одна кнопка на тосте. */
export interface NotificationAction {
  /** Ключ i18n подписи кнопки. */
  readonly titleKey: string;
  /** Что сделать по нажатию. Закрытие тоста — дело отрисовки, здесь только действие. */
  run(): void;
}

/** Что просят показать. */
export interface NotificationRequest {
  /** По умолчанию `info`. */
  readonly level?: NotificationLevel;
  /** Ключ i18n сообщения. */
  readonly messageKey: string;
  readonly params?: Record<string, unknown>;
  readonly action?: NotificationAction;
  /** Подсказка отрисовке, сколько держать тост. Без значения решает отрисовка. */
  readonly durationMs?: number;
}

/** Уведомление в очереди: запрос плюс выданный идентификатор, с проставленным уровнем. */
export interface Notification extends NotificationRequest {
  readonly id: string;
  readonly level: NotificationLevel;
}

/** Ссылка на показанное уведомление — чтобы снять его до того, как истечёт время. */
export interface NotificationHandle {
  readonly id: string;
  dismiss(): void;
}

/** Настройки одного уровня — всё, кроме самого уровня и сообщения. */
export type NotificationOptions = Omit<NotificationRequest, 'messageKey' | 'level'>;

export interface NotificationsService {
  show(request: NotificationRequest): NotificationHandle;
  info(messageKey: string, options?: NotificationOptions): NotificationHandle;
  success(messageKey: string, options?: NotificationOptions): NotificationHandle;
  warning(messageKey: string, options?: NotificationOptions): NotificationHandle;
  error(messageKey: string, options?: NotificationOptions): NotificationHandle;
  /**
   * Очередь не показанных уведомлений в порядке поступления.
   *
   * Между изменениями возвращает **ту же** ссылку: снимок читает `useSyncExternalStore`,
   * который на новом массиве при каждом вызове падает с «The result of getSnapshot should
   * be cached».
   */
  pending(): readonly Notification[];
  /** Снимает уведомление из очереди. Неизвестный идентификатор — не ошибка. */
  dismiss(id: string): void;
  /** Очередь изменилась: добавили или сняли. */
  observe(cb: () => void): Disposable;
}

export const NotificationsServiceToken =
  defineService<NotificationsService>('reformer.notifications');
