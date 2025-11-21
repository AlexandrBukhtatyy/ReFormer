/**
 * Minimum value validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для min валидатора
 * Поддерживает опциональные поля (number | undefined)
 */
export function min<TForm, TField extends number | undefined = number>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  minValue: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath, (value) => {
    if (value === null || value === undefined) {
      return null; // Пропускаем, если пусто (используйте required для обязательности)
    }

    if (value < minValue) {
      return {
        code: 'min',
        message: options?.message || `Минимальное значение: ${minValue}`,
        params: { min: minValue, actual: value, ...options?.params },
      };
    }

    return null;
  });
}
