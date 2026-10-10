/**
 * Валидатор целого числа (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/integer
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора, проверяющего что число — целое.
 *
 * Пустые значения и не-числа пропускаются (используйте {@link required} и {@link isNumber}).
 *
 * @param options - Опции валидатора ({@link RuleOptions}): `code`, `params`
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Проверка целого числа
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, integer } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.count, [required(), integer({ code: 'count.integer' })]);
 * });
 * ```
 */
export function integer(options?: RuleOptions): Rule<number | null | undefined> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) return null;
    if (!Number.isInteger(value)) {
      return validationIssue('integer', options);
    }
    return null;
  };
}
