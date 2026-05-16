/**
 * Валидатор проверки формата даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/is-date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';
import { parseDate } from './date-utils';

/**
 * Фабрика валидатора, проверяющего что значение — валидная дата.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.birthDate, isDate());
 * validate(path.eventDate, isDate({ message: 'Введите корректную дату' }));
 * ```
 */
export function isDate<TForm = unknown, TField extends string | Date | undefined = string | Date>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value as string | Date);
    if (parsed === null) {
      return {
        code: 'date_invalid',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
