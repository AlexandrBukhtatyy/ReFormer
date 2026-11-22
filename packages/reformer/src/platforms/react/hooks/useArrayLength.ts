import { useCallback, useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { effect } from '@preact/signals-core';
import type { FormArray } from '../../../form/types/index';

/**
 * React-хук для подписки только на длину массива.
 *
 * Оптимизированная версия {@link useFormControl} для FormArray, которая
 * подписывается только на длину массива. Компонент не будет ре-рендериться
 * при изменении значений вложенных полей.
 *
 * @typeParam T - Тип элемента массива
 * @param control - FormArray для подписки
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
 *         <ItemRenderer key={arrayNode.keyAt(index)} item={item} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @group React Hooks
 */
export function useArrayLength<T extends object>(control: FormArray<T>): number {
  const cacheRef = useRef<{ length: number }>({ length: control.length });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;

      const dispose = effect(() => {
        void control.length;

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
    const currentLength = control.length;

    if (cacheRef.current.length === currentLength) {
      return cacheRef.current.length;
    }

    cacheRef.current.length = currentLength;
    return currentLength;
  }, [control]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
