/**
 * Кастомная синхронная валидация поля.
 *
 * @group Validation
 * @category Core Functions
 */

import { extractPath } from '../../utils/field-path';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import type { Validator, FieldPathNode, ValidateOptions } from '../../types';

/**
 * Зарегистрировать синхронный валидатор для поля.
 *
 * Принимает чистую функцию-валидатор `(value, control, root) => error | null`,
 * либо фабрику из `@reformer/core/validators` (например, `required()`).
 *
 * @group Validation
 * @category Core Functions
 *
 * @example
 * ```typescript
 * // Кастомный валидатор
 * validate(path.birthDate, (value, _control, root) => {
 *   const age = calculateAge(new Date(value));
 *   if (age < 18) return { code: 'tooYoung', message: 'Только 18+' };
 *   return null;
 * });
 *
 * // Фабрика из @reformer/core/validators
 * import { required, min } from '@reformer/core/validators';
 * validate(path.loanAmount, required());
 * validate(path.loanAmount, min(50000, { message: 'Min 50 000' }));
 * ```
 */
export function validate<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  validator: Validator<TForm, TField>,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerSync(
    path,
    validator as Validator<unknown, unknown>,
    options
  );
}
