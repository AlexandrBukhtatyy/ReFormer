import { useCallback, useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { effect } from '@preact/signals-core';
import type { ArrayNode } from '../core/nodes/array-node';
import type { FormFields } from '../core/types';

/**
 * React-хук для подписки только на длину массива.
 *
 * Оптимизированная версия {@link useFormControl} для ArrayNode, которая
 * подписывается только на сигнал `length`. Компонент не будет ре-рендериться
 * при изменении значений вложенных полей.
 *
 * @typeParam T - Тип элемента массива
 * @param control - ArrayNode для подписки
 * @returns Текущая длина массива
 *
 * @example
 * ```tsx
 * function ArrayRenderer({ arrayNode }) {
 *   const length = useArrayLength(arrayNode);
 *
 *   return (
 *     <div>
 *       {arrayNode.map((item, index) => (
 *         <ItemRenderer key={item.id} item={item} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @group React Hooks
 */
export function useArrayLength<T extends FormFields>(control: ArrayNode<T>): number {
  const cacheRef = useRef<{ length: number }>({ length: control.length.value });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;

      const dispose = effect(() => {
        void control.length.value;

        if (isFirstRun) {
          isFirstRun = false;
          return;
        }

        onStoreChange();
      });

      return dispose;
    },
    [control]
  );

  const getSnapshot = useCallback((): number => {
    const currentLength = control.length.value;

    if (cacheRef.current.length === currentLength) {
      return cacheRef.current.length;
    }

    cacheRef.current.length = currentLength;
    return currentLength;
  }, [control]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
