/**
 * Валидатор минимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/min-age
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate, calculateAge } from './date-utils';

/**
 * Фабрика валидатора минимального возраста (по дате рождения).
 *
 * Пустые и невалидные даты пропускаются.
 *
 * @example
 * ```typescript
 * validate(path.birthDate, minAge(18));
 * validate(path.birthDate, minAge(21, { message: 'Вам должно быть не менее 21 года' }));
 * ```
 */
export function minAge<
  TForm = unknown,
  TField extends string | Date | null | undefined = string | Date,
>(minAgeValue: number, options?: ValidateOptions): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return null;
    }
    const age = calculateAge(parsed);
    if (age < minAgeValue) {
      return {
        code: 'date_min_age',
        message: options?.message ?? `Минимальный возраст: ${minAgeValue} лет`,
        params: { minAge: minAgeValue, currentAge: age, ...options?.params },
      };
    }
    return null;
  };
}
