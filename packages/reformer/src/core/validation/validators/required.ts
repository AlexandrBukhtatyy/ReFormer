/**
 * Required field validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для required валидатора
 * Поддерживает опциональные поля (TField | undefined)
 */
export function required<TForm = any, TField = any>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    // Проверка на пустое значение
    if (value === null || value === undefined || value === '') {
      return {
        code: 'required',
        message: options?.message || 'Поле обязательно для заполнения',
        params: options?.params,
      };
    }

    // Для булевых значений требуем true
    if (typeof value === 'boolean' && value !== true) {
      return {
        code: 'required',
        message: options?.message || 'Поле обязательно для заполнения',
        params: options?.params,
      };
    }

    return null;
  });
}
