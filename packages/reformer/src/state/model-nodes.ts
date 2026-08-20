/**
 * Внутреннее дерево узлов модели: значения, начальный снимок, dirty/reset.
 *
 * `LeafNode`/`GroupNode`/`ArrayNode` держат ТОЛЬКО значение (сигнал `@preact/signals-core` плюс
 * снимок `initial`). Это НЕ узлы формы: тёзки из `form/nodes/` несут touched/dirty/status/errors
 * и строятся поверх этих сигналов. Наружу дерево не отдаётся — доступ идёт через прокси
 * (`model-value-proxy` — значения, `model-signals-proxy` — `$`-сигналы).
 *
 * @group State
 * @module state/model-nodes
 */

import { batch, signal, type Signal } from '@preact/signals-core';
import type { PathAwareSignal } from './types';
import { isDerived } from './derived-registry';

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

export const isIndexKey = (key: string): boolean => /^\d+$/.test(key);

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

export type ModelNode = LeafNode | GroupNode | ArrayNode;

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

export class GroupNode {
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

  /** Реактивное чтение поддерева (внутри effect/computed подписывает на все листья группы). */
  read(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of this.children) out[key] = node.read();
    return out;
  }
  peek(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of this.children) out[key] = node.peek();
    return out;
  }
  set(value: unknown): void {
    if (value == null || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    // batch: иначе подписчик агрегата группы (`model.$.<group>`) получит по уведомлению на каждое поле.
    batch(() => {
      for (const [key, node] of this.children) {
        if (!(key in v)) continue;
        // F9: производные поля (цели compute) не затираем значением из payload — ими владеет compute.
        if (node.kind === 'leaf' && isDerived(node.signal)) continue;
        node.set(v[key]);
      }
    });
  }
  resetToInitial(): void {
    batch(() => {
      for (const node of this.children.values()) node.resetToInitial();
    });
  }
  captureInitial(): void {
    for (const node of this.children.values()) node.captureInitial();
  }
  dirty(): boolean {
    for (const node of this.children.values()) if (node.dirty()) return true;
    return false;
  }
}

export class ArrayNode {
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

  /**
   * Реактивное чтение массива. Читаем `items.value` (а не `.peek()`) — внутри effect/computed это
   * подписка на СОСТАВ массива, поэтому push/removeAt/move ретригерят наравне с правкой элемента.
   */
  read(): unknown[] {
    return this.items.value.map((node) => node.read());
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
