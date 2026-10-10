/**
 * Правило `pattern(regex)` — соответствие регулярному выражению.
 *
 * Регрессия #20: правило вызывало `regex.test(value)` на переданном экземпляре; с флагом `/g`
 * или `/y` метод stateful (двигает `lastIndex`), и один и тот же ввод чередовал valid/invalid.
 * Теперь правило клонирует regex и сбрасывает `lastIndex` на каждый вызов. Регрессия #17: у
 * замечания нет текста — только код и `params.pattern` (источник regex без флагов).
 */

import { describe, expect, it } from 'vitest';
import { pattern } from '../../../src/form/validators/pattern';
import { describeRule } from '../../test-utils/rule-table';

describeRule('pattern — совпадение', pattern(/^\d{3}$/), [
  { value: '123', code: null },
  { value: '12', code: 'pattern', params: { pattern: '^\\d{3}$' } },
  { value: '1234', code: 'pattern', params: { pattern: '^\\d{3}$' } },
  { value: 'abc', code: 'pattern', params: { pattern: '^\\d{3}$' } },
]);

describeRule('pattern — без якорей ищется подстрока', pattern(/abc/), [
  { value: 'xxabcxx', code: null },
  { value: 'ab', code: 'pattern', params: { pattern: 'abc' } },
]);

describeRule('pattern — флаги учитываются, в params только источник', pattern(/^[a-z]+$/i), [
  { value: 'AbC', code: null, label: '"AbC" — флаг /i' },
  { value: 'Ab1', code: 'pattern', params: { pattern: '^[a-z]+$' } },
]);

describeRule('pattern — пустые значения пропускаются', pattern(/^\d+$/), [
  { value: '', code: null },
  { value: null, code: null },
  { value: undefined, code: null },
]);

describe('pattern — stateful RegExp (regression #20)', () => {
  it('флаг /g: один и тот же валидный ввод стабильно валиден при повторных вызовах', () => {
    const rule = pattern(/abc/g);
    // До фикса: 1-й вызов ok, 2-й падал (lastIndex продвинулся мимо совпадения)
    for (let i = 0; i < 5; i++) {
      expect(rule('abc')).toBeNull();
    }
  });

  it('флаг /y (sticky): повторные вызовы детерминированы', () => {
    const rule = pattern(/abc/y);
    for (let i = 0; i < 5; i++) {
      expect(rule('abc')).toBeNull();
    }
  });

  it('не мутирует lastIndex переданного вызывающим экземпляра', () => {
    const re = /abc/g;
    const rule = pattern(re);
    rule('abc');
    expect(re.lastIndex).toBe(0);
  });

  it('lastIndex, сдвинутый вызывающим кодом, на правило не влияет', () => {
    const re = /abc/g;
    re.lastIndex = 2;
    expect(pattern(re)('abc')).toBeNull();
  });

  it('несовпадающий ввод стабильно отклоняется', () => {
    const rule = pattern(/^\d+$/g);
    for (let i = 0; i < 3; i++) {
      expect(rule('abc')?.code).toBe('pattern');
    }
  });

  it('чередование совпадающих и несовпадающих вводов не сбивает результат', () => {
    const rule = pattern(/\d/g);
    expect(
      [rule('1'), rule('a'), rule('2'), rule('2')].map((issue) => issue?.code ?? null)
    ).toEqual([null, 'pattern', null, null]);
  });
});

describe('pattern — код замечания (regression #17)', () => {
  it('без опций текста у замечания нет: код и источник regex', () => {
    expect(pattern(/^\d+$/)('abc')).toEqual({ code: 'pattern', params: { pattern: '^\\d+$' } });
  });

  it('свой код заменяет встроенный, params сливаются, параметры из опций главнее', () => {
    expect(
      pattern(/^\d+$/, {
        code: 'zip.pattern',
        params: { pattern: 'шесть цифр', example: '101000' },
      })('abc')
    ).toEqual({ code: 'zip.pattern', params: { pattern: 'шесть цифр', example: '101000' } });
  });
});
