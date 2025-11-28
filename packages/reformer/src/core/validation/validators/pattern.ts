/**
 * Валидатор паттерна (регулярного выражения)
 *
 * @group Validation
 * @category Validators
 * @module validators/pattern
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Валидатор паттерна (регулярного выражения)
 *
 * Проверяет, что значение соответствует указанному регулярному выражению.
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации
 * @param regex - Регулярное выражение для проверки
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Только буквы
 * pattern(path.name, /^[а-яА-Яa-zA-Z]+$/)
 *
 * // Только цифры
 * pattern(path.code, /^\d+$/)
 *
 * // С кастомным сообщением
 * pattern(path.username, /^[a-z0-9_]+$/i, {
 *   message: 'Только латинские буквы, цифры и подчёркивание'
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'pattern',
 *   message: 'Значение не соответствует требуемому формату',
 *   params: { pattern: '^[a-z]+$' }
 * }
 * ```
 */
export function pattern<TForm, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  regex: RegExp,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath, (value) => {
    if (!value) {
      return null;
    }

    if (!regex.test(value)) {
      return {
        code: 'pattern',
        message: options?.message || 'Значение не соответствует требуемому формату',
        params: { pattern: regex.source, ...options?.params },
      };
    }

    return null;
  });
}
