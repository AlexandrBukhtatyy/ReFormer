/**
 * Быстрое добавление компонента: что показывает сетка и куда по ней ходит курсор.
 *
 * ## Тот же каталог, что у палитры, и тот же поиск
 *
 * Разделы и отбор берутся у {@link paletteSections} — второй способ искать компонент означал бы,
 * что «Input» находится в панели и не находится в диалоге. Разница только в раскладке: панель
 * узкая и рисует список, диалог широкий и рисует сетку, поэтому здесь появляется ПЛОСКИЙ
 * порядок ({@link flattenQuickAdd}) — по нему ходит курсор и по нему же считается вставка.
 *
 * ## Курсор ходит по числу колонок, а не по разделам
 *
 * Колонок в сетке столько, сколько влезло по ширине, — это знает только браузер, поэтому число
 * приходит сюда параметром. Всё остальное — арифметика над плоским индексом: вправо и влево
 * шаг единичный, вверх и вниз — шаг в целую строку.
 *
 * На границе раздела курсор переходит в соседний, а не упирается: разделы в сетке идут подряд,
 * и «упереться» человек воспримет как неработающую клавишу. Цена — на стыке разных по длине
 * разделов шаг вниз может встать не строго под курсором; это заметно меньшая беда, чем курсор,
 * застрявший в конце раздела.
 *
 * @module plugins/editor-schema/quick-add
 */

import type { CatalogEntry } from '@/lib/catalog/types';
import type { NavDir } from '@/lib/form-model/query';
import { paletteSections, type PaletteEntry, type PaletteSection } from './palette-model';

/** Запись сетки: пункт палитры вместе с его местом в плоском порядке. */
export interface QuickAddItem {
  readonly entry: PaletteEntry;
  readonly category: string;
  /** Позиция в плоском порядке обхода — она же адрес курсора. */
  readonly index: number;
}

/** Раздел сетки: заголовок и его записи. */
export interface QuickAddSection {
  readonly category: string;
  readonly items: readonly QuickAddItem[];
}

export interface QuickAddView {
  readonly sections: readonly QuickAddSection[];
  /** Все записи подряд, в порядке отрисовки. Пустой список — ничего не нашлось. */
  readonly flat: readonly QuickAddItem[];
}

/**
 * Что показать по строке поиска.
 *
 * Пустая строка означает «весь каталог», а не «ничего»: диалог открывают и затем, чтобы
 * посмотреть, что вообще есть, — так же, как в первой версии.
 */
export function quickAddView(
  catalog: readonly CatalogEntry[],
  query = '',
  order?: readonly string[]
): QuickAddView {
  const sections = paletteSections(catalog, { query, order });
  const flat: QuickAddItem[] = [];
  const grid = sections.map((section: PaletteSection) => ({
    category: section.category,
    items: section.items.map((entry) => {
      const item: QuickAddItem = { entry, category: section.category, index: flat.length };
      flat.push(item);
      return item;
    }),
  }));
  return { sections: grid, flat };
}

/**
 * Куда переедет курсор; возвращается новый плоский индекс.
 *
 * За края сетки курсор не выходит: шаг, которому некуда вести, оставляет его на месте.
 * Исключение одно — шаг вниз из последней строки: он ведёт на последнюю запись, потому что
 * нижняя строка часто неполная, и «ничего не произошло» там читалось бы как поломка.
 */
export function gridTarget(index: number, total: number, columns: number, dir: NavDir): number {
  if (total <= 0) return 0;
  const width = Math.max(1, columns);
  const current = Math.min(Math.max(index, 0), total - 1);

  switch (dir) {
    case 'left':
      return Math.max(current - 1, 0);
    case 'right':
      return Math.min(current + 1, total - 1);
    case 'up': {
      const up = current - width;
      return up < 0 ? current : up;
    }
    default: {
      const down = current + width;
      if (down < total) return down;
      return current === total - 1 ? current : total - 1;
    }
  }
}
