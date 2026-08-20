/**
 * Типы контракта схемы поведения.
 *
 * `BehaviorScope` — то, что видит автор схемы внутри `defineFormBehavior`; `FormBehavior` —
 * результат, который принимает `createForm({ behavior })`. Реэкспорт сигнальных типов здесь же,
 * чтобы пользовательские операторы писались одним импортом из `@reformer/core/behaviors`.
 *
 * @group Behaviors
 * @module form/behaviors/types
 */

import type { Signal, ReadonlySignal } from '@preact/signals-core';
import type { BehaviorCleanup, FormModel, FormProxy } from '../../index';

/** Контекст схемы поведения: модель (значения/сигналы) + форма (ноды). */
export type BehaviorScope<T> = { model: FormModel<T>; form: FormProxy<T> };

/** Результат {@link defineFormBehavior}; передаётся в `createForm({ behavior })`. */
export interface FormBehavior<T> {
  /** @internal Запускается `createForm` после построения нод и заполнения реестра сигнал→нода. */
  __run(model: FormModel<T>, form: FormProxy<T>): BehaviorCleanup;
}

export type { Signal, ReadonlySignal, BehaviorCleanup };

/** Контекст async-реакции: `signal` аннулируется, когда поле меняется снова до завершения колбэка. */
export interface ChangeContext {
  signal: AbortSignal;
}
