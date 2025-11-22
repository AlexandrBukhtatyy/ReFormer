/**
 * Двусторонняя синхронизация полей
 * @module behaviors/syncFields
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode, FormFields, FormValue } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import type { SyncFieldsOptions, BehaviorHandlerFn } from '../types';

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
export function syncFields<TForm extends FormFields, T extends FormValue>(
  field1: FieldPathNode<TForm, T>,
  field2: FieldPathNode<TForm, T>,
  options?: SyncFieldsOptions<T>
): void {
  const { debounce, transform } = options || {};

  const handler: BehaviorHandlerFn<TForm> = (form, _context, withDebounce) => {
    const sourceNode = form.getFieldByPath(field1.__path);
    const targetNode = form.getFieldByPath(field2.__path);

    if (!sourceNode || !targetNode) return null;

    // Флаг для предотвращения циклических обновлений
    let isUpdating = false;

    const dispose1 = effect(() => {
      const sourceValue = sourceNode.value.value as T;

      if (isUpdating) return;

      withDebounce(() => {
        isUpdating = true;
        const finalValue = transform ? transform(sourceValue) : sourceValue;
        targetNode.setValue(finalValue as FormValue, { emitEvent: false });
        isUpdating = false;
      });
    });

    const dispose2 = effect(() => {
      const targetValue = targetNode.value.value;

      if (isUpdating) return;

      withDebounce(() => {
        isUpdating = true;
        // Обратная синхронизация (без трансформации)
        sourceNode.setValue(targetValue, { emitEvent: false });
        isUpdating = false;
      });
    });

    // Возвращаем комбинированный cleanup
    return () => {
      dispose1();
      dispose2();
    };
  };

  getCurrentBehaviorRegistry().register(handler, { debounce });
}
