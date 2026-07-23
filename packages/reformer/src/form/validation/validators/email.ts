/**
 * Валидатор формата email (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/email
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

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
 * import { required, email } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * email: {
 *   value: model.$.email,
 *   component: Input,
 *   validators: [required(), email({ message: 'Введите корректный email' })],
 * },
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
