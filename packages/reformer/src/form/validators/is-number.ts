/**
 * Валидатор «значение — число» (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/is-number
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора, проверяющего что значение — конечное число (не NaN, не строка).
 *
 * Пустые значения (`null`/`undefined`) пропускаются (используйте {@link required} для
 * обязательности). В отличие от других number-валидаторов, **не** пропускает не-числа
 * и `NaN` — это его задача.
 *
 * @param options - Опции валидатора ({@link RuleOptions}): `code`, `params`
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Проверка, что значение — число
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, isNumber } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.amount, [required(), isNumber({ code: 'amount.isNumber' })]);
 * });
 * ```
 */
export function isNumber(options?: RuleOptions): Rule<number | null | undefined> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) {
      return validationIssue('isNumber', options);
    }
    return null;
  };
}
