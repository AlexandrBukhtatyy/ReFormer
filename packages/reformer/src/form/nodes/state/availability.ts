/**
 * Доступность ноды: отключённая нода не проверяется и не показывает замечаний.
 *
 * @internal
 * @module form/nodes/state/availability
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';

export interface AvailabilityState {
  readonly disabled: ReadonlySignal<boolean>;
  setDisabled(disabled: boolean): void;
}

export function createAvailability(initiallyDisabled = false): AvailabilityState {
  const disabled = signal(initiallyDisabled);
  return {
    disabled: computed(() => disabled.value),
    setDisabled: (value) => {
      disabled.value = value;
    },
  };
}
