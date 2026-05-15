/**
 * Валидатор максимальной даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/max-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, normalizeDate } from './date-utils';

/**
 * Фабрика валидатора максимальной даты (включительно).
 *
 * Пустые и невалидные даты пропускаются.
 *
 * @example
 * ```typescript
 * validate(path.birthDate, maxDate(new Date())); // не позже сегодня
 * validate(path.endDate, maxDate(new Date('2025-12-31')));
 * ```
 */
export function maxDate<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(maxDateValue: Date, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const normalizedValue = normalizeDate(parsed);
    const normalizedMax = normalizeDate(maxDateValue);

    if (normalizedValue > normalizedMax) {
      return {
        code: 'date_max',
        message:
          options?.message ?? `Дата должна быть не позднее ${normalizedMax.toLocaleDateString()}`,
        params: { maxDate: maxDateValue, ...options?.params },
      };
    }
    return null;
  };
}
