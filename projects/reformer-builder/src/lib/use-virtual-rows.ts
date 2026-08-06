/**
 * Виртуальный скролл для списков строк ФИКСИРОВАННОЙ высоты (дерево файлов): в DOM живёт только
 * видимое окно строк плюс запас сверху/снизу. Высота списка держится распоркой, окно сдвигается
 * `translateY` — скроллбар и позиции строк совпадают с невиртуальным списком.
 *
 * Скроллером считается viewport внутри ui-kit `ScrollArea` (`[data-slot="scroll-area-viewport"]`);
 * если его нет — сам элемент по ref (обычный `overflow-auto` контейнер тоже подходит).
 *
 * @module reformer-builder/lib/use-virtual-rows
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** Окно строк, которые нужно отрисовать: `[start, end)`. */
export interface RowRange {
  start: number;
  end: number;
}

/**
 * Диапазон строк для отрисовки — чистая функция (тестируется).
 *
 * @param scrollTop текущая прокрутка скроллера, px
 * @param viewportHeight высота видимой области, px (0 — ещё не измерена)
 * @param rowHeight высота строки, px
 * @param count всего строк
 * @param overscan запас строк за пределами видимой области
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
  // +1 — строка, срезанная нижней границей вьюпорта.
  const fit = Math.ceil(Math.max(viewportHeight, 0) / rowHeight) + 1;
  const start = Math.max(0, Math.min(first - overscan, Math.max(0, count - 1)));
  const end = Math.min(count, first + fit + overscan);
  return { start, end: Math.max(end, start) };
}

/** Скроллер: viewport внутри ScrollArea или сам контейнер. */
function scrollerOf(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? root;
}

export interface VirtualRows extends RowRange {
  /** Вешается на контейнер со скроллом (ScrollArea Root или `overflow-auto` div). */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Высота всего списка, px — распорка под скроллбар. */
  totalHeight: number;
  /** Сдвиг окна от начала списка, px. */
  offsetTop: number;
  /** Доскроллить до строки `index`, если она вне видимой области (как `scrollIntoView`, но по индексу). */
  scrollToRow: (index: number) => void;
}

/**
 * Окно видимых строк списка из `count` строк по `rowHeight` px.
 *
 * @example
 * const v = useVirtualRows(rows.length, 24);
 * <ScrollArea ref={v.scrollRef}>
 *   <div style={{ height: v.totalHeight }}>
 *     <div style={{ transform: `translateY(${v.offsetTop}px)` }}>
 *       {rows.slice(v.start, v.end).map(renderRow)}
 *     </div>
 *   </div>
 * </ScrollArea>
 */
export function useVirtualRows(count: number, rowHeight: number, overscan = 8): VirtualRows {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewportHeight: 0 });

  useEffect(() => {
    const el = scrollerOf(scrollRef.current);
    if (!el) return;
    const read = () =>
      setMetrics((prev) =>
        prev.scrollTop === el.scrollTop && prev.viewportHeight === el.clientHeight
          ? prev // без изменений — не будим React
          : { scrollTop: el.scrollTop, viewportHeight: el.clientHeight }
      );
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, []);

  const scrollToRow = useCallback(
    (index: number) => {
      const el = scrollerOf(scrollRef.current);
      if (!el || index < 0) return;
      const top = index * rowHeight;
      const bottom = top + rowHeight;
      if (top < el.scrollTop) el.scrollTop = top;
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
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
