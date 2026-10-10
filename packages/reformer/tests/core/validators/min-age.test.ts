/**
 * Правило `minAge(n)` — возраст по дате рождения не меньше `n` полных лет.
 *
 * Регрессия: возраст считался через усреднённый год (365.25 дн), и `minAge(18)` отклонял того, кому
 * ровно 18 сегодня. Проверяются день рождения сегодня / вчера / завтра, время рождения, рождённые
 * 29 февраля в невисокосный год, `params` (`minAge`, `currentAge`). Часы фейковые (15.06.2024 12:00
 * локального времени), даты — локальными конструкторами; строки — дата-время без смещения.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { minAge } from '../../../src/form/validators/min-age';
import { useFakeClock } from '../../test-utils/async';
import { checkRule } from '../../test-utils/rule-table';

describe('minAge — граница 18 лет (сегодня 15.06.2024)', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  checkRule(minAge(18), [
    { value: new Date(2006, 5, 15), code: null, label: '18 сегодня — проходит (regression)' },
    { value: new Date(2006, 5, 14), code: null, label: 'день рождения был вчера' },
    { value: new Date(2006, 5, 15, 23, 59), code: null, label: 'время рождения не учитывается' },
    { value: new Date(1950, 0, 1), code: null, label: 'намного старше' },
    {
      value: new Date(2006, 5, 16),
      code: 'date_min_age',
      params: { minAge: 18, currentAge: 17 },
      label: '18 исполнится завтра — date_min_age',
    },
    {
      value: new Date(2024, 0, 1),
      code: 'date_min_age',
      params: { minAge: 18, currentAge: 0 },
      label: 'младенец',
    },
    { value: '2006-06-15T00:00', code: null, label: '"2006-06-15T00:00" — 18 сегодня' },
    {
      value: '2006-06-16T00:00',
      code: 'date_min_age',
      params: { minAge: 18, currentAge: 17 },
      label: '"2006-06-16T00:00" — 17',
    },
  ]);

  // поведение под вопросом [ReFormer-iioz]: дата рождения в будущем даёт currentAge: -1 — текст «вам −1 год»
  // вместо явной ошибки «дата рождения в будущем» (её даёт pastDate()).
  it('дата рождения в будущем — отрицательный currentAge', () => {
    expect(minAge(18)(new Date(2025, 0, 1))).toEqual({
      code: 'date_min_age',
      params: { minAge: 18, currentAge: -1 },
    });
  });

  it('сегодня берётся в момент проверки: на следующий день 17-летнему уже 18', () => {
    const rule = minAge(18);
    const birth = new Date(2006, 5, 16);
    expect(rule(birth)?.code).toBe('date_min_age');
    vi.setSystemTime(new Date(2024, 5, 16, 0, 0, 1));
    expect(rule(birth)).toBeNull();
  });
});

describe('minAge — рождённые 29 февраля в невисокосный год', () => {
  beforeEach(() => useFakeClock(new Date(2022, 1, 28, 12)));
  afterEach(() => vi.useRealTimers());

  // поведение под вопросом [ReFormer-iioz]: в невисокосный год 18 исполняется 1 марта, а не 28 февраля.
  it('28 февраля 2022 рождённому 29.02.2004 ещё 17', () => {
    expect(minAge(18)(new Date(2004, 1, 29))).toEqual({
      code: 'date_min_age',
      params: { minAge: 18, currentAge: 17 },
    });
  });

  it('1 марта 2022 рождённому 29.02.2004 уже 18', () => {
    vi.setSystemTime(new Date(2022, 2, 1, 12));
    expect(minAge(18)(new Date(2004, 1, 29))).toBeNull();
  });
});

describe('minAge — пустые и невалидные даты пропускаются', () => {
  checkRule(minAge(18), [
    { value: '', code: null },
    { value: null, code: null },
    { value: undefined, code: null },
    { value: 'not-a-date', code: null },
    { value: new Date(Number.NaN), code: null, label: 'Invalid Date' },
  ]);
});

describe('minAge — опции', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  it('свой код заменяет встроенный, параметры правила остаются', () => {
    expect(minAge(18, { code: 'birthDate.minAge' })(new Date(2010, 0, 1))).toEqual({
      code: 'birthDate.minAge',
      params: { minAge: 18, currentAge: 14 },
    });
  });

  it('params из опций сливаются с параметрами правила и главнее их', () => {
    expect(
      minAge(18, { params: { currentAge: 'мало', law: '152-ФЗ' } })(new Date(2010, 0, 1))
    ).toEqual({ code: 'date_min_age', params: { minAge: 18, currentAge: 'мало', law: '152-ФЗ' } });
  });
});
