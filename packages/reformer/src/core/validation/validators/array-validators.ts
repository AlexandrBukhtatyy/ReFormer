/**
 * Валидаторы для массивов.
 *
 * - `notEmpty` — фабрика валидатора (передаётся в `validate(path, notEmpty(...))`).
 * - `validateItems` — оператор схемы (вызывается напрямую).
 *
 * @group Validation
 * @category Validators
 */

import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import { extractPath } from '../field-path';
import type { Validator, ValidateOptions, ValidationSchemaFn } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

// ============================================================================
// notEmpty — фабрика валидатора
// ============================================================================

/**
 * Фабрика валидатора, проверяющего что массив (или строка) не пустой.
 *
 * @example
 * ```typescript
 * validate(path.properties, notEmpty({ message: 'Добавьте хотя бы один элемент' }));
 * ```
 */
export function notEmpty<TForm = unknown, TField = unknown>(
  options?: ValidateOptions
): Validator<TForm, TField> {
  return (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const len = (value as { length?: number }).length;
    if (typeof len !== 'number' || len >= 1) {
      return null;
    }
    return {
      code: 'minLength',
      message: options?.message ?? 'Массив не должен быть пустым',
      params: { minLength: 1, ...options?.params },
    };
  };
}

// ============================================================================
// validateItems — оператор схемы (регистрирует item-схему в реестре)
// ============================================================================

/**
 * Применить validation schema к каждому элементу массива.
 *
 * Регистрирует схему валидации, которая будет автоматически применяться
 * к каждому элементу ArrayNode (как существующим, так и новым).
 *
 * @example
 * ```typescript
 * import { propertyValidation } from './property-validation';
 *
 * applyWhen(path.hasProperty, (value) => value === true, (path) => {
 *   validate(path.properties, notEmpty({ message: 'Добавьте хотя бы один объект' }));
 *   validateItems(path.properties, propertyValidation);
 * });
 * ```
 */
export function validateItems<TForm, TItem>(
  fieldPath: FieldPathNode<TForm, TItem[] | undefined> | undefined,
  itemSchemaFn: ValidationSchemaFn<TItem>
): void {
  if (!fieldPath) return;
  const path = extractPath(fieldPath);
  getCurrentValidationRegistry().registerArrayItemValidation(path, itemSchemaFn);
}
