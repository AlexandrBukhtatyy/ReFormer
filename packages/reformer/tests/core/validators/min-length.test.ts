/**
 * Правило `minLength(n)` — минимальная длина строки или массива (включительно).
 *
 * Длина — `value.length`: работает со строкой, массивом и любым объектом с числовым `length`.
 * Пустые значения (`null`/`undefined`/`''`) и значения без числового `length` пропускаются.
 * Пустой массив пустым значением НЕ считается: документация советует `minLength(1)` как «хотя бы
 * один элемент». Длина строки — в UTF-16-единицах, как у атрибута `minlength`.
 */

import { describe, expect, it } from 'vitest';
import { minLength } from '../../../src/form/validators/min-length';
import { describeRule } from '../../test-utils/rule-table';

describeRule('minLength — строки', minLength(3), [
  { value: 'abc', code: null, label: '"abc" — граница 3 проходит' },
  { value: 'abcd', code: null },
  { value: 'ab', code: 'minLength', params: { minLength: 3, actualLength: 2 } },
  {
    value: ' ',
    code: 'minLength',
    params: { minLength: 3, actualLength: 1 },
    label: '" " — пробел: непустая строка длины 1',
  },
]);

describeRule('minLength — массивы', minLength(2), [
  { value: [1, 2], code: null },
  { value: [null, undefined], code: null, label: '[null, undefined] — считаются элементы' },
  // У массива — элементы, а не символы: свой код, чтобы текст говорил об элементах. Параметры
  // прежние — шаблон своего кода правила (`{minLength}`) у массива не ломается.
  { value: [1], code: 'minItems', params: { minLength: 2, actualLength: 1 } },
  // Пустой массив проверяется, а не пропускается (в отличие от minFiles([]) — см. min-files.test).
  { value: [], code: 'minItems', params: { minLength: 2, actualLength: 0 } },
]);

describeRule('minLength — суррогатные пары', minLength(2), [
  // поведение под вопросом [ReFormer-cnk3]: эмодзи — один видимый символ, но length 2 (UTF-16), как у атрибута
  // minlength браузера; графемы не считаются.
  { value: '😀', code: null, label: '"😀" — length 2 проходит minLength(2)' },
  { value: 'я', code: 'minLength', params: { minLength: 2, actualLength: 1 } },
]);

describeRule('minLength — объект с числовым length', minLength(3), [
  { value: { length: 1 }, code: 'minLength', params: { minLength: 3, actualLength: 1 } },
  { value: { length: 3 }, code: null },
]);

describeRule('minLength — пустые значения и значения без length пропускаются', minLength(3), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
  { value: 12, code: null, label: '12 — у числа нет length' },
  { value: true, code: null },
  { value: {}, code: null },
  { value: { length: '2' }, code: null, label: 'нечисловой length' },
]);

describe('minLength — опции', () => {
  it('свой код заменяет встроенный, параметры правила остаются', () => {
    expect(minLength(8, { code: 'password.minLength' })('short')).toEqual({
      code: 'password.minLength',
      params: { minLength: 8, actualLength: 5 },
    });
  });

  it('params из опций сливаются с параметрами правила и главнее их', () => {
    expect(minLength(1, { params: { minLength: 'один', item: 'тег' } })([])).toEqual({
      code: 'minItems',
      params: { minLength: 'один', actualLength: 0, item: 'тег' },
    });
  });
});
