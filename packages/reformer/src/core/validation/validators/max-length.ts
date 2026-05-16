/**
 * Валидатор максимальной длины (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/maxLength
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора максимальной длины строки или массива.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.name, maxLength(50));
 * validate(path.bio, maxLength(500, { message: 'Max 500 символов' }));
 * ```
 */
export function maxLength<TForm = unknown, TField = unknown>(
  maxLen: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const len = (value as { length?: number }).length;
    if (typeof len !== 'number') return null;
    if (len > maxLen) {
      return {
        code: 'maxLength',
        message: options?.message ?? 'invalid',
        params: { maxLength: maxLen, actualLength: len, ...options?.params },
      };
    }
    return null;
  };
}
