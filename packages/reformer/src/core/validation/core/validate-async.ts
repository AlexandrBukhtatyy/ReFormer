/**
 * Асинхронная валидация поля
 */

import { extractPath } from '../field-path';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import type {
  ContextualAsyncValidatorFn,
  ValidateAsyncOptions,
} from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Зарегистрировать асинхронный валидатор для поля
 *
 * @example
 * ```typescript
 * validateAsync(
 *   path.inn,
 *   async (ctx) => {
 *     const inn = ctx.value();
 *     if (!inn) return null;
 *
 *     const response = await fetch('/api/validate-inn', {
 *       method: 'POST',
 *       body: JSON.stringify({ inn }),
 *     });
 *
 *     const data = await response.json();
 *     if (!data.valid) {
 *       return {
 *         code: 'invalidInn',
 *         message: 'ИНН не найден в базе данных ФНС',
 *       };
 *     }
 *
 *     return null;
 *   },
 *   { debounce: 1000 }
 * );
 * ```
 */
export function validateAsync<TForm = any, TField = any>(
  fieldPath: FieldPathNode<TForm, TField>,
  validatorFn: ContextualAsyncValidatorFn<TForm, TField>,
  options?: ValidateAsyncOptions
): void {
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerAsync(path, validatorFn, options);
}
