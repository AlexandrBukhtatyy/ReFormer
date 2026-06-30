/**
 * Реестр «сигнал модели → FieldNode» (M1).
 *
 * Заменяет навигацию по строковому пути (`FieldPathNavigator`) для state-операций behavior
 * (`enableWhen`/`disableWhen`) и in-form роутинга ошибок валидации. Заполняется в `createForm`
 * при сборке формы из модели; «ручка поля» — сигнал модели (`model.$.path`).
 *
 * Используется `WeakMap`, поэтому записи авто-собираются GC вместе с сигналами.
 *
 * @group Utils
 * @module core/utils/signal-node-registry
 */

import type { Signal } from '@preact/signals-core';
import type { FormNode } from '../nodes/form-node';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new WeakMap<Signal<any>, FormNode<any>>();

/**
 * Связать сигнал модели с его FieldNode.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerSignalNode(signal: Signal<any>, node: FormNode<any>): void {
  registry.set(signal, node);
}

/**
 * Получить FieldNode по сигналу модели (или undefined, если форма не построена/поле не материализовано,
 * например элемент массива в родительской форме).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNodeForSignal(signal: Signal<any>): FormNode<any> | undefined {
  return registry.get(signal);
}
