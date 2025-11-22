/**
 * Валидатор минимального значения
 * @module validators/min
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Валидатор минимального числового значения
 *
 * Проверяет, что числовое значение не меньше указанного минимума.
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @param fieldPath - Путь к полю для валидации
 * @param minValue - Минимально допустимое значение
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   min(path.age, 18),
 *   min(path.quantity, 1),
 * ]
 *
 * // С кастомным сообщением
 * min(path.age, 18, { message: 'Вам должно быть не менее 18 лет' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'min',
 *   message: 'Минимальное значение: 18',
 *   params: { min: 18, actual: 16 }
 * }
 * ```
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
