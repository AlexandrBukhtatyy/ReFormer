/**
 * Правило `pastDate()` — дата не в будущем (сегодня допустимо).
 *
 * «Сегодня» берётся в момент проверки, а не при создании правила; время значения не учитывается.
 * Код замечания называет нарушение: `date_future` — «дата оказалась в будущем». Часы фейковые
 * (15.06.2024 12:00 локального времени), даты — локальными конструкторами.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pastDate } from '../../../src/form/validators/past-date';
import { useFakeClock } from '../../test-utils/async';
import { checkRule } from '../../test-utils/rule-table';

describe('pastDate — относительно сегодняшнего дня', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  checkRule(pastDate(), [
    { value: new Date(2024, 5, 15), code: null, label: 'сегодня в 00:00 — проходит' },
    {
      value: new Date(2024, 5, 15, 23, 59, 59, 999),
      code: null,
      label: 'сегодня в 23:59 — проходит',
    },
    { value: new Date(2024, 5, 14), code: null, label: 'вчера' },
    { value: new Date(1990, 0, 1), code: null, label: 'давно' },
    { value: new Date(2024, 5, 16), code: 'date_future', label: 'завтра в 00:00 — date_future' },
    { value: new Date(2030, 0, 1), code: 'date_future', label: 'нескоро' },
    { value: '2024-06-15T23:00', code: null, label: '"2024-06-15T23:00" — сегодня' },
    { value: '2024-06-16T00:30', code: 'date_future', label: '"2024-06-16T00:30" — завтра' },
  ]);

  it('у замечания только код', () => {
    expect(pastDate()(new Date(2024, 5, 16))).toEqual({ code: 'date_future' });
  });

  it('сегодня берётся в момент проверки, а не при создании правила', () => {
    const rule = pastDate();
    const nextDay = new Date(2024, 5, 16);
    expect(rule(nextDay)?.code).toBe('date_future');
    vi.setSystemTime(new Date(2024, 5, 16, 0, 0, 1));
    expect(rule(nextDay)).toBeNull();
  });
});

describe('pastDate — пустые и невалидные даты пропускаются', () => {
  checkRule(pastDate(), [
    { value: '', code: null },
    { value: null, code: null },
    { value: undefined, code: null },
    { value: 'not-a-date', code: null },
    { value: new Date(Number.NaN), code: null, label: 'Invalid Date' },
  ]);
});

describe('pastDate — опции', () => {
  it('свой код и params', () => {
    expect(
      pastDate({ code: 'birthDate.pastDate', params: { field: 'Дата рождения' } })(
        new Date(3000, 0, 1)
      )
    ).toEqual({ code: 'birthDate.pastDate', params: { field: 'Дата рождения' } });
  });
});
