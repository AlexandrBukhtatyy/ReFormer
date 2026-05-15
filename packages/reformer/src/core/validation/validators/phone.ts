/**
 * Валидатор номера телефона (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/phone
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

export type PhoneFormat = 'international' | 'ru' | 'us' | 'any';

const PHONE_PATTERNS: Record<PhoneFormat, RegExp> = {
  international: /^\+?[1-9]\d{1,14}$/,
  ru: /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/,
  us: /^(\+?1)?[\s\-]?\(?[2-9]\d{2}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/,
  any: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
};

const FORMAT_MESSAGES: Record<PhoneFormat, string> = {
  international: 'Введите телефон в международном формате (например, +1234567890)',
  ru: 'Введите российский номер телефона (например, +7 900 123-45-67)',
  us: 'Введите американский номер телефона (например, (123) 456-7890)',
  any: 'Неверный формат телефона',
};

export interface PhoneValidatorOptions extends ValidateOptions {
  format?: PhoneFormat;
}

/**
 * Фабрика валидатора номера телефона.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.phone, phone());
 * validate(path.phone, phone({ format: 'ru' }));
 * ```
 */
export function phone<TForm = unknown, TField extends string | undefined = string>(
  options?: PhoneValidatorOptions
): Validator<TForm, TField> {
  const format: PhoneFormat = options?.format ?? 'any';
  const regex = PHONE_PATTERNS[format];

  return (value) => {
    if (!value) {
      return null;
    }
    if (!regex.test(value as string)) {
      return {
        code: 'phone',
        message: options?.message ?? FORMAT_MESSAGES[format],
        params: { format, ...options?.params },
      };
    }
    return null;
  };
}
