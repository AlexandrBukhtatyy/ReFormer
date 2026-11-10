import { useMemo, type DependencyList } from 'react';
import { computed } from '@preact/signals-core';
import { useSignalSnapshot } from './useSignalSnapshot';

/**
 * Вычисленное значение из сигналов и моделей — селектор для React: компонент перерисовывается,
 * только когда меняется результат `fn`, а не всё, что `fn` прочитал.
 *
 * `fn` выполняется как `computed`: всё, что он читает (`model.$.x.value`, `model.x`, другие
 * сигналы), становится зависимостью. Если `fn` каждый раз собирает новый объект или массив,
 * передайте `isEqual` (например `shallowEqual` из `@reformer/core/model`) — при равном результате
 * хук вернёт прежнюю ссылку, и компонент не перерисуется.
 *
 * `deps` — как у `useMemo`: значения из рендера (props, state), которые читает `fn`. При их смене
 * вычисление пересоздаётся.
 *
 * @typeParam T - Тип результата
 * @param fn - Вычисление над сигналами и моделями
 * @param deps - Значения из рендера, которые читает `fn`. По умолчанию — нет.
 * @param isEqual - Равенство результатов. По умолчанию — по ссылке.
 * @returns Текущий результат `fn`
 *
 * @example Одна строка корзины
 * ```tsx
 * import { shallowEqual } from '@reformer/core/model';
 * import { useComputed } from '@reformer/core/react';
 *
 * function CartLine({ id }: { id: string }) {
 *   const line = useComputed(
 *     () => cart.model.$.items.value.find((item) => item.id === id),
 *     [id],
 *     shallowEqual
 *   );
 *   return line ? <div>{line.title} × {line.qty}</div> : null;
 * }
 * ```
 *
 * @example Значение-примитив — равенство не нужно
 * ```tsx
 * const total = useComputed(() => cart.model.$.items.value.length);
 * ```
 *
 * @group React Hooks
 */
export function useComputed<T>(
  fn: () => T,
  deps: DependencyList = [],
  isEqual?: (a: T, b: T) => boolean
): T {
  const source = useMemo(
    () => {
      let previous: { value: T } | undefined;
      return computed(() => {
        const next = fn();
        // Прежняя ссылка — computed не меняет версию, и подписчик (рендер) не просыпается.
        if (previous && isEqual?.(previous.value, next)) return previous.value;
        previous = { value: next };
        return next;
      });
    },
    // `fn` и `isEqual` пересоздаются на каждый рендер; пересчёт задают `deps`, как у `useMemo`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );
  return useSignalSnapshot(source);
}
