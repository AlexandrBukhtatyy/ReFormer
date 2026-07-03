/**
 * Валидатор «не меньше нуля» (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/non-negative
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора, проверяющего что число неотрицательное (`≥ 0`).
 *
 * Пустые значения и не-числа пропускаются (используйте {@link required} и {@link isNumber}).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Чистый валидатор {@link Validator} для числового поля
 *
 * @example Проверка неотрицательности
 * ```typescript
 * import { nonNegative } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * balance: {
 *   value: model.$.balance,
 *   component: Input,
 *   validators: [nonNegative({ message: 'Баланс не может быть отрицательным' })],
 * },
 * ```
 */
export function nonNegative<TForm = unknown, TField extends number | null | undefined = number>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value as number)) return null;
    if ((value as number) < 0) {
      return {
        code: 'nonNegative',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
