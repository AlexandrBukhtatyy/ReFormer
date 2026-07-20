import type { RefObject } from 'react';

/**
 * Базовый императивный контракт любого field-компонента ReFormer.
 *
 * Синтезируется HOC {@link withFormControl} из DOM-узла примитива. Rich-handle композитов
 * (SelectAsync, DatePicker, Combobox, InputPassword) расширяют его своими методами
 * (`open`/`close`/`reload`/`toggleVisibility`/…).
 *
 * Достаётся из render-схемы по селектору:
 * `schema.node(sel).getRef<FieldHandle>().current?.focus()`.
 *
 * Покрывает ТОЛЬКО истинно императивные действия. Реактивное состояние
 * (value / disabled / visible / options / validation) остаётся в слое behaviors —
 * через handle его НЕ дублируют. См. docs/plans/useimperativehandle-refactored-blossom.md.
 */
export interface FieldHandle {
  /** Сфокусировать поле (делегирует на DOM-элемент примитива). */
  focus(): void;
  /** Снять фокус. */
  blur(): void;
  /** Проскроллить поле в область видимости. */
  scrollIntoView(opts?: ScrollIntoViewOptions): void;
  /** Живой DOM-элемент поля (или `null` до монтирования / для размонтированной ноды). */
  getElement(): HTMLElement | null;
}

/**
 * Собирает baseline {@link FieldHandle}, делегирующий на DOM-элемент по ссылке `el`.
 * Все вызовы null-safe: до монтирования (`el.current === null`) — no-op, без исключений.
 */
export function makeElementFieldHandle(el: RefObject<HTMLElement | null>): FieldHandle {
  return {
    focus: () => el.current?.focus(),
    blur: () => el.current?.blur(),
    scrollIntoView: (opts) => el.current?.scrollIntoView(opts),
    getElement: () => el.current,
  };
}
