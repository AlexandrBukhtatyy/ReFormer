/**
 * Состояние компонента поля: пропсы из узла схемы и правки поверх них.
 *
 * @internal
 * @module form/nodes/state/component
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';

export interface ComponentState {
  readonly props: ReadonlySignal<Readonly<Record<string, unknown>>>;
  update(patch: Record<string, unknown>): void;
}

export function createComponentState(initial: Record<string, unknown> = {}): ComponentState {
  const props = signal<Readonly<Record<string, unknown>>>(initial);
  return {
    props: computed(() => props.value),
    update: (patch) => {
      props.value = { ...props.peek(), ...patch };
    },
  };
}
