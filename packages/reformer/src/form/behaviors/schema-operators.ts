/**
 * Операторы поведения над узлами схемы: видимость, события компонентов, жизненный цикл.
 *
 * Оператор только ЗАПИСЫВАЕТ правило в схему-контроллер; исполняет его рендерер. Там, где схему
 * рисуют руками (JSX без рендерера), правила узлов не действуют — видимость и обработчики
 * остаются в разметке.
 *
 * Узел берётся из схемы своей области: `schema.node(selector)`. Внутри `defineFormBehavior`
 * запись живёт столько же, сколько поведение, и снимается вместе с ним.
 *
 * @group Behaviors
 * @module form/behaviors/schema-operators
 */

import type { NodeLifecycleHooks, SchemaNodeControl, SchemaScope } from '../schema-controller';
import { onDisposeIfActive } from './context';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Скрывать узел, пока условие истинно.
 *
 * Условие реактивно: пересчитывается при изменении любого сигнала, прочитанного внутри него.
 * Принудительное `schema.node(selector).setHidden(...)` главнее условия.
 *
 * @example
 * ```typescript
 * hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');
 * ```
 */
export function hideWhen(node: SchemaNodeControl, condition: () => boolean): void {
  const { conditionRegistry } = node.__overrideMaps;
  conditionRegistry.set(node.__selector, condition);
  onDisposeIfActive(() => {
    if (conditionRegistry.get(node.__selector) === condition) {
      conditionRegistry.delete(node.__selector);
    }
  });
}

/**
 * Повесить обработчик на проп-событие компонента узла (`onSubmit`, `onChange`, …).
 *
 * Обработчик получает те же аргументы, что и исходный проп компонента, и перекрывает одноимённый
 * проп из `componentProps`.
 *
 * @example
 * ```typescript
 * onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
 *   await submitApplication(model.get());
 * });
 * ```
 */
export function onComponentEvent(
  node: SchemaNodeControl,
  event: string,
  handler: (...args: any[]) => any
): void {
  const { callbackRegistry } = node.__overrideMaps;
  let handlers = callbackRegistry.get(node.__selector);
  if (!handlers) {
    handlers = new Map();
    callbackRegistry.set(node.__selector, handlers);
  }
  handlers.set(event, handler);
  const registered = handlers;
  onDisposeIfActive(() => {
    if (registered.get(event) === handler) registered.delete(event);
  });
}

/**
 * Реактивный эффект, живущий, пока схема области смонтирована рендерером.
 *
 * В отличие от `effect` поведения, запускается после монтирования — внутри доступны ref узлов
 * (`schema.node(selector).getRef().current`). Может вернуть функцию очистки.
 *
 * @example
 * ```typescript
 * const wizard = schema.node('wizard').getRef<FormWizardHandle>();
 * renderEffect(schema, () => {
 *   if (model.loanType === 'mortgage') wizard.current?.goToStep(1);
 * });
 * ```
 */
export function renderEffect(schema: SchemaScope, effectFn: () => void | (() => void)): void {
  const { effectRegistry } = schema.__overrideMaps;
  effectRegistry.push(effectFn);
  onDisposeIfActive(() => {
    const index = effectRegistry.indexOf(effectFn);
    if (index !== -1) effectRegistry.splice(index, 1);
  });
}

function setLifecycleHook<K extends keyof NodeLifecycleHooks>(
  node: SchemaNodeControl,
  hook: K,
  value: NonNullable<NodeLifecycleHooks[K]>
): void {
  const { lifecycleRegistry } = node.__overrideMaps;
  lifecycleRegistry.set(node.__selector, {
    ...(lifecycleRegistry.get(node.__selector) ?? {}),
    [hook]: value,
  });
  onDisposeIfActive(() => {
    const hooks = lifecycleRegistry.get(node.__selector);
    if (hooks?.[hook] !== value) return;
    const rest = { ...hooks };
    delete rest[hook];
    if (Object.keys(rest).length === 0) lifecycleRegistry.delete(node.__selector);
    else lifecycleRegistry.set(node.__selector, rest);
  });
}

/**
 * Синхронный хук времени сборки: `fn` вызывается сразу, до первого рендера узла. Единственный
 * хук, способный повлиять на первый рендер, — внутри можно править пропсы через
 * `schema.node(selector).patchProps({ … })`.
 *
 * К монтированию узла не привязан; аргумент `node` принимается ради симметрии с
 * {@link onMount} / {@link onUnmount}.
 *
 * @example
 * ```typescript
 * onInit(schema.node('summary'), () => {
 *   schema.node('summary').patchProps({ currency: detectCurrency() });
 * });
 * ```
 */
export function onInit(_node: SchemaNodeControl, fn: () => void): void {
  fn();
}

/**
 * Хук после первого монтирования узла. Может вернуть очистку — она выполнится при размонтировании.
 *
 * @example
 * ```typescript
 * onMount(schema.node('data-boundary'), () => void loadApplication());
 * ```
 */
export function onMount(node: SchemaNodeControl, fn: () => void | (() => void)): void {
  setLifecycleHook(node, 'onMount', fn);
}

/**
 * Хук перед размонтированием узла.
 *
 * @example
 * ```typescript
 * onUnmount(schema.node('wizard'), () => saveDraft(model.get()));
 * ```
 */
export function onUnmount(node: SchemaNodeControl, fn: () => void): void {
  setLifecycleHook(node, 'onUnmount', fn);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
