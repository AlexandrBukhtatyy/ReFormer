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
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.email, email());
 * validate(path.email, email({ message: 'Введите корректный email' }));
 * ```
 */
export function email<TForm = unknown, TField extends string | undefined = string>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (!value) {
      return null;
    }
    if (!EMAIL_REGEX.test(value as string)) {
      return {
        code: 'email',
        message: options?.message ?? 'Неверный формат email',
        params: options?.params,
      };
    }
    return null;
  };
}
