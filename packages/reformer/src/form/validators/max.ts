/**
 * Валидатор максимального значения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/max
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';

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
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, max } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.quantity, [max(100)]);
 *   validate(model.$.discount, [required(), max(50, { message: 'Не более 50%' })]);
 * });
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
