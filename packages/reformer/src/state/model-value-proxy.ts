/**
 * Value-фасад модели: `model.email`, `model.profile.name`, `model.tags.at(0)`.
 *
 * Объектная группа промоутится в под-модель {@link makeFormModel} (value-доступ + `.$` + API),
 * массив — в прокси с мутациями и обходом, лист — в реактивное чтение значения. Идентичность
 * фасадов стабильна (`facadeCache`), поэтому `model.profile.$.name === model.$.profile.name`
 * и `arr[i] === arr.at(i)` — на это опираются per-item формы и ключи в рендере.
 *
 * @group State
 * @module state/model-value-proxy
 */

import { type ModelNode, GroupNode, ArrayNode, isIndexKey } from './model-nodes';
import { signalsProxy, resolveSignalAt } from './model-signals-proxy';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Proxy: value-доступ
// ============================================================================

/**
 * Value-фасад узла модели: объектная группа → под-модель {@link makeFormModel} (value-доступ + `.$` + API),
 * массив → {@link arrayValueProxy}, лист → значение (реактивное чтение). Единая точка value-доступа —
 * и для полей корня/групп (`model.personalData`), и для обхода массива (`at`/`map`/`forEach`/индекс/итератор):
 * объектные узлы всюду единообразно промоутятся в {@link FormModel} со стабильной идентичностью (facadeCache),
 * поэтому `model.personalData.$.lastName === model.$.personalData.lastName` и `arr[i] === arr.at(i)`.
 */
function nodeValue(node: ModelNode | undefined): unknown {
  if (!node) return undefined;
  if (node.kind === 'group') return makeFormModel(node);
  if (node.kind === 'array') return arrayValueProxy(node);
  return node.read(); // лист — реактивное чтение (подписка в effect/computed)
}

function arrayValueProxy(arr: ArrayNode): any {
  const api = {
    get length(): number {
      return arr.items.value.length;
    },
    push: (v: unknown) => arr.push(v),
    insertAt: (i: number, v: unknown) => arr.insertAt(i, v),
    removeAt: (i: number) => arr.removeAt(i),
    move: (f: number, t: number) => arr.move(f, t),
    swap: (a: number, b: number) => arr.swap(a, b),
    clear: () => arr.clear(),
    at: (i: number) => nodeValue(arr.items.value[i]),
    map: (fn: (item: unknown, i: number) => unknown) =>
      arr.items.value.map((n, i) => fn(nodeValue(n), i)),
    forEach: (fn: (item: unknown, i: number) => void) =>
      arr.items.value.forEach((n, i) => fn(nodeValue(n), i)),
    toArray: () => arr.peek(),
    [Symbol.iterator]: function* () {
      const list = arr.items.value;
      for (let i = 0; i < list.length; i++) yield nodeValue(list[i]);
    },
  };
  return new Proxy(api, {
    get: (target, key, recv) => {
      if (key === '__path') return arr.path;
      if (typeof key === 'string' && isIndexKey(key))
        return nodeValue(arr.items.value[Number(key)]);
      return Reflect.get(target, key, recv);
    },
    has: (target, key) => {
      if (typeof key === 'string' && isIndexKey(key)) return Number(key) < arr.items.value.length;
      return Reflect.has(target, key);
    },
  });
}
// ============================================================================
// Фасад FormModel
// ============================================================================

const RESERVED = new Set([
  '$',
  'get',
  'set',
  'patch',
  'isDirty',
  'reset',
  'captureInitial',
  'signalAt',
]);

// Кэш фасадов по GroupNode → стабильная идентичность под-модели (для per-item форм/ключей в рендере).
const facadeCache = new WeakMap<GroupNode, any>();

// Обратный поиск: фасад FormModel → корневой GroupNode. Нужен для обхода листьев модели
// (`eachLeafSignal`) без публичного доступа к внутреннему дереву.
export const rootByFacade = new WeakMap<object, GroupNode>();

export function makeFormModel(group: GroupNode): any {
  const cached = facadeCache.get(group);
  if (cached) return cached;
  const api: Record<string, unknown> = {
    $: signalsProxy(group),
    get: () => group.peek(),
    set: (v: Record<string, unknown>) => group.set(v),
    patch: (v: Record<string, unknown>) => group.set(v),
    isDirty: () => group.dirty(),
    reset: () => group.resetToInitial(),
    captureInitial: () => group.captureInitial(),
    signalAt: (path: string) => resolveSignalAt(group, path),
  };
  const proxy = new Proxy(
    {},
    {
      get: (_t, key) => {
        // Паритет с прежним groupValueProxy: путь группы читаем и на под-модели (не enumerable — см. ownKeys ниже).
        if (key === '__path') return group.path;
        if (typeof key !== 'string') return undefined;
        // Поле формы затеняет одноимённый метод API (редкий краевой случай).
        const child = group.children.get(key);
        if (child) return nodeValue(child);
        if (RESERVED.has(key)) return api[key];
        return undefined;
      },
      set: (_t, key, val) => {
        if (typeof key !== 'string') return false;
        const child = group.children.get(key);
        if (child) {
          child.set(val);
          return true;
        }
        return false;
      },
      has: (_t, key) => typeof key === 'string' && (group.children.has(key) || RESERVED.has(key)),
      ownKeys: () => [...group.children.keys()],
      getOwnPropertyDescriptor: (_t, key) =>
        typeof key === 'string' && group.children.has(key)
          ? { enumerable: true, configurable: true }
          : undefined,
    }
  );
  facadeCache.set(group, proxy);
  rootByFacade.set(proxy, group);
  return proxy;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
