/**
 * Порядок разделов палитры. Категория, которой нет в {@link DEFAULT_CATEGORY_ORDER}, не ломается
 * заметно — она просто уезжает в хвост, ниже «Прочего», и это легко не увидеть годами. Так и было
 * с «Мастером» (`Wizard`/`Step` из `synthetic-entries`), поэтому проверка сверяет НЕ список с
 * копией списка, а список с фактическим каталогом.
 *
 * @module reformer-builder/catalog/grouping.test
 */

import { describe, expect, it } from 'vitest';
import { getCatalog } from './index';
import { DEFAULT_CATEGORY_ORDER, FALLBACK_CATEGORY, groupByCategory } from './grouping';

describe('DEFAULT_CATEGORY_ORDER', () => {
  it('перечисляет каждую категорию, которая реально встречается в каталоге', () => {
    const used = [...new Set(getCatalog().map((e) => e.category ?? FALLBACK_CATEGORY))];
    const missing = used.filter((c) => !DEFAULT_CATEGORY_ORDER.includes(c));
    expect(missing).toEqual([]);
  });

  it('групповой хвост пуст: незнакомых разделов у дефолтного каталога нет', () => {
    const groups = groupByCategory(getCatalog()).map(([category]) => category);
    const knownPrefix = groups.filter((c) => DEFAULT_CATEGORY_ORDER.includes(c));
    expect(groups).toEqual(knownPrefix);
  });
});
