import { useImperativeHandle, useRef } from 'react';
import type { Ref, RefObject } from 'react';

/**
 * Базовый императивный контракт поля формы.
 *
 * Обёртка поля (`FormField.Control` из `@reformer/cdk`, рендерер `@reformer/renderer-react`)
 * строит его из DOM-узла контрола. Композиты со своим handle (`open`/`close`/`reload`/…) отдают
 * его как есть — он расширяет этот контракт.
 *
 * Достаётся из render-схемы по селектору:
 * `schema.node(sel).getRef<FieldHandle>().current?.focus()`.
 *
 * Покрывает ТОЛЬКО императивные действия. Реактивное состояние (value / disabled / options /
 * validation) живёт в behaviors и через handle не дублируется.
 */
export interface FieldHandle {
  /** Сфокусировать поле (делегирует на DOM-элемент контрола). */
  focus(): void;
  /** Снять фокус. */
  blur(): void;
  /** Проскроллить поле в область видимости. */
  scrollIntoView(opts?: ScrollIntoViewOptions): void;
  /** Живой DOM-элемент поля (или `null` до монтирования / для размонтированной ноды). */
  getElement(): HTMLElement | null;
}

/**
 * Собирает базовый {@link FieldHandle}, делегирующий на DOM-элемент по ссылке `el`.
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

/** DOM-элемент, а не handle композита. Без `instanceof HTMLElement` — SSR-safe. */
function isElementNode(value: unknown): value is HTMLElement {
  return (
    typeof value === 'object' && value !== null && (value as { nodeType?: unknown }).nodeType === 1
  );
}

/**
 * Ref для контрола поля + императивный handle для потребителя.
 *
 * Возвращённый ref вешается на контрол. На `outerRef` публикуется:
 * - handle самого контрола, если тот его реализует (`useImperativeHandle` композита);
 * - иначе — базовый {@link FieldHandle}, построенный из DOM-узла контрола.
 *
 * Хук вызывается безусловно; вешать ref на контрол стоит только при заданном `outerRef` —
 * так function-компонент без ref-поддержки не получает лишний ref.
 *
 * @param outerRef - ref потребителя (из `forwardRef` или `schema.node(sel).getRef()`).
 * @returns ref, который нужно передать контролу.
 */
export function useFieldHandleRef<H = FieldHandle>(
  outerRef: Ref<H> | undefined
): RefObject<unknown> {
  const innerRef = useRef<unknown>(null);
  // Базовый handle — один на всю жизнь поля (узел он читает лениво): новый объект на каждом
  // коммите зацикливал колбэк-ref с setState у родителя.
  const elementHandle = useRef<FieldHandle | null>(null);
  // Без deps: пересчёт каждый рендер дешёвый, а контрол может смениться (другой component).
  useImperativeHandle(outerRef, () => resolveFieldHandle(innerRef, elementHandle) as H);
  return innerRef;
}

/**
 * Что публиковать потребителю по ref контрола: handle композита как есть, иначе (DOM-узел или
 * ещё пусто) — базовый {@link FieldHandle}, читающий узел лениво из `inner`. С `cache` базовый
 * handle создаётся один раз и дальше переиспользуется.
 *
 * @internal Экспортируется для юнит-тестов.
 */
export function resolveFieldHandle(
  inner: RefObject<unknown>,
  cache?: { current: FieldHandle | null }
): unknown {
  const current = inner.current;
  if (current != null && !isElementNode(current)) return current;
  const element = inner as RefObject<HTMLElement | null>;
  if (!cache) return makeElementFieldHandle(element);
  cache.current ??= makeElementFieldHandle(element);
  return cache.current;
}
