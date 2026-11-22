/**
 * Журнал — лента записей о том, что произошло, и ничего больше.
 *
 * **Почему служба, а не панель.** Пишут все: оболочка об отказе плагина, плагин о неудачной
 * операции. Показывает — плагин, внёсший панель журнала, и только он знает, как. Служба хранит
 * ленту, а панель подписывается и рисует её; без панели записи просто копятся до предела.
 *
 * **Запись — ключ и параметры, а не готовая строка.** То же соглашение, что у уведомлений
 * и диагностик: запись, сделанная до смены языка, после неё звучит на новом. Непереводимое
 * (текст исключения) идёт полем `detail` как есть.
 *
 * **Память сессии.** Журнал не переживает перезагрузку: он отвечает на вопрос «что сейчас
 * произошло», а не ведёт историю проекта. Предел вытесняет старые записи — цикл, отказывающий
 * на каждой итерации, иначе съел бы память молча.
 *
 * Объявление службы и токен живут в пакете `@reformer/builder-plugin-api`.
 *
 * @module shell/platform/services/log
 */

import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { createEventBus } from '@/shell/platform/primitives/event';
import { defineEvent } from '@reformer/builder-plugin-api/internal';
import type { LogEntry, LogEntryRequest, LogService } from '@reformer/builder-plugin-api/internal';

const LogDidChange = defineEvent<void>('log.didChange');

/**
 * Потолок журнала.
 *
 * Больше, чем у очереди тостов: тосты гаснут, а записи читают задним числом, и сотни последних
 * событий — то, что человек ещё готов пролистать. Переполнение вытесняет самое старое.
 */
export const MAX_LOG_ENTRIES = 500;

/** Общий пустой снимок: одна ссылка на все пустые состояния — см. требование к `entries`. */
const EMPTY: readonly LogEntry[] = Object.freeze([]);

export interface LogServiceOptions {
  /** Часы. Внедряются ради тестов: время записи — часть того, что проверяется. */
  readonly now?: () => number;
  /** Потолок журнала; по умолчанию {@link MAX_LOG_ENTRIES}. */
  readonly capacity?: number;
}

/**
 * Создаёт службу журнала.
 *
 * Идентификаторы выдаются счётчиком, а не случайно: они не покидают сессию, а стабильная
 * последовательность делает тесты читаемыми. Очистка счётчик не сбрасывает — иначе React-ключи
 * строк, нарисованных до очистки и после, совпали бы.
 */
export function createLogService(options: LogServiceOptions = {}): LogService {
  const now = options.now ?? Date.now;
  const capacity = options.capacity ?? MAX_LOG_ENTRIES;
  const entries: LogEntry[] = [];
  const bus = createEventBus();
  let snapshot: readonly LogEntry[] | null = EMPTY;
  let nextId = 0;

  const changed = (): void => {
    snapshot = null;
    bus.emit(LogDidChange, undefined);
  };

  return {
    append(request: LogEntryRequest): LogEntry {
      if (request.messageKey.trim() === '') {
        throw new Error('log: ключ сообщения не может быть пустым');
      }
      if (request.source.trim() === '') {
        throw new Error('log: источник записи не может быть пустым');
      }
      // Замораживаем: запись уже у подписчиков, и правка задним числом означала бы строку
      // журнала, которая меняется после показа.
      const entry: LogEntry = Object.freeze({
        ...request,
        id: `l${++nextId}`,
        level: request.level ?? 'info',
        time: now(),
      });
      entries.push(entry);
      if (entries.length > capacity) entries.splice(0, entries.length - capacity);
      changed();
      return entry;
    },

    entries(): readonly LogEntry[] {
      snapshot ??= entries.length === 0 ? EMPTY : Object.freeze([...entries]);
      return snapshot;
    },

    clear(): void {
      if (entries.length === 0) return;
      entries.length = 0;
      changed();
    },

    observe(cb: () => void): Disposable {
      return bus.on(LogDidChange, cb);
    },
  };
}
