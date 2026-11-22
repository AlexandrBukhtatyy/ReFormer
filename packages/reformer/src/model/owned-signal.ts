/**
 * Сигнал, который снаружи только читается, а пишет его владелец.
 *
 * Запись `.value` бросает `TypeError`, как у `computed`; владелец пишет методом {@link OwnedSignal.set}.
 * Обёртка `computed(() => s.value)` дала бы ту же защиту, но ценой ещё одного объекта, замыкания и
 * звена графа на каждый сигнал. Здесь объект один.
 *
 * Состояние уровней (тема, язык, таблица) и состояние нод формы стоят на этом классе: читатели
 * получают его как `ReadonlySignal`, а менять значение может только код уровня.
 *
 * @internal
 * @module model/owned-signal
 */

import { Signal } from '@preact/signals-core';

/** Сеттер базового класса: вызов через `super.value = …` в V8 заметно медленнее. */
const writeValue = Object.getOwnPropertyDescriptor(Signal.prototype, 'value')!.set!;

export class OwnedSignal<T> extends Signal<T> {
  override get value(): T {
    return super.value;
  }

  override set value(_value: T) {
    throw new TypeError(this.readonlyMessage());
  }

  /** Запись владельца. */
  set(value: T): void {
    writeValue.call(this, value);
  }

  /** Текст ошибки записи снаружи. Подкласс уточняет, чем менять значение. */
  protected readonlyMessage(): string {
    return 'Сигнал только для чтения: его значение меняет владелец (команды уровня или модели).';
  }
}
