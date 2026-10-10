/**
 * Валидатор минимальной даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min-date
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, normalizeDate } from './date-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора минимальной даты (включительно).
 *
 * Сравнение по нормализованным датам (время обнуляется). Пустые и невалидные даты
 * пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param minDateValue - Минимально допустимая дата (включительно)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадает `minDate`.
 * @returns Правило {@link Rule} для поля даты (`string | Date`)
 *
 * @example Минимальная дата
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, minDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.startDate, [required(), minDate(new Date(), { code: 'startDate.minDate' })]);
 * });
 * ```
 */
export function minDate(
  minDateValue: Date,
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
    const normalizedValue = normalizeDate(parsed);
    const normalizedMin = normalizeDate(minDateValue);

    if (normalizedValue < normalizedMin) {
      return validationIssue('date_min', options, { minDate: minDateValue });
    }
    return null;
  };
}
