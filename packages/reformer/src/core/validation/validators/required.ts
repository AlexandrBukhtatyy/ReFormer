/**
 * Валидатор обязательного поля (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/required
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора обязательного поля.
 *
 * Возвращает чистую функцию-валидатор `(value, control, root)`. Передаётся в `validate()`.
 *
 * Пустыми считаются: `null`, `undefined`, `''` (пустая строка).
 * Для boolean полей требуется значение `true`.
 *
 * @example
 * ```typescript
 * import { validate } from '@reformer/core';
 * import { required } from '@reformer/core/validators';
 *
 * validate(path.email, required());
 * validate(path.phone, required({ message: 'Укажите номер телефона' }));
 * validate(path.agreeToTerms, required({ message: 'Необходимо принять условия' }));
 * ```
 */
export function required<TForm = unknown, TField = unknown>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return {
        code: 'required',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    if (typeof value === 'boolean' && value !== true) {
      return {
        code: 'required',
        message: options?.message ?? 'invalid',
        params: options?.params,
      };
    }
    return null;
  };
}
