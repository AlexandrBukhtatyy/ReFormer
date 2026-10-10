/**
 * Правило `maxAge(n)` — возраст по дате рождения не больше `n` полных лет.
 *
 * Граница включительна: в день `n`-летия проходит, на следующий день рождения — замечание.
 * Проверяются день рождения сегодня / вчера / завтра, рождённые 29 февраля в невисокосный год,
 * `params` (`maxAge`, `currentAge`). Часы фейковые (15.06.2024 12:00 локального времени), даты —
 * локальными конструкторами.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maxAge } from '../../../src/form/validators/max-age';
import { useFakeClock } from '../../test-utils/async';
import { checkRule } from '../../test-utils/rule-table';

describe('maxAge — граница 65 лет (сегодня 15.06.2024)', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  checkRule(maxAge(65), [
    { value: new Date(1959, 5, 15), code: null, label: '65 сегодня — проходит' },
    { value: new Date(1959, 5, 16), code: null, label: '65 исполнится завтра' },
    { value: new Date(1958, 5, 16), code: null, label: '66 исполнится завтра — пока 65' },
    { value: new Date(2000, 0, 1), code: null, label: 'намного младше' },
    { value: new Date(2030, 0, 1), code: null, label: 'дата рождения в будущем — возраст −6' },
    {
      value: new Date(1958, 5, 15),
      code: 'date_max_age',
      params: { maxAge: 65, currentAge: 66 },
      label: '66 сегодня — date_max_age',
    },
    {
      value: new Date(1958, 5, 14),
      code: 'date_max_age',
      params: { maxAge: 65, currentAge: 66 },
      label: '66 исполнилось вчера',
    },
    {
      value: '1958-06-15T23:00',
      code: 'date_max_age',
      params: { maxAge: 65, currentAge: 66 },
      label: '"1958-06-15T23:00" — 66',
    },
  ]);
});

describe('maxAge — рождённые 29 февраля в невисокосный год', () => {
  beforeEach(() => useFakeClock(new Date(2022, 1, 28, 12)));
  afterEach(() => vi.useRealTimers());

  // поведение под вопросом [ReFormer-iioz]: в невисокосный год 66 исполняется 1 марта, а не 28 февраля.
  it('28 февраля 2022 рождённому 29.02.1956 ещё 65', () => {
    expect(maxAge(65)(new Date(1956, 1, 29))).toBeNull();
  });

  it('1 марта 2022 рождённому 29.02.1956 уже 66', () => {
    vi.setSystemTime(new Date(2022, 2, 1, 12));
    expect(maxAge(65)(new Date(1956, 1, 29))).toEqual({
      code: 'date_max_age',
      params: { maxAge: 65, currentAge: 66 },
    });
  });
});

describe('maxAge — пустые и невалидные даты пропускаются', () => {
  checkRule(maxAge(65), [
    { value: '', code: null },
    { value: null, code: null },
    { value: undefined, code: null },
    { value: 'not-a-date', code: null },
    { value: new Date(Number.NaN), code: null, label: 'Invalid Date' },
  ]);
});

describe('maxAge — опции', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  it('свой код заменяет встроенный, параметры правила остаются', () => {
    expect(maxAge(65, { code: 'birthDate.maxAge' })(new Date(1950, 0, 1))).toEqual({
      code: 'birthDate.maxAge',
      params: { maxAge: 65, currentAge: 74 },
    });
  });

  it('params из опций сливаются с параметрами правила и главнее их', () => {
    expect(
      maxAge(65, { params: { maxAge: 'пенсионный', product: 'ипотека' } })(new Date(1950, 0, 1))
    ).toEqual({
      code: 'date_max_age',
      params: { maxAge: 'пенсионный', currentAge: 74, product: 'ипотека' },
    });
  });
});
