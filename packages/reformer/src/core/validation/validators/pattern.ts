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
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.name, pattern(/^[а-яА-Яa-zA-Z]+$/));
 * validate(path.code, pattern(/^\d+$/, { message: 'Только цифры' }));
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
        message: options?.message ?? 'Значение не соответствует требуемому формату',
        params: { pattern: regex.source, ...options?.params },
      };
    }
    return null;
  };
}
