/**
 * Условная валидация
 */

import { extractPath, createFieldPath } from '../field-path';
import type { FieldPath } from '../../types/field-path';
import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import type { ConditionFn } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Применить валидацию только при выполнении условия
 *
 * @example
 * ```typescript
 * applyWhen(
 *   path.loanType,
 *   (type) => type === 'mortgage',
 *   (path) => {
 *     required(path.propertyValue, { message: 'Укажите стоимость' });
 *     min(path.propertyValue, 1000000);
 *   }
 * );
 * ```
 */
export function applyWhen<TForm = any, TField = any>(
  fieldPath: FieldPathNode<TForm, TField>,
  condition: ConditionFn<TField>,
  validationFn: (path: FieldPath<TForm>) => void
): void {
  const path = extractPath(fieldPath);

  // Входим в условный блок
  getCurrentValidationRegistry().enterCondition(path, condition);

  try {
    // Выполняем вложенную валидацию
    // Создаем новый FieldPath proxy для вложенной функции
    const nestedPath = createFieldPath<TForm>();
    validationFn(nestedPath);
  } finally {
    // Выходим из условного блока
    getCurrentValidationRegistry().exitCondition();
  }
}
