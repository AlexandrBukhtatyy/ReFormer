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
import type { SchemaController, SchemaScope } from '../schema-controller';

/**
 * Область схемы поведения: модель (значения и сигналы), форма (ноды) и схема (узлы разметки).
 *
 * `schema` адресует узлы СВОЕЙ области: в корневом поведении — корневое дерево, в поведении
 * подформы (`apply`) и строки массива (`applyEach`) — поддерево этой части. Правила узлов
 * (`hideWhen`, `onComponentEvent`, `onMount`) исполняет рендерер; без него они ничего не делают.
 */
export type BehaviorScope<T> = {
  model: FormModel<T>;
  form: FormProxy<T>;
  schema: SchemaScope;
};

/** Результат {@link defineFormBehavior}; передаётся в `createForm({ behavior })`. */
export interface FormBehavior<T> {
  /**
   * @internal Запускается сборкой формы после построения нод и заполнения реестра сигнал→нода.
   * `controller` — схема-контроллер сборки; без него поведение получает собственный, который
   * никто не читает (модель без рендерера).
   */
  __run(model: FormModel<T>, form: FormProxy<T>, controller?: SchemaController): BehaviorCleanup;
}

export type { Signal, ReadonlySignal, BehaviorCleanup };

/** Контекст async-реакции: `signal` аннулируется, когда поле меняется снова до завершения колбэка. */
export interface ChangeContext {
  signal: AbortSignal;
}
