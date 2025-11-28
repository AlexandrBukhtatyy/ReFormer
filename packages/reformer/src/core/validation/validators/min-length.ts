/**
 * Валидатор минимальной длины строки
 *
 * @group Validation
 * @category Validators
 * @module validators/minLength
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Валидатор минимальной длины строки
 *
 * Проверяет, что длина строки не меньше указанного минимума.
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации
 * @param minLen - Минимальная допустимая длина строки
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   minLength(path.name, 2),
 *   minLength(path.password, 8),
 * ]
 *
 * // С кастомным сообщением
 * minLength(path.password, 8, { message: 'Пароль должен быть не менее 8 символов' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'minLength',
 *   message: 'Минимальная длина: 8 символов',
 *   params: { minLength: 8, actualLength: 3 }
 * }
 * ```
 */
export function minLength<TForm, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  minLen: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath, (value) => {
    if (!value) {
      return null;
    }

    if (value.length < minLen) {
      return {
        code: 'minLength',
        message: options?.message || `Минимальная длина: ${minLen} символов`,
        params: { minLength: minLen, actualLength: value.length, ...options?.params },
      };
    }

    return null;
  });
}
