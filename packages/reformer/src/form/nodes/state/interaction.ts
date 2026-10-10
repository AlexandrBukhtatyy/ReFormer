/**
 * Взаимодействие с полем: трогали ли его и меняли ли значение.
 *
 * @internal
 * @module form/nodes/state/interaction
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';

export interface InteractionState {
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  setTouched(touched: boolean): void;
  setDirty(dirty: boolean): void;
}

export function createInteraction(): InteractionState {
  const touched = signal(false);
  const dirty = signal(false);
  return {
    touched: computed(() => touched.value),
    dirty: computed(() => dirty.value),
    setTouched: (value) => {
      touched.value = value;
    },
    setDirty: (value) => {
      dirty.value = value;
    },
  };
}
