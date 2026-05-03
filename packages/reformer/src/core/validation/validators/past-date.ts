/**
 * Валидатор даты в прошлом
 *
 * @group Validation
 * @category Validators
 * @module validators/past-date
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';
import { parseDate, getToday, normalizeDate } from './date-utils';

/**
 * Проверяет, что дата находится в прошлом (не в будущем)
 *
 * Пустые значения и невалидные даты пропускаются (используйте `required` и `isDate`).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование - дата рождения не может быть в будущем
 * validationSchema: (path) => [
 *   pastDate(path.birthDate),
 * ]
 *
 * // С кастомным сообщением
 * pastDate(path.birthDate, { message: 'Дата рождения не может быть в будущем' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'date_future',
 *   message: 'Дата не может быть в будущем',
 *   params: {}
 * }
 * ```
 */
export function pastDate<TForm, TField extends string | Date | undefined = string | Date>(
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
      return null; // Невалидные даты пропускаем, это проверяет isDate
    }

    const normalizedValue = normalizeDate(parsed);
    const today = getToday();

    if (normalizedValue > today) {
      return {
        code: 'date_future',
        message: options?.message || 'Дата не может быть в будущем',
        params: options?.params,
      };
    }

    return null;
  });
}
