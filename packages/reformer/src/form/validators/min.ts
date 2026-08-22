/**
 * Валидатор минимального значения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/min
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';

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
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, min } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.age, [min(18)]);
 *   validate(model.$.quantity, [required(), min(1, { message: 'Минимум 1' })]);
 * });
 * ```
 */
export function min<TForm = unknown, TField extends number | null | undefined = number>(
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
