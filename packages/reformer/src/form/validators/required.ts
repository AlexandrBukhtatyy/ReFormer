/**
 * Валидатор обязательного поля (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/required
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';

/**
 * Фабрика валидатора обязательного поля.
 *
 * Возвращает чистую функцию-валидатор `(value, control, root)`. Передаётся в `validate()`.
 *
 * Пустыми считаются: `null`, `undefined`, `''` (пустая строка), `[]` (пустой массив —
 * обязательный multi-select / FormArray без выбранных элементов).
 * Для boolean полей требуется значение `true`.
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Чистый валидатор {@link Validator} для поля схемы
 *
 * @example Обязательные поля в схеме формы
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.email, [required()]);
 *   validate(model.$.phone, [required({ message: 'Укажите номер телефона' })]);
 *   validate(model.$.agreeToTerms, [required({ message: 'Необходимо принять условия' })]);
 * });
 * ```
 */
export function required<TForm = unknown, TField = unknown>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'boolean' && value !== true);
    if (isEmpty) {
      return {
        code: 'required',
        message: options?.message ?? '',
        params: options?.params,
      };
    }
    return null;
  };
}
