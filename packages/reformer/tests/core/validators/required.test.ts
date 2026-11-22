/**
 * Правило `required()` — обязательное поле.
 *
 * Пустыми считаются `null`, `undefined`, `''`, `[]` и любое boolean, кроме `true` (обязательный
 * чекбокс) — это единственное правило каталога, для которого пустое значение и есть ошибка.
 * Регрессии: #17 — у замечания нет текста, только код (строку даёт резолвер по коду); #21 — пустой
 * массив проходил как заполненный, и обязательный multi-select / FieldArray без выбора молча проходил.
 */

import { describe, expect, it } from 'vitest';
import { required } from '../../../src/form/validators/required';
import { describeRule } from '../../test-utils/rule-table';

describeRule('required — пустые значения', required(), [
  { value: null, code: 'required' },
  { value: undefined, code: 'required' },
  { value: '', code: 'required' },
  { value: [], code: 'required', label: '[] — пустой массив (regression #21)' },
  { value: false, code: 'required', label: 'false — чекбокс не отмечен' },
]);

describeRule('required — заполненные значения', required(), [
  { value: 'x', code: null },
  { value: ' ', code: null, label: '" " — пробел: пустой только ""' },
  { value: 0, code: null },
  { value: -0, code: null },
  { value: true, code: null },
  { value: ['a'], code: null },
  { value: [0], code: null, label: '[0] — массив с «ложным» элементом' },
  { value: [null], code: null, label: '[null] — длина 1' },
  { value: {}, code: null },
  { value: new Date(2024, 0, 1), code: null, label: 'Date' },
]);

describeRule(
  'required — NaN пуст: так выглядит очищенный числовой ввод [ReFormer-cnk3]',
  required(),
  [{ value: NaN, code: 'required' }]
);

describe('required — код замечания (regression #17)', () => {
  it('текста у замечания нет: только код, по нему резолвер берёт строку', () => {
    expect(required()(null)).toEqual({ code: 'required' });
  });

  it('свой код поля заменяет встроенный', () => {
    expect(required({ code: 'phone.required' })('')).toEqual({ code: 'phone.required' });
  });

  it('params из опций переходят в замечание (своих параметров у правила нет)', () => {
    expect(required({ params: { field: 'Телефон' } })([])).toEqual({
      code: 'required',
      params: { field: 'Телефон' },
    });
  });
});
