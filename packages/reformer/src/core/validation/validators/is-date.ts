/**
 * Валидатор проверки формата даты
 *
 * @group Validation
 * @category Validators
 * @module validators/is-date
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';
import { parseDate } from './date-utils';

/**
 * Проверяет, что значение является валидной датой
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   isDate(path.birthDate),
 *   isDate(path.eventDate),
 * ]
 *
 * // С кастомным сообщением
 * isDate(path.birthDate, { message: 'Введите корректную дату' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'date_invalid',
 *   message: 'Неверный формат даты',
 *   params: {}
 * }
 * ```
 */
export function isDate<TForm, TField extends string | Date | undefined = string | Date>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = parseDate(value as string | Date);

    if (parsed === null) {
      return {
        code: 'date_invalid',
        message: options?.message || 'Неверный формат даты',
        params: options?.params,
      };
    }

    return null;
  });
}
