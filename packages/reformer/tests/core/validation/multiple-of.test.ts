/**
 * Regression: multipleOf с десятичным шагом.
 *
 * Баг (до фикса): `value % divisor !== 0` — JS `%` неточен для двоично-непредставимых чисел
 * (0.3 % 0.1 === 0.0999…), из-за чего легитимные кратные десятичного шага помечались невалидными.
 */

import { describe, it, expect } from 'vitest';
import { multipleOf } from '../../../src/core/validation/validators/multiple-of';

const v = multipleOf(0.1) as unknown as (value: unknown) => unknown;
const vHalf = multipleOf(0.5) as unknown as (value: unknown) => unknown;
const vInt = multipleOf(5) as unknown as (value: unknown) => unknown;

describe('multipleOf — десятичный шаг (epsilon-сравнение)', () => {
  it('десятичные кратные валидны (regression: были ложные ошибки)', () => {
    expect(v(0.3)).toBeNull(); // 0.3 % 0.1 === 0.0999… но 0.3 кратно 0.1
    expect(v(0.7)).toBeNull();
    expect(v(1.2)).toBeNull();
    expect(vHalf(2.5)).toBeNull();
    expect(vHalf(0)).toBeNull();
  });

  it('не-кратные отклоняются', () => {
    expect(v(0.35)).not.toBeNull();
    expect(vHalf(0.3)).not.toBeNull();
    expect(vInt(7)).not.toBeNull();
  });

  it('целые кратные и пустые/не-числа', () => {
    expect(vInt(10)).toBeNull();
    expect(vInt(0)).toBeNull();
    expect(v(null)).toBeNull();
    expect(v('x')).toBeNull();
  });
});
