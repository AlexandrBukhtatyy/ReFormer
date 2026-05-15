/**
 * Валидатор максимального значения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/max
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора максимального числового значения.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * import { validate } from '@reformer/core';
 * import { max } from '@reformer/core/validators';
 *
 * validate(path.quantity, max(100));
 * validate(path.discount, max(50, { message: 'Не более 50%' }));
 * ```
 */
export function max<TForm = unknown, TField extends number | undefined = number>(
  maxValue: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if ((value as number) > maxValue) {
      return {
        code: 'max',
        message: options?.message ?? `Максимальное значение: ${maxValue}`,
        params: { max: maxValue, actual: value, ...options?.params },
      };
    }
    return null;
  };
}
