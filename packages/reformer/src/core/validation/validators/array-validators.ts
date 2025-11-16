/**
 * Валидаторы для массивов
 *
 * Предоставляет специализированные функции для валидации ArrayNode:
 * - notEmpty: проверка что массив не пустой
 * - validateItems: применение validation schema к каждому элементу
 */

import { getCurrentValidationRegistry } from '../../utils/registry-helpers';
import { extractPath } from '../field-path';
import { minLength } from './min-length';
import type { ValidateOptions, ValidationSchemaFn } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

// ============================================================================
// notEmpty - Проверка что массив не пустой
// ============================================================================

/**
 * Проверить что массив содержит хотя бы один элемент
 *
 * Это удобный алиас для `minLength(field, 1)`, оптимизированный для массивов.
 *
 * @param fieldPath - Поле-массив для валидации
 * @param options - Опции валидации (message, params и т.д.)
 *
 * @example
 * ```typescript
 * // Простая проверка
 * notEmpty(path.properties, { message: 'Добавьте хотя бы один объект имущества' });
 *
 * // С дополнительными параметрами
 * notEmpty(path.coBorrowers, {
 *   message: 'Требуется хотя бы один созаемщик',
 *   params: { minItems: 1 }
 * });
 * ```
 */
export function notEmpty<TForm, TItem>(
  fieldPath: FieldPathNode<TForm, TItem[] | undefined> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  // Используем minLength как базовую реализацию
  minLength(fieldPath, 1, {
    message: options?.message || 'Массив не должен быть пустым',
    params: { minLength: 1, ...options?.params },
  });
}

// ============================================================================
// validateItems - Валидация элементов массива
// ============================================================================

/**
 * Применить validation schema к каждому элементу массива
 *
 * Регистрирует схему валидации, которая будет автоматически применяться
 * к каждому элементу ArrayNode (как существующим, так и новым).
 *
 * @param fieldPath - Поле-массив для валидации элементов
 * @param itemSchemaFn - Validation schema для одного элемента
 *
 * @example
 * ```typescript
 * import { propertyValidation } from './property-validation';
 *
 * // В additionalValidation
 * applyWhen(path.hasProperty, (value) => value === true, (path) => {
 *   // Проверка что массив не пустой
 *   notEmpty(path.properties, { message: 'Добавьте хотя бы один объект имущества' });
 *
 *   // Валидация каждого элемента
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

  // Регистрируем схему валидации для элементов массива
  //  Используем текущий активный реестр из context stack
  getCurrentValidationRegistry().registerArrayItemValidation(path, itemSchemaFn);
}
