/**
 * Валидатор формата email (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module form/validators/email
 */

import type { Validator, ValidateOptions } from '../types/validation-schema';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Фабрика валидатора формата email.
 *
 * Проверяет по упрощённому regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Пустые значения
 * (`''`/`null`/`undefined`) пропускаются (используйте {@link required} для обязательности).
 *
 * @param options - Опции валидатора ({@link ValidateOptions}): `message`, `params`
 * @returns Чистый валидатор {@link Validator} для строкового поля
 *
 * @example Проверка формата email
 * ```typescript
 * import { defineValidationSchema, validate } from '@reformer/core/validation';
 * import { required, email } from '@reformer/core/validators';
 *
 * // Правила живут в отдельной схеме над МОДЕЛЬЮ — layout-схема валидаторов не несёт.
 * const validation = defineValidationSchema<MyForm>(({ model }) => {
 *   validate(model.$.email, [required(), email({ message: 'Введите корректный email' })]);
 * });
 * ```
 */
export function email<TForm = unknown, TField extends string | null | undefined = string>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (!value) {
      return null;
    }
    if (!EMAIL_REGEX.test(value as string)) {
      return {
        code: 'email',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
