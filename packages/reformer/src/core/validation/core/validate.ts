/**
 * Кастомная синхронная валидация поля
 *
 * @group Validation
 * @category Core Functions
 */

import { extractPath } from '../field-path';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import type { ContextualValidatorFn, FieldPathNode, ValidateOptions } from '../../types';

/**
 * Зарегистрировать кастомный синхронный валидатор для поля
 * Поддерживает опциональные поля
 *
 * @group Validation
 * @category Core Functions
 *
 * @example
 * ```typescript
 * validate(path.birthDate, (ctx: ValidationContext<TForm, TField>) => {
 *   const birthDate = new Date(ctx.value());
 *   const age = calculateAge(birthDate);
 *
 *   if (age < 18) {
 *     return {
 *       code: 'tooYoung',
 *       message: 'Заемщику должно быть не менее 18 лет',
 *     };
 *   }
 *
 *   return null;
 * });
 * ```
 */
export function validate<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  validatorFn: ContextualValidatorFn<TForm, TField>,
  options?: ValidateOptions
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerSync(path, validatorFn, options);
}
