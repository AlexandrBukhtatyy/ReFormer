/**
 * FormModel — реактивный proxy над JS-объектом (слой данных, M1).
 *
 * Внутреннее представление — дерево узлов ({@link LeafNode}/{@link GroupNode}/{@link ArrayNode}),
 * зеркалящее форму данных. Наружу отдаются два proxy: value-доступ (значения) и `$` (сигналы).
 *
 * @group Model
 * @module core/model/form-model
 */

import { batch, computed, signal, type ReadonlySignal, type Signal } from '@preact/signals-core';
import type { FormModel, PathAwareSignal } from './types';
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

// ============================================================================
// Proxy: value-доступ
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

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
function signalsProxy(node: ModelNode): any {
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

// Обратный поиск: фасад FormModel → корневой GroupNode. Нужен для обхода листьев модели
// (`eachLeafSignal`) без публичного доступа к внутреннему дереву.
const rootByFacade = new WeakMap<object, GroupNode>();

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

// ============================================================================
// Обход листьев модели
// ============================================================================

function walkLeaves(node: ModelNode, visit: (signal: PathAwareSignal<unknown>) => void): void {
  if (node.kind === 'leaf') {
    visit(node.signal);
    return;
  }
  if (node.kind === 'group') {
    for (const child of node.children.values()) walkLeaves(child, visit);
    return;
  }
  // array: читаем `items.value` (а не `.peek()`) — внутри effect это подписка на СОСТАВ массива,
  // поэтому добавление/удаление элемента ретригерит обходчика (напр. реактивную стратегию валидации).
  for (const item of node.items.value) walkLeaves(item, visit);
}

/**
 * Обойти ВСЕ листовые сигналы модели (включая элементы массивов), вызвав `visit` на каждом.
 *
 * Внутри реактивного `effect` служит подпиской «любое поле изменилось»: `visit(sig => void sig.value)`
 * подписывает на значения листьев, а обход массивов через `items.value` — на их состав. Так строятся
 * триггеры `change`/`blur` стратегий валидации (см. `createFormValidation`), тем же паттерном, что
 * `revalidateWhen`, но без ручного перечисления зависимостей.
 *
 * @group Model
 */
export function eachLeafSignal<T>(
  model: FormModel<T>,
  visit: (signal: PathAwareSignal<unknown>) => void
): void {
  const root = rootByFacade.get(model as unknown as object);
  if (root) walkLeaves(root, visit);
}

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
 * const model = createModel<{ email: string; profile: { name: string }; tags: string[] }>({
 *   email: '',
 *   profile: { name: '' },
 *   tags: [],
 * });
 * model.email = 'a@b.c';
 * model.$.email.value;          // 'a@b.c' (сигнал)
 * // вложенная объект-группа — под-модель FormModel (value-доступ + `.$` + API):
 * model.profile.name = 'Ada';   // value-запись
 * model.$.profile.name.value;   // 'Ada' (сигнал; ≡ model.profile.$.name у под-модели)
 * model.profile.get();          // { name: 'Ada' }
 * model.tags.push('x');
 * model.get();                  // { email: 'a@b.c', profile: { name: 'Ada' }, tags: ['x'] }
 * ```
 */
export function createModel<T extends object>(initial: T): FormModel<T> {
  const root = new GroupNode(initial as Record<string, unknown>, '');
  return makeFormModel(root) as FormModel<T>;
}
