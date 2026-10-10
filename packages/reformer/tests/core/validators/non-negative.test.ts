/**
 * Правило `nonNegative()` — число не меньше нуля.
 *
 * `0` и `-0` проходят (`-0 < 0` ложно), `Infinity` проходит, любое отрицательное — замечание.
 * Пустые значения и не-числа пропускаются — тип проверяет `isNumber()`.
 */

import { describe, expect, it } from 'vitest';
import { nonNegative } from '../../../src/form/validators/non-negative';
import { describeRule } from '../../test-utils/rule-table';

describeRule('nonNegative — граница и знак', nonNegative(), [
  { value: 0, code: null },
  { value: -0, code: null, label: '-0 — не отрицательное' },
  { value: Number.MIN_VALUE, code: null, label: 'Number.MIN_VALUE' },
  { value: Infinity, code: null },
  { value: -1, code: 'nonNegative' },
  { value: -Number.MIN_VALUE, code: 'nonNegative', label: '-Number.MIN_VALUE' },
  { value: -Infinity, code: 'nonNegative' },
]);

describeRule('nonNegative — пустые значения и не-числа пропускаются', nonNegative(), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: NaN, code: null },
  { value: '-1', code: null, label: '"-1" — строка, не число' },
]);

describe('nonNegative — опции', () => {
  it('у замечания только код, без params', () => {
    expect(nonNegative()(-1)).toEqual({ code: 'nonNegative' });
  });

  it('свой код и params', () => {
    expect(nonNegative({ code: 'balance.nonNegative', params: { currency: 'RUB' } })(-1)).toEqual({
      code: 'balance.nonNegative',
      params: { currency: 'RUB' },
    });
  });
});
