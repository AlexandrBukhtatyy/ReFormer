/**
 * Валидатор кратности (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/multiple-of
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора, проверяющего что число кратно заданному.
 *
 * Пустые значения и не-числа пропускаются (используйте `required` и `isNumber`).
 *
 * @example
 * ```typescript
 * validate(path.price, multipleOf(0.01));
 * validate(path.rating, multipleOf(0.5, { message: 'Только шаг 0.5' }));
 * ```
 */
export function multipleOf<TForm = unknown, TField extends number | undefined = number>(
  divisor: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value as number)) return null;
    if ((value as number) % divisor !== 0) {
      return {
        code: 'multipleOf',
        message: options?.message ?? 'invalid',
        params: { multipleOf: divisor, ...options?.params },
      };
    }
    return null;
  };
}
