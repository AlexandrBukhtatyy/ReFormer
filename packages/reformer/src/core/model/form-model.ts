/**
 * FormModel — реактивный proxy над JS-объектом (слой данных, M1).
 *
 * Внутреннее представление — дерево узлов ({@link LeafNode}/{@link GroupNode}/{@link ArrayNode}),
 * зеркалящее форму данных. Наружу отдаются два proxy: value-доступ (значения) и `$` (сигналы).
 *
 * @group Model
 * @module core/model/form-model
 */

import { signal, type Signal } from '@preact/signals-core';
import type { FormModel, PathAwareSignal } from './types';
import { isDerived } from '../utils/derived-registry';

// ============================================================================
// Утилиты
// ============================================================================

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return false;
  if (v instanceof Date) return false;
  if (typeof Blob !== 'undefined' && v instanceof Blob) return false;
  if (typeof File !== 'undefined' && v instanceof File) return false;
  return true;
};

const joinPath = (base: string, key: string | number): string =>
  base === '' ? String(key) : `${base}.${key}`;

const isIndexKey = (key: string): boolean => /^\d+$/.test(key);

const clone = <T>(v: T): T => {
  if (Array.isArray(v)) return v.map(clone) as unknown as T;
  if (isPlainObject(v)) {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v)) o[k] = clone((v as Record<string, unknown>)[k]);
    return o as T;
  }
  return v;
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
};

// ============================================================================
// Внутренние узлы модели
// ============================================================================

type ModelNode = LeafNode | GroupNode | ArrayNode;

class LeafNode {
  readonly kind = 'leaf' as const;
  readonly signal: PathAwareSignal<unknown>;
  private initial: unknown;

  constructor(
    initial: unknown,
    public path: string
  ) {
    const s = signal(initial) as Signal<unknown> & { __path: string };
    s.__path = path;
    this.signal = s as PathAwareSignal<unknown>;
    this.initial = clone(initial);
  }

  rebase(path: string): void {
    this.path = path;
    (this.signal as Signal<unknown> & { __path: string }).__path = path;
  }

  /** Реактивное чтение (внутри effect/computed создаёт зависимость). */
  read(): unknown {
    return this.signal.value;
  }
  /** Нереактивный снимок. */
  peek(): unknown {
    return this.signal.peek();
  }
  set(value: unknown): void {
    this.signal.value = value;
  }
  resetToInitial(): void {
    this.signal.value = clone(this.initial);
  }
  captureInitial(): void {
    this.initial = clone(this.signal.peek());
  }
  dirty(): boolean {
    return !deepEqual(this.signal.peek(), this.initial);
  }
}

class GroupNode {
  readonly kind = 'group' as const;
  readonly children = new Map<string, ModelNode>();

  constructor(
    initial: Record<string, unknown>,
    public path: string
  ) {
    for (const key of Object.keys(initial)) {
      this.children.set(key, buildNode(initial[key], joinPath(path, key)));
    }
  }

  rebase(path: string): void {
    this.path = path;
    for (const [key, node] of this.children) node.rebase(joinPath(path, key));
  }

  peek(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of this.children) out[key] = node.peek();
    return out;
  }
  set(value: unknown): void {
    if (value == null || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    for (const [key, node] of this.children) {
      if (!(key in v)) continue;
      // F9: производные поля (цели compute) не затираем значением из payload — ими владеет compute.
      if (node.kind === 'leaf' && isDerived(node.signal)) continue;
      node.set(v[key]);
    }
  }
  resetToInitial(): void {
    for (const node of this.children.values()) node.resetToInitial();
  }
  captureInitial(): void {
    for (const node of this.children.values()) node.captureInitial();
  }
  dirty(): boolean {
    for (const node of this.children.values()) if (node.dirty()) return true;
    return false;
  }
}

class ArrayNode {
  readonly kind = 'array' as const;
  readonly items: Signal<ModelNode[]>;
  private initial: unknown[];

  constructor(
    initial: unknown[],
    public path: string
  ) {
    this.items = signal(initial.map((v, i) => buildNode(v, joinPath(path, i))));
    this.initial = clone(initial);
  }

  rebase(path: string): void {
    this.path = path;
    this.items.peek().forEach((node, i) => node.rebase(joinPath(path, i)));
  }

  private reindex(): void {
    this.items.peek().forEach((node, i) => node.rebase(joinPath(this.path, i)));
  }

  push(value: unknown): void {
    const arr = this.items.peek();
    this.items.value = [...arr, buildNode(value, joinPath(this.path, arr.length))];
  }
  insertAt(index: number, value: unknown): void {
    const arr = [...this.items.peek()];
    arr.splice(index, 0, buildNode(value, joinPath(this.path, index)));
    this.items.value = arr;
    this.reindex();
  }
  removeAt(index: number): void {
    const arr = [...this.items.peek()];
    arr.splice(index, 1);
    this.items.value = arr;
    this.reindex();
  }
  move(from: number, to: number): void {
    const arr = [...this.items.peek()];
    const [moved] = arr.splice(from, 1);
    if (moved) arr.splice(to, 0, moved);
    this.items.value = arr;
    this.reindex();
  }
  swap(a: number, b: number): void {
    const arr = [...this.items.peek()];
    if (a < 0 || b < 0 || a >= arr.length || b >= arr.length || a === b) return;
    [arr[a], arr[b]] = [arr[b], arr[a]];
    this.items.value = arr;
    this.reindex();
  }
  clear(): void {
    this.items.value = [];
  }

  peek(): unknown[] {
    return this.items.peek().map((node) => node.peek());
  }
  set(value: unknown): void {
    const arr = Array.isArray(value) ? value : [];
    this.items.value = arr.map((v, i) => buildNode(v, joinPath(this.path, i)));
  }
  resetToInitial(): void {
    this.set(clone(this.initial));
  }
  captureInitial(): void {
    this.initial = clone(this.peek());
  }
  dirty(): boolean {
    return !deepEqual(this.peek(), this.initial);
  }
}

function buildNode(value: unknown, path: string): ModelNode {
  if (Array.isArray(value)) return new ArrayNode(value, path);
  if (isPlainObject(value)) return new GroupNode(value, path);
  return new LeafNode(value, path);
}

// ============================================================================
// Proxy: value-доступ
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

function childValue(node: ModelNode | undefined): unknown {
  if (!node) return undefined;
  if (node.kind === 'leaf') return node.read();
  if (node.kind === 'group') return groupValueProxy(node);
  return arrayValueProxy(node);
}

function groupValueProxy(group: GroupNode): any {
  return new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === '__path') return group.path;
        return typeof key === 'string' ? childValue(group.children.get(key)) : undefined;
      },
      set: (_t, key, val) => {
        if (typeof key !== 'string') return false;
        const child = group.children.get(key);
        if (child) child.set(val);
        return true;
      },
      has: (_t, key) => typeof key === 'string' && group.children.has(key),
      ownKeys: () => [...group.children.keys()],
      getOwnPropertyDescriptor: (_t, key) =>
        typeof key === 'string' && group.children.has(key)
          ? { enumerable: true, configurable: true }
          : undefined,
    }
  );
}

function itemFacade(node: ModelNode | undefined): unknown {
  if (!node) return undefined;
  if (node.kind === 'group') return makeFormModel(node);
  if (node.kind === 'array') return arrayValueProxy(node);
  return node.read();
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
    at: (i: number) => itemFacade(arr.items.value[i]),
    map: (fn: (item: unknown, i: number) => unknown) =>
      arr.items.value.map((n, i) => fn(itemFacade(n), i)),
    forEach: (fn: (item: unknown, i: number) => void) =>
      arr.items.value.forEach((n, i) => fn(itemFacade(n), i)),
    toArray: () => arr.peek(),
    [Symbol.iterator]: function* () {
      const list = arr.items.value;
      for (let i = 0; i < list.length; i++) yield childValue(list[i]);
    },
  };
  return new Proxy(api, {
    get: (target, key, recv) => {
      if (key === '__path') return arr.path;
      if (typeof key === 'string' && isIndexKey(key))
        return childValue(arr.items.value[Number(key)]);
      return Reflect.get(target, key, recv);
    },
    has: (target, key) => {
      if (typeof key === 'string' && isIndexKey(key)) return Number(key) < arr.items.value.length;
      return Reflect.has(target, key);
    },
  });
}

// ============================================================================
// Proxy: сигналы ($)
// ============================================================================

function signalsProxy(node: ModelNode): any {
  if (node.kind === 'leaf') return node.signal;
  if (node.kind === 'group') {
    return new Proxy(
      {},
      {
        get: (_t, key) => {
          if (key === '__path') return node.path;
          if (typeof key !== 'string') return undefined;
          const child = node.children.get(key);
          return child ? signalsProxy(child) : undefined;
        },
        has: (_t, key) => typeof key === 'string' && node.children.has(key),
        ownKeys: () => [...node.children.keys()],
        getOwnPropertyDescriptor: (_t, key) =>
          typeof key === 'string' && node.children.has(key)
            ? { enumerable: true, configurable: true }
            : undefined,
      }
    );
  }
  const arr = node;
  return new Proxy(
    {
      get length(): number {
        return arr.items.value.length;
      },
    },
    {
      get: (target, key, recv) => {
        if (key === '__path') return arr.path;
        if (typeof key === 'string' && isIndexKey(key)) {
          const item = arr.items.value[Number(key)];
          return item ? signalsProxy(item) : undefined;
        }
        return Reflect.get(target, key, recv);
      },
    }
  );
}

// ============================================================================
// signalAt: путь → сигнал
// ============================================================================

function resolveSignalAt(root: GroupNode, path: string): PathAwareSignal<unknown> | undefined {
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

function makeFormModel(group: GroupNode): any {
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
        if (typeof key !== 'string') return undefined;
        // Поле формы затеняет одноимённый метод API (редкий краевой случай).
        const child = group.children.get(key);
        if (child) return childValue(child);
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
  return proxy;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================================
// Публичная фабрика
// ============================================================================

/**
 * Создать реактивную модель данных формы (слой M1).
 *
 * @group Model
 * @param initial Начальные значения (объект). Определяют форму данных и initial-снимок.
 * @returns {@link FormModel} с value-доступом, `$`-сигналами и API (get/set/patch/isDirty/reset/signalAt).
 *
 * @example
 * ```typescript
 * const model = createModel<{ email: string; tags: string[] }>({ email: '', tags: [] });
 * model.email = 'a@b.c';
 * model.$.email.value;        // 'a@b.c' (сигнал)
 * model.tags.push('x');
 * model.get();                // { email: 'a@b.c', tags: ['x'] }
 * ```
 */
export function createModel<T extends object>(initial: T): FormModel<T> {
  const root = new GroupNode(initial as Record<string, unknown>, '');
  return makeFormModel(root) as FormModel<T>;
}
