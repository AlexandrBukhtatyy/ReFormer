/**
 * Email format validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions, ValidationContext } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для email валидатора
 * Поддерживает опциональные поля (string | undefined)
 */
export function email<TForm, TField extends string | undefined = string>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validate(fieldPath, (ctx: ValidationContext<TForm, TField>) => {
    const value = ctx.value();

    if (!value) {
      return null;
    }

    if (!emailRegex.test(value)) {
      return {
        code: 'email',
        message: options?.message || 'Неверный формат email',
        params: options?.params,
      };
    }

    return null;
  });
}
