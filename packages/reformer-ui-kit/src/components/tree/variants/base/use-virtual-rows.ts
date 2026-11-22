/**
 * Виртуальный скролл для списков строк ФИКСИРОВАННОЙ высоты.
 *
 * Дереву он нужен по-настоящему: раскрытый каталог реального проекта — это тысячи строк, а
 * у каждой строки свои обработчики, и у потребителя поверх неё может висеть контекстное меню,
 * то есть узел Radix со своими подписками. Без виртуализации раскрытие `src` в среднем
 * репозитории означало бы несколько тысяч таких узлов разом.
 *
 * ## Правило отделено от подписки
 *
 * {@link rowRange} — чистая функция, и проверяется без единого DOM-узла: окно строк это
 * арифметика, а не отрисовка. В хуке остаётся ровно то, что без браузера не проверить, —
 * чтение метрик скроллера и подписка на его события.
 *
 * ## Что считается скроллером
 *
 * {@link ScrollArea} кита прокручивает не корень, а вложенный `[data-slot="scroll-area-viewport"]`,
 * поэтому метрики читаются с него. Если разметка окажется другой (обычный `overflow-auto`),
 * скроллером считается сам элемент по ссылке — так хук годится и вне кита.
 *
 * @module components/tree/use-virtual-rows
 */

import * as React from 'react';

/** Окно строк, которые нужно отрисовать: `[start, end)`. */
export interface RowRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Какие строки показать при такой прокрутке.
 *
 * `overscan` — запас строк за краями видимой области: без него строка, появляющаяся из-за
 * края, успевает мигнуть пустотой на быстрой прокрутке.
 */
export function rowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan: number
): RowRange {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(scrollTop, 0) / rowHeight);
  // +1 — строка, срезанная нижней границей вьюпорта: она видна наполовину и обязана быть.
  const fit = Math.ceil(Math.max(viewportHeight, 0) / rowHeight) + 1;
  const start = Math.max(0, Math.min(first - overscan, Math.max(0, count - 1)));
  const end = Math.min(count, first + fit + overscan);
  return { start, end: Math.max(end, start) };
}

/** Скроллер: вьюпорт внутри `ScrollArea` кита или сам контейнер. */
function scrollerOf(root: HTMLElement | null): HTMLElement | null {
  if (root === null) return null;
  return root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? root;
}

export interface VirtualRows extends RowRange {
  /** Вешается на контейнер со скроллом. */
  readonly scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Высота всего списка — распорка, которая держит скроллбар честным. */
  readonly totalHeight: number;
  /** Сдвиг окна от начала списка. */
  readonly offsetTop: number;
  /** Доводит строку до видимой области, если она за краем. */
  readonly scrollToRow: (index: number) => void;
}

/**
 * Окно видимых строк списка из `count` строк по `rowHeight` пикселей.
 *
 * @example
 * const rows = useVirtualRows(items.length, 24);
 * <ScrollArea ref={rows.scrollRef}>
 *   <div style={{ height: rows.totalHeight }}>
 *     <div style={{ transform: `translateY(${rows.offsetTop}px)` }}>
 *       {items.slice(rows.start, rows.end).map(renderRow)}
 *     </div>
 *   </div>
 * </ScrollArea>
 */
export function useVirtualRows(count: number, rowHeight: number, overscan = 8): VirtualRows {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = React.useState({ scrollTop: 0, viewportHeight: 0 });

  React.useEffect(() => {
    const element = scrollerOf(scrollRef.current);
    if (element === null) return;

    const read = (): void => {
      setMetrics((prev) =>
        // Прокрутка сыплет событиями десятками в секунду; будить React там, где ничего
        // не изменилось, значит перерисовывать дерево на каждый пиксель инерции.
        prev.scrollTop === element.scrollTop && prev.viewportHeight === element.clientHeight
          ? prev
          : { scrollTop: element.scrollTop, viewportHeight: element.clientHeight }
      );
    };

    read();
    element.addEventListener('scroll', read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', read);
      observer.disconnect();
    };
  }, []);

  const scrollToRow = React.useCallback(
    (index: number): void => {
      const element = scrollerOf(scrollRef.current);
      if (element === null || index < 0) return;
      const top = index * rowHeight;
      const bottom = top + rowHeight;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (bottom > element.scrollTop + element.clientHeight) {
        element.scrollTop = bottom - element.clientHeight;
      }
    },
    [rowHeight]
  );

  const { start, end } = rowRange(
    metrics.scrollTop,
    metrics.viewportHeight,
    rowHeight,
    count,
    overscan
  );

  return {
    scrollRef,
    start,
    end,
    totalHeight: count * rowHeight,
    offsetTop: start * rowHeight,
    scrollToRow,
  };
}
