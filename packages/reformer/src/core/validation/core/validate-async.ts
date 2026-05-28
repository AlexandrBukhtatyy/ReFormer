/**
 * Асинхронная валидация поля.
 *
 * @group Validation
 * @category Core Functions
 */

import { extractPath } from '../../utils/field-path';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import type { AsyncValidator, FieldPathNode, ValidateAsyncOptions } from '../../types';

/**
 * Зарегистрировать асинхронный валидатор для поля.
 *
 * Принимает чистую async-функцию `(value, control, root) => Promise<error | null>`.
 *
 * @group Validation
 * @category Core Functions
 *
 * @example
 * ```typescript
 * validateAsync(
 *   path.inn,
 *   async (value, _control, _root) => {
 *     if (!value) return null;
 *     const response = await fetch('/api/validate-inn', {
 *       method: 'POST',
 *       body: JSON.stringify({ inn: value }),
 *     });
 *     const data = await response.json();
 *     if (!data.valid) {
 *       return { code: 'invalidInn', message: 'ИНН не найден в базе ФНС' };
 *     }
 *     return null;
 *   },
 *   { debounce: 1000 }
 * );
 * ```
 */
export function validateAsync<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField>,
  validator: AsyncValidator<TForm, TField>,
  options?: ValidateAsyncOptions
): void {
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerAsync(
    path,
    validator as AsyncValidator<unknown, unknown>,
    options
  );
}
