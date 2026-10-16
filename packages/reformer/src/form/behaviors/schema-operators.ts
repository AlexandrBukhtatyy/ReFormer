/**
 * Операторы поведения над узлами схемы: видимость, события компонентов, жизненный цикл.
 *
 * Оператор только ЗАПИСЫВАЕТ правило методом узла или области (`addHideCondition`,
 * `addEventHandler`, `addLifecycleHook`, `addRenderEffect`) и регистрирует его снятие; как правила
 * хранятся, знает схема-контроллер, а исполняет их рендерер. Там, где схему
 * рисуют руками (JSX без рендерера), правила узлов не действуют — видимость и обработчики
 * остаются в разметке.
 *
 * Узел берётся из схемы своей области: `schema.node(selector)`. Внутри `defineFormBehavior`
 * запись живёт столько же, сколько поведение, и снимается вместе с ним.
 *
 * @group Behaviors
 * @module form/behaviors/schema-operators
 */

import type { SchemaNodeControl, SchemaScope } from '../schema-controller';
import { onDisposeIfActive } from './context';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Скрывать узел, пока условие истинно.
 *
 * Условие реактивно: пересчитывается при изменении любого сигнала, прочитанного внутри него.
 * Принудительное `schema.node(selector).setHidden(...)` главнее условия.
 *
 * Только видимость: поля скрытого узла не выключаются и проверяются правилами — переход шага
 * откажет без замечаний на экране. Поля узла выключай тем же условием через `enableWhen`.
 *
 * @example
 * ```typescript
 * const mortgage = () => model.loanType === 'mortgage';
 * enableWhen([model.$.propertyValue, model.$.initialPayment], mortgage, { resetOnDisable: true });
 * hideWhen(schema.node('mortgage'), () => !mortgage());
 * ```
 */
export function hideWhen(node: SchemaNodeControl, condition: () => boolean): void {
  onDisposeIfActive(node.addHideCondition(condition));
}

/**
 * Повесить обработчик на проп-событие компонента узла (`onSubmit`, `onChange`, …).
 *
 * Обработчик получает те же аргументы, что и исходный проп компонента. У контейнера он перекрывает
 * одноимённый проп из `componentProps`. У поля и массива событие уже занято привязкой (запись
 * значения в форму, кнопки массива) — обработчик вызывается после неё, а не вместо: ввод не ломается.
 * У подформы своего компонента нет — правило не действует, в dev рендерер предупреждает.
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
  onDisposeIfActive(node.addEventHandler(event, handler));
}

/**
 * Реактивный эффект, живущий, пока схема области смонтирована рендерером.
 *
 * В отличие от `effect` поведения, запускается после монтирования — внутри доступны ref узлов
 * (`schema.node(selector).getRef().current`). Может вернуть функцию очистки.
 *
 * @example
 * ```typescript
 * const panel = schema.node('summary').getRef<HTMLElement>();
 * renderEffect(schema, () => {
 *   if (model.loanType === 'mortgage') panel.current?.scrollIntoView();
 * });
 * ```
 */
export function renderEffect(schema: SchemaScope, effectFn: () => void | (() => void)): void {
  onDisposeIfActive(schema.addRenderEffect(effectFn));
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
  onDisposeIfActive(node.addLifecycleHook('onMount', fn));
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
  onDisposeIfActive(node.addLifecycleHook('onUnmount', fn));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
