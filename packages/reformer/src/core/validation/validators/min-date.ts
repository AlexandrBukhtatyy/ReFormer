/**
 * Валидатор минимальной даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/min-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, normalizeDate } from './date-utils';

/**
 * Фабрика валидатора минимальной даты (включительно).
 *
 * Пустые и невалидные даты пропускаются (используйте `required` и `isDate`).
 *
 * @example
 * ```typescript
 * validate(path.eventDate, minDate(new Date('2024-01-01')));
 * validate(path.startDate, minDate(new Date(), { message: 'Дата должна быть не раньше сегодня' }));
 * ```
 */
export function minDate<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(minDateValue: Date, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const normalizedValue = normalizeDate(parsed);
    const normalizedMin = normalizeDate(minDateValue);

    if (normalizedValue < normalizedMin) {
      return {
        code: 'date_min',
        message:
          options?.message ?? `Дата должна быть не ранее ${normalizedMin.toLocaleDateString()}`,
        params: { minDate: minDateValue, ...options?.params },
      };
    }
    return null;
  };
}
