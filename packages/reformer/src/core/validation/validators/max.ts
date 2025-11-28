/**
 * Валидатор максимального значения
 *
 * @group Validation
 * @category Validators
 * @module validators/max
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Валидатор максимального числового значения
 *
 * Проверяет, что числовое значение не превышает указанный максимум.
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации
 * @param maxValue - Максимально допустимое значение
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   max(path.quantity, 100),
 *   max(path.discount, 50),
 * ]
 *
 * // С кастомным сообщением
 * max(path.quantity, 100, { message: 'Максимум 100 единиц' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'max',
 *   message: 'Максимальное значение: 100',
 *   params: { max: 100, actual: 150 }
 * }
 * ```
 */
export function max<TForm, TField extends number | undefined = number>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxValue: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath, (value) => {
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
