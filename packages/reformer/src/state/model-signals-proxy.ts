/**
 * Дерево `$` — доступ к сигналам модели и резолв пути в сигнал.
 *
 * Лист отдаётся как сам {@link PathAwareSignal}; группа/массив — как контейнерный узел:
 * `ReadonlySignal` агрегированного значения ПЛЮС доступ к детям по имени/индексу. Контейнер
 * намеренно НЕ `instanceof Signal` — по этой проверке лист отличают от группы (`create-form`,
 * renderer-react/json), см. {@link containerSignal}.
 *
 * @group State
 * @module state/model-signals-proxy
 */

import { computed, type ReadonlySignal } from '@preact/signals-core';
import type { PathAwareSignal } from './types';
import { type ModelNode, GroupNode, ArrayNode, isIndexKey } from './model-nodes';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Proxy: сигналы ($)
// ============================================================================

// Кэш узлов дерева `$` → стабильная идентичность контейнерного узла (`model.$.inner === model.$.inner`)
// и, главное, ОДИН агрегирующий `computed` на узел (иначе каждое обращение плодило бы новый).
const signalsCache = new WeakMap<GroupNode | ArrayNode, any>();

/**
 * Делегат `ReadonlySignal` над агрегатом контейнерного узла. Обычный объект, а НЕ подкласс/Proxy
 * вокруг инстанса `Computed`, по двум причинам:
 * - методы замкнуты на `agg`, поэтому receiver прокси не утекает в preact как `this` (иначе его
 *   запись во внутренние поля (`this._targets = …`) ушла бы в set-трап);
 * - `instanceof Signal` остаётся `false`, а проверками `value instanceof Signal` по кодовой базе
 *   лист отличают от группы (`create-form`, renderer-react/json). `ReadonlySignal` — структурный
 *   интерфейс, так что совместимость по типам сохраняется.
 */
function containerSignal(node: GroupNode | ArrayNode): ReadonlySignal<unknown> {
  const agg = computed(() => node.read());
  return {
    get value() {
      return agg.value;
    },
    peek: () => agg.peek(),
    subscribe: (fn: (value: unknown) => void) => agg.subscribe(fn),
    valueOf: () => agg.value,
    toString: () => String(agg.value),
    toJSON: () => agg.value,
    brand: agg.brand,
  } as ReadonlySignal<unknown>;
}

/**
 * Узел дерева `$`: лист → сам {@link PathAwareSignal}, группа/массив → контейнерный узел —
 * {@link ReadonlySignal} агрегированного значения ПЛЮС доступ к детям по имени/индексу.
 *
 * Порядок разрешения ключа: служебные `__path`/`__kind` → ребёнок → свойство сигнала. Дети идут
 * раньше свойств сигнала — тот же приоритет, что у {@link makeFormModel} (поле формы затеняет метод
 * API). Поэтому имена `value`/`peek`/`subscribe`/`valueOf`/`toString`/`toJSON`/`brand` де-факто
 * зарезервированы: одноимённое поле формы затенит свойство сигнала (`subscribe` при этом продолжает
 * работать — он замкнут на агрегат, а не читает `.value` через прокси).
 *
 * `has`/`ownKeys` намеренно НЕ показывают свойства сигнала — ровно как `__path`, доступный через
 * `get`, но невидимый для `in`/`Object.keys`. Так `Object.keys(model.$.<group>)` остаётся списком
 * полей, а потребители, перечисляющие модель, не видят служебных ключей.
 */
export function signalsProxy(node: ModelNode): any {
  if (node.kind === 'leaf') return node.signal;
  const cached = signalsCache.get(node);
  if (cached) return cached;

  const api = containerSignal(node);
  const isGroup = node.kind === 'group';
  const childAt = (key: string): ModelNode | undefined =>
    isGroup
      ? (node as GroupNode).children.get(key)
      : isIndexKey(key)
        ? (node as ArrayNode).items.value[Number(key)]
        : undefined;

  const target = isGroup
    ? {}
    : {
        get length(): number {
          return (node as ArrayNode).items.value.length;
        },
      };

  const proxy = new Proxy(target, {
    get: (t, key, recv) => {
      if (key === '__path') return node.path;
      if (key === '__kind') return node.kind;
      if (typeof key !== 'string') return Reflect.get(api, key, api);
      const child = childAt(key);
      if (child) return signalsProxy(child);
      // `length` массива — реактивный геттер на target; у группы такого ключа нет.
      if (!isGroup && Reflect.has(t, key)) return Reflect.get(t, key, recv);
      return Reflect.get(api, key, api);
    },
    has: (t, key) =>
      typeof key === 'string' && (childAt(key) !== undefined || (!isGroup && Reflect.has(t, key))),
    ownKeys: () => (isGroup ? [...(node as GroupNode).children.keys()] : Reflect.ownKeys(target)),
    getOwnPropertyDescriptor: (t, key) => {
      if (typeof key === 'string' && childAt(key)) return { enumerable: true, configurable: true };
      return isGroup ? undefined : Reflect.getOwnPropertyDescriptor(t, key);
    },
  });

  signalsCache.set(node, proxy);
  return proxy;
}

/**
 * Узел дерева `model.$` — контейнер (группа/массив), а не лист?
 *
 * Контейнерный узел структурно совместим с `ReadonlySignal` (`peek`/`value`/`subscribe`), поэтому
 * duck-typing «есть `peek` ⇒ это лист» на нём даёт ложное срабатывание. Этот guard — надёжный
 * способ различить: обходчикам дерева нужно спускаться в контейнер, а не читать его целиком.
 *
 * @group Model
 * @example
 * ```typescript
 * const isLeaf = (v: unknown) => isSignalLike(v) && !isModelContainerSignal(v);
 * ```
 */
export function isModelContainerSignal(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  const kind = (value as { __kind?: unknown }).__kind;
  return kind === 'group' || kind === 'array';
}

// ============================================================================
// signalAt: путь → сигнал
// ============================================================================

export function resolveSignalAt(
  root: GroupNode,
  path: string
): PathAwareSignal<unknown> | undefined {
  if (!path) return undefined;
  let node: ModelNode | undefined = root;
  for (const seg of path.split('.')) {
    if (!node) return undefined;
    if (node.kind === 'group') node = node.children.get(seg);
    else if (node.kind === 'array') node = node.items.peek()[Number(seg)];
    else return undefined;
  }
  return node && node.kind === 'leaf' ? node.signal : undefined;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
