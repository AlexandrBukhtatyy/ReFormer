/**
 * Валидатор максимальной длины строки
 * @module validators/maxLength
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Валидатор максимальной длины строки
 *
 * Проверяет, что длина строки не превышает указанный максимум.
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @param fieldPath - Путь к полю для валидации
 * @param maxLen - Максимальная допустимая длина строки
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   maxLength(path.name, 50),
 *   maxLength(path.bio, 500),
 * ]
 *
 * // С кастомным сообщением
 * maxLength(path.bio, 500, { message: 'Максимум 500 символов' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'maxLength',
 *   message: 'Максимальная длина: 500 символов',
 *   params: { maxLength: 500, actualLength: 512 }
 * }
 * ```
 */
export function maxLength<TForm, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxLen: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath, (value) => {
    if (!value) {
      return null;
    }

    if (value.length > maxLen) {
      return {
        code: 'maxLength',
        message: options?.message || `Максимальная длина: ${maxLen} символов`,
        params: { maxLength: maxLen, actualLength: value.length, ...options?.params },
      };
    }

    return null;
  });
}
