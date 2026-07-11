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
 * Работает со строкой или массивом (проверяется `value.length`). Пустые значения
 * (`null`/`undefined`/`''`) и значения без числового `length` пропускаются
 * (используйте {@link required} для обязательности).
 *
 * @param maxLen - Максимально допустимая длина (включительно)
 * @param options - Опции валидатора ({@link ValidateOptions}). В `params` ошибки автоматически
 *   попадают `maxLength` и `actualLength`.
 * @returns Чистый валидатор {@link Validator} для строки или массива
 *
 * @example Максимальная длина строки
 * ```typescript
 * import { maxLength } from '@reformer/core/validators';
 *
 * // Внутри FieldConfig схемы формы:
 * name: { value: model.$.name, component: Input, validators: [maxLength(50)] },
 * bio: {
 *   value: model.$.bio,
 *   component: Textarea,
 *   validators: [maxLength(500, { message: 'Максимум 500 символов' })],
 * },
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
