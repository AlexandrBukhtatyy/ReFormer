/**
 * Правило `futureDate()` — дата не в прошлом (сегодня допустимо).
 *
 * «Сегодня» берётся в момент проверки, а не при создании правила; время значения не учитывается.
 * Код замечания называет нарушение: `date_past` — «дата оказалась в прошлом». Часы фейковые
 * (15.06.2024 12:00 локального времени), даты — локальными конструкторами.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { futureDate } from '../../../src/form/validators/future-date';
import { useFakeClock } from '../../test-utils/async';
import { checkRule } from '../../test-utils/rule-table';

describe('futureDate — относительно сегодняшнего дня', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  checkRule(futureDate(), [
    { value: new Date(2024, 5, 15), code: null, label: 'сегодня в 00:00 — проходит' },
    {
      value: new Date(2024, 5, 15, 23, 59, 59, 999),
      code: null,
      label: 'сегодня в 23:59 — проходит',
    },
    { value: new Date(2024, 5, 16), code: null, label: 'завтра' },
    { value: new Date(2030, 0, 1), code: null, label: 'нескоро' },
    { value: new Date(2024, 5, 14, 23, 59), code: 'date_past', label: 'вчера в 23:59 — date_past' },
    { value: new Date(1990, 0, 1), code: 'date_past', label: 'давно' },
    { value: '2024-06-15', code: null, label: '"2024-06-15" — сегодня' },
    { value: '2024-06-14', code: 'date_past', label: '"2024-06-14" — вчера' },
    { value: '2024-06-14T23:30', code: null, label: 'дата-время — не дата [ReFormer-iioz]' },
  ]);

  it('у замечания только код', () => {
    expect(futureDate()(new Date(2024, 5, 14))).toEqual({ code: 'date_past' });
  });

  it('сегодня берётся в момент проверки, а не при создании правила', () => {
    const rule = futureDate();
    const today = new Date(2024, 5, 15);
    expect(rule(today)).toBeNull();
    vi.setSystemTime(new Date(2024, 5, 16, 0, 0, 1));
    expect(rule(today)?.code).toBe('date_past');
  });
});

describe('futureDate — пустые и невалидные даты пропускаются', () => {
  checkRule(futureDate(), [
    { value: '', code: null },
    { value: null, code: null },
    { value: undefined, code: null },
    { value: 'not-a-date', code: null },
    { value: new Date(Number.NaN), code: null, label: 'Invalid Date' },
  ]);
});

describe('futureDate — опции', () => {
  it('свой код и params', () => {
    expect(
      futureDate({ code: 'appointment.futureDate', params: { field: 'Дата визита' } })(
        new Date(2000, 0, 1)
      )
    ).toEqual({ code: 'appointment.futureDate', params: { field: 'Дата визита' } });
  });
});
