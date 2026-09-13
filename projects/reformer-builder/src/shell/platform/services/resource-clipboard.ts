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
 * Служба буфера ресурсов — реализация объявленного буфера.
 *
 * Объявление службы и токен живут в пакете `@reformer/builder-plugin-api`.
 *
 * @module shell/platform/services/resource-clipboard
 */

import { createEventBus } from '@/shell/platform/primitives/event';
import { defineEvent } from '@reformer/builder-plugin-api/internal';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import {
  type ClipboardMode,
  type ClipboardState,
  type ResourceClipboardService,
} from '@reformer/builder-plugin-api/internal';

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
