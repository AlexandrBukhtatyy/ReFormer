/**
 * Minimum length validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для minLength валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function minLength<TForm = any, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  minLen: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    if (value.length < minLen) {
      return {
        code: 'minLength',
        message: options?.message || `Минимальная длина: ${minLen} символов`,
        params: { minLength: minLen, actualLength: value.length, ...options?.params },
      };
    }

    return null;
  });
}
