/**
 * Мост сигналов ядра в сигналы Angular.
 *
 * Состояние формы живёт в сигналах `@preact/signals-core`: Angular о них не знает, и чтение такого
 * сигнала в шаблоне шаблон на него не подписывает. Мост читает сигналы в effect ядра и отдаёт
 * результат сигналом Angular — на него шаблон подписывается обычным способом, а смена значения
 * сама планирует перерисовку: зона для этого не нужна.
 *
 * @module renderer-angular/bridge/signals
 */

import { DestroyRef, computed, inject, signal, type Signal } from '@angular/core';
import { effect } from '@reformer/core/signals';

/**
 * Значение, вычисленное из сигналов ядра, как сигнал Angular.
 *
 * `read` может читать и сигналы ядра, и сигналы Angular (вход компонента с нодой поля): смена
 * любого пересчитывает значение. Мост ленивый — подписка на сигналы ядра заводится при первом
 * чтении, поэтому `read` вправе обращаться к обязательным входам, которых в конструкторе ещё нет,
 * а компонент не перерисовывается на значение, которого не читал.
 *
 * Подписка снимается вместе с владельцем: по умолчанию это контекст внедрения, в котором вызван
 * мост (конструктор или инициализатор поля компонента, директивы).
 *
 * @param read - Чтение сигналов.
 * @param destroyRef - Владелец подписки; вне контекста внедрения передаётся явно.
 * @returns Сигнал только для чтения.
 *
 * @example
 * ```ts
 * class FieldError {
 *   readonly control = input.required<FormControl<unknown>>();
 *   readonly shown = fromCoreSignal(() => this.control().shouldShowError.value);
 * }
 * ```
 */
export function fromCoreSignal<T>(read: () => T, destroyRef?: DestroyRef): Signal<T> {
  const owner = destroyRef ?? inject(DestroyRef);
  // Счётчик смен сигналов ядра: его чтение делает вычисление ниже зависимым от них.
  const revision = signal(0);
  let dispose: (() => void) | undefined;
  let destroyed = false;
  owner.onDestroy(() => {
    destroyed = true;
    dispose?.();
    dispose = undefined;
  });

  return computed(() => {
    revision();
    dispose?.();
    dispose = undefined;
    if (destroyed) return read();

    let value!: T;
    let fresh = true;
    // Первый проход effect ядра исполняется сразу, внутри вычисления Angular: сигналы ядра
    // запоминает effect, сигналы Angular — само вычисление. Повторный проход значит, что сигнал
    // ядра сменился: значение пересчитается при следующем чтении, уже с новой подпиской.
    dispose = effect(() => {
      if (!fresh) {
        revision.update((count) => count + 1);
        return;
      }
      fresh = false;
      value = read();
    });
    return value;
  });
}
