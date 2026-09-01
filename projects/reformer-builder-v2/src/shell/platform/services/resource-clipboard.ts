/**
 * Буфер записей дерева: «Копировать» здесь, «Вставить» там.
 *
 * **Это НЕ системный буфер обмена, и не по недосмотру.** `navigator.clipboard` переносит
 * текст и картинки; ссылки на файлы проекта в него не кладутся вовсе — у File System Access
 * хэндл не сериализуется, а путь без источника ничего не адресует. Поэтому копирование
 * внутри проекта идёт по адресам ресурсов, и живёт этот набор ровно столько, сколько живёт
 * вкладка приложения.
 *
 * **Почему служба, а не состояние панели.** Панель дерева размонтируется при переключении
 * левого дока (дерево → шаблоны → дерево), и буфер, живущий в её состоянии, терялся бы между
 * «Копировать» и «Вставить» — то есть ровно между двумя половинами одного действия. Служба же
 * доступна командам, а команды и есть та единственная дверь, через которую вставку зовут
 * и меню, и клавиша, и палитра.
 *
 * **Вставка буфер НЕ очищает.** Как в файловых менеджерах: скопированное вставляют
 * в несколько мест подряд, и очистка после первой вставки означала бы, что вторую надо
 * начинать заново.
 *
 * @module host/services/resource-clipboard
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import { createEventBus, defineEvent } from '@/shell/platform/primitives/event';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import { defineService } from '@/shell/platform/primitives/service';

/**
 * Что сделали с записями.
 *
 * Различать обязательно: копия оставляет оригинал на месте, перенос — нет. Сейчас вставка
 * умеет только копирование, но вид хранится с самого начала, потому что добавить его позже
 * означало бы, что уже написанные вклады меню знают о буфере не всё.
 */
export type ClipboardMode = 'copy' | 'cut';

/** Снимок буфера. Ссылка стабильна между изменениями — условие `useSyncExternalStore`. */
export interface ClipboardState {
  readonly mode: ClipboardMode;
  readonly items: readonly ResourceId[];
}

export interface ResourceClipboardService {
  /** Кладёт записи в буфер, заменяя предыдущее содержимое. Пустой список очищает буфер. */
  copy(items: readonly ResourceId[]): void;
  /** То же, но с пометкой «вырезано»: вставка обязана перенести, а не скопировать. */
  cut(items: readonly ResourceId[]): void;
  clear(): void;
  /** Содержимое буфера; пустой список — буфер пуст. */
  get(): ClipboardState;
  /** Сколько записей лежит в буфере. Нужен предикатам применимости — им хватает числа. */
  size(): number;
  observe(cb: () => void): Disposable;
}

export const ResourceClipboardServiceToken =
  defineService<ResourceClipboardService>('host.clipboard');

const ClipboardDidChange = defineEvent<void>('clipboard.didChange');

/** Общее пустое состояние: одна ссылка на все пустые снимки. */
const EMPTY: ClipboardState = Object.freeze({ mode: 'copy', items: Object.freeze([]) });

export function createResourceClipboardService(): ResourceClipboardService {
  const bus = createEventBus();
  let state: ClipboardState = EMPTY;

  const put = (mode: ClipboardMode, items: readonly ResourceId[]): void => {
    // Повторы сняты здесь, а не у вызывающего: выделение в дереве может содержать и строку,
    // по которой щёлкнули, и её же в наборе, а вставлять один файл дважды нельзя.
    const unique = [...new Set(items)];
    state = unique.length === 0 ? EMPTY : Object.freeze({ mode, items: Object.freeze(unique) });
    bus.emit(ClipboardDidChange, undefined);
  };

  return {
    copy(items) {
      put('copy', items);
    },

    cut(items) {
      put('cut', items);
    },

    clear() {
      if (state === EMPTY) return;
      state = EMPTY;
      bus.emit(ClipboardDidChange, undefined);
    },

    get: () => state,
    size: () => state.items.length,

    observe(cb) {
      return bus.on(ClipboardDidChange, cb);
    },
  };
}
