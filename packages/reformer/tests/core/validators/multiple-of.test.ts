/**
 * Правило `multipleOf(divisor)` — кратность числа делителю.
 *
 * Регрессия: правило сравнивало `value % divisor !== 0`, а `%` неточен для двоично-непредставимых
 * чисел (`0.3 % 0.1 === 0.0999…`) — легитимные кратные дробного шага помечались ошибкой. Затем
 * остаток сравнивался с абсолютным допуском 1e-9, который не растёт с величиной числа, — ложные
 * ошибки на крупных суммах ([ReFormer-csg2]). Теперь частное `value / divisor` сравнивается с
 * ближайшим целым с относительным допуском.
 */

import { describe, expect, it } from 'vitest';
import { multipleOf } from '../../../src/form/validators/multiple-of';
import { describeRule } from '../../test-utils/rule-table';

describeRule('multipleOf — десятичный шаг 0.1 (epsilon-сравнение)', multipleOf(0.1), [
  { value: 0.3, code: null, label: '0.3 — остаток 0.0999… около делителя (regression)' },
  { value: 0.7, code: null },
  { value: 1.2, code: null },
  { value: 0, code: null },
  { value: -0.3, code: null, label: '-0.3 — отрицательное кратное' },
  { value: 0.35, code: 'multipleOf', params: { multipleOf: 0.1 } },
]);

describeRule('multipleOf — шаг 0.5', multipleOf(0.5), [
  { value: 2.5, code: null },
  { value: 0, code: null },
  { value: -0, code: null },
  { value: 0.3, code: 'multipleOf', params: { multipleOf: 0.5 } },
]);

describeRule('multipleOf — целый шаг', multipleOf(5), [
  { value: 10, code: null },
  { value: 0, code: null },
  { value: -15, code: null },
  { value: 7, code: 'multipleOf', params: { multipleOf: 5 } },
  { value: Infinity, code: 'multipleOf', params: { multipleOf: 5 }, label: 'Infinity — некратно' },
]);

describeRule('multipleOf — отрицательный делитель', multipleOf(-3), [
  { value: 9, code: null },
  { value: -9, code: null },
  { value: 10, code: 'multipleOf', params: { multipleOf: -3 } },
]);

describeRule('multipleOf — пустые значения и не-числа пропускаются', multipleOf(0.1), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: NaN, code: null },
  { value: 'x', code: null },
  { value: '0.35', code: null, label: '"0.35" — строка, не число' },
]);

describe('multipleOf — вырожденный делитель — ошибка конфигурации [ReFormer-cnk3]', () => {
  // Раньше частное `x / 0` не было конечным, и правило молча отклоняло любое число, включая 0.
  it.each([0, -0, Number.NaN, Number.POSITIVE_INFINITY])(
    'multipleOf(%s) бросает RangeError',
    (divisor) => {
      expect(() => multipleOf(divisor)).toThrowError(
        /^\[@reformer\/core\] multipleOf\(.+\): делитель должен быть конечным числом, не равным нулю/
      );
    }
  );
});

describe('multipleOf — опции', () => {
  it('свой код заменяет встроенный, params сливаются, параметры из опций главнее', () => {
    expect(
      multipleOf(0.5, { code: 'rating.step', params: { multipleOf: '½', unit: 'балла' } })(0.3)
    ).toEqual({ code: 'rating.step', params: { multipleOf: '½', unit: 'балла' } });
  });
});

describe('multipleOf — крупные значения [ReFormer-csg2]', () => {
  it('сумма в копейках до миллиона проходит с шагом 0.01', () => {
    expect(multipleOf(0.01)(1234567.89)).toBeNull();
  });

  // 9 877 776.79 кратно 0.01, но абсолютный допуск 1e-9 меньше ошибки округления на этой величине.
  it('кратное 0.01 около десяти миллионов проходит [ReFormer-csg2]', () => {
    expect(multipleOf(0.01)(9877776.79)).toBeNull();
  });

  it('суммы с шагом 0.01 до двадцати миллионов проходят, середина шага — нет', () => {
    const rule = multipleOf(0.01);
    const amounts = Array.from({ length: 400 }, (_, index) => (index * 4_999_999 + 7) / 100);
    expect([
      amounts.filter((amount) => rule(amount) !== null),
      amounts.filter((amount) => rule(amount + 0.005) === null),
    ]).toEqual([[], []]);
  });
});
