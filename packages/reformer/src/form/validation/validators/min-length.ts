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
 * Работает со строкой или массивом (проверяется `value.length`). Пустые значения
 * (`null`/`undefined`/`''`) и значения без числового `length` пропускаются
 * (используйте {@link required} для обязательности).
 *
 * @param minLen - Минимально допустимая длина (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `minLength` и `actualLength`.
 * @returns Чистый валидатор {@link Validator} для строки или массива
 *
 * @example Минимальная длина строки
 * ```typescript
 * import { required, minLength } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * name: { value: model.$.name, component: Input, validators: [minLength(2)] },
 * password: {
 *   value: model.$.password,
 *   component: Input,
 *   validators: [required(), minLength(8, { message: 'Минимум 8 символов' })],
 * },
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
        message: options?.message ?? 'invalid',
        params: { minLength: minLen, actualLength: len, ...options?.params },
      };
    }
    return null;
  };
}
