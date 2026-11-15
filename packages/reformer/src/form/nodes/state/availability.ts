/**
 * Доступность ноды: отключённая нода не проверяется и не показывает замечаний.
 *
 * Признак — {@link OwnedSignal}: снаружи только чтение, пишет его `setDisabled`.
 *
 * @internal
 * @module form/nodes/state/availability
 */

import type { ReadonlySignal } from '@preact/signals-core';
import { OwnedSignal } from './owned-signal';

export interface AvailabilityState {
  readonly disabled: ReadonlySignal<boolean>;
  setDisabled(disabled: boolean): void;
}

class Availability implements AvailabilityState {
  private readonly disabledSignal: OwnedSignal<boolean>;

  constructor(initiallyDisabled: boolean) {
    this.disabledSignal = new OwnedSignal(initiallyDisabled);
  }

  get disabled(): ReadonlySignal<boolean> {
    return this.disabledSignal;
  }

  setDisabled(value: boolean): void {
    this.disabledSignal.set(value);
  }
}

export function createAvailability(initiallyDisabled = false): AvailabilityState {
  return new Availability(initiallyDisabled);
}
