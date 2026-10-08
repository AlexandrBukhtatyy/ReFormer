/**
 * Валидатор минимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min-age
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, calculateAge } from './date-utils';
import { validationError } from './validation-error';

/**
 * Фабрика валидатора минимального возраста (по дате рождения).
 *
 * Возраст вычисляется по дате рождения относительно сегодняшнего дня. Пустые и невалидные
 * даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param minAgeValue - Минимально допустимый возраст (в полных годах)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `minAge` и `currentAge`.
 * @returns Правило {@link Rule} для поля даты рождения (`string | Date`)
 *
 * @example Минимальный возраст
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, minAge } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.birthDate, [required(), minAge(18, { message: 'Вам должно быть не менее 18 лет' })]);
 * });
 * ```
 */
export function minAge(
  minAgeValue: number,
  options?: ValidateOptions
): Rule<string | Date | null | undefined> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value);
    if (parsed === null) {
      return null;
    }
    const age = calculateAge(parsed);
    if (age < minAgeValue) {
      return validationError('date_min_age', options, { minAge: minAgeValue, currentAge: age });
    }
    return null;
  };
}
