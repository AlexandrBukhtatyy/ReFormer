/**
 * Валидатор целого числа (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/integer
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора, проверяющего что число — целое.
 *
 * Пустые значения и не-числа пропускаются (используйте `required` и `isNumber`).
 *
 * @example
 * ```typescript
 * validate(path.age, integer());
 * validate(path.count, integer({ message: 'Должно быть целым числом' }));
 * ```
 */
export function integer<TForm = unknown, TField extends number | undefined = number>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value as number)) return null;
    if (!Number.isInteger(value as number)) {
      return {
        code: 'integer',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
