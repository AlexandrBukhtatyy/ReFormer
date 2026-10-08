/**
 * Валидатор минимальной даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min-date
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, normalizeDate } from './date-utils';
import { validationError } from './validation-error';

/**
 * Фабрика валидатора минимальной даты (включительно).
 *
 * Сравнение по нормализованным датам (время обнуляется). Пустые и невалидные даты
 * пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param minDateValue - Минимально допустимая дата (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадает `minDate`.
 * @returns Правило {@link Rule} для поля даты (`string | Date`)
 *
 * @example Минимальная дата
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, minDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.startDate, [required(), minDate(new Date(), { message: 'Дата не раньше сегодня' })]);
 * });
 * ```
 */
export function minDate(
  minDateValue: Date,
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
    const normalizedValue = normalizeDate(parsed);
    const normalizedMin = normalizeDate(minDateValue);

    if (normalizedValue < normalizedMin) {
      return validationError('date_min', options, { minDate: minDateValue });
    }
    return null;
  };
}
