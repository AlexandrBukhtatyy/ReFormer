/**
 * Взаимодействие с полем: трогали ли его и меняли ли значение.
 *
 * @internal
 * @module form/nodes/state/interaction
 */

import { batch, computed, signal, type ReadonlySignal } from '@preact/signals-core';

export interface InteractionState {
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  /**
   * Сколько раз поле помечали тронутым — каждый уход из поля, и повторный тоже. У тронутого поля
   * `touched` при новом уходе не меняется; по счётчику стратегия `blur` видит и его.
   */
  readonly touches: ReadonlySignal<number>;
  setTouched(touched: boolean): void;
  setDirty(dirty: boolean): void;
}

export function createInteraction(): InteractionState {
  const touched = signal(false);
  const dirty = signal(false);
  const touches = signal(0);
  return {
    touched: computed(() => touched.value),
    dirty: computed(() => dirty.value),
    touches: computed(() => touches.value),
    setTouched: (value) => {
      // Одной волной: метка и счётчик меняются вместе, подписчики просыпаются один раз.
      batch(() => {
        touched.value = value;
        if (value) touches.value = touches.peek() + 1;
      });
    },
    setDirty: (value) => {
      dirty.value = value;
    },
  };
}
