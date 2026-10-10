/**
 * Правило `maxLength(n)` — максимальная длина строки или массива (включительно).
 *
 * Длина — `value.length`: строка, массив, объект с числовым `length`. Пустые значения
 * (`null`/`undefined`/`''`) и значения без числового `length` пропускаются. Длина строки — в
 * UTF-16-единицах: эмодзи из суррогатной пары занимает две.
 */

import { describe, expect, it } from 'vitest';
import { maxLength } from '../../../src/form/validators/max-length';
import { describeRule } from '../../test-utils/rule-table';

describeRule('maxLength — строки', maxLength(3), [
  { value: 'abc', code: null, label: '"abc" — граница 3 проходит' },
  { value: 'a', code: null },
  { value: 'abcd', code: 'maxLength', params: { maxLength: 3, actualLength: 4 } },
  {
    value: '    ',
    code: 'maxLength',
    params: { maxLength: 3, actualLength: 4 },
    label: 'пробелы считаются',
  },
]);

describeRule('maxLength — массивы', maxLength(2), [
  { value: [], code: null },
  { value: [1, 2], code: null },
  { value: [1, 2, 3], code: 'maxLength', params: { maxLength: 2, actualLength: 3 } },
]);

describeRule('maxLength — суррогатные пары', maxLength(1), [
  // поведение под вопросом [ReFormer-cnk3]: пользователь видит один символ, правило — длину 2 (UTF-16), как
  // атрибут maxlength браузера; текст «не больше 1 символа, введено 2» для эмодзи сбивает с толку.
  {
    value: '😀',
    code: 'maxLength',
    params: { maxLength: 1, actualLength: 2 },
    label: '"😀" — length 2',
  },
  { value: 'я', code: null },
]);

describeRule('maxLength — объект с числовым length', maxLength(3), [
  { value: { length: 4 }, code: 'maxLength', params: { maxLength: 3, actualLength: 4 } },
  { value: { length: 3 }, code: null },
]);

describeRule('maxLength — пустые значения и значения без length пропускаются', maxLength(0), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
  { value: 12345, code: null, label: '12345 — у числа нет length' },
  { value: {}, code: null },
  { value: { length: '9' }, code: null, label: 'нечисловой length' },
]);

describe('maxLength — опции', () => {
  it('свой код заменяет встроенный, параметры правила остаются', () => {
    expect(maxLength(3, { code: 'bio.maxLength' })('abcd')).toEqual({
      code: 'bio.maxLength',
      params: { maxLength: 3, actualLength: 4 },
    });
  });

  it('params из опций сливаются с параметрами правила и главнее их', () => {
    expect(maxLength(3, { params: { actualLength: 'много', unit: 'символов' } })('abcd')).toEqual({
      code: 'maxLength',
      params: { maxLength: 3, actualLength: 'много', unit: 'символов' },
    });
  });
});
