/**
 * Валидатор даты в будущем (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/future-date
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, getToday, normalizeDate } from './date-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора, проверяющего что дата не в прошлом.
 *
 * Дата не должна быть раньше сегодняшнего дня (сравнение по нормализованным датам).
 * Пустые и невалидные даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param options - Опции валидатора ({@link RuleOptions}): `code`, `params`
 * @returns Правило {@link Rule} для поля даты (`string | Date`)
 *
 * @example Дата не в прошлом
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, futureDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.appointmentDate, [required(), futureDate({ code: 'appointmentDate.futureDate' })]);
 * });
 * ```
 */
export function futureDate(options?: RuleOptions): Rule<string | Date | null | undefined> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value);
    if (parsed === null) {
      return null;
    }
    const normalizedValue = normalizeDate(parsed);
    const today = getToday();

    if (normalizedValue < today) {
      return validationIssue('date_past', options);
    }
    return null;
  };
}
