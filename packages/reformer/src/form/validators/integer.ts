/**
 * Валидатор целого числа (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/integer
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationError } from './validation-error';

/**
 * Фабрика валидатора, проверяющего что число — целое.
 *
 * Пустые значения и не-числа пропускаются (используйте {@link required} и {@link isNumber}).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Проверка целого числа
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, integer } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.count, [required(), integer({ message: 'Должно быть целым числом' })]);
 * });
 * ```
 */
export function integer(options?: ValidateOptions): Rule<number | null | undefined> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) return null;
    if (!Number.isInteger(value)) {
      return validationError('integer', options);
    }
    return null;
  };
}
