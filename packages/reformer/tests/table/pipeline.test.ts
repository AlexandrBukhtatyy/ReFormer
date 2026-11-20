/**
 * Чистые функции таблицы [ReFormer-cn5g.4]: сравнение и фильтр клиентского режима, цикл сортировки.
 */

import { describe, expect, it } from 'vitest';
import {
  defaultCompare,
  defaultMatch,
  isEmptyFilter,
  nextDirection,
  withSort,
} from '../../src/table/pipeline';

const collator = new Intl.Collator('ru', { numeric: true });

describe('defaultCompare', () => {
  it('пустые больше всех и равны друг другу', () => {
    expect(defaultCompare(null, undefined, collator)).toBe(0);
    expect(defaultCompare('', 1, collator)).toBe(1);
    expect(defaultCompare(1, null, collator)).toBe(-1);
  });

  it('числа, даты и булевы — по величине; строки — коллацией с числами', () => {
    expect(defaultCompare(2, 10, collator)).toBeLessThan(0);
    expect(defaultCompare(new Date(2026, 1, 1), new Date(2025, 1, 1), collator)).toBeGreaterThan(0);
    expect(defaultCompare(false, true, collator)).toBeLessThan(0);
    expect(defaultCompare('файл 2', 'файл 10', collator)).toBeLessThan(0);
  });
});

describe('defaultMatch', () => {
  it('строка — подстрока без учёта регистра; пустое значение не подходит', () => {
    expect(defaultMatch('Иванов', 'ИВА')).toBe(true);
    expect(defaultMatch(null, 'а')).toBe(false);
    expect(defaultMatch(undefined, 'а')).toBe(false);
    expect(defaultMatch(42, '4')).toBe(true);
  });

  it('массив — значение из списка; прочее — равенство', () => {
    expect(defaultMatch('admin', ['admin', 'owner'])).toBe(true);
    expect(defaultMatch('user', ['admin'])).toBe(false);
    expect(defaultMatch(true, true)).toBe(true);
    expect(defaultMatch(NaN, NaN)).toBe(true);
  });
});

describe('цикл сортировки', () => {
  it('nextDirection: asc → desc → null → asc', () => {
    expect(nextDirection(null)).toBe('asc');
    expect(nextDirection('asc')).toBe('desc');
    expect(nextDirection('desc')).toBeNull();
  });

  it('withSort без multi — одна колонка или ничего', () => {
    expect(withSort([{ id: 'a', desc: false }], 'b', 'desc', false)).toEqual([
      { id: 'b', desc: true },
    ]);
    expect(withSort([{ id: 'a', desc: false }], 'a', null, false)).toEqual([]);
  });

  it('withSort с multi — добавляет в конец, меняет на месте, убирает', () => {
    const base = [{ id: 'a', desc: false }];
    expect(withSort(base, 'b', 'asc', true)).toEqual([...base, { id: 'b', desc: false }]);
    expect(withSort([...base, { id: 'b', desc: false }], 'a', 'desc', true)).toEqual([
      { id: 'a', desc: true },
      { id: 'b', desc: false },
    ]);
    expect(withSort(base, 'a', null, true)).toEqual([]);
  });

  it('isEmptyFilter: undefined, null и пустая строка', () => {
    expect([undefined, null, ''].every(isEmptyFilter)).toBe(true);
    expect([0, false, ' ', []].some(isEmptyFilter)).toBe(false);
  });
});
