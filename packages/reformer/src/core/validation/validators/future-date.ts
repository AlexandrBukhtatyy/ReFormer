/**
 * Валидатор даты в будущем (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/future-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, getToday, normalizeDate } from './date-utils';

/**
 * Фабрика валидатора, проверяющего что дата не в прошлом.
 *
 * Пустые и невалидные даты пропускаются.
 *
 * @example
 * ```typescript
 * validate(path.eventDate, futureDate());
 * validate(path.appointmentDate, futureDate({ message: 'Дата записи должна быть в будущем' }));
 * ```
 */
export function futureDate<
  TForm = unknown,
  TField extends string | Date | undefined = string | Date,
>(options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const normalizedValue = normalizeDate(parsed);
    const today = getToday();

    if (normalizedValue < today) {
      return {
        code: 'date_past',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
