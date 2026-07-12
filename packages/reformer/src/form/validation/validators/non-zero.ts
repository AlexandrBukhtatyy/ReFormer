/**
 * Валидатор «не ноль» (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/non-zero
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора, проверяющего что число не равно нулю.
 *
 * Пустые значения и не-числа пропускаются (используйте {@link required} и {@link isNumber}).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Чистый валидатор {@link Validator} для числового поля
 *
 * @example Проверка «не ноль»
 * ```typescript
 * import { nonZero } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * divisor: {
 *   value: model.$.divisor,
 *   component: Input,
 *   validators: [nonZero({ message: 'Не может быть нулём' })],
 * },
 * ```
 */
export function nonZero<TForm = unknown, TField extends number | null | undefined = number>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || isNaN(value as number)) return null;
    if ((value as number) === 0) {
      return {
        code: 'nonZero',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
