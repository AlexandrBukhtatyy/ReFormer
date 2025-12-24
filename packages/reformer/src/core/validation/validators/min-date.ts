/**
 * Валидатор минимальной даты
 *
 * @group Validation
 * @category Validators
 * @module validators/min-date
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';
import { parseDate, normalizeDate } from './date-utils';

/**
 * Проверяет, что дата не раньше указанной минимальной
 *
 * Пустые значения и невалидные даты пропускаются (используйте `required` и `isDate`).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации
 * @param minDateValue - Минимально допустимая дата (включительно)
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   minDate(path.eventDate, new Date('2024-01-01')),
 * ]
 *
 * // С кастомным сообщением
 * minDate(path.startDate, new Date(), { message: 'Дата должна быть не раньше сегодня' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'date_min',
 *   message: 'Дата должна быть не ранее 01.01.2024',
 *   params: { minDate: Date }
 * }
 * ```
 */
export function minDate<TForm, TField extends string | Date | undefined = string | Date>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  minDateValue: Date,
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
    const normalizedMin = normalizeDate(minDateValue);

    if (normalizedValue < normalizedMin) {
      return {
        code: 'date_min',
        message:
          options?.message || `Дата должна быть не ранее ${normalizedMin.toLocaleDateString()}`,
        params: { minDate: minDateValue, ...options?.params },
      };
    }

    return null;
  });
}
