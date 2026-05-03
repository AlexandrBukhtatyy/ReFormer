/**
 * Двусторонняя синхронизация полей
 *
 * @group Behaviors
 * @category Behavior Rules
 * @module behaviors/syncFields
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode, FormFields, FormValue } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { runOutsideEffect } from '../../utils/safe-effect';
import type { SyncFieldsOptions, BehaviorHandlerFn } from '../types';

/**
 * Двусторонняя синхронизация двух полей
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param field1 - Первое поле
 * @param field2 - Второе поле
 * @param options - Опции (`transform` асимметричен — применяется только field1 → field2; `debounce`)
 *
 * @example Базовый mirror двух текстовых полей
 * ```typescript
 * import { syncFields, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface MirrorForm {
 *   syncField1: string;
 *   syncField2: string;
 * }
 *
 * export const mirrorBehavior: BehaviorSchemaFn<MirrorForm> = (path) => {
 *   syncFields(path.syncField1, path.syncField2);
 * };
 * ```
 *
 * @example С `transform` (асимметричный) и `debounce` для защиты от частых перезаписей
 * ```typescript
 * import { syncFields, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface CodeForm {
 *   internalCode: string;  // канонический формат
 *   displayCode: string;   // показываем пользователю
 * }
 *
 * export const codeBehavior: BehaviorSchemaFn<CodeForm> = (path) => {
 *   // internalCode → displayCode: применяется toUpperCase
 *   // displayCode → internalCode: пишется как есть
 *   syncFields(path.internalCode, path.displayCode, {
 *     transform: (value) => (typeof value === 'string' ? value.toUpperCase() : value),
 *     debounce: 150, // сглаживает дёргание каретки
 *   });
 * };
 * ```
 *
 * @see [docs/llms/24-sync-fields.md](../../../../docs/llms/24-sync-fields.md)
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
        // runOutsideEffect выходит из контекста effect, предотвращая "Cycle detected"
        runOutsideEffect(() => {
          try {
            const finalValue = transform ? transform(sourceValue) : sourceValue;
            targetNode.setValue(finalValue as FormValue, { emitEvent: false });
          } finally {
            isUpdating = false;
          }
        });
      });
    });

    const dispose2 = effect(() => {
      const targetValue = targetNode.value.value;

      if (isUpdating) return;

      withDebounce(() => {
        isUpdating = true;
        // runOutsideEffect выходит из контекста effect, предотвращая "Cycle detected"
        runOutsideEffect(() => {
          try {
            // Обратная синхронизация (без трансформации)
            sourceNode.setValue(targetValue, { emitEvent: false });
          } finally {
            isUpdating = false;
          }
        });
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
