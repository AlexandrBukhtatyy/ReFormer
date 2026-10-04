/**
 * createRenderSchema — программное управление схемой рендера
 *
 * Оборачивает RenderSchemaFn в прокси-объект, который сохраняет совместимость
 * с FormRenderer и добавляет API .node(selector) для императивного управления
 * видимостью и пропсами нод через Preact-сигналы.
 *
 * Само хранилище переопределений и управление узлом живут в ядре (схема-контроллер,
 * `@reformer/core`) — там они не зависят от React и доступны поведению формы. Здесь остаются
 * обёртка `createRenderSchema` для низкоуровневого рендера по функции-схеме и React-хуки, которыми
 * узлы рендерера читают переопределения своей области.
 *
 * @module reformer/renderer-react/render-schema-proxy
 */

import { createContext, useContext, useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import {
  createSchemaScope,
  type NodeLifecycleHooks,
  type SchemaController,
  type SchemaNodeControl,
  type SchemaOverrideMaps,
} from '@reformer/core';
import type { RenderSchemaFn } from './types';

const PROXY_MARKER = Symbol('RenderSchemaProxy');

// ============================================================
// Override maps context
// ============================================================

export type { NodeLifecycleHooks };

/**
 * Хранилище переопределений области схемы — общий тип ядра ({@link SchemaOverrideMaps}).
 * Имя оставлено для обратной совместимости импорта из рендерера.
 */
export type RenderSchemaOverrideMaps = SchemaOverrideMaps;

/**
 * React-контекст с картами переопределений ТЕКУЩЕЙ области схемы: корня, строки массива или
 * подформы. Ставит его {@link FormRenderer}, а внутри дерева — границы областей.
 */
export const RenderSchemaOverrideContext = createContext<RenderSchemaOverrideMaps | null>(null);

/** Схема-контроллер сборки и хранилище корневой области — для границ областей и ref по пути. */
export interface SchemaControllerContextValue {
  controller: SchemaController;
  /** Хранилище корневой области: ref по абсолютному пути модели ищется в нём. */
  rootMaps: RenderSchemaOverrideMaps;
}

/**
 * @internal
 * Контекст схемы-контроллера сборки. Есть только при рендере бандла `createForm`: по нему строки
 * массивов и подформы получают собственные области. При рендере по `createRenderSchema` его нет —
 * область одна на всё дерево.
 */
export const SchemaControllerContext = createContext<SchemaControllerContextValue | null>(null);

// ============================================================
// Public types
// ============================================================

/**
 * API для программного управления конкретной нодой схемы рендера — общий тип ядра
 * ({@link SchemaNodeControl}). Получается через schema.node(selector).
 */
export type RenderNodeControl = SchemaNodeControl;

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
 * Низкоуровневый API: область у такой схемы одна на всё дерево, включая строки массивов. Сборка
 * `createForm` даёт области по под-моделям и схему прямо в поведении формы.
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
  const scope = createSchemaScope();
  const proxyFn = fn as RenderSchemaProxy<T>;

  Object.assign(proxyFn, {
    [PROXY_MARKER]: true,
    __overrideMaps: scope.__overrideMaps,
    node: scope.node,
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
