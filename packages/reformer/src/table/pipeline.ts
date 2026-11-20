/**
 * Чистые функции таблицы: сравнение и фильтр клиентского режима, цикл сортировки.
 *
 * @internal
 * @module table/pipeline
 */

import type { SortDirection, SortEntry } from './types';

/** Пустой фильтр в карту фильтров не попадает. */
export function isEmptyFilter(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Сравнение по умолчанию: пустые (`null`, `undefined`, `''`) больше всех — по возрастанию они в
 * конце; числа, даты и булевы — по величине, остальное — коллацией.
 */
export function defaultCompare(a: unknown, b: unknown, collator: Intl.Collator): number {
  const emptyA = isEmptyFilter(a);
  const emptyB = isEmptyFilter(b);
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

/**
 * Фильтр по умолчанию: строковый — подстрока без учёта регистра, массив — значение из списка,
 * прочее — равенство.
 */
export function defaultMatch(value: unknown, filter: unknown): boolean {
  if (typeof filter === 'string') {
    if (value === null || value === undefined) return false;
    return String(value).toLocaleLowerCase().includes(filter.toLocaleLowerCase());
  }
  if (Array.isArray(filter)) return filter.includes(value);
  return Object.is(value, filter);
}

/**
 * Новая сортировка после смены направления колонки.
 *
 * @param current - Текущая сортировка.
 * @param id - Колонка.
 * @param direction - Направление; `null` — убрать колонку.
 * @param multi - Сохранить остальные колонки (колонка уходит в конец приоритета, если её не было).
 */
export function withSort(
  current: readonly SortEntry[],
  id: string,
  direction: SortDirection | null,
  multi: boolean
): SortEntry[] {
  if (!multi) return direction === null ? [] : [{ id, desc: direction === 'desc' }];
  const at = current.findIndex((entry) => entry.id === id);
  if (direction === null) return current.filter((entry) => entry.id !== id);
  const entry = { id, desc: direction === 'desc' };
  if (at === -1) return [...current, entry];
  return current.map((existing, index) => (index === at ? entry : existing));
}

/** Следующее направление в цикле «по возрастанию → по убыванию → без сортировки». */
export function nextDirection(current: SortDirection | null): SortDirection | null {
  if (current === null) return 'asc';
  return current === 'asc' ? 'desc' : null;
}
