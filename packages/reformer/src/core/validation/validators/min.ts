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
 * Пустые значения (`null`/`undefined`) пропускаются (используйте {@link required} для обязательности).
 *
 * @param minValue - Минимально допустимое значение (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `min` и `actual`.
 * @returns Чистый валидатор {@link Validator} для числового поля
 *
 * @example Минимальное значение числового поля
 * ```typescript
 * import { required, min } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * age: { value: model.$.age, component: Input, validators: [min(18)] },
 * quantity: {
 *   value: model.$.quantity,
 *   component: Input,
 *   validators: [required(), min(1, { message: 'Минимум 1' })],
 * },
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
