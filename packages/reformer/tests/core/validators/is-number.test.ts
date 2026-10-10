/**
 * Правило `isNumber()` — значение является числом.
 *
 * Единственное числовое правило, которое НЕ пропускает не-числа и `NaN`: это его задача. По
 * документации — «конечное число (не строка, не NaN)», поэтому `±Infinity` даёт замечание
 * ([ReFormer-5v4x]); по общему правилу каталога пустая строка — пустое значение, которое правило
 * пропускает ([ReFormer-a4tk]).
 */

import { describe, expect, it } from 'vitest';
import { isNumber } from '../../../src/form/validators/is-number';
import { describeRule } from '../../test-utils/rule-table';

describeRule('isNumber — числа проходят', isNumber(), [
  { value: 0, code: null },
  { value: -0, code: null },
  { value: 1.5, code: null },
  { value: -42, code: null },
  { value: Number.MAX_VALUE, code: null, label: 'Number.MAX_VALUE' },
  { value: Number.MIN_VALUE, code: null, label: 'Number.MIN_VALUE' },
]);

describeRule('isNumber — не-числа и NaN отклоняются', isNumber(), [
  { value: NaN, code: 'isNumber' },
  { value: '5', code: 'isNumber', label: '"5" — строка, не число' },
  { value: 'abc', code: 'isNumber' },
  { value: true, code: 'isNumber' },
  { value: {}, code: 'isNumber' },
  { value: [], code: 'isNumber' },
  { value: [1], code: 'isNumber' },
]);

describeRule('isNumber — null и undefined пропускаются', isNumber(), [
  { value: null, code: null },
  { value: undefined, code: null },
]);

describe('isNumber — опции', () => {
  it('у замечания только код, без params', () => {
    expect(isNumber()(NaN)).toEqual({ code: 'isNumber' });
  });

  it('свой код и params', () => {
    expect(isNumber({ code: 'amount.isNumber', params: { hint: 'цифрами' } })(NaN)).toEqual({
      code: 'amount.isNumber',
      params: { hint: 'цифрами' },
    });
  });
});

describe('isNumber — конечное число [ReFormer-5v4x]', () => {
  it.each([Infinity, -Infinity])(
    '%s — не конечное число, замечание isNumber [ReFormer-5v4x]',
    (value) => {
      expect(isNumber()(value)?.code).toBe('isNumber');
    }
  );
});

describe('isNumber — пустая строка [ReFormer-a4tk]', () => {
  it('пустая строка — пустое значение, замечания нет [ReFormer-a4tk]', () => {
    expect(isNumber()('' as never)).toBeNull();
  });

  it('строка из пробела — не пустое значение и не число', () => {
    expect(isNumber()(' ' as never)?.code).toBe('isNumber');
  });
});
