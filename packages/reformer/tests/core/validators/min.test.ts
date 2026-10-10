/**
 * Правило `min(n)` — нижняя граница числа (включительно).
 *
 * Граница проходит; в `params` замечания — порог и фактическое значение. `NaN` пропускается,
 * `-0` равен нулю, `-Infinity` меньше любого порога. По документации числовые правила, кроме
 * `isNumber`, пропускают пустые значения и не-числа; раньше `min` сравнивал через `<` с
 * приведением типов, и `''` / строка-число давали замечание — [ReFormer-qkxl].
 */

import { describe, expect, it } from 'vitest';
import { min } from '../../../src/form/validators/min';
import { describeRule } from '../../test-utils/rule-table';

describeRule('min — граница и параметры', min(10), [
  { value: 10, code: null, label: '10 — граница проходит' },
  { value: 10.000001, code: null },
  { value: Infinity, code: null },
  { value: 9.999, code: 'min', params: { min: 10, actual: 9.999 } },
  { value: -10, code: 'min', params: { min: 10, actual: -10 } },
  { value: -Infinity, code: 'min', params: { min: 10, actual: -Infinity } },
]);

describeRule('min — ноль и знак нуля', min(0), [
  { value: 0, code: null },
  { value: -0, code: null, label: '-0 равен 0 — проходит' },
  { value: -1e-9, code: 'min', params: { min: 0, actual: -1e-9 } },
]);

describeRule('min — отрицательный дробный порог', min(-2.5), [
  { value: -2.5, code: null },
  { value: -2.6, code: 'min', params: { min: -2.5, actual: -2.6 } },
]);

describeRule('min — пустые значения и NaN пропускаются', min(10), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: NaN, code: null },
  { value: 'abc', code: null, label: '"abc" — не число (сравнение с NaN ложно)' },
]);

describe('min — опции', () => {
  it('свой код заменяет встроенный, параметры правила остаются', () => {
    expect(min(18, { code: 'age.min' })(16)).toEqual({
      code: 'age.min',
      params: { min: 18, actual: 16 },
    });
  });

  it('params из опций сливаются с параметрами правила и главнее их', () => {
    expect(min(10, { params: { unit: 'лет', min: 'десять' } })(5)).toEqual({
      code: 'min',
      params: { min: 'десять', actual: 5, unit: 'лет' },
    });
  });
});

describe('min — не-числа пропускаются (документация) [ReFormer-qkxl]', () => {
  // Было: '' < 10 → 0 < 10 → замечание { min: 10, actual: '' }; при min(-5) — уже без замечания.
  it('пустая строка — пустое значение, замечания нет [ReFormer-qkxl]', () => {
    expect(min(10)('' as never)).toBeNull();
  });

  it("строка-число '3' — не число, правило её пропускает [ReFormer-qkxl]", () => {
    expect(min(5)('3' as never)).toBeNull();
  });
});
