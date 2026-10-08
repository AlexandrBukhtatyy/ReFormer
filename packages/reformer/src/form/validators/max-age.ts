/**
 * Валидатор максимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max-age
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, calculateAge } from './date-utils';
import { validationError } from './validation-error';

/**
 * Фабрика валидатора максимального возраста (по дате рождения).
 *
 * Возраст вычисляется по дате рождения относительно сегодняшнего дня. Пустые и невалидные
 * даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param maxAgeValue - Максимально допустимый возраст (в полных годах)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `maxAge` и `currentAge`.
 * @returns Правило {@link Rule} для поля даты рождения (`string | Date`)
 *
 * @example Максимальный возраст
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { maxAge } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.birthDate, [maxAge(100, { message: 'Проверьте дату рождения' })]);
 * });
 * ```
 */
export function maxAge(
  maxAgeValue: number,
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
    if (age > maxAgeValue) {
      return validationError('date_max_age', options, { maxAge: maxAgeValue, currentAge: age });
    }
    return null;
  };
}
