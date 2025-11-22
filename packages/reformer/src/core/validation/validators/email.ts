/**
 * Валидатор формата email
 * @module validators/email
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Валидатор формата email
 *
 * Проверяет, что значение соответствует формату email адреса.
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @param fieldPath - Путь к полю для валидации
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   required(path.email),
 *   email(path.email),
 * ]
 *
 * // С кастомным сообщением
 * email(path.email, { message: 'Введите корректный email адрес' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'email',
 *   message: 'Неверный формат email',
 *   params: {}
 * }
 * ```
 */
export function email<TForm, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validate(fieldPath, (value) => {
    if (!value) {
      return null;
    }

    if (!emailRegex.test(value)) {
      return {
        code: 'email',
        message: options?.message || 'Неверный формат email',
        params: options?.params,
      };
    }

    return null;
  });
}
