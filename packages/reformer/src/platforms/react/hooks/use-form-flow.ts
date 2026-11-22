/**
 * `useFormFlow` — снимок сигналов потока шагов для рендера.
 *
 * @module platforms/react/hooks/use-form-flow
 */

import { useCallback, useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { effect } from '@preact/signals-core';
import type { FormFlow } from '../../../form/flow/flow';

/**
 * Состояние потока на момент рендера.
 *
 * @group React
 */
export interface FormFlowSnapshot {
  /** Текущий шаг. */
  readonly current: string;
  /** Номер текущего шага с нуля. */
  readonly index: number;
  /** Пройденные шаги. */
  readonly completed: ReadonlySet<string>;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  /** Идёт ли проверка шага. */
  readonly validating: boolean;
}

const read = (flow: FormFlow): FormFlowSnapshot => ({
  current: flow.current.value,
  index: flow.index.value,
  completed: flow.completed.value,
  isFirst: flow.isFirst.value,
  isLast: flow.isLast.value,
  validating: flow.validating.value,
});

const same = (left: FormFlowSnapshot, right: FormFlowSnapshot): boolean =>
  left.current === right.current &&
  left.index === right.index &&
  left.completed === right.completed &&
  left.validating === right.validating;

/**
 * Подписаться на поток шагов: компонент перерисовывается при смене шага, пройденных шагов и
 * состояния проверки. Переходы — методами самого потока (`flow.next()`, `flow.goTo(id)`).
 *
 * @param flow - Поток шагов (`bundle.flow`).
 * @returns {@link FormFlowSnapshot}.
 *
 * @example
 * ```tsx
 * function Steps({ flow }: { flow: FormFlow }) {
 *   const { current, isLast, validating } = useFormFlow(flow);
 *   return (
 *     <button disabled={isLast || validating} onClick={() => void flow.next()}>
 *       Далее ({current})
 *     </button>
 *   );
 * }
 * ```
 *
 * @group React
 */
export function useFormFlow(flow: FormFlow): FormFlowSnapshot {
  const cache = useRef<{ flow: FormFlow; snapshot: FormFlowSnapshot } | null>(null);

  const getSnapshot = useCallback((): FormFlowSnapshot => {
    const next = read(flow);
    const previous = cache.current;
    if (previous && previous.flow === flow && same(previous.snapshot, next)) {
      return previous.snapshot;
    }
    cache.current = { flow, snapshot: next };
    return next;
  }, [flow]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      let first = true;
      return effect(() => {
        read(flow); // зависимости эффекта — все сигналы потока
        if (first) {
          first = false;
          return;
        }
        onChange();
      });
    },
    [flow]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
