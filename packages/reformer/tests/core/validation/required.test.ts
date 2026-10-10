/**
 * Regression: required() — default message и пустой массив.
 *
 * Дефект #17: без per-field `message` валидатор жёстко возвращал message: 'invalid',
 *   что затеняло документированную fallback-цепочку резолвера `message || code` —
 *   не-i18n форма показывала 'invalid' вместо кода 'required'. Теперь default = ''.
 * Дефект #21: пустой массив [] проходил required() как валидный, поэтому обязательный
 *   multi-select / FieldArray без выбора молча проходил валидацию. Теперь [] отклоняется.
 */

import { describe, it, expect } from 'vitest';
import { required } from '../../../src/form/validators/required';

const v = required() as unknown as (value: unknown) => { code: string; message?: string } | null;

describe('required — код замечания (regression #17)', () => {
  it('текста у замечания нет: только код, по нему резолвер берёт строку', () => {
    const err = v(null);
    expect(err).toEqual({ code: 'required' });
  });

  it('свой код поля заменяет встроенный', () => {
    const withCode = required({ code: 'phone.required' }) as unknown as (
      value: unknown
    ) => { code: string } | null;
    expect(withCode('')).toEqual({ code: 'phone.required' });
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
