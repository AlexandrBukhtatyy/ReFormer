/**
 * Валидатор максимального значения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max
 */

import type { RuleOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationIssue } from './validation-issue';

/**
 * Фабрика валидатора максимального числового значения.
 *
 * Пустые значения и не-числа (`''`, строка из цифр, `NaN`) пропускаются — используйте
 * {@link required} и {@link isNumber}.
 *
 * @param maxValue - Максимально допустимое значение (включительно)
 * @param options - Опции валидатора ({@link RuleOptions}). В `params` ошибки автоматически
 *   попадают `max` и `actual`.
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Максимальное значение числового поля
 * ```typescript
 * import { defineValidation, validate } from '@reformer/core/validation';
 * import { required, max } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidation<MyForm>(({ model }) => {
 *   validate(model.$.quantity, [max(100)]);
 *   validate(model.$.discount, [required(), max(50, { code: 'discount.max' })]);
 * });
 * ```
 */
export function max(maxValue: number, options?: RuleOptions): Rule<number | null | undefined> {
  return (value) => {
    // Сравнение с приведением типов дало бы замечание для строки-числа '10'.
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }
    if (value > maxValue) {
      return validationIssue('max', options, { max: maxValue, actual: value });
    }
    return null;
  };
}
