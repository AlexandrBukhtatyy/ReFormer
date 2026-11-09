import { useCallback } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { effect, type ReadonlySignal } from '@preact/signals-core';

/**
 * Значение произвольного сигнала в React-компоненте: компонент перерисовывается, когда сигнал
 * меняется.
 *
 * Для поля формы есть {@link useFormControl} и {@link useFormControlValue}. Этот хук — для
 * остальных сигналов: идёт ли проверка (`bundle.validating`), работает ли обработчик отправки
 * (`bundle.submission.submitting`), группа модели целиком (`model.$.address`), свой `computed`.
 *
 * @typeParam T - Тип значения сигнала
 * @param source - Сигнал или `computed`
 * @returns Текущее значение сигнала
 *
 * @example Кнопка отправки
 * ```tsx
 * import { useSignalSnapshot } from '@reformer/core/react';
 *
 * function SubmitButton({ bundle }: { bundle: FormBundle<Signup> }) {
 *   const validating = useSignalSnapshot(bundle.validating);
 *   const submitting = useSignalSnapshot(bundle.submission.submitting);
 *   return (
 *     <button type="submit" disabled={validating || submitting}>
 *       {submitting ? 'Отправка…' : 'Отправить'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @example Группа модели
 * ```tsx
 * const address = useSignalSnapshot(model.$.address); // { city, street }
 * ```
 *
 * @group React Hooks
 */
export function useSignalSnapshot<T>(source: ReadonlySignal<T>): T {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let isFirstRun = true;
      return effect(() => {
        // Чтение ради подписки — вызовом: выражение `void source?.value` минификатор выбросил бы
        // (см. tests/meta/tracking-reads.test.ts).
        source.valueOf();
        if (isFirstRun) {
          isFirstRun = false;
          return;
        }
        onStoreChange();
      });
    },
    [source]
  );
  const getSnapshot = useCallback((): T => source.peek(), [source]);
  // Третий аргумент — снимок для SSR: значение без подписки.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
