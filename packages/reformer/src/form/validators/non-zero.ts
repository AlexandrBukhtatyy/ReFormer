/**
 * Валидатор «не ноль» (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/non-zero
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationError } from './validation-error';

/**
 * Фабрика валидатора, проверяющего что число не равно нулю.
 *
 * Пустые значения и не-числа пропускаются (используйте {@link required} и {@link isNumber}).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Проверка «не ноль»
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { nonZero } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.divisor, [nonZero({ message: 'Не может быть нулём' })]);
 * });
 * ```
 */
export function nonZero(options?: ValidateOptions): Rule<number | null | undefined> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) return null;
    if (value === 0) {
      return validationError('nonZero', options);
    }
    return null;
  };
}
