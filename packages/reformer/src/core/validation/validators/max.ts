/**
 * Maximum value validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для max валидатора
 * Поддерживает опциональные поля (number | undefined)
 */
export function max<TForm, TField extends number | undefined = number>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxValue: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (value === null || value === undefined) {
      return null;
    }

    if (value > maxValue) {
      return {
        code: 'max',
        message: options?.message || `Максимальное значение: ${maxValue}`,
        params: { max: maxValue, actual: value, ...options?.params },
      };
    }

    return null;
  });
}
