/**
 * Cross-field валидация со scope.
 *
 * @group Validation
 * @category Core Functions
 */

import { extractPath } from '../../utils/field-path';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import type { GroupValidator, ValidateGroupOptions } from '../../types/validation-schema';
import type { FieldPathNode, FieldPath } from '../../types';

/**
 * Зарегистрировать cross-field валидатор для scope-поддерева формы.
 *
 * Первый аргумент — путь до scope. Для всей формы передаётся сам `path`
 * (он же `FieldPath<TForm>`), для поддерева — конкретное вложенное поле.
 *
 * @group Validation
 * @category Core Functions
 *
 * @example
 * ```typescript
 * // Scope = вся форма
 * validateGroup(path, (scope, _root) => {
 *   const v = scope.getValue();
 *   if (v.initialPayment > v.propertyValue) {
 *     return { code: 'tooHigh', message: 'Взнос > стоимости' };
 *   }
 *   return null;
 * }, { targetField: path.initialPayment });
 *
 * // Scope = поддерево
 * validateGroup(path.personalData, (scope, _root) => {
 *   if (scope.lastName.value.value === scope.firstName.value.value) {
 *     return { code: 'sameNames', message: 'Фамилия = Имя?' };
 *   }
 *   return null;
 * });
 * ```
 */
export function validateGroup<TForm, TScope = TForm>(
  scopePath: FieldPathNode<TForm, TScope> | FieldPath<TForm>,
  validator: GroupValidator<TForm, TScope>,
  options?: ValidateGroupOptions<TForm>
): void {
  const path = extractPath(scopePath);
  getCurrentValidationRegistry().registerGroup(
    validator as GroupValidator<unknown, unknown>,
    options as ValidateGroupOptions<unknown> | undefined,
    path
  );
}
