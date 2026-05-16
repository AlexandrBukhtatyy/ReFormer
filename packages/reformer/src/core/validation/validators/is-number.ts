/**
 * Валидатор «значение — число» (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/is-number
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора, проверяющего что значение — конечное число (не NaN, не строка).
 *
 * Пустые значения (`null`/`undefined`) пропускаются (используйте `required` для обязательности).
 * В отличие от других number-валидаторов, **не** пропускает не-числа — это его задача.
 *
 * @example
 * ```typescript
 * validate(path.amount, isNumber());
 * validate(path.amount, isNumber({ message: 'Введите число' }));
 * ```
 */
export function isNumber<TForm = unknown, TField extends number | undefined = number>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value as number)) {
      return {
        code: 'isNumber',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
