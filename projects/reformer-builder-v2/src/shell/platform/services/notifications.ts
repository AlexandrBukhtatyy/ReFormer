/**
 * Уведомления — очередь тостов и ничего больше.
 *
 * **Почему служба, а не вызов `toast()` из кита.** Уведомляют все: Host при отказе источника,
 * плагин при неудачном действии, ассистент по итогу хода. Если каждый зовёт `sonner`
 * напрямую, то платформа зависит от библиотеки отрисовки в каждой второй точке, тесты
 * требуют DOM, а заменить отрисовку (или показать те же сообщения в другом месте — журнале,
 * панели) можно только правкой всех вызывающих. Здесь служба хранит очередь, а оболочка
 * на Э5 подписывается и рисует её тем, чем сочтёт нужным.
 *
 * **Сообщение — ключ и параметры, а не готовая строка.** То же соглашение, что у диагностик
 * и отказов источника: `messageKey` разрешается через i18n. Готовая фраза означала бы, что
 * уведомление уже переведено в месте возникновения — то есть на языке, который был активен
 * тогда, и без возможности показать тот же текст в логе одинаково.
 *
 * **Служба не заводит таймеров.** `durationMs` — подсказка отрисовке, а не расписание:
 * таймер внутри службы сделал бы её зависимой от планировщика (и непроверяемой без фейковых
 * таймеров), а время жизни тоста всё равно знает тот, кто его показывает — он же ставит
 * его на паузу под курсором.
 *
 * @module host/services/notifications
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import { createEventBus, defineEvent } from '@/shell/platform/primitives/event';
import { defineService } from '@/shell/platform/primitives/service';

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

export const NotificationsServiceToken = defineService<NotificationsService>('host.notifications');

const NotificationsDidChange = defineEvent<void>('notifications.didChange');

/**
 * Потолок очереди.
 *
 * Нужен, потому что очередь могут наполнять до того, как оболочка подпишется (Э5 позже Э4),
 * и цикл, отказывающий на каждой итерации, иначе съел бы память молча. Переполнение
 * вытесняет самое старое: свежее уведомление объясняет происходящее лучше, чем первое
 * из ста одинаковых.
 */
const MAX_PENDING = 100;

/** Общий пустой снимок: одна ссылка на все пустые состояния — см. требование к `pending`. */
const EMPTY: readonly Notification[] = Object.freeze([]);

/**
 * Создаёт службу уведомлений.
 *
 * Идентификаторы выдаются счётчиком, а не случайно: они не покидают сессию, а стабильная
 * последовательность делает тесты и логи читаемыми.
 */
export function createNotificationsService(): NotificationsService {
  const queue: Notification[] = [];
  const bus = createEventBus();
  let snapshot: readonly Notification[] | null = EMPTY;
  let nextId = 0;

  const changed = (): void => {
    snapshot = null;
    bus.emit(NotificationsDidChange, undefined);
  };

  const dismiss = (id: string): void => {
    const index = queue.findIndex((item) => item.id === id);
    if (index < 0) return;
    queue.splice(index, 1);
    changed();
  };

  const show = (request: NotificationRequest): NotificationHandle => {
    if (request.messageKey.trim() === '') {
      throw new Error('notifications: ключ сообщения не может быть пустым');
    }
    const id = `n${++nextId}`;
    // Замораживаем: уведомление уже в очереди у подписчиков, и правка задним числом
    // означала бы тост, текст которого меняется после показа.
    queue.push(Object.freeze({ ...request, id, level: request.level ?? 'info' }));
    if (queue.length > MAX_PENDING) queue.splice(0, queue.length - MAX_PENDING);
    changed();

    return {
      id,
      dismiss(): void {
        dismiss(id);
      },
    };
  };

  const withLevel =
    (level: NotificationLevel) =>
    (messageKey: string, options: NotificationOptions = {}): NotificationHandle =>
      show({ ...options, messageKey, level });

  return {
    show,
    info: withLevel('info'),
    success: withLevel('success'),
    warning: withLevel('warning'),
    error: withLevel('error'),

    pending(): readonly Notification[] {
      if (snapshot === null) {
        snapshot = queue.length === 0 ? EMPTY : Object.freeze([...queue]);
      }
      return snapshot;
    },

    dismiss,

    observe(cb: () => void): Disposable {
      return bus.on(NotificationsDidChange, cb);
    },
  };
}
