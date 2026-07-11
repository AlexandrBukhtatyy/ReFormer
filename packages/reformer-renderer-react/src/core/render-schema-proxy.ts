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
import { signal, type Signal } from '@reformer/core/signals';
import type { RenderSchemaFn } from './types';

const PROXY_MARKER = Symbol('RenderSchemaProxy');

// ============================================================
// Override maps context
// ============================================================

/**
 * Хуки жизненного цикла ноды, регистрируемые через render-behavior.
 * Каждый хук опционален; повторная регистрация перезаписывает предыдущее значение.
 */
export interface NodeLifecycleHooks {
  /** Срабатывает один раз при mount ноды. Может вернуть cleanup-функцию. */
  onMount?: () => void | (() => void);
  /** Срабатывает один раз при unmount ноды. */
  onUnmount?: () => void;
}

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
  /** Хуки жизненного цикла ноды: selector → { onMount, onUnmount } */
  lifecycleRegistry: Map<string, NodeLifecycleHooks>;
  /**
   * Глобальный счётчик изменений (сохранён для обратной совместимости). Пер-нодовые подписчики
   * больше на него НЕ подписываются — см. {@link RenderSchemaOverrideMaps.versionFor}.
   */
  version: Signal<number>;
  /**
   * Пер-selector версия-сигнал (ленивое создание). Нода подписывается только на сигнал СВОЕГО
   * selector, поэтому `setHidden`/`patchProps` уведомляют O(1) подписчиков (только затронутую
   * ноду), а не O(N) все ноды дерева через единый глобальный сигнал.
   */
  versionFor(selector: string): Signal<number>;
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

/**
 * Type guard: проверяет, что `fn` — это результат {@link createRenderSchema}.
 *
 * @param fn - Произвольная `RenderSchemaFn`.
 * @returns `true`, если `fn` обёрнута через `createRenderSchema`.
 *
 * @example
 * ```typescript
 * import { isRenderSchemaProxy, createRenderSchema } from '@reformer/renderer-react';
 *
 * const proxy = createRenderSchema(renderSchemaFn);
 * isRenderSchemaProxy(proxy); // true
 * isRenderSchemaProxy(renderSchemaFn); // false
 * ```
 */
export function isRenderSchemaProxy<T>(fn: RenderSchemaFn<T>): fn is RenderSchemaProxy<T> {
  return typeof fn === 'function' && PROXY_MARKER in fn;
}

/**
 * Оборачивает {@link RenderSchemaFn} в {@link RenderSchemaProxy} — функцию-схему
 * с дополнительным API `.node(selector)` для императивного управления нодами
 * (видимость, `componentProps`, ref) и точкой применения декларативного поведения
 * (`hideWhen`/`renderEffect`/`onComponentEvent`/lifecycle-хуки).
 *
 * Возвращённый прокси остаётся вызываемой `RenderSchemaFn`, поэтому его напрямую
 * передают в `render` у {@link FormRenderer}. Переопределения хранятся в Map-ах и
 * применяются реактивно (через версионный сигнал) — перерисовывается только затронутая нода.
 *
 * @typeParam T - Тип значения формы
 * @param fn - Исходная функция-схема (без аргументов; привязка к данным — через сигналы в листьях)
 * @returns {@link RenderSchemaProxy} — та же схема + `.node(selector)` и `__overrideMaps`
 *
 * @example Программное управление нодами
 * ```tsx
 * const schema = createRenderSchema<MyForm>(() => ({
 *   selector: 'root',
 *   component: Box,
 *   children: [
 *     { selector: 'extra-section', component: Section, componentProps: { title: 'Доп.' } },
 *   ],
 * }));
 *
 * schema.node('extra-section').setHidden(true);
 * schema.node('extra-section').patchProps({ title: 'Новый заголовок' });
 * schema.node('extra-section').resetHidden();
 *
 * <FormRenderer render={schema} />
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
  const lifecycleRegistry = new Map<string, NodeLifecycleHooks>();
  const version = signal(0);
  const selectorVersions = new Map<string, Signal<number>>();
  const versionFor = (selector: string): Signal<number> => {
    let s = selectorVersions.get(selector);
    if (!s) {
      s = signal(0);
      selectorVersions.set(selector, s);
    }
    return s;
  };
  // Бампнуть версию: глобальную (обратная совместимость — на неё уже никто из нод не подписан)
  // и точечно сигнал selector'а, чтобы уведомить ТОЛЬКО подписчиков этой ноды (O(1), не O(N)).
  const bump = (selector: string): void => {
    version.value++;
    versionFor(selector).value++;
  };

  const overrideMaps: RenderSchemaOverrideMaps = {
    hiddenOverrides,
    propsOverrides,
    refRegistry,
    conditionRegistry,
    effectRegistry,
    callbackRegistry,
    lifecycleRegistry,
    version,
    versionFor,
  };

  const proxyFn = fn as RenderSchemaProxy<T>;

  Object.assign(proxyFn, {
    [PROXY_MARKER]: true,
    __overrideMaps: overrideMaps,
  });

  proxyFn.node = (selector: string): RenderNodeControl => ({
    setHidden(value: boolean) {
      hiddenOverrides.set(selector, value);
      bump(selector);
      return this;
    },
    resetHidden() {
      hiddenOverrides.delete(selector);
      bump(selector);
      return this;
    },
    patchProps(partial: Record<string, unknown>) {
      propsOverrides.set(selector, { ...(propsOverrides.get(selector) ?? {}), ...partial });
      bump(selector);
      return this;
    },
    resetProps() {
      propsOverrides.delete(selector);
      bump(selector);
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
      // Подписка только на сигнал СВОЕГО selector (O(1) notify). Ноды без selector не подписываются.
      (onStoreChange: () => void) =>
        maps && selector ? maps.versionFor(selector).subscribe(onStoreChange) : () => {},
      [maps, selector]
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
      // Подписка только на сигнал СВОЕГО selector (O(1) notify). Ноды без selector не подписываются.
      (onStoreChange: () => void) =>
        maps && selector ? maps.versionFor(selector).subscribe(onStoreChange) : () => {},
      [maps, selector]
    ),
    () => (selector && maps ? (maps.propsOverrides.get(selector) ?? null) : null),
    () => (selector && maps ? (maps.propsOverrides.get(selector) ?? null) : null)
  );
}
