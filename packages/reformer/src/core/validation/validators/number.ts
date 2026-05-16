/**
 * Валидатор числовых значений (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/number
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

export interface NumberValidatorOptions extends ValidateOptions {
  /** Минимальное значение (включительно) */
  min?: number;
  /** Максимальное значение (включительно) */
  max?: number;
  /** Требовать целое число */
  integer?: boolean;
  /** Значение должно быть кратно этому числу */
  multipleOf?: number;
  /** Разрешить отрицательные числа (по умолчанию true) */
  allowNegative?: boolean;
  /** Разрешить ноль (по умолчанию true) */
  allowZero?: boolean;
}

/**
 * Фабрика валидатора числа с расширенными ограничениями.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.age, number());
 * validate(path.price, number({ min: 0, max: 1000000 }));
 * validate(path.percentage, number({ min: 0, max: 100, integer: true }));
 * ```
 */
export function number<TForm = unknown, TField extends number | undefined = number>(
  options?: NumberValidatorOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'number' || isNaN(value as number)) {
      return {
        code: 'number',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    const num = value as number;

    if (options?.integer && !Number.isInteger(num)) {
      return {
        code: 'number_integer',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    if (options?.min !== undefined && num < options.min) {
      return {
        code: 'number_min',
        message: options?.message ?? 'invalid',
        params: { min: options.min, ...options?.params },
      };
    }
    if (options?.max !== undefined && num > options.max) {
      return {
        code: 'number_max',
        message: options?.message ?? 'invalid',
        params: { max: options.max, ...options?.params },
      };
    }
    if (options?.multipleOf !== undefined && num % options.multipleOf !== 0) {
      return {
        code: 'number_multiple',
        message: options?.message ?? 'invalid',
        params: { multipleOf: options.multipleOf, ...options?.params },
      };
    }
    if (options?.allowNegative === false && num < 0) {
      return {
        code: 'number_negative',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    if (options?.allowZero === false && num === 0) {
      return {
        code: 'number_zero',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }

    return null;
  };
}
