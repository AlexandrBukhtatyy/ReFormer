/**
 * Правило `integer()` — число целое.
 *
 * Пустые значения и не-числа (включая `NaN`) пропускаются — тип проверяет `isNumber()`.
 * Бесконечность целым числом не считается (`Number.isInteger`), крупные числа с плавающей точкой
 * без дробной части — целые.
 */

import { describe, expect, it } from 'vitest';
import { integer } from '../../../src/form/validators/integer';
import { describeRule } from '../../test-utils/rule-table';

describeRule('integer — целые проходят', integer(), [
  { value: 0, code: null },
  { value: -0, code: null },
  { value: 5, code: null },
  { value: -5, code: null },
  { value: 1e21, code: null, label: '1e21 — целое в плавающей точке' },
  { value: Number.MAX_SAFE_INTEGER + 2, code: null, label: 'больше MAX_SAFE_INTEGER' },
]);

describeRule('integer — дробные и бесконечность отклоняются', integer(), [
  { value: 1.5, code: 'integer' },
  { value: -0.1, code: 'integer' },
  { value: Number.EPSILON, code: 'integer', label: 'Number.EPSILON' },
  { value: Infinity, code: 'integer' },
  { value: -Infinity, code: 'integer' },
]);

describeRule('integer — пустые значения и не-числа пропускаются', integer(), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: NaN, code: null },
  { value: '1.5', code: null, label: '"1.5" — строка, не число' },
]);

describe('integer — опции', () => {
  it('у замечания только код, без params', () => {
    expect(integer()(2.5)).toEqual({ code: 'integer' });
  });

  it('свой код и params', () => {
    expect(integer({ code: 'count.integer', params: { unit: 'шт.' } })(2.5)).toEqual({
      code: 'count.integer',
      params: { unit: 'шт.' },
    });
  });
});
