/**
 * Схема-контроллер — программное управление узлами схемы: видимость, пропсы, обработчики событий,
 * жизненный цикл, ref. От React не зависит: поведение формы записывает сюда правила, а исполняет
 * их рендерер.
 *
 * ## Области
 *
 * Узлы адресуются по `selector` внутри ОБЛАСТИ. Область — дерево одной под-модели: корень сборки,
 * строка массива (`item`) или подформа (`part`). Области изолированы строго: корень не видит
 * узлы строк и частей, часть — только своё поддерево. Поэтому два монтирования одной части не
 * конфликтуют, а селектор в ней пишется без оглядки на место, где она стоит.
 *
 * Хранилища принадлежат сборке ({@link createSchemaController}), а не модулю: две сборки на одной
 * модели записей не делят.
 *
 * @group Schema
 * @module form/schema-controller
 */

import { signal, type Signal } from '@preact/signals-core';
import { isModelContainerSignal, isValueSignal } from '../model/model-signals-proxy';
import { isModelFacade } from '../model/model-value-proxy';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Хуки жизненного цикла узла схемы. Каждый хук опционален; повторная регистрация перезаписывает
 * предыдущее значение.
 *
 * @group Schema
 */
export interface NodeLifecycleHooks {
  /** Срабатывает один раз при mount узла. Может вернуть cleanup-функцию. */
  onMount?: () => void | (() => void);
  /** Срабатывает один раз при unmount узла. */
  onUnmount?: () => void;
}

/**
 * Хранилище переопределений одной области схемы. Ключ каждой карты — `selector` узла.
 *
 * @group Schema
 */
export interface SchemaOverrideMaps {
  hiddenOverrides: Map<string, boolean | null>;
  propsOverrides: Map<string, Record<string, unknown> | null>;
  refRegistry: Map<string, { current: any }>;
  /** Условия скрытия узлов: selector → реактивное условие. */
  conditionRegistry: Map<string, () => boolean>;
  /** Реактивные эффекты, живущие, пока область смонтирована (`renderEffect`). */
  effectRegistry: Array<() => void | (() => void)>;
  /** Обработчики событий компонентов: selector → { имя пропа → обработчик }. */
  callbackRegistry: Map<string, Map<string, (...args: any[]) => any>>;
  /** Хуки жизненного цикла узла: selector → { onMount, onUnmount }. */
  lifecycleRegistry: Map<string, NodeLifecycleHooks>;
  /** Общий счётчик изменений области. Узлы на него не подписываются — см. `versionFor`. */
  version: Signal<number>;
  /**
   * Версия-сигнал одного селектора (создаётся лениво). Узел подписывается только на сигнал СВОЕГО
   * селектора, поэтому `setHidden` / `patchProps` уведомляют один узел, а не всё дерево.
   */
  versionFor(selector: string): Signal<number>;
}

/**
 * Управление одним узлом схемы. Получается через `schema.node(selector)`.
 *
 * @group Schema
 */
export interface SchemaNodeControl {
  /** Принудительно скрыть или показать узел, минуя условие `hideWhen`. */
  setHidden(value: boolean): this;
  /** Убрать принудительное значение — снова действует условие `hideWhen`. */
  resetHidden(): this;
  /** Подмешать объект в `componentProps` узла. */
  patchProps(partial: Record<string, unknown>): this;
  /** Убрать подмешанные пропсы. */
  resetProps(): this;
  /**
   * Ref на компонент узла. Создаётся один раз на селектор; рендерер вешает его на компонент.
   * Компонент обязан принимать `ref`.
   */
  getRef<H>(): { current: H | null };
  /** @internal Селектор узла. */
  __selector: string;
  /** @internal Хранилище области. */
  __overrideMaps: SchemaOverrideMaps;
}

/**
 * Схема одной области: адресует узлы по `selector`.
 *
 * @group Schema
 */
export interface SchemaScope {
  /** Управление узлом области по его `selector`. */
  node(selector: string): SchemaNodeControl;
  /** @internal Хранилище области — его читает рендерер. */
  __overrideMaps: SchemaOverrideMaps;
}

/**
 * Схема-контроллер сборки: области по под-моделям.
 *
 * @group Schema
 */
export interface SchemaController {
  /**
   * Область под-модели: корня сборки, строки массива или группы подформы. Создаётся при первом
   * обращении; повторное обращение отдаёт ту же область.
   */
  scopeOf(subModel: object): SchemaScope;
}

/**
 * Пустое хранилище переопределений области.
 *
 * @group Schema
 */
function createSchemaOverrideMaps(): SchemaOverrideMaps {
  const selectorVersions = new Map<string, Signal<number>>();
  return {
    hiddenOverrides: new Map(),
    propsOverrides: new Map(),
    refRegistry: new Map(),
    conditionRegistry: new Map(),
    effectRegistry: [],
    callbackRegistry: new Map(),
    lifecycleRegistry: new Map(),
    version: signal(0),
    versionFor(selector) {
      let version = selectorVersions.get(selector);
      if (!version) {
        version = signal(0);
        selectorVersions.set(selector, version);
      }
      return version;
    },
  };
}

/**
 * Схема области поверх хранилища: `node(selector)` → управление узлом.
 *
 * @param maps - Хранилище области; по умолчанию создаётся новое.
 * @group Schema
 */
export function createSchemaScope(
  maps: SchemaOverrideMaps = createSchemaOverrideMaps()
): SchemaScope {
  // Изменение уведомляет только подписчиков затронутого селектора; общий счётчик — для тех, кому
  // нужна любая правка области.
  const bump = (selector: string): void => {
    maps.version.value++;
    maps.versionFor(selector).value++;
  };

  return {
    __overrideMaps: maps,
    node: (selector) => ({
      setHidden(value) {
        maps.hiddenOverrides.set(selector, value);
        bump(selector);
        return this;
      },
      resetHidden() {
        maps.hiddenOverrides.delete(selector);
        bump(selector);
        return this;
      },
      patchProps(partial) {
        maps.propsOverrides.set(selector, {
          ...(maps.propsOverrides.get(selector) ?? {}),
          ...partial,
        });
        bump(selector);
        return this;
      },
      resetProps() {
        maps.propsOverrides.delete(selector);
        bump(selector);
        return this;
      },
      getRef<H>() {
        let ref = maps.refRegistry.get(selector);
        if (!ref) {
          ref = { current: null };
          maps.refRegistry.set(selector, ref);
        }
        return ref as { current: H | null };
      },
      __selector: selector,
      __overrideMaps: maps,
    }),
  };
}

/**
 * Схема-контроллер одной сборки формы.
 *
 * @example
 * ```typescript
 * const controller = createSchemaController();
 * const root = controller.scopeOf(model);
 * root.node('mortgage').setHidden(true);
 *
 * controller.scopeOf(model.items.at(0)); // область строки — свои селекторы
 * ```
 *
 * @group Schema
 */
export function createSchemaController(): SchemaController {
  const scopes = new WeakMap<object, SchemaScope>();
  return {
    scopeOf(subModel) {
      let scope = scopes.get(subModel);
      if (!scope) {
        scope = createSchemaScope();
        scopes.set(subModel, scope);
      }
      return scope;
    },
  };
}

/**
 * Селекторы узлов дерева области: узел и его `children`. Внутрь `item` и `part` обход не
 * заходит — это функции, их поддеревья принадлежат другим областям.
 *
 * @param node - Узел дерева области.
 * @param onSelector - Вызывается для каждого встреченного `selector` (в том числе повторного).
 */
export function eachSchemaSelector(node: unknown, onSelector: (selector: string) => void): void {
  const visit = (current: unknown, visited: WeakSet<object>): void => {
    if (current == null || typeof current !== 'object') return;
    if (isValueSignal(current) || isModelContainerSignal(current) || isModelFacade(current)) return;
    if (visited.has(current)) return;
    visited.add(current);
    const { selector, children } = current as { selector?: unknown; children?: unknown };
    if (typeof selector === 'string') onSelector(selector);
    if (Array.isArray(children)) for (const child of children) visit(child, visited);
  };
  visit(node, new WeakSet());
}

/**
 * Селекторы, на которые в области записаны правила, но которых нет в её дереве. Такое правило
 * ничего не делает — сборка и рендерер в dev предупреждают о нём.
 *
 * Ref в проверку не входит: его разрешено брать по абсолютному пути модели
 * (`phones.0.number`), а такой строки при сборке может ещё не быть.
 *
 * @param maps - Хранилище области.
 * @param tree - Дерево (поддерево) области.
 * @returns Селекторы с правилами, не найденные в дереве.
 *
 * @example
 * ```typescript
 * const scope = controller.scopeOf(model);
 * unknownSchemaSelectors(scope.__overrideMaps, tree); // ['mortgage'] — узла с таким selector нет
 * ```
 *
 * @group Schema
 */
export function unknownSchemaSelectors(maps: SchemaOverrideMaps, tree: unknown): string[] {
  const known = new Set<string>();
  eachSchemaSelector(tree, (selector) => known.add(selector));
  const used = new Set<string>([
    ...maps.hiddenOverrides.keys(),
    ...maps.propsOverrides.keys(),
    ...maps.conditionRegistry.keys(),
    ...maps.callbackRegistry.keys(),
    ...maps.lifecycleRegistry.keys(),
  ]);
  return [...used].filter((selector) => !known.has(selector));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
