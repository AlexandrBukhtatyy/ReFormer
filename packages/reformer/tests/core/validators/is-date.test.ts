/**
 * Правило `isDate()` — значение является валидной датой.
 *
 * Принимает `Date` или строку. Строка `YYYY-MM-DD` разбирается по компонентам: несуществующая
 * календарная дата (`2023-02-29`) — замечание, хотя `new Date(string)` перенёс бы её на 1 марта
 * [ReFormer-eei6]. Остальные строки разбирает `new Date(string)` (V8). Невалидный `Date`,
 * неразборчивая строка и значения других типов (число-метка времени) — замечание `date_invalid`.
 */

import { describe, expect, it } from 'vitest';
import { isDate } from '../../../src/form/validators/is-date';
import { describeRule } from '../../test-utils/rule-table';

describeRule('isDate — валидные даты', isDate(), [
  { value: new Date(2024, 5, 15), code: null, label: 'Date' },
  { value: '2024-06-15', code: null, label: 'ISO-дата' },
  { value: '2024-06-15T10:30', code: null, label: 'ISO дата-время без смещения' },
  { value: '2024-06-15T10:30:00Z', code: null, label: 'ISO дата-время UTC' },
  { value: '2024-02-29', code: null, label: '29 февраля високосного года' },
]);

describeRule('isDate — невалидные значения', isDate(), [
  { value: new Date(Number.NaN), code: 'date_invalid', label: 'Invalid Date' },
  { value: 'not-a-date', code: 'date_invalid' },
  { value: '2024-13-01', code: 'date_invalid', label: 'тринадцатый месяц' },
  { value: '31.12.2024', code: 'date_invalid', label: 'ДД.ММ.ГГГГ движок не разбирает' },
  {
    value: 1718409600000,
    code: 'date_invalid',
    label: 'число-метка времени — не Date и не строка',
  },
  { value: 0, code: 'date_invalid', label: '0 — не Date и не строка' },
]);

describeRule('isDate — пустые значения пропускаются', isDate(), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
]);

describe('isDate — снисходительный разбор V8 (поведение под вопросом)', () => {
  // поведение под вопросом [ReFormer-iioz]: `new Date(string)` в V8 угадывает дату по обрывкам — строка с числом
  // становится 2001 годом, американский порядок ММ.ДД.ГГГГ разбирается. В другом движке (SSR не на
  // V8) результат может отличаться — правило зависит от реализации Date.parse.
  it.each([
    ['hello 1', 'строка с числом'],
    ['12.31.2024', 'ММ.ДД.ГГГГ'],
    ['March 7', 'месяц и день без года'],
  ])('%s (%s) — проходит', (value) => {
    expect(isDate()(value)).toBeNull();
  });
});

describe('isDate — опции', () => {
  it('у замечания только код', () => {
    expect(isDate()('x')).toEqual({ code: 'date_invalid' });
  });

  it('свой код и params', () => {
    expect(isDate({ code: 'eventDate.isDate', params: { example: '15.06.2024' } })('x')).toEqual({
      code: 'eventDate.isDate',
      params: { example: '15.06.2024' },
    });
  });
});

describe('isDate — несуществующая календарная дата [ReFormer-eei6]', () => {
  // `new Date('2023-02-29')` в V8 — 1 марта 2023: ISO-строка с днём вне месяца не отклонялась,
  // а переносилась; minDate/minAge затем сравнивали уже перенесённую дату.
  it('2023-02-29 (невисокосный год) — date_invalid [ReFormer-eei6]', () => {
    expect(isDate()('2023-02-29')?.code).toBe('date_invalid');
  });

  it('день и месяц вне диапазона — date_invalid', () => {
    expect(
      ['2024-02-30', '2024-04-31', '2024-13-01', '2024-00-10', '2024-01-00'].map(
        (value) => isDate()(value)?.code
      )
    ).toEqual(Array(5).fill('date_invalid'));
  });

  it('29 февраля високосного года и год меньше 100 — существующие даты', () => {
    expect([isDate()('2024-02-29'), isDate()('2000-02-29'), isDate()('0099-12-31')]).toEqual([
      null,
      null,
      null,
    ]);
  });
});
