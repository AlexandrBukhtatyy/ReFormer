/**
 * Внутреннее дерево узлов модели: значения, начальный снимок, dirty/reset.
 *
 * `ModelLeafNode`/`ModelGroupNode`/`ModelArrayNode` держат ТОЛЬКО значение (сигнал `@preact/signals-core` плюс
 * снимок `initial`). Это НЕ узлы формы: тёзки из `form/nodes/` несут touched/dirty/status/issues
 * и строятся поверх этих сигналов. Наружу дерево не отдаётся — доступ идёт через прокси
 * (`model-value-proxy` — значения, `model-signals-proxy` — `$`-сигналы).
 *
 * @group Model
 * @module model/model-nodes
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
  // Дата — изменяемый объект: снимок с общей ссылкой портился бы правкой на месте (`setFullYear`).
  if (v instanceof Date) return new Date(v.getTime()) as unknown as T;
  if (Array.isArray(v)) return v.map(clone) as unknown as T;
  if (isPlainObject(v)) {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v)) o[k] = clone((v as Record<string, unknown>)[k]);
    return o as T;
  }
  return v;
};

/**
 * Глубокое сравнение значений модели: объекты и массивы — по содержимому, даты — по времени,
 * остальное (включая файлы) — по ссылке.
 *
 * @internal
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  // NaN не равен самому себе: без этой ветки число-NaN считалось бы изменённым всегда.
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (a instanceof Date && b instanceof Date) return Object.is(a.getTime(), b.getTime());
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
// Шаблон нового элемента массива
// ============================================================================

/** Фабрика нового элемента массива. */
type Blank = () => unknown;

// Шаблон едет на самом массиве начальных значений под символом: массив остаётся обычным `U[]`
// (тип данных формы не меняется), а в `Object.keys`/JSON/`clone` метка не попадает.
const BLANK = Symbol.for('@reformer/core:arrayBlank');

const blankOf = (value: unknown): Blank | undefined =>
  Array.isArray(value) ? (value as { [BLANK]?: Blank })[BLANK] : undefined;

/**
 * Образец того же места модели внутри шаблона родительского массива. Ленивый: шаблон родителя
 * ради него вызывается, только когда образец действительно понадобился.
 */
type Shape = () => unknown;

const fieldOf = (shape: unknown, key: string): unknown =>
  isPlainObject(shape) ? shape[key] : undefined;

/**
 * Частичное значение элемента поверх шаблона: ключи значения главнее, недостающие (и `undefined`)
 * берутся из шаблона, вложенные группы сливаются так же, массивы и листья значения заменяют
 * шаблонные целиком — как `patch` модели. Не объект — значение как есть.
 */
function fillFromBlank(base: unknown, value: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(value)) return value;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, part] of Object.entries(value)) {
    merged[key] = part === undefined ? base[key] : fillFromBlank(base[key], part);
  }
  return merged;
}

/**
 * Массив модели с шаблоном нового элемента.
 *
 * Шаблон — фабрика значения, которое получает `push()` / `insertAt(i)` без аргумента: кнопка
 * «Добавить» секции массива, `model.items.push()` в поведении. Частичное значение
 * (`push({ type: 'house' })`) дополняется из шаблона. Объявляется там же, где остальные
 * начальные значения, — в модели; схеме и JSX знать его не нужно.
 *
 * Возвращает обычный массив: тип поля остаётся `U[]`. Шаблон переживает `set` / `patch` / `reset`
 * модели. Вложенные массивы объявляются внутри шаблона элемента — тогда и элементы, пришедшие
 * обычными данными (загрузка с сервера), получают их шаблоны.
 *
 * Шаблон привязан к самому массиву, поэтому до `createModel` его нельзя копировать:
 * `structuredClone`, `JSON.parse(JSON.stringify(…))` и `[...array]` отдают массив без шаблона, и
 * `push()` без значения бросит ошибку. Начальные значения с `arrayOf` держат в фабрике
 * (`const initial = () => ({ items: arrayOf(blank) })`), а не в константе, которую клонируют.
 *
 * @typeParam U - Тип элемента массива.
 * @param blank - Фабрика нового элемента. Вызывается на каждое добавление — значение не делится
 *   между элементами.
 * @param items - Начальные элементы. По умолчанию массив пуст.
 * @returns Массив начальных значений с шаблоном.
 *
 * @example
 * ```typescript
 * const blankPhone = () => ({ number: '' });
 * const blankCoBorrower = () => ({ name: '', phones: arrayOf(blankPhone) });
 *
 * const model = createModel({ coBorrowers: arrayOf(blankCoBorrower) });
 *
 * model.coBorrowers.push(); // { name: '', phones: [] }
 * model.coBorrowers.at(0).phones.push(); // { number: '' }
 * model.coBorrowers.push({ name: 'Анна' }); // { name: 'Анна', phones: [] } — остальное из шаблона
 * ```
 *
 * @group Model
 */
export function arrayOf<U>(blank: () => U, items: readonly U[] = []): U[] {
  const array = [...items];
  Object.defineProperty(array, BLANK, { value: blank });
  return array;
}

// ============================================================================
// Внутренние узлы модели
// ============================================================================

export type ModelNode = ModelLeafNode | ModelGroupNode | ModelArrayNode;

class ModelLeafNode {
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
  /**
   * Вернуть значение к снимку. Производное поле (цель `compute`, поле сервера с `markDerived`)
   * сброс не пишет — как `set` и `patch`: значением владеет поведение, а снимок такого поля снят
   * до первого расчёта, и `compute` пересчитал бы его только при смене источников.
   */
  resetToInitial(): void {
    if (isDerived(this.signal)) return;
    this.signal.value = clone(this.initial);
  }
  captureInitial(): void {
    this.initial = clone(this.signal.peek());
  }
  dirty(): boolean {
    return this.differsFrom(this.initial);
  }
  /**
   * Отличается ли значение от снимка. Производное поле отличием не считается: его пишет поведение,
   * а не пользователь — иначе форма без единой правки была бы «изменённой».
   */
  differsFrom(snapshot: unknown): boolean {
    return !isDerived(this.signal) && !deepEqual(this.signal.peek(), snapshot);
  }
}

export class ModelGroupNode {
  readonly kind = 'group' as const;
  readonly children = new Map<string, ModelNode>();

  /**
   * @param shape Образец той же группы из шаблона родительского массива: из него вложенные
   *   массивы берут шаблоны, если значение пришло обычными данными (см. {@link ModelArrayNode}).
   */
  constructor(
    initial: Record<string, unknown>,
    public path: string,
    shape?: Shape
  ) {
    for (const key of Object.keys(initial)) {
      const childShape = shape && (() => fieldOf(shape(), key));
      this.children.set(key, buildNode(initial[key], joinPath(path, key), childShape));
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
  /**
   * Полная установка: значение ожидается целиком. Ключи, которых в нём нет, остаются прежними —
   * как у {@link patch}, — но в dev о них сообщает предупреждение: неполный объект в `set` — почти
   * всегда ошибка вызывающего кода, а не намерение.
   */
  set(value: unknown): void {
    const missing: string[] = [];
    this.write(value, missing);
    if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
      const at = this.path === '' ? 'model' : `model.${this.path}`;
      const what =
        value == null || typeof value !== 'object'
          ? 'значение не объект — группа осталась прежней'
          : `в значении нет ключей ${missing.map((key) => `«${key}»`).join(', ')} — ` +
            'эти поля остались прежними';
      console.warn(
        `[@reformer/core] ${at}.set(...): ${what}. \`set\` ожидает объект целиком; для ` +
          'частичного обновления есть `patch`.'
      );
    }
  }

  /**
   * Частичное обновление: записываются только переданные ключи. Вложенная группа сливается так
   * же, массив заменяется целиком.
   */
  patch(value: unknown): void {
    this.write(value, undefined);
  }

  /**
   * Запись значения по ключам группы. Лишние ключи значения игнорируются, производные поля не
   * затираются.
   *
   * @param missing - Куда складывать пути ключей, для которых значение не пришло. Передаётся при
   *   полной установке ({@link set}); при частичной ({@link patch}) — `undefined`.
   */
  private write(value: unknown, missing: string[] | undefined): void {
    if (value == null || typeof value !== 'object') {
      // Группа без объекта-значения не записана вовсе — для полной установки это недостающий ключ.
      missing?.push(this.path);
      return;
    }
    const v = value as Record<string, unknown>;
    // batch: иначе подписчик агрегата группы (`model.$.<group>`) получит по уведомлению на каждое поле.
    batch(() => {
      for (const [key, node] of this.children) {
        // Производные поля (цели compute) не затираем значением из payload — ими владеет compute.
        if (node.kind === 'leaf' && isDerived(node.signal)) continue;
        if (!(key in v)) {
          missing?.push(joinPath(this.path, key));
          continue;
        }
        if (node.kind === 'group') node.write(v[key], missing);
        else node.set(v[key]);
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
  /** Отличается ли группа от снимка её значения (строка массива сверяется со снимком массива). */
  differsFrom(snapshot: unknown): boolean {
    if (!isPlainObject(snapshot)) return true;
    for (const [key, node] of this.children) if (node.differsFrom(snapshot[key])) return true;
    return false;
  }
}

export class ModelArrayNode {
  readonly kind = 'array' as const;
  readonly items: Signal<ModelNode[]>;
  private initial: unknown[];
  // Шаблон нового элемента (`arrayOf`). Принадлежит узлу, а не значению: `set`/`reset` заменяют
  // элементы, узел остаётся — и шаблон с ним.
  private blank: Blank | undefined;
  // Запасной шаблон — `initialValue` узла-массива схемы.
  private fallback: Blank | undefined;
  // Образец элемента — один вызов шаблона. Нужен только ради вложенных шаблонов: элемент из
  // обычных данных (`set` с сервера, `push(значение)`) метку `arrayOf` на своих массивах не несёт.
  private sample: { readonly value: unknown } | undefined;

  /** @param shape Образец того же массива из шаблона родителя (см. {@link ModelGroupNode}). */
  constructor(
    initial: unknown[],
    public path: string,
    private readonly shape?: Shape
  ) {
    this.blank = blankOf(initial);
    this.items = signal(initial.map((v, i) => this.build(v, i)));
    this.initial = clone(initial);
  }

  /** Шаблон по старшинству: свой (`arrayOf`) → из шаблона родителя → из схемы. */
  private template(): Blank | undefined {
    this.blank ??= blankOf(this.shape?.());
    return this.blank ?? this.fallback;
  }

  // Образец читается лениво — лишний вызов шаблона случается, только когда вложенному массиву
  // элемента из обычных данных понадобился свой шаблон.
  private readonly itemShape: Shape = () => {
    if (!this.sample) {
      const blank = this.template();
      if (!blank) return undefined;
      this.sample = { value: blank() };
    }
    return this.sample.value;
  };

  private build(value: unknown, index: number): ModelNode {
    return buildNode(value, joinPath(this.path, index), this.itemShape);
  }

  /**
   * Значение нового элемента: из шаблона; переданный объект накладывается поверх шаблона —
   * недостающие ключи берутся из шаблона, поэтому `push({ type: 'house' })` даёт полный элемент.
   */
  private fresh(value: unknown): unknown {
    const blank = this.template();
    if (value !== undefined) return blank ? fillFromBlank(blank(), value) : value;
    if (!blank) {
      throw new Error(
        `[@reformer/core] ${this.path || 'массив'}: добавление элемента без значения, а шаблона ` +
          'у массива нет. Объявите его в модели — `arrayOf(() => ({ … }))` — либо передайте ' +
          'значение: `push(значение)`.'
      );
    }
    return blank();
  }

  /** Шаблон из схемы (`initialValue` узла-массива) — запасной: шаблон модели главнее. */
  provideBlank(blank: Blank): void {
    this.fallback ??= blank;
  }

  rebase(path: string): void {
    this.path = path;
    this.items.peek().forEach((node, i) => node.rebase(joinPath(path, i)));
  }

  private reindex(): void {
    this.items.peek().forEach((node, i) => node.rebase(joinPath(this.path, i)));
  }

  push(value?: unknown): void {
    const arr = this.items.peek();
    this.items.value = [...arr, this.build(this.fresh(value), arr.length)];
  }
  insertAt(index: number, value?: unknown): void {
    if (!Number.isInteger(index) || index < 0) return;
    const arr = [...this.items.peek()];
    arr.splice(index, 0, this.build(this.fresh(value), index));
    this.items.value = arr;
    this.reindex();
  }
  removeAt(index: number): void {
    const arr = [...this.items.peek()];
    // `removeAt(list.findIndex(…))` без находки не должен удалять последний элемент.
    if (!Number.isInteger(index) || index < 0 || index >= arr.length) return;
    arr.splice(index, 1);
    this.items.value = arr;
    this.reindex();
  }
  move(from: number, to: number): void {
    const arr = [...this.items.peek()];
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0) return;
    if (from >= arr.length || from === to) return;
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
    this.items.value = arr.map((v, i) => this.build(v, i));
  }
  resetToInitial(): void {
    this.set(clone(this.initial));
  }
  captureInitial(): void {
    this.initial = clone(this.peek());
  }
  dirty(): boolean {
    return this.differsFrom(this.initial);
  }
  /**
   * Отличается ли массив от снимка: другая длина либо отличается элемент. Сверка идёт по узлам, а
   * не по значению целиком — производные поля строк (цели `compute` поведения строки) не в счёт.
   */
  differsFrom(snapshot: unknown): boolean {
    const items = this.items.peek();
    if (!Array.isArray(snapshot) || snapshot.length !== items.length) return true;
    return items.some((node, index) => node.differsFrom(snapshot[index]));
  }
}

function buildNode(value: unknown, path: string, shape?: Shape): ModelNode {
  if (Array.isArray(value)) return new ModelArrayNode(value, path, shape);
  if (isPlainObject(value)) return new ModelGroupNode(value, path, shape);
  return new ModelLeafNode(value, path);
}

/** Значение `initialValue` узла-массива схемы как шаблон: фабрика — как есть, значение — копией. */
export const blankFrom = (initialValue: unknown): Blank =>
  typeof initialValue === 'function' ? (initialValue as Blank) : () => clone(initialValue);
