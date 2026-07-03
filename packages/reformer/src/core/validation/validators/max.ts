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
 * Пустые значения (`null`/`undefined`) пропускаются (используйте {@link required} для обязательности).
 *
 * @param maxValue - Максимально допустимое значение (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `max` и `actual`.
 * @returns Чистый валидатор {@link Validator} для числового поля
 *
 * @example Максимальное значение числового поля
 * ```typescript
 * import { required, max } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * quantity: { value: model.$.quantity, component: Input, validators: [max(100)] },
 * discount: {
 *   value: model.$.discount,
 *   component: Input,
 *   validators: [required(), max(50, { message: 'Не более 50%' })],
 * },
 * ```
 */
export function max<TForm = unknown, TField extends number | null | undefined = number>(
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
        message: options?.message ?? 'invalid',
        params: { max: maxValue, actual: value, ...options?.params },
      };
    }
    return null;
  };
}
