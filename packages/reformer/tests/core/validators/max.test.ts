/**
 * Правило `max(n)` — верхняя граница числа (включительно).
 *
 * Граница проходит; в `params` замечания — порог и фактическое значение. `NaN` пропускается,
 * `-0` равен нулю, `Infinity` больше любого порога. Как и у `min`, не-числа пропускаются: раньше
 * сравнение `>` с приведением типов давало замечание на `''` при отрицательном пороге и на
 * строку-число [ReFormer-qkxl].
 */

import { describe, expect, it } from 'vitest';
import { max } from '../../../src/form/validators/max';
import { describeRule } from '../../test-utils/rule-table';

describeRule('max — граница и параметры', max(100), [
  { value: 100, code: null, label: '100 — граница проходит' },
  { value: 99.999, code: null },
  { value: -Infinity, code: null },
  { value: 100.001, code: 'max', params: { max: 100, actual: 100.001 } },
  { value: 1e9, code: 'max', params: { max: 100, actual: 1e9 } },
  { value: Infinity, code: 'max', params: { max: 100, actual: Infinity } },
]);

describeRule('max — ноль и знак нуля', max(0), [
  { value: 0, code: null },
  { value: -0, code: null, label: '-0 равен 0 — проходит' },
  { value: 1e-9, code: 'max', params: { max: 0, actual: 1e-9 } },
]);

describeRule('max — отрицательный дробный порог', max(-2.5), [
  { value: -2.5, code: null },
  { value: -2.4, code: 'max', params: { max: -2.5, actual: -2.4 } },
]);

describeRule('max — пустые значения и NaN пропускаются', max(100), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: NaN, code: null },
  { value: 'abc', code: null, label: '"abc" — не число (сравнение с NaN ложно)' },
]);

describe('max — опции', () => {
  it('свой код заменяет встроенный, параметры правила остаются', () => {
    expect(max(50, { code: 'discount.max' })(75)).toEqual({
      code: 'discount.max',
      params: { max: 50, actual: 75 },
    });
  });

  it('params из опций сливаются с параметрами правила и главнее их', () => {
    expect(max(50, { params: { unit: '%', actual: 'много' } })(75)).toEqual({
      code: 'max',
      params: { max: 50, actual: 'много', unit: '%' },
    });
  });
});

describe('max — не-числа пропускаются (документация) [ReFormer-qkxl]', () => {
  // Было: '' > -1 → 0 > -1 → замечание { max: -1, actual: '' }; при положительном пороге — нет.
  it('пустая строка — пустое значение, замечания нет [ReFormer-qkxl]', () => {
    expect(max(-1)('' as never)).toBeNull();
  });

  it("строка-число '10' — не число, правило её пропускает [ReFormer-qkxl]", () => {
    expect(max(5)('10' as never)).toBeNull();
  });
});
