/**
 * Валидатор регулярного выражения (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/pattern
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора регулярного выражения.
 *
 * Пустые значения (`''`/`null`/`undefined`) пропускаются (используйте {@link required}
 * для обязательности).
 *
 * @param regex - Регулярное выражение для проверки значения
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадает `pattern` (строка-источник regex).
 * @returns Чистый валидатор {@link Validator} для строкового поля
 *
 * @example Проверка по регулярному выражению
 * ```typescript
 * import { required, pattern } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * name: {
 *   value: model.$.name,
 *   component: Input,
 *   validators: [pattern(/^[a-zA-Zа-яА-Я]+$/, { message: 'Только буквы' })],
 * },
 * phone: {
 *   value: model.$.phone,
 *   component: InputMask,
 *   validators: [
 *     required(),
 *     pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Формат +7 (999) 123-45-67' }),
 *   ],
 * },
 * ```
 */
export function pattern<TForm = unknown, TField extends string | undefined = string>(
  regex: RegExp,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (!value) {
      return null;
    }
    if (!regex.test(value as string)) {
      return {
        code: 'pattern',
        message: options?.message ?? 'invalid',
        params: { pattern: regex.source, ...options?.params },
      };
    }
    return null;
  };
}
