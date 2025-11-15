/**
 * Pattern (regex) validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для pattern валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function pattern<TForm = any, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  regex: RegExp,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    if (!regex.test(value)) {
      return {
        code: 'pattern',
        message: options?.message || 'Значение не соответствует требуемому формату',
        params: { pattern: regex.source, ...options?.params },
      };
    }

    return null;
  });
}
