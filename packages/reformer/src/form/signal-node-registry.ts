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
import type { FormNode } from './nodes/form-node';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new WeakMap<Signal<any>, FormNode<any>>();

/**
 * Связать сигнал модели с его нодой формы.
 *
 * Вызывается движком при сборке формы (`createForm`/{@link createFormFromModel}) для каждого
 * листового поля. Прикладной код обычно этот реестр не заполняет напрямую.
 *
 * @param signal - Сигнал значения из {@link FormModel} (ручка поля, `model.$.path`)
 * @param node - Нода формы, отвечающая за это поле
 *
 * @example Привязка листовых полей при построении формы
 * ```typescript
 * import { registerSignalNode } from '@reformer/core';
 *
 * const sig = model.signalAt('profile.email');
 * const node = group.getFieldByPath('profile.email');
 * if (sig && node) registerSignalNode(sig, node);
 * ```
 *
 * @see {@link getNodeForSignal} - обратный поиск ноды по сигналу
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerSignalNode(signal: Signal<any>, node: FormNode<any>): void {
  registry.set(signal, node);
}

/**
 * Найти ноду формы по сигналу модели.
 *
 * Используется state-операциями behavior (`enableWhen`/`disableWhen`) и роутингом ошибок
 * валидации в ноды. Возвращает `undefined`, если форма ещё не построена или поле не
 * материализовано в этой форме (например, элемент массива, который строится per-item).
 *
 * @param signal - Сигнал значения из {@link FormModel}
 * @returns Нода формы для этого поля или `undefined`
 *
 * @example Роутинг ошибок валидации в ноду поля
 * ```typescript
 * import { getNodeForSignal } from '@reformer/core';
 *
 * const sig = model.$.email;
 * getNodeForSignal(sig)?.setErrors([{ code: 'required', message: 'Обязательно' }]);
 * ```
 *
 * @see {@link registerSignalNode} - регистрация связи сигнал→нода
 * @group Utilities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNodeForSignal(signal: Signal<any>): FormNode<any> | undefined {
  return registry.get(signal);
}
