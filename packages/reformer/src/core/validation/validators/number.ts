/**
 * Number validator with advanced options
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для number валидатора
 * Проверяет, что значение является числом и соответствует заданным ограничениям
 *
 * @example
 * ```typescript
 * number(path.age);
 * number(path.price, { min: 0, max: 1000000 });
 * number(path.percentage, { min: 0, max: 100, integer: true });
 * number(path.rating, { min: 0, max: 5, multipleOf: 0.5 });
 * ```
 */
export function number<TForm = any, TField extends number | undefined = number>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions & {
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
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    // Пропускаем null/undefined
    if (value === null || value === undefined) {
      return null;
    }

    // Проверка, что значение является числом
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        code: 'number',
        message: options?.message || 'Значение должно быть числом',
        params: options?.params,
      };
    }

    // Проверка на целое число
    if (options?.integer && !Number.isInteger(value)) {
      return {
        code: 'number_integer',
        message: options?.message || 'Значение должно быть целым числом',
        params: options?.params,
      };
    }

    // Проверка минимального значения
    if (options?.min !== undefined && value < options.min) {
      return {
        code: 'number_min',
        message: options?.message || `Значение должно быть не менее ${options.min}`,
        params: { min: options.min, ...options?.params },
      };
    }

    // Проверка максимального значения
    if (options?.max !== undefined && value > options.max) {
      return {
        code: 'number_max',
        message: options?.message || `Значение должно быть не более ${options.max}`,
        params: { max: options.max, ...options?.params },
      };
    }

    // Проверка кратности
    if (options?.multipleOf !== undefined && value % options.multipleOf !== 0) {
      return {
        code: 'number_multiple',
        message: options?.message || `Значение должно быть кратно ${options.multipleOf}`,
        params: { multipleOf: options.multipleOf, ...options?.params },
      };
    }

    // Проверка отрицательных чисел
    if (options?.allowNegative === false && value < 0) {
      return {
        code: 'number_negative',
        message: options?.message || 'Отрицательные числа не допускаются',
        params: options?.params,
      };
    }

    // Проверка нуля
    if (options?.allowZero === false && value === 0) {
      return {
        code: 'number_zero',
        message: options?.message || 'Ноль не допускается',
        params: options?.params,
      };
    }

    return null;
  });
}
