/**
 * Валидатор минимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min-age
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, calculateAge } from './date-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора минимального возраста (по дате рождения).
 *
 * Возраст вычисляется по дате рождения относительно сегодняшнего дня. Пустые и невалидные
 * даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param minAgeValue - Минимально допустимый возраст (в полных годах)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `minAge` и `currentAge`.
 * @returns Правило {@link Rule} для поля даты рождения (`string | Date`)
 *
 * @example Минимальный возраст
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, minAge } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.birthDate, [required(), minAge(18, { code: 'birthDate.minAge' })]);
 * });
 * ```
 */
export function minAge(
  minAgeValue: number,
  options?: RuleOptions
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
      return validationIssue('date_min_age', options, { minAge: minAgeValue, currentAge: age });
    }
    return null;
  };
}
