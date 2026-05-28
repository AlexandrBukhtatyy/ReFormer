/**
 * Валидатор минимального значения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/min
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора минимального числового значения.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * import { validate } from '@reformer/core';
 * import { min } from '@reformer/core/validators';
 *
 * validate(path.age, min(18));
 * validate(path.quantity, min(1, { message: 'Минимум 1' }));
 * ```
 */
export function min<TForm = unknown, TField extends number | undefined = number>(
  minValue: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if ((value as number) < minValue) {
      return {
        code: 'min',
        message: options?.message ?? 'invalid',
        params: { min: minValue, actual: value, ...options?.params },
      };
    }
    return null;
  };
}
