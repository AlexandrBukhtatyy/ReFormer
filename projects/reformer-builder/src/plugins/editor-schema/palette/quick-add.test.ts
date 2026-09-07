/**
 * Тесты модели быстрого добавления.
 *
 * Проверяется то, что видно без браузера: что показывает выдача и куда едет курсор при
 * заданном числе колонок. Само число колонок измеряется по DOM и потому проверяется
 * браузерным прогоном — здесь оно параметр.
 *
 * @module plugins/editor-schema/palette/quick-add.test
 */

import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '@/lib/catalog/types';
import { gridTarget, quickAddView } from './quick-add';

function entry(name: string, category: string, role: CatalogEntry['role'] = 'field'): CatalogEntry {
  return {
    name,
    role,
    category,
    propsSchema: { type: 'object', properties: {} },
    makeNode: () => ({ value: '$model(x)', component: `$component(${name})` }),
  } as CatalogEntry;
}

const CATALOG: readonly CatalogEntry[] = [
  entry('Input', 'Поля ввода'),
  entry('Textarea', 'Поля ввода'),
  entry('Select', 'Выбор'),
  entry('$html(div)', 'HTML', 'container'),
];

describe('quickAddView', () => {
  it('без поиска показывает весь каталог по разделам', () => {
    const view = quickAddView(CATALOG);
    // Порядок разделов задаёт домен (`groupByCategory`), а не диалог: он один на палитру
    // и на сетку, иначе один и тот же каталог выглядел бы в них по-разному.
    expect(view.sections.map((section) => section.category)).toEqual([
      'HTML',
      'Поля ввода',
      'Выбор',
    ]);
    expect(view.flat).toHaveLength(4);
  });

  it('плоский порядок совпадает с порядком отрисовки и нумерует записи подряд', () => {
    const view = quickAddView(CATALOG);
    expect(view.flat.map((item) => item.index)).toEqual([0, 1, 2, 3]);
    expect(view.flat.map((item) => item.entry.name)).toEqual([
      '$html(div)',
      'Input',
      'Textarea',
      'Select',
    ]);
    // Раздел записи хранится на ней самой: сетка рисует заголовки, а курсор ходит по плоскому
    // списку, и связь между ними нужна обоим.
    expect(view.flat[2].category).toBe('Поля ввода');
  });

  it('ищет по имени и по тегу, пустые разделы не показывает', () => {
    expect(quickAddView(CATALOG, 'text').flat.map((item) => item.entry.name)).toEqual(['Textarea']);
    // `div` человек ищет тегом, а в каталоге запись зовётся `$html(div)`.
    const byTag = quickAddView(CATALOG, 'div');
    expect(byTag.flat.map((item) => item.entry.name)).toEqual(['$html(div)']);
    expect(byTag.sections).toHaveLength(1);
  });

  it('ничего не нашлось — пустая выдача, а не пустые разделы', () => {
    const view = quickAddView(CATALOG, 'такого-нет');
    expect(view.sections).toEqual([]);
    expect(view.flat).toEqual([]);
  });
});

describe('gridTarget', () => {
  // Сетка 3×3 без последней записи: 8 карточек, три колонки.
  const total = 8;
  const columns = 3;

  it('вправо и влево идут по соседям', () => {
    expect(gridTarget(0, total, columns, 'right')).toBe(1);
    expect(gridTarget(1, total, columns, 'left')).toBe(0);
  });

  it('вниз и вверх идут через строку', () => {
    expect(gridTarget(0, total, columns, 'down')).toBe(3);
    expect(gridTarget(4, total, columns, 'up')).toBe(1);
  });

  it('у краёв курсор остаётся на месте', () => {
    expect(gridTarget(0, total, columns, 'left')).toBe(0);
    expect(gridTarget(0, total, columns, 'up')).toBe(0);
    expect(gridTarget(total - 1, total, columns, 'right')).toBe(total - 1);
    expect(gridTarget(total - 1, total, columns, 'down')).toBe(total - 1);
  });

  it('вниз из неполной последней строки ведёт на последнюю запись', () => {
    // Из позиции 6 строка ниже неполная: шаг через строку вышел бы за конец, и курсор
    // встал бы «никуда» — вместо этого он идёт на последнюю карточку.
    expect(gridTarget(6, total, columns, 'down')).toBe(total - 1);
  });

  it('пустая выдача и странное число колонок не ломают счёт', () => {
    expect(gridTarget(3, 0, columns, 'down')).toBe(0);
    expect(gridTarget(5, total, 0, 'down')).toBe(6);
    expect(gridTarget(-4, total, columns, 'right')).toBe(1);
    expect(gridTarget(99, total, columns, 'left')).toBe(total - 2);
  });
});
