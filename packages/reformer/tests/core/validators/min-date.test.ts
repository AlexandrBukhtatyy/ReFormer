/**
 * Правило `minDate(date)` — дата не раньше границы (включительно).
 *
 * Сравниваются календарные дни: время у значения и у границы обнуляется, поэтому граница с часами
 * (`minDate(new Date())` — «не раньше сегодня») не отсекает сегодняшнюю дату с более ранним часом.
 * В `params.minDate` — исходная граница (со временем), правило её не мутирует. Пустые и невалидные
 * даты пропускаются. Даты — локальными конструкторами; строки — дата-время без смещения (локальное
 * время), чтобы результат не зависел от часового пояса.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { minDate } from '../../../src/form/validators/min-date';
import { useFakeClock } from '../../test-utils/async';
import { describeRule } from '../../test-utils/rule-table';

const bound = new Date(2024, 5, 15);

describeRule('minDate — граница 15.06.2024', minDate(bound), [
  { value: new Date(2024, 5, 15), code: null, label: 'граница проходит' },
  { value: new Date(2024, 5, 15, 23, 59, 59, 999), code: null, label: 'граница в конце дня' },
  { value: new Date(2024, 5, 16), code: null, label: 'день после границы' },
  { value: new Date(2030, 0, 1), code: null, label: 'далеко после границы' },
  {
    value: new Date(2024, 5, 14, 23, 59, 59, 999),
    code: 'date_min',
    params: { minDate: bound },
    label: 'накануне в 23:59 — date_min',
  },
  { value: new Date(1990, 0, 1), code: 'date_min', params: { minDate: bound }, label: 'давно' },
]);

describeRule('minDate — строки', minDate(bound), [
  { value: '2024-06-15T00:00', code: null, label: '"2024-06-15T00:00" — локальная полночь' },
  { value: '2024-06-14T23:00', code: 'date_min', params: { minDate: bound } },
]);

describeRule('minDate — пустые и невалидные даты пропускаются', minDate(bound), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
  { value: 'not-a-date', code: null },
  { value: new Date(Number.NaN), code: null, label: 'Invalid Date' },
]);

describe('minDate — время границы и значения не учитывается', () => {
  it('граница с часами не отсекает тот же день с более ранним часом', () => {
    expect(minDate(new Date(2024, 5, 15, 18, 30))(new Date(2024, 5, 15, 8))).toBeNull();
  });

  it('в params — исходная граница со временем', () => {
    const withTime = new Date(2024, 5, 15, 18, 30);
    expect(minDate(withTime)(new Date(2024, 5, 14, 20))).toEqual({
      code: 'date_min',
      params: { minDate: new Date(2024, 5, 15, 18, 30) },
    });
  });

  it('ни граница, ни значение не мутируются', () => {
    const limit = new Date(2024, 5, 15, 18, 30);
    const value = new Date(2024, 5, 14, 9, 15);
    minDate(limit)(value);
    expect([limit, value]).toEqual([new Date(2024, 5, 15, 18, 30), new Date(2024, 5, 14, 9, 15)]);
  });
});

describe('minDate — «не раньше сегодня»: minDate(new Date())', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  it('сегодня утром — проходит, хотя граница создана в полдень', () => {
    expect(minDate(new Date())(new Date(2024, 5, 15, 9))).toBeNull();
  });

  it('вчера — date_min', () => {
    expect(minDate(new Date())(new Date(2024, 5, 14))?.code).toBe('date_min');
  });

  it('завтра — проходит', () => {
    expect(minDate(new Date())(new Date(2024, 5, 16))).toBeNull();
  });
});

describe('minDate — опции', () => {
  it('свой код заменяет встроенный, params сливаются, параметры из опций главнее', () => {
    expect(
      minDate(bound, { code: 'startDate.minDate', params: { minDate: '15 июня', hint: 1 } })(
        new Date(2024, 0, 1)
      )
    ).toEqual({ code: 'startDate.minDate', params: { minDate: '15 июня', hint: 1 } });
  });
});
