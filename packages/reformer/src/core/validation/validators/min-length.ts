/**
 * Валидатор минимальной длины (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/minLength
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

/**
 * Фабрика валидатора минимальной длины строки или массива.
 *
 * Пустые значения пропускаются (используйте `required` для обязательности).
 *
 * @example
 * ```typescript
 * validate(path.name, minLength(2));
 * validate(path.password, minLength(8, { message: 'Min 8 символов' }));
 * ```
 */
export function minLength<TForm = unknown, TField = unknown>(
  minLen: number,
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const len = (value as { length?: number }).length;
    if (typeof len !== 'number') return null;
    if (len < minLen) {
      return {
        code: 'minLength',
        message: options?.message ?? `Минимальная длина: ${minLen} символов`,
        params: { minLength: minLen, actualLength: len, ...options?.params },
      };
    }
    return null;
  };
}
