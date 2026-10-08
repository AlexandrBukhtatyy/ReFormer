/**
 * Валидатор «значение — число» (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/is-number
 */

import type { ValidateOptions } from '../types/validation-schema';
import type { Rule } from '../validation/types';
import { validationError } from './validation-error';

/**
 * Фабрика валидатора, проверяющего что значение — конечное число (не NaN, не строка).
 *
 * Пустые значения (`null`/`undefined`) пропускаются (используйте {@link required} для
 * обязательности). В отличие от других number-валидаторов, **не** пропускает не-числа
 * и `NaN` — это его задача.
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Правило {@link Rule} для числового поля
 *
 * @example Проверка, что значение — число
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, isNumber } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.amount, [required(), isNumber({ message: 'Введите число' })]);
 * });
 * ```
 */
export function isNumber(options?: ValidateOptions): Rule<number | null | undefined> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value)) {
      return validationError('isNumber', options);
    }
    return null;
  };
}
