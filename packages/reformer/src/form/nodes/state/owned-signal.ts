/**
 * Сигнал состояния ноды, который снаружи только читается.
 *
 * Запись `.value` бросает `TypeError`, как у `computed`; владелец пишет методом {@link OwnedSignal.set}.
 * Раньше защиту давала обёртка `computed(() => s.value)`: на каждый сигнал каждого поля — ещё объект
 * и замыкание при построении формы и лишнее звено графа при каждом чтении. Здесь объект один.
 *
 * @internal
 * @module form/nodes/state/owned-signal
 */

import { Signal } from '@preact/signals-core';

/** Сеттер базового класса: вызов через `super.value = …` в V8 заметно медленнее. */
const writeValue = Object.getOwnPropertyDescriptor(Signal.prototype, 'value')!.set!;

export class OwnedSignal<T> extends Signal<T> {
  override get value(): T {
    return super.value;
  }

  override set value(_value: T) {
    throw new TypeError(
      'Состояние ноды формы только для чтения: его меняют методы ноды (setValue, markAsTouched, disable…).'
    );
  }

  /** Запись владельца. */
  set(value: T): void {
    writeValue.call(this, value);
  }
}
