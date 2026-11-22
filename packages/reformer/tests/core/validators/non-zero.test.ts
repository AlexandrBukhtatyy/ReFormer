/**
 * Правило `nonZero()` — число не равно нулю.
 *
 * И `0`, и `-0` дают замечание (`-0 === 0`); сколь угодно малые и бесконечные значения проходят.
 * Пустые значения и не-числа пропускаются — тип проверяет `isNumber()`.
 */

import { describe, expect, it } from 'vitest';
import { nonZero } from '../../../src/form/validators/non-zero';
import { describeRule } from '../../test-utils/rule-table';

describeRule('nonZero — ноль и знак нуля', nonZero(), [
  { value: 0, code: 'nonZero' },
  { value: -0, code: 'nonZero', label: '-0 — тоже ноль' },
  { value: 1, code: null },
  { value: -1, code: null },
  { value: Number.MIN_VALUE, code: null, label: 'Number.MIN_VALUE' },
  { value: Infinity, code: null },
  { value: -Infinity, code: null },
]);

describeRule('nonZero — пустые значения и не-числа пропускаются', nonZero(), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: NaN, code: null },
  { value: '0', code: null, label: '"0" — строка, не число' },
]);

describe('nonZero — опции', () => {
  it('у замечания только код, без params', () => {
    expect(nonZero()(0)).toEqual({ code: 'nonZero' });
  });

  it('свой код и params', () => {
    expect(nonZero({ code: 'divisor.nonZero', params: { field: 'Делитель' } })(0)).toEqual({
      code: 'divisor.nonZero',
      params: { field: 'Делитель' },
    });
  });
});
