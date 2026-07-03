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
 * Пустые значения и не-числа пропускаются (используйте {@link required} и {@link isNumber}).
 *
 * @param divisor - Делитель: значение должно быть кратно ему
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадает `multipleOf` (делитель).
 * @returns Чистый валидатор {@link Validator} для числового поля
 *
 * @example Проверка кратности
 * ```typescript
 * import { multipleOf } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * rating: {
 *   value: model.$.rating,
 *   component: Input,
 *   validators: [multipleOf(0.5, { message: 'Только шаг 0.5' })],
 * },
 * ```
 */
export function multipleOf<TForm = unknown, TField extends number | undefined = number>(
  divisor: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  // `%` точен только для двоично-представимых чисел: 0.3 % 0.1 === 0.0999…, поэтому сравниваем
  // остаток с допуском (иначе десятичный шаг вроде multipleOf(0.5) даёт ложные ошибки).
  const EPSILON = 1e-9;
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value as number)) return null;
    const remainder = Math.abs((value as number) % divisor);
    const isMultiple = remainder <= EPSILON || Math.abs(remainder - Math.abs(divisor)) <= EPSILON;
    if (!isMultiple) {
      return {
        code: 'multipleOf',
        message: options?.message ?? 'invalid',
        params: { multipleOf: divisor, ...options?.params },
      };
    }
    return null;
  };
}
