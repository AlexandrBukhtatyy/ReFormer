/**
 * Правило `phone(options?)` — номер телефона по формату.
 *
 * Форматы: `international` (E.164 без разделителей), `ru` (+7/7/8, коды 4xx/8xx/9xx, разделители),
 * `us` (NANP), `any` — по умолчанию, «свободный формат: цифры, скобки и разделители». В `params`
 * замечания — выбранный `format`. Формат `any` — от 3 до 15 цифр с любыми разделителями между ними;
 * раньше он допускал не больше трёх групп цифр и отклонял привычную запись `+7 (999) 123-45-67`
 * [ReFormer-82wx].
 */

import { describe, expect, it } from 'vitest';
import { phone } from '../../../src/form/validators/phone';
import { describeRule } from '../../test-utils/rule-table';

const international = { format: 'international' } as const;

describeRule('phone — international (E.164)', phone(international), [
  { value: '+79991234567', code: null },
  { value: '79991234567', code: null, label: 'плюс необязателен' },
  { value: '+12', code: null, label: 'две цифры — минимум' },
  { value: '+123456789012345', code: null, label: '15 цифр — максимум E.164' },
  { value: '+1234567890123456', code: 'phone', params: international, label: '16 цифр' },
  { value: '+1', code: 'phone', params: international, label: 'одна цифра' },
  { value: '+0123', code: 'phone', params: international, label: 'код страны с нуля' },
  { value: '+7 999 123 45 67', code: 'phone', params: international, label: 'с разделителями' },
]);

describeRule('phone — ru', phone({ format: 'ru' }), [
  { value: '+7 (999) 123-45-67', code: null },
  { value: '+79991234567', code: null },
  { value: '89991234567', code: null },
  { value: '8 (495) 123-45-67', code: null, label: 'городской код 495' },
  { value: '+7-999-123-45-67', code: null },
  { value: '+7 999 123 45 67', code: null },
  { value: '9991234567', code: null, label: 'без префикса страны' },
  { value: '+7 (399) 123-45-67', code: 'phone', params: { format: 'ru' }, label: 'код 3xx' },
  { value: '+7 (999) 123-45-6', code: 'phone', params: { format: 'ru' }, label: 'на цифру короче' },
  { value: '+1 (555) 123-4567', code: 'phone', params: { format: 'ru' }, label: 'номер США' },
  // Код города — в парных скобках либо без них [ReFormer-cnk3].
  { value: '+7 (999 123-45-67', code: 'phone', params: { format: 'ru' }, label: 'непарная «(»' },
  { value: '+7 999) 123-45-67', code: 'phone', params: { format: 'ru' }, label: 'непарная «)»' },
]);

describeRule('phone — us (NANP)', phone({ format: 'us' }), [
  { value: '+1 (555) 123-4567', code: null },
  { value: '555-123-4567', code: null },
  { value: '5551234567', code: null },
  {
    value: '(555 123-4567',
    code: 'phone',
    params: { format: 'us' },
    label: 'непарная «(» [ReFormer-cnk3]',
  },
  { value: '1-555-123-4567', code: null },
  { value: '(155) 123-4567', code: 'phone', params: { format: 'us' }, label: 'код зоны с 1' },
  {
    value: '+7 (999) 123-45-67',
    code: 'phone',
    params: { format: 'us' },
    label: 'российский номер',
  },
]);

describeRule('phone — any', phone({ format: 'any' }), [
  { value: '+79991234567', code: null },
  { value: '+7 999 1234567', code: null },
  { value: '(495) 1234567', code: null },
  { value: '999-123-4567', code: null },
  { value: '999.123.4567', code: null },
  { value: '123', code: null, label: 'три цифры — минимум' },
  { value: '12', code: 'phone', params: { format: 'any' } },
  { value: 'abc', code: 'phone', params: { format: 'any' } },
  { value: '+7 999 123 45 6x', code: 'phone', params: { format: 'any' }, label: 'буква в номере' },
]);

describeRule('phone — формат по умолчанию any', phone(), [
  { value: '+79991234567', code: null },
  { value: 'abc', code: 'phone', params: { format: 'any' } },
]);

describeRule('phone — пустые значения пропускаются', phone({ format: 'ru' }), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
]);

describe('phone — опции', () => {
  it('свой код заменяет встроенный, format остаётся в params', () => {
    expect(phone({ format: 'ru', code: 'contacts.phone' })('abc')).toEqual({
      code: 'contacts.phone',
      params: { format: 'ru' },
    });
  });

  it('params из опций сливаются и главнее параметра format', () => {
    expect(
      phone({ format: 'ru', params: { format: '+7 (XXX) XXX-XX-XX', hint: 1 } })('abc')
    ).toEqual({
      code: 'phone',
      params: { format: '+7 (XXX) XXX-XX-XX', hint: 1 },
    });
  });
});

describe('phone — any: свободный формат [ReFormer-82wx]', () => {
  it('+7 (999) 123-45-67 проходит формат по умолчанию [ReFormer-82wx]', () => {
    expect(phone()('+7 (999) 123-45-67')).toBeNull();
  });

  it('привычные записи с группами цифр проходят', () => {
    expect(
      ['8 (999) 123-45-67', '+1 (555) 123-4567', '+44 20 7946 0958', '8.800.555.35.35'].map(
        (value) => phone()(value)
      )
    ).toEqual([null, null, null, null]);
  });

  it('больше 15 цифр, плюс не в начале и буквы — замечание', () => {
    expect(
      ['+1 234 567 890 123 456', '7+999 123 45 67', '+7 999 CALL NOW'].map(
        (value) => phone()(value)?.code
      )
    ).toEqual(['phone', 'phone', 'phone']);
  });
});
