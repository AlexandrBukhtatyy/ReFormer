/**
 * Валидатор минимального значения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора минимального числового значения.
 *
 * Пустые значения (`null`/`undefined`) пропускаются (используйте {@link required} для обязательности).
 *
 * @param minValue - Минимально допустимое значение (включительно)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `min` и `actual`.
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Минимальное значение числового поля
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, min } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.age, [min(18)]);
 *   validate(model.$.quantity, [required(), min(1, { code: 'quantity.min' })]);
 * });
 * ```
 */
export function min(minValue: number, options?: RuleOptions): Rule<number | null | undefined> {
  return (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (value < minValue) {
      return validationIssue('min', options, { min: minValue, actual: value });
    }
    return null;
  };
}
