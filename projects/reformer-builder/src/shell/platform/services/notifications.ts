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
 * Служба уведомлений — очередь, из которой рисует оболочка.
 *
 * Объявление службы и токен живут в пакете `@reformer/builder-plugin-api`.
 *
 * @module shell/platform/services/notifications
 */

import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { createEventBus } from '@/shell/platform/primitives/event';
import { defineEvent } from '@reformer/builder-plugin-api/internal';
import {
  type Notification,
  type NotificationHandle,
  type NotificationLevel,
  type NotificationOptions,
  type NotificationRequest,
  type NotificationsService,
} from '@reformer/builder-plugin-api/internal';

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
