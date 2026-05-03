/**
 * RenderBehaviorFn — поведение схемы рендера через standalone helpers
 *
 * Контракт аналогичен BehaviorSchemaFn из @reformer/core:
 * функция принимает schema и вызывает вспомогательные функции.
 *
 * Форма больше не передаётся напрямую — она читается через ref компонента
 * (например, FormWizardHandle.form). Условия реактивны через Preact computed().
 *
 * @module reformer/renderer-react/render-behavior
 */

import { useCallback, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { computed, effect } from '@preact/signals-core';
import type { RenderSchemaProxy, RenderNodeControl } from './render-schema-proxy';

// ============================================================================
// Public types
// ============================================================================

/**
 * Функция-схема поведения рендера.
 * Аналог BehaviorSchemaFn из @reformer/core, но для видимости нод.
 *
 * Принимает схему и вызывает standalone-хелперы (hideWhen, renderEffect).
 * Форма читается через ref wizard-компонента: `schema.node('wizard').getRef().current?.form`.
 *
 * @example
 * ```typescript
 * const behavior: RenderBehaviorFn<MyForm> = (schema) => {
 *   const wizardRef = schema.node('wizard').getRef<FormWizardHandle<MyForm>>();
 *
 *   hideWhen(schema.node('mortgage-section'), () =>
 *     wizardRef.current?.form.loanType.value.value !== 'mortgage'
 *   );
 *
 *   renderEffect(schema, () => {
 *     const form = wizardRef.current?.form;
 *     if (form?.loanType.value.value === 'mortgage') {
 *       wizardRef.current?.goToStep(1);
 *     }
 *   });
 * };
 * ```
 */
export type RenderBehaviorFn<T> = (schema: RenderSchemaProxy<T>) => void;

// ============================================================================
// Standalone helpers
// ============================================================================

/**
 * Объявить условие скрытия для ноды.
 *
 * Условие реактивно — пересчитывается при изменении любого Preact-сигнала,
 * прочитанного внутри conditionFn (в т.ч. сигналов формы через ref).
 *
 * @example
 * ```typescript
 * const wizardRef = schema.node('wizard').getRef<FormWizardHandle<MyForm>>();
 * hideWhen(schema.node('mortgage-section'), () =>
 *   wizardRef.current?.form.loanType.value.value !== 'mortgage'
 * );
 * ```
 */
export function hideWhen(node: RenderNodeControl, conditionFn: () => boolean): void {
  node.__overrideMaps.conditionRegistry.set(node.__selector, conditionFn);
}

/**
 * Зарегистрировать колбэк на проп-событие компонента.
 *
 * Позволяет объявить обработчики (onSubmit, onChange и т.п.) в behavior
 * вместо жёсткого указания в componentProps схемы.
 * Колбэк получает ровно те же аргументы, что и оригинальный проп компонента.
 *
 * @example
 * ```typescript
 * onComponentEvent(
 *   schema.node('wizard'),
 *   'onSubmit',
 *   async (values: MyForm) => {
 *     await submitForm(values);
 *   }
 * );
 * ```
 */

export function onComponentEvent(
  node: RenderNodeControl,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => any
): void {
  const { callbackRegistry } = node.__overrideMaps;
  if (!callbackRegistry.has(node.__selector)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callbackRegistry.set(node.__selector, new Map<string, (...args: any[]) => any>());
  }
  callbackRegistry.get(node.__selector)!.set(event, handler);
}

/**
 * Зарегистрировать реактивный side-effect.
 *
 * effectFn оборачивается в Preact effect() — автоматически перезапускается
 * при изменении любого сигнала, прочитанного внутри effectFn.
 * Может вернуть функцию очистки.
 *
 * @example
 * ```typescript
 * const wizardRef = schema.node('wizard').getRef<FormWizardHandle<MyForm>>();
 * renderEffect(schema, () => {
 *   const form = wizardRef.current?.form;
 *   if (form?.loanType.value.value === 'mortgage') {
 *     wizardRef.current?.goToStep(1);
 *   }
 * });
 * ```
 */

export function renderEffect<T>(
  schema: RenderSchemaProxy<T>,
  effectFn: () => void | (() => void)
): void {
  schema.__overrideMaps.effectRegistry.push(effectFn);
}

// ----------------------------------------------------------------------------
// Lifecycle helpers
// ----------------------------------------------------------------------------

function setLifecycleHook<K extends keyof import('./render-schema-proxy').NodeLifecycleHooks>(
  node: RenderNodeControl,
  hook: K,
  value: NonNullable<import('./render-schema-proxy').NodeLifecycleHooks[K]>
): void {
  const { lifecycleRegistry } = node.__overrideMaps;
  const existing = lifecycleRegistry.get(node.__selector) ?? {};
  lifecycleRegistry.set(node.__selector, { ...existing, [hook]: value });
}

/**
 * Синхронный build-time hook. Вызывается один раз при применении behavior к схеме
 * (до первого рендера ноды). Это единственный хук, способный повлиять на первый
 * рендер — внутри можно дергать `schema.node(selector).patchProps({ ... })`
 * для установки/обновления componentProps.
 *
 * Типичный кейс: создать форму/стейт, закрепить за нодой через patchProps.
 *
 * @example
 * ```typescript
 * onInit(schema.node('wizard'), () => {
 *   const form = createMyForm();
 *   schema.node('wizard').patchProps({ form });
 * });
 * ```
 */
export function onInit(node: RenderNodeControl, fn: () => void): void {
  fn();
}

/**
 * Post-mount hook. Срабатывает после первого mount ноды (через useEffect).
 * Может вернуть cleanup, который выполнится при unmount.
 *
 * @example
 * ```typescript
 * onMount(schema.node('wizard'), () => {
 *   console.log('wizard mounted');
 *   return () => console.log('wizard cleanup from onMount');
 * });
 * ```
 */
export function onMount(node: RenderNodeControl, fn: () => void | (() => void)): void {
  setLifecycleHook(node, 'onMount', fn);
}

/**
 * Pre-unmount hook. Срабатывает при unmount ноды.
 *
 * @example
 * ```typescript
 * onUnmount(schema.node('wizard'), () => {
 *   console.log('wizard unmounted');
 * });
 * ```
 */
export function onUnmount(node: RenderNodeControl, fn: () => void): void {
  setLifecycleHook(node, 'onUnmount', fn);
}

// ============================================================================
// Internal hooks
// ============================================================================

/**
 * @internal
 * Подписывается на реактивное условие через Preact computed().
 * При изменении любого сигнала формы, прочитанного внутри fn, компонент перерендерится.
 */
export function useCondition(fn: (() => boolean) | undefined): boolean {
  const getSnapshot = useCallback(() => fn?.() ?? false, [fn]);
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!fn) return () => {};
      const c = computed(fn);
      return c.subscribe(notify);
    },
    [fn]
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * @internal
 * Монтирует реактивные effects из effectRegistry.
 * Каждый effect оборачивается в Preact effect() — автоматически перезапускается
 * при изменении любого сигнала, прочитанного внутри effectFn.
 */
export function RenderBehaviorEffects({
  effectRegistry,
}: {
  effectRegistry: Array<() => void | (() => void)>;
}): null {
  useEffect(() => {
    const disposes = effectRegistry.map((effectFn) =>
      effect(() => {
        const cleanup = effectFn();
        return typeof cleanup === 'function' ? cleanup : undefined;
      })
    );
    return () => disposes.forEach((dispose) => dispose());
  }, []); // effectRegistry стабилен — создаётся один раз при createRenderSchema

  return null;
}

/**
 * @internal
 * Подключает lifecycle-хуки ноды (onMount/onUnmount).
 * onMount может вернуть cleanup-функцию — она вызовется до onUnmount.
 */
export function useNodeLifecycle(
  hooks: import('./render-schema-proxy').NodeLifecycleHooks | undefined
): void {
  useEffect(() => {
    if (!hooks) return;
    const mountCleanup = hooks.onMount?.();
    return () => {
      if (typeof mountCleanup === 'function') mountCleanup();
      hooks.onUnmount?.();
    };
  }, [hooks]);
}
