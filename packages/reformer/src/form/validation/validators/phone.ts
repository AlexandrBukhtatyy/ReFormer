/**
 * Валидатор номера телефона (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/phone
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Формат проверки номера телефона для валидатора {@link phone}.
 *
 * - `international` — международный формат E.164 (`+?[1-9]\d{1,14}`);
 * - `ru` — российские номера (`+7`/`7`/`8`, коды `4`/`8`/`9`, с разделителями);
 * - `us` — североамериканские номера (NANP);
 * - `any` — свободный формат: цифры, скобки и разделители (по умолчанию).
 */
export type PhoneFormat = 'international' | 'ru' | 'us' | 'any';

const PHONE_PATTERNS: Record<PhoneFormat, RegExp> = {
  international: /^\+?[1-9]\d{1,14}$/,
  ru: /^(\+7|7|8)?[\s-]?\(?[489][0-9]{2}\)?[\s-]?[0-9]{3}[\s-]?[0-9]{2}[\s-]?[0-9]{2}$/,
  us: /^(\+?1)?[\s-]?\(?[2-9]\d{2}\)?[\s-]?\d{3}[\s-]?\d{4}$/,
  any: /^\+?\(?[0-9]{1,4}\)?[-\s.]?\(?[0-9]{1,4}\)?[-\s.]?[0-9]{1,9}$/,
};

/**
 * Опции валидатора {@link phone}. Расширяют {@link ValidateOptions} (`message`, `params`)
 * выбором формата номера.
 */
export interface PhoneValidatorOptions extends ValidateOptions {
  /** Формат проверки {@link PhoneFormat}. По умолчанию `'any'`. */
  format?: PhoneFormat;
}

/**
 * Фабрика валидатора номера телефона.
 *
 * Проверяет значение по regex выбранного {@link PhoneFormat}. Пустые значения
 * (`''`/`null`/`undefined`) пропускаются (используйте {@link required} для обязательности).
 *
 * @param options - Опции валидатора {@link PhoneValidatorOptions}. В `params` ошибки
 *   автоматически попадает выбранный `format`.
 * @returns Чистый валидатор {@link Validator} для строкового поля
 *
 * @example Проверка номера телефона
 * ```typescript
 * import { required, phone } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * phone: {
 *   value: model.$.phone,
 *   component: Input,
 *   validators: [required(), phone({ format: 'ru' })],
 * },
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
        message: options?.message ?? 'invalid',
        params: { format, ...options?.params },
      };
    }
    return null;
  };
}
