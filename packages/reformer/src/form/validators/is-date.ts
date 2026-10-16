/**
 * Валидатор проверки формата даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/is-date
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate } from './date-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора, проверяющего что значение — валидная дата.
 *
 * Строгий формат: `Date` либо строка `YYYY-MM-DD` с существующим днём календаря. Строки в иных
 * форматах (`'31.12.2024'`, `'March 7'`, дата со временем) — `date_invalid`. Пустые значения
 * (`''`/`null`/`undefined`) пропускаются (используйте {@link required} для обязательности).
 *
 * @param options - Опции валидатора ({@link RuleOptions}): `code`, `params`
 * @returns Правило {@link Rule} для поля даты (`string | Date`)
 *
 * @example Проверка валидности даты
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, isDate } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.eventDate, [required(), isDate({ code: 'eventDate.isDate' })]);
 * });
 * ```
 */
export function isDate(options?: RuleOptions): Rule<string | Date | null | undefined> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseDate(value);
    if (parsed === null) {
      return validationIssue('date_invalid', options);
    }
    return null;
  };
}
