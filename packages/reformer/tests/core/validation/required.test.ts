/**
 * Regression: required() — default message и пустой массив.
 *
 * Дефект #17: без per-field `message` валидатор жёстко возвращал message: 'invalid',
 *   что затеняло документированную fallback-цепочку резолвера `message || code` —
 *   не-i18n форма показывала 'invalid' вместо кода 'required'. Теперь default = ''.
 * Дефект #21: пустой массив [] проходил required() как валидный, поэтому обязательный
 *   multi-select / FormArray без выбора молча проходил валидацию. Теперь [] отклоняется.
 */

import { describe, it, expect } from 'vitest';
import { required } from '../../../src/core/validation/validators/required';

const v = required() as unknown as (value: unknown) => { code: string; message: string } | null;

describe('required — default message (regression #17)', () => {
  it('без options.message возвращает пустое message (fallback на code)', () => {
    const err = v(null);
    expect(err).not.toBeNull();
    expect(err?.code).toBe('required');
    // Ключ фикса: message === '' → резолвер `message || code` доберётся до кода
    expect(err?.message).toBe('');
  });

  it('per-field message сохраняется', () => {
    const withMsg = required({ message: 'Обязательно' }) as unknown as (
      value: unknown
    ) => { message: string } | null;
    expect(withMsg('')?.message).toBe('Обязательно');
  });
});

describe('required — пустые значения (regression #21)', () => {
  it('пустой массив [] отклоняется', () => {
    const err = v([]);
    expect(err).not.toBeNull();
    expect(err?.code).toBe('required');
  });

  it('непустой массив валиден', () => {
    expect(v(['a'])).toBeNull();
    expect(v([0])).toBeNull();
  });

  it('прочие пустые: null/undefined/пустая строка/boolean false', () => {
    expect(v(null)).not.toBeNull();
    expect(v(undefined)).not.toBeNull();
    expect(v('')).not.toBeNull();
    expect(v(false)).not.toBeNull();
  });

  it('заполненные значения валидны', () => {
    expect(v('x')).toBeNull();
    expect(v(0)).toBeNull();
    expect(v(true)).toBeNull();
  });
});
