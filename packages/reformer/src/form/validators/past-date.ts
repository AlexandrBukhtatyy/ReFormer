/**
 * Валидатор даты в прошлом (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/past-date
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, getToday, normalizeDate } from './date-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора, проверяющего что дата не в будущем.
 *
 * Дата не должна быть позже сегодняшнего дня (сравнение по нормализованным датам).
 * Пустые и невалидные даты пропускаются (используйте {@link required} и {@link isDate}).
 *
 * @param options - Опции валидатора ({@link RuleOptions}): `code`, `params`
 * @returns Правило {@link Rule} для поля даты (`string | Date`)
 *
 * @example Дата не в будущем
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, pastDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.birthDate, [required(), pastDate({ code: 'birthDate.pastDate' })]);
 * });
 * ```
 */
export function pastDate(options?: RuleOptions): Rule<string | Date | null | undefined> {
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

    if (normalizedValue > today) {
      return validationIssue('date_future', options);
    }
    return null;
  };
}
