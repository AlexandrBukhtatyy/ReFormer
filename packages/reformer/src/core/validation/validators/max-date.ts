/**
 * Валидатор максимальной даты
 *
 * @group Validation
 * @category Validators
 * @module validators/max-date
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';
import { parseDate, normalizeDate } from './date-utils';

/**
 * Проверяет, что дата не позже указанной максимальной
 *
 * Пустые значения и невалидные даты пропускаются (используйте `required` и `isDate`).
 *
 * @group Validation
 * @category Validators
 *
 * @param fieldPath - Путь к полю для валидации
 * @param maxDateValue - Максимально допустимая дата (включительно)
 * @param options - Опции валидации (message, params)
 *
 * @example
 * ```typescript
 * // Базовое использование
 * validationSchema: (path) => [
 *   maxDate(path.birthDate, new Date()), // Не позже сегодня
 * ]
 *
 * // С кастомным сообщением
 * maxDate(path.endDate, new Date('2025-12-31'), { message: 'Дата не может быть позже конца года' })
 * ```
 *
 * @example
 * ```typescript
 * // Ошибка валидации
 * {
 *   code: 'date_max',
 *   message: 'Дата должна быть не позднее 31.12.2025',
 *   params: { maxDate: Date }
 * }
 * ```
 */
export function maxDate<TForm, TField extends string | Date | undefined = string | Date>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxDateValue: Date,
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
    const normalizedMax = normalizeDate(maxDateValue);

    if (normalizedValue > normalizedMax) {
      return {
        code: 'date_max',
        message:
          options?.message || `Дата должна быть не позднее ${normalizedMax.toLocaleDateString()}`,
        params: { maxDate: maxDateValue, ...options?.params },
      };
    }

    return null;
  });
}
