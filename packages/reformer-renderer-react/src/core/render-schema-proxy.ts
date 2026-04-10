/**
 * createRenderSchema — программное управление схемой рендера
 *
 * Оборачивает RenderSchemaFn в прокси-объект, который сохраняет совместимость
 * с FormRenderer и добавляет API .node(selector) для императивного управления
 * видимостью и пропсами нод через Preact-сигналы.
 *
 * Переопределения хранятся в Map-ах и передаются вниз через React-контекст.
 * Компоненты подписываются на версионный сигнал — он инкрементируется при
 * любом изменении переопределений, после чего каждый RenderNodeComponent
 * перечитывает своё значение из Map по selector.
 *
 * @module reformer/renderer-react/render-schema-proxy
 */

import { createRef, createContext, useContext, useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { signal, type Signal } from '@preact/signals-core';
import type { RenderSchemaFn } from './types';

const PROXY_MARKER = Symbol('RenderSchemaProxy');

// ============================================================
// Override maps context
// ============================================================

export interface RenderSchemaOverrideMaps {
  hiddenOverrides: Map<string, boolean | null>;
  propsOverrides: Map<string, Record<string, unknown> | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refRegistry: Map<string, RefObject<any>>;
  /** Условия скрытия нод: selector → conditionFn (реактивная, без form) */
  conditionRegistry: Map<string, () => boolean>;
  /** Реактивные side-effects: [] → (заполняется через renderEffect) */
  effectRegistry: Array<() => void | (() => void)>;
  /** Колбэки на пропсы компонентов: selector → { eventName → handler } */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callbackRegistry: Map<string, Map<string, (...args: any[]) => any>>;
  /** Инкрементируется при любом изменении — все подписчики перечитывают свои значения */
  version: Signal<number>;
}

/**
 * React-контекст с картами переопределений.
 * Предоставляется FormRenderer когда render является RenderSchemaProxy.
 */
export const RenderSchemaOverrideContext = createContext<RenderSchemaOverrideMaps | null>(null);

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
  /**
   * Получить React ref на компонент с данным selector.
   * Ref создаётся один раз (idempotent) и передаётся в компонент через render-node.
   * Компонент должен поддерживать ref (forwardRef или React 19 ref prop).
   */
  getRef<H>(): RefObject<H>;
  /** @internal — selector этой ноды (используется standalone helpers hideWhen/renderEffect) */
  __selector: string;
  /** @internal — override maps схемы (используется standalone helpers) */
  __overrideMaps: RenderSchemaOverrideMaps;
}

/**
 * RenderSchemaFn с дополнительным API программного управления.
 * Создаётся через createRenderSchema().
 */
export type RenderSchemaProxy<T> = RenderSchemaFn<T> & {
  [PROXY_MARKER]: true;
  /** Получить контроллер ноды по selector */
  node(selector: string): RenderNodeControl;
  /** @internal — карты переопределений для передачи через контекст */
  __overrideMaps: RenderSchemaOverrideMaps;
};

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
 * schema.node('extra-section').setHidden(true);
 * schema.node('extra-section').patchProps({ title: 'Новый заголовок' });
 * schema.node('extra-section').resetHidden();
 *
 * <FormRenderer form={form} render={schema} />
 * ```
 */
export function createRenderSchema<T>(fn: RenderSchemaFn<T>): RenderSchemaProxy<T> {
  const hiddenOverrides = new Map<string, boolean | null>();
  const propsOverrides = new Map<string, Record<string, unknown> | null>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refRegistry = new Map<string, RefObject<any>>();
  const conditionRegistry = new Map<string, () => boolean>();
  const effectRegistry: Array<() => void | (() => void)> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callbackRegistry = new Map<string, Map<string, (...args: any[]) => any>>();
  const version = signal(0);

  const overrideMaps: RenderSchemaOverrideMaps = {
    hiddenOverrides,
    propsOverrides,
    refRegistry,
    conditionRegistry,
    effectRegistry,
    callbackRegistry,
    version,
  };

  const proxyFn = fn as RenderSchemaProxy<T>;

  Object.assign(proxyFn, {
    [PROXY_MARKER]: true,
    __overrideMaps: overrideMaps,
  });

  proxyFn.node = (selector: string): RenderNodeControl => ({
    setHidden(value: boolean) {
      hiddenOverrides.set(selector, value);
      version.value++;
      return this;
    },
    resetHidden() {
      hiddenOverrides.delete(selector);
      version.value++;
      return this;
    },
    patchProps(partial: Record<string, unknown>) {
      propsOverrides.set(selector, { ...(propsOverrides.get(selector) ?? {}), ...partial });
      version.value++;
      return this;
    },
    resetProps() {
      propsOverrides.delete(selector);
      version.value++;
      return this;
    },
    getRef<H>(): RefObject<H> {
      if (!refRegistry.has(selector)) {
        refRegistry.set(selector, createRef<H>());
      }
      return refRegistry.get(selector) as RefObject<H>;
    },
    __selector: selector,
    __overrideMaps: overrideMaps,
  });

  return proxyFn;
}

// ============================================================
// Internal hooks
// ============================================================

/**
 * @internal
 * Читает переопределение hidden для данного selector.
 * Подписывается на версионный сигнал — при любом изменении переопределений
 * перечитывает значение из Map. Если selector не задан или переопределения нет — null.
 */
export function useHiddenOverride(selector: string | undefined): boolean | null {
  const maps = useContext(RenderSchemaOverrideContext);

  return useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => (maps ? maps.version.subscribe(onStoreChange) : () => {}),
      [maps]
    ),
    () => (selector && maps ? (maps.hiddenOverrides.get(selector) ?? null) : null),
    () => (selector && maps ? (maps.hiddenOverrides.get(selector) ?? null) : null)
  );
}

/**
 * @internal
 * Читает переопределение props для данного selector.
 * Подписывается на версионный сигнал — аналогично useHiddenOverride.
 */
export function usePropsOverride(selector: string | undefined): Record<string, unknown> | null {
  const maps = useContext(RenderSchemaOverrideContext);

  return useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => (maps ? maps.version.subscribe(onStoreChange) : () => {}),
      [maps]
    ),
    () => (selector && maps ? (maps.propsOverrides.get(selector) ?? null) : null),
    () => (selector && maps ? (maps.propsOverrides.get(selector) ?? null) : null)
  );
}
