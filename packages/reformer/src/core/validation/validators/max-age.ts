/**
 * Валидатор максимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/max-age
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, calculateAge } from './date-utils';

/**
 * Фабрика валидатора максимального возраста (по дате рождения).
 *
 * Пустые и невалидные даты пропускаются.
 *
 * @example
 * ```typescript
 * validate(path.birthDate, maxAge(65));
 * validate(path.birthDate, maxAge(100, { message: 'Проверьте дату рождения' }));
 * ```
 */
export function maxAge<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(maxAgeValue: number, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const age = calculateAge(parsed);
    if (age > maxAgeValue) {
      return {
        code: 'date_max_age',
        message: options?.message ?? 'invalid',
        params: { maxAge: maxAgeValue, currentAge: age, ...options?.params },
      };
    }
    return null;
  };
}
