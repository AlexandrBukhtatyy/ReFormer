/**
 * Взаимодействие с полем: трогали ли его и меняли ли значение.
 *
 * Флаги — {@link OwnedSignal}: снаружи только чтение, пишет их нода через методы.
 *
 * @internal
 * @module form/nodes/state/interaction
 */

import { batch, type ReadonlySignal } from '@preact/signals-core';
import { OwnedSignal } from './owned-signal';

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

class Interaction implements InteractionState {
  private readonly touchedSignal = new OwnedSignal(false);
  private readonly dirtySignal = new OwnedSignal(false);
  private readonly touchesSignal = new OwnedSignal(0);

  get touched(): ReadonlySignal<boolean> {
    return this.touchedSignal;
  }

  get dirty(): ReadonlySignal<boolean> {
    return this.dirtySignal;
  }

  get touches(): ReadonlySignal<number> {
    return this.touchesSignal;
  }

  setTouched(value: boolean): void {
    // Одной волной: метка и счётчик меняются вместе, подписчики просыпаются один раз.
    batch(() => {
      this.touchedSignal.set(value);
      if (value) this.touchesSignal.set(this.touchesSignal.peek() + 1);
    });
  }

  setDirty(value: boolean): void {
    this.dirtySignal.set(value);
  }
}

export function createInteraction(): InteractionState {
  return new Interaction();
}
