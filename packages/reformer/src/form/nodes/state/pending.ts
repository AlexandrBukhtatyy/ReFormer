/**
 * Ожидание проверки поля: раннер валидации отмечает начало и конец async-правил парой вызовов.
 * Вызовы считаются — поле ждёт, пока идёт хотя бы один прогон; устаревший прогон снимает только
 * свою отметку.
 *
 * @internal
 * @module form/nodes/state/pending
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';

export interface PendingState {
  readonly active: ReadonlySignal<boolean>;
  mark(pending: boolean): void;
}

export function createPending(): PendingState {
  const runs = signal(0);
  return {
    active: computed(() => runs.value > 0),
    mark: (pending) => {
      runs.value = Math.max(0, runs.peek() + (pending ? 1 : -1));
    },
  };
}
