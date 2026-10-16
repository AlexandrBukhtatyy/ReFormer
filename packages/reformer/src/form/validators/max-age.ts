/**
 * Валидатор максимального возраста (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max-age
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { parseDate, calculateAge, isFutureBirth } from './date-utils';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора максимального возраста (по дате рождения).
 *
 * Возраст вычисляется по дате рождения относительно сегодняшнего дня; родившийся 29 февраля в
 * невисокосный год взрослеет 28 февраля. Дату рождения в будущем правило не оценивает — её
 * отклоняет {@link minAge} (или {@link pastDate}); иначе пара правил на поле дала бы два
 * одинаковых замечания. Пустые и невалидные даты пропускаются (используйте {@link required} и
 * {@link isDate}).
 *
 * @param maxAgeValue - Максимально допустимый возраст (в полных годах)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `maxAge` и `currentAge`.
 * @returns Правило {@link Rule} для поля даты рождения (`string | Date`)
 *
 * @example Максимальный возраст
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { maxAge } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.birthDate, [maxAge(100, { code: 'birthDate.maxAge' })]);
 * });
 * ```
 */
export function maxAge(
  maxAgeValue: number,
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
    if (isFutureBirth(parsed)) return null;
    const age = calculateAge(parsed);
    if (age > maxAgeValue) {
      return validationIssue('date_max_age', options, { maxAge: maxAgeValue, currentAge: age });
    }
    return null;
  };
}
