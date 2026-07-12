/**
 * Regression: pattern() — stateful RegExp и default message.
 *
 * Дефект #20: pattern() вызывал regex.test(value) на переданном экземпляре RegExp. С флагом
 *   /g или /y `test` stateful (двигает lastIndex между вызовами), поэтому один и тот же
 *   валидный ввод чередовал valid/invalid. Фикс клонирует regex и сбрасывает lastIndex.
 * Дефект #17: без per-field message валидатор возвращал 'invalid', затеняя fallback на code.
 *   Теперь default = ''.
 */

import { describe, it, expect } from 'vitest';
import { pattern } from '../../../src/form/validation/validators/pattern';

describe('pattern — stateful RegExp determinism (regression #20)', () => {
  it('флаг /g: один и тот же валидный ввод стабильно валиден при повторных вызовах', () => {
    const v = pattern(/abc/g) as unknown as (value: unknown) => unknown;
    // До фикса: 1-й вызов ok, 2-й падал (lastIndex продвинулся мимо совпадения)
    for (let i = 0; i < 5; i++) {
      expect(v('abc')).toBeNull();
    }
  });

  it('флаг /y (sticky): повторные вызовы детерминированы', () => {
    const v = pattern(/abc/y) as unknown as (value: unknown) => unknown;
    for (let i = 0; i < 5; i++) {
      expect(v('abc')).toBeNull();
    }
  });

  it('не мутирует lastIndex переданного вызывающим экземпляра', () => {
    const re = /abc/g;
    const v = pattern(re) as unknown as (value: unknown) => unknown;
    v('abc');
    expect(re.lastIndex).toBe(0);
  });

  it('несовпадающий ввод стабильно отклоняется', () => {
    const v = pattern(/^\d+$/g) as unknown as (value: unknown) => { code: string } | null;
    for (let i = 0; i < 3; i++) {
      expect(v('abc')?.code).toBe('pattern');
    }
  });
});

describe('pattern — default message (regression #17)', () => {
  it('без options.message возвращает пустое message (fallback на code)', () => {
    const v = pattern(/^\d+$/) as unknown as (
      value: unknown
    ) => { code: string; message: string; params: Record<string, unknown> } | null;
    const err = v('abc');
    expect(err?.code).toBe('pattern');
    expect(err?.message).toBe('');
    expect(err?.params.pattern).toBe('^\\d+$');
  });

  it('пустые значения пропускаются', () => {
    const v = pattern(/^\d+$/) as unknown as (value: unknown) => unknown;
    expect(v('')).toBeNull();
    expect(v(null)).toBeNull();
    expect(v(undefined)).toBeNull();
  });
});
