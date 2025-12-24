/**
 * Валидатор даты в будущем
 *
 * @group Validation
 * @category Validators
 * @module validators/future-date
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';
import { parseDate, getToday, normalizeDate } from './date-utils';

/**
 * Проверяет, что дата находится в будущем (не в прошлом)
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
 * // Базовое использование - дата события должна быть в будущем
 * validationSchema: (path) => [
 *   futureDate(path.eventDate),
 * ]
 *
 * // С кастомным сообщением
 * futureDate(path.appointmentDate, { message: 'Дата записи должна быть в будущем' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'date_past',
 *   message: 'Дата не может быть в прошлом',
 *   params: {}
 * }
 * ```
 */
export function futureDate<TForm, TField extends string | Date | undefined = string | Date>(
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
      return null; // Невалидные даты пропускаются, это проверяет isDate
    }

    const normalizedValue = normalizeDate(parsed);
    const today = getToday();

    if (normalizedValue < today) {
      return {
        code: 'date_past',
        message: options?.message || 'Дата не может быть в прошлом',
        params: options?.params,
      };
    }

    return null;
  });
}
