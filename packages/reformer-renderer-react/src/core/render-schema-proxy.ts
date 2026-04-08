/**
 * createRenderSchema — программное управление схемой рендера
 *
 * Оборачивает RenderSchemaFn в прокси-объект, который сохраняет совместимость
 * с FormRenderer и добавляет API .node(selector) для императивного управления
 * видимостью и пропсами нод через Preact-сигналы.
 *
 * @module reformer/renderer-react/render-schema-proxy
 */

import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { signal, type Signal } from '@preact/signals-core';
import type { RenderSchemaFn, RenderNode, ContainerRenderNode } from './types';
import { isContainerRenderNode } from './utils';

const PROXY_MARKER = Symbol('RenderSchemaProxy');

// ============================================================
// Public types
// ============================================================

/**
 * API для программного управления конкретной нодой схемы рендера.
 * Получается через schema.node(selector).
 */
export interface RenderNodeControl {
  /** Принудительно скрыть/показать ноду, игнорируя условие hidden из схемы */
  setHidden(value: boolean): this;
  /** Убрать переопределение hidden — восстанавливает исходное условие из схемы */
  resetHidden(): this;
  /** Подмердить объект в componentProps ноды */
  patchProps(partial: Record<string, unknown>): this;
  /** Убрать переопределение пропсов — восстанавливает исходные componentProps из схемы */
  resetProps(): this;
}

/**
 * RenderSchemaFn с дополнительным API программного управления.
 * Создаётся через createRenderSchema().
 */
export type RenderSchemaProxy<T> = RenderSchemaFn<T> & {
  [PROXY_MARKER]: true;
  /** Получить контроллер ноды по selector */
  node(selector: string): RenderNodeControl;
};

/**
 * @internal
 * Расширение RenderNode с прикреплёнными сигналами переопределений.
 * Устанавливается в applyOverrides при вызове проксированной схемы.
 */
export interface RenderNodeOverrides {
  __hiddenOverride?: Signal<boolean | null>;
  __propsOverride?: Signal<Record<string, unknown> | null>;
}

// ============================================================
// Public API
// ============================================================

/** Проверяет, является ли fn результатом createRenderSchema */
export function isRenderSchemaProxy<T>(fn: RenderSchemaFn<T>): fn is RenderSchemaProxy<T> {
  return typeof fn === 'function' && PROXY_MARKER in fn;
}

/**
 * Создаёт RenderSchemaProxy — обёртку над RenderSchemaFn с программным управлением.
 *
 * @example
 * ```ts
 * const schema = createRenderSchema<MyForm>((path) => ({
 *   selector: 'root',
 *   component: Box,
 *   children: [
 *     { selector: 'extra-section', component: Section, children: [...] }
 *   ]
 * }));
 *
 * // Программное управление
 * schema.node('extra-section').setHidden(true);
 * schema.node('extra-section').patchProps({ title: 'Новый заголовок' });
 * schema.node('extra-section').resetHidden();
 *
 * // Передаётся в FormRenderer без изменений
 * <FormRenderer form={form} render={schema} />
 * ```
 */
export function createRenderSchema<T>(fn: RenderSchemaFn<T>): RenderSchemaProxy<T> {
  const hiddenOverrides = new Map<string, Signal<boolean | null>>();
  const propsOverrides = new Map<string, Signal<Record<string, unknown> | null>>();

  function getHiddenSignal(selector: string): Signal<boolean | null> {
    if (!hiddenOverrides.has(selector)) {
      hiddenOverrides.set(selector, signal(null));
    }
    return hiddenOverrides.get(selector)!;
  }

  function getPropsSignal(selector: string): Signal<Record<string, unknown> | null> {
    if (!propsOverrides.has(selector)) {
      propsOverrides.set(selector, signal(null));
    }
    return propsOverrides.get(selector)!;
  }

  /**
   * Рекурсивно прикрепляет сигналы переопределений к нодам.
   * Значения сигналов НЕ читаются здесь — только ссылки прикрепляются.
   * Фактические значения читаются в RenderNodeComponent через useOptionalSignalValue.
   */
  function applyOverrides(node: RenderNode<T>): RenderNode<T> & RenderNodeOverrides {
    if (!isContainerRenderNode(node)) return node;

    const { selector } = node;
    const withOverrides: ContainerRenderNode<T> & RenderNodeOverrides = {
      ...node,
      __hiddenOverride: selector ? getHiddenSignal(selector) : undefined,
      __propsOverride: selector ? getPropsSignal(selector) : undefined,
      children: node.children?.map(applyOverrides),
    };

    return withOverrides;
  }

  const proxyFn = ((path) => applyOverrides(fn(path))) as RenderSchemaProxy<T>;

  Object.assign(proxyFn, { [PROXY_MARKER]: true });

  proxyFn.node = (selector: string): RenderNodeControl => ({
    setHidden(value: boolean) {
      getHiddenSignal(selector).value = value;
      return this;
    },
    resetHidden() {
      getHiddenSignal(selector).value = null;
      return this;
    },
    patchProps(partial: Record<string, unknown>) {
      const sig = getPropsSignal(selector);
      sig.value = { ...sig.value, ...partial };
      return this;
    },
    resetProps() {
      getPropsSignal(selector).value = null;
      return this;
    },
  });

  return proxyFn;
}

// ============================================================
// Internal hook
// ============================================================

/**
 * @internal
 * Подписывается на Preact-сигнал и возвращает его текущее значение.
 * Если сигнал не передан (undefined) — возвращает undefined без подписки.
 *
 * Хук всегда вызывается (не нарушает Rules of Hooks).
 * Условная логика — только внутри колбэков useSyncExternalStore.
 */
export function useOptionalSignalValue<T>(sig: Signal<T> | undefined): T | undefined {
  return useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => (sig ? sig.subscribe(onStoreChange) : () => {}),
      [sig]
    ),
    () => sig?.value,
    () => sig?.value
  );
}
