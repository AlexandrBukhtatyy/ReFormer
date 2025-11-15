/**
 * Two-way field synchronization
 */

import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { SyncFieldsOptions } from '../types';
import { createSyncBehavior } from '../behavior-factories';

/**
 * Двусторонняя синхронизация двух полей
 *
 * @param field1 - Первое поле
 * @param field2 - Второе поле
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Синхронизировать два поля
 *   syncFields(path.email, path.emailCopy);
 * };
 * ```
 */
export function syncFields<TForm extends Record<string, any>, T>(
  field1: FieldPathNode<TForm, T>,
  field2: FieldPathNode<TForm, T>,
  options?: SyncFieldsOptions<T>
): void {
  const { debounce } = options || {};

  const handler = createSyncBehavior(field1, field2, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}
