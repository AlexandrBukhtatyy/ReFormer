/**
 * Правило `maxDate(date)` — дата не позже границы (включительно).
 *
 * Сравниваются календарные дни: время у значения и у границы обнуляется, поэтому сегодняшняя дата с
 * поздним часом проходит `maxDate(new Date())` («не позже сегодня»). В `params.maxDate` — исходная
 * граница со временем, правило её не мутирует. Пустые и невалидные даты пропускаются. Даты —
 * локальными конструкторами; строки — дата-время без смещения (локальное время).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maxDate } from '../../../src/form/validators/max-date';
import { useFakeClock } from '../../test-utils/async';
import { describeRule } from '../../test-utils/rule-table';

const bound = new Date(2024, 5, 15);

describeRule('maxDate — граница 15.06.2024', maxDate(bound), [
  { value: new Date(2024, 5, 15), code: null, label: 'граница проходит' },
  { value: new Date(2024, 5, 15, 23, 59, 59, 999), code: null, label: 'граница в конце дня' },
  { value: new Date(2024, 5, 14), code: null, label: 'день до границы' },
  { value: new Date(1990, 0, 1), code: null, label: 'далеко до границы' },
  {
    value: new Date(2024, 5, 16),
    code: 'date_max',
    params: { maxDate: bound },
    label: 'следующий день в 00:00 — date_max',
  },
  { value: new Date(2030, 0, 1), code: 'date_max', params: { maxDate: bound }, label: 'нескоро' },
]);

describeRule('maxDate — строки', maxDate(bound), [
  { value: '2024-06-15T23:30', code: null, label: '"2024-06-15T23:30" — тот же день' },
  { value: '2024-06-16T00:30', code: 'date_max', params: { maxDate: bound } },
]);

describeRule('maxDate — пустые и невалидные даты пропускаются', maxDate(bound), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
  { value: 'not-a-date', code: null },
  { value: new Date(Number.NaN), code: null, label: 'Invalid Date' },
]);

describe('maxDate — время границы и значения не учитывается', () => {
  it('граница с утренним часом не отсекает тот же день вечером', () => {
    expect(maxDate(new Date(2024, 5, 15, 8))(new Date(2024, 5, 15, 22))).toBeNull();
  });

  it('в params — исходная граница со временем', () => {
    expect(maxDate(new Date(2024, 5, 15, 8, 45))(new Date(2024, 5, 16, 1))).toEqual({
      code: 'date_max',
      params: { maxDate: new Date(2024, 5, 15, 8, 45) },
    });
  });

  it('ни граница, ни значение не мутируются', () => {
    const limit = new Date(2024, 5, 15, 8, 45);
    const value = new Date(2024, 5, 16, 9, 15);
    maxDate(limit)(value);
    expect([limit, value]).toEqual([new Date(2024, 5, 15, 8, 45), new Date(2024, 5, 16, 9, 15)]);
  });
});

describe('maxDate — «не позже сегодня»: maxDate(new Date())', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  it('сегодня вечером — проходит, хотя граница создана в полдень', () => {
    expect(maxDate(new Date())(new Date(2024, 5, 15, 21))).toBeNull();
  });

  it('вчера — проходит', () => {
    expect(maxDate(new Date())(new Date(2024, 5, 14))).toBeNull();
  });

  it('завтра — date_max', () => {
    expect(maxDate(new Date())(new Date(2024, 5, 16))?.code).toBe('date_max');
  });
});

describe('maxDate — опции', () => {
  it('свой код заменяет встроенный, params сливаются, параметры из опций главнее', () => {
    expect(
      maxDate(bound, { code: 'birthDate.maxDate', params: { maxDate: 'сегодня', hint: 1 } })(
        new Date(2030, 0, 1)
      )
    ).toEqual({ code: 'birthDate.maxDate', params: { maxDate: 'сегодня', hint: 1 } });
  });
});
