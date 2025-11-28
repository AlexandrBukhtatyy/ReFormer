/**
 * Валидатор номера телефона
 *
 * @group Validation
 * @category Validators
 * @module validators/phone
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Формат телефона для валидации
 *
 * @group Validation
 * @category Validators
 */
export type PhoneFormat = 'international' | 'ru' | 'us' | 'any';

/**
 * Адаптер для phone валидатора
 * Поддерживает опциональные поля (string | undefined)
 *
 * @group Validation
 * @category Validators
 *
 * @example
 * ```typescript
 * phone(path.phoneNumber);
 * phone(path.phoneNumber, { format: 'ru' });
 * phone(path.phoneNumber, { format: 'international', message: 'Неверный формат телефона' });
 * ```
 */
export function phone<TForm, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions & {
    /** Формат телефона */
    format?: PhoneFormat;
  }
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  const format = options?.format || 'any';

  // Регулярные выражения для разных форматов
  const patterns: Record<PhoneFormat, RegExp> = {
    // Международный формат: +1234567890 или +1 234 567 8900
    international: /^\+?[1-9]\d{1,14}$/,
    // Российский формат: +7 (XXX) XXX-XX-XX, 8 (XXX) XXX-XX-XX, и вариации
    ru: /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/,
    // US формат: (123) 456-7890, 123-456-7890, 1234567890
    us: /^(\+?1)?[\s\-]?\(?[2-9]\d{2}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/,
    // Любой формат: минимум 10 цифр с возможными разделителями
    any: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
  };

  validate(fieldPath, (value) => {
    if (!value) {
      return null;
    }

    const regex = patterns[format];

    if (!regex.test(value)) {
      const formatMessages: Record<PhoneFormat, string> = {
        international: 'Введите телефон в международном формате (например, +1234567890)',
        ru: 'Введите российский номер телефона (например, +7 900 123-45-67)',
        us: 'Введите американский номер телефона (например, (123) 456-7890)',
        any: 'Неверный формат телефона',
      };

      return {
        code: 'phone',
        message: options?.message || formatMessages[format],
        params: { format, ...options?.params },
      };
    }

    return null;
  });
}
