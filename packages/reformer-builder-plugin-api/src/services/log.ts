/**
 * Журнал: что произошло — ключом сообщения, уровнем и подробностями, а не готовой фразой.
 *
 * Здесь ОБЪЯВЛЕНИЕ. Хранение живёт в оболочке, показ — у плагина, внёсшего панель журнала.
 *
 * ## Чем журнал отличается от уведомлений и диагностик
 *
 * Уведомление — то, что человек должен увидеть СЕЙЧАС; оно исчезает. Диагностика — состояние
 * документа: находка живёт, пока не исправлена, и замещается следующей проверкой. Запись журнала
 * — событие: она остаётся после того, как тост погас, и не замещается ничем. Отсюда «подробности
 * — в журнале» вместо «подробности — в консоли»: консоль человеку не видна, а журнал виден.
 *
 * ## Текст — ключом, подробности — как есть
 *
 * Сообщение переводится при показе, как у уведомлений: запись, сделанная до смены языка,
 * после неё звучит на новом. Но текст исключения или стек перевести нечем — они идут полем
 * {@link LogEntryRequest.detail} и показываются без перевода.
 *
 * ## Чего здесь нет
 *
 * Помощников `info`/`warning`/`error`: `append` покрывает всё, а поверхность SDK растёт по факту
 * использования. Хранения между сеансами: журнал — память сессии, и оболочка держит ограниченное
 * число последних записей, вытесняя старые.
 *
 * Слово «журнал» в коде платформы уже занято журналом ПРАВОК рабочей области (отмена и повтор),
 * поэтому служба называется `log`, а «Журнал» — только подпись панели.
 *
 * @module @reformer/builder-plugin-api/services/log
 */

import type { Disposable } from '../primitives/disposable.js';
import type { ResourceId } from '../primitives/resource.js';
import { defineService } from '../primitives/service.js';

/** Уровень записи. Определяет значок и тон строки, но не её судьбу: вытесняются все одинаково. */
export type LogLevel = 'info' | 'warning' | 'error';

/** Что просят записать. */
export interface LogEntryRequest {
  /** По умолчанию `info`. */
  readonly level?: LogLevel;
  /**
   * О ком запись — обычно идентификатор плагина (`ctx.id`). Подписывает строку журнала.
   *
   * Владельца проставляет пишущий, а не служба: реестр служб у всех плагинов общий. Оболочка,
   * сообщая об отказе плагина, ставит сюда идентификатор ОТКАЗАВШЕГО — запись о нём, а не о ней.
   */
  readonly source: string;
  /**
   * Ключ i18n сообщения. Голый ключ переводит словарь оболочки; свою строку плагин называет
   * ключом с владельцем — `pluginMessageKey(pluginId, key)` — и она берётся из ЕГО словаря.
   */
  readonly messageKey: string;
  readonly params?: Record<string, unknown>;
  /**
   * Подробности, которые не переводятся: текст исключения, стек, путь. Показываются как есть
   * и свёрнутыми — строку журнала читают по сообщению. Ошибку в текст превращает {@link errorDetail}.
   */
  readonly detail?: string;
  /** Ресурс, к которому относится запись: показывающий вправе открыть его по щелчку. */
  readonly resource?: ResourceId;
}

/** Запись в журнале: запрос плюс выданный идентификатор, время и проставленный уровень. */
export interface LogEntry extends LogEntryRequest {
  readonly id: string;
  readonly level: LogLevel;
  /** Когда записано — миллисекунды эпохи, как у `Date.now()`. */
  readonly time: number;
}

export interface LogService {
  /** Добавляет запись в конец журнала и возвращает её такой, какой она легла. */
  append(entry: LogEntryRequest): LogEntry;
  /**
   * Записи в порядке поступления — от старой к новой.
   *
   * Между изменениями возвращает **ту же** ссылку: снимок читает `useSyncExternalStore`,
   * который на новом массиве при каждом вызове падает с «The result of getSnapshot should
   * be cached».
   */
  entries(): readonly LogEntry[];
  /** Очищает журнал целиком — то, что делает кнопка «Очистить» панели. */
  clear(): void;
  /** Журнал изменился: запись добавили, вытеснили или журнал очистили. */
  observe(cb: () => void): Disposable;
}

export const LogServiceToken = defineService<LogService>('reformer.log');

/** Сколько звеньев цепочки `cause` раскрывается: цикл в причинах не должен повесить запись. */
const MAX_CAUSES = 5;

/**
 * Ошибка — текстом для {@link LogEntryRequest.detail}.
 *
 * Бросить можно чем угодно, поэтому разбор разный: у `Error` берётся стек (без него — имя
 * и сообщение) и цепочка причин, строка остаётся собой, прочее — JSON или `String`. `String`
 * на объекте даёт «[object Object]», что не значит ничего, поэтому он последний.
 *
 * Функция здесь, а не у каждого пишущего: ошибку в подробности превращают и оболочка, и плагины,
 * а копии совпадали бы по договорённости — то есть до первой правки.
 *
 * @returns `undefined` — подробностей нет (`undefined` и `null`).
 */
export function errorDetail(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;
  if (!(error instanceof Error)) return describeValue(error);

  const parts = [describeError(error)];
  let cause: unknown = error.cause;
  for (let depth = 0; depth < MAX_CAUSES && cause !== undefined && cause !== null; depth += 1) {
    parts.push(
      `Caused by: ${cause instanceof Error ? describeError(cause) : describeValue(cause)}`
    );
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return parts.join('\n');
}

function describeError(error: Error): string {
  const head = `${error.name}: ${error.message}`;
  const stack = error.stack;
  if (stack === undefined || stack === '') return head;
  // V8 начинает стек строкой «Имя: сообщение», другие движки — сразу кадрами.
  return stack.startsWith(head) ? stack : `${head}\n${stack}`;
}

function describeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) return json;
  } catch {
    // Цикл или BigInt: JSON не вышел — остаётся `String`.
  }
  return String(value);
}
