/**
 * Maximum length validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для maxLength валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function maxLength<TForm, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  maxLen: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath, (value) => {
    if (!value) {
      return null;
    }

    if (value.length > maxLen) {
      return {
        code: 'maxLength',
        message: options?.message || `Максимальная длина: ${maxLen} символов`,
        params: { maxLength: maxLen, actualLength: value.length, ...options?.params },
      };
    }

    return null;
  });
}
