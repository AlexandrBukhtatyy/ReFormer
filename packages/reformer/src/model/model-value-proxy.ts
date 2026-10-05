/**
 * Value-фасад модели: `model.email`, `model.profile.name`, `model.tags.at(0)`.
 *
 * Объектная группа промоутится в под-модель {@link makeFormModel} (value-доступ + `.$` + API),
 * массив — в прокси с мутациями и обходом, лист — в реактивное чтение значения. Идентичность
 * фасадов стабильна (`facadeCache`), поэтому `model.profile.$.name === model.$.profile.name`
 * и `arr[i] === arr.at(i)` — на это опираются per-item формы и ключи в рендере.
 *
 * @group Model
 * @module model/model-value-proxy
 */

import { Signal } from '@preact/signals-core';
import { type ModelNode, GroupNode, ArrayNode, blankFrom, isIndexKey } from './model-nodes';
import {
  signalsProxy,
  resolveSignalAt,
  containerNodeOf,
  isModelArraySignal,
  isModelContainerSignal,
} from './model-signals-proxy';
import type { FormModel, ModelArray } from './types';

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

// Кэш фасадов массивов → стабильная идентичность (`model.items === model.items`). На неё опираются
// узел массива формы (ключ эффекта синхронизации), рендерер (зависимость хуков) и привязка по
// идентичности — без кэша каждое обращение к массиву отдавало бы новый прокси.
const arrayFacadeCache = new WeakMap<ArrayNode, any>();

// Обратный поиск: фасад массива → узел модели. По нему фасад находит свою ручку `$` (`signalsOf`).
const arrayByFacade = new WeakMap<object, ArrayNode>();

function arrayValueProxy(arr: ArrayNode): any {
  const cached = arrayFacadeCache.get(arr);
  if (cached) return cached;
  const api = {
    get length(): number {
      return arr.items.value.length;
    },
    push: (v?: unknown) => arr.push(v),
    insertAt: (i: number, v?: unknown) => arr.insertAt(i, v),
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
  const proxy = new Proxy(api, {
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
  arrayFacadeCache.set(arr, proxy);
  arrayByFacade.set(proxy, arr);
  return proxy;
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

// ============================================================================
// Ручка `$` ↔ value-фасад
// ============================================================================

/**
 * Value-фасад для ручки {@link modelOf}: массив → {@link ModelArray}, объект → под-модель
 * {@link FormModel}.
 *
 * @group Model
 */
export type ModelOf<V> =
  NonNullable<V> extends ReadonlyArray<infer U> ? ModelArray<U> : FormModel<NonNullable<V>>;

/**
 * Value-фасад по ручке дерева `model.$`: группа → под-модель {@link FormModel}, массив →
 * {@link ModelArray}. Обратная операция к `model.$`: `modelOf(model.$.address) === model.address`.
 *
 * Ручка находит фасад по ИДЕНТИЧНОСТИ, а не по пути. Путь для этого не годится: он абсолютный
 * (`items.0.phones`) и меняется при перестановке строк, а области поведения и формы строк
 * вложенные — поиск по пути от под-модели строки ничего не находит.
 *
 * Лист ручкой контейнера не является — функция бросает. В частности, группа или массив,
 * созданные из начального `null`, в модели — лист: вид узла фиксируется при создании.
 *
 * @typeParam V - Значение, которое хранит ручка (выводится из `peek()`).
 * @param handle - Узел-группа или узел-массив дерева `model.$`.
 * @returns Под-модель группы либо фасад массива.
 * @throws TypeError если `handle` — лист или не ручка модели.
 *
 * @example
 * ```typescript
 * const model = createModel({ address: { city: '' }, phones: [{ number: '' }] });
 *
 * modelOf(model.$.address).city = 'Казань'; // под-модель: чтение, запись, get/set/patch
 * modelOf(model.$.phones).push({ number: '+7' }); // фасад массива: мутации и обход
 * modelOf(model.$.phones[0]).number; // строка массива — тоже группа
 * ```
 *
 * @group Model
 */
export function modelOf<V extends object | null | undefined>(handle: { peek(): V }): ModelOf<V> {
  const node = containerNodeOf(handle);
  if (!node) {
    const path = (handle as { __path?: unknown } | null)?.__path;
    const at = typeof path === 'string' && path !== '' ? ` «${path}»` : '';
    throw new TypeError(
      handle instanceof Signal
        ? `[@reformer/core] modelOf: ручка${at} — лист, у него нет под-модели. Группа или массив, ` +
            'созданные из начального null, в модели тоже лист: задайте начальное значение ' +
            'объектом или массивом.'
        : '[@reformer/core] modelOf: ожидалась ручка группы или массива из дерева model.$ ' +
            '(например, model.$.address или model.$.items).'
    );
  }
  return (node.kind === 'group' ? makeFormModel(node) : arrayValueProxy(node)) as ModelOf<V>;
}

/**
 * Ручка `$` по value-фасаду: под-модель → её `model.$`, фасад массива → узел-массив дерева `$`.
 * Для всего остального — `undefined`.
 *
 * @internal
 */
export function signalsOf(facade: unknown): object | undefined {
  if (facade == null || typeof facade !== 'object') return undefined;
  const array = arrayByFacade.get(facade);
  if (array) return signalsProxy(array);
  const group = rootByFacade.get(facade);
  return group ? signalsProxy(group) : undefined;
}

/**
 * Ручка массива по привязке: сама ручка `model.$.<массив>` либо value-фасад `model.<массив>`.
 * Для всего остального — `undefined`.
 *
 * @internal
 */
export function arrayHandleOf(binding: unknown): object | undefined {
  if (isModelArraySignal(binding)) return binding as object;
  const handle = signalsOf(binding);
  return isModelArraySignal(handle) ? handle : undefined;
}

/**
 * Ручка группы по привязке: `model.$.<группа>` либо под-модель `model.<группа>`. Для всего
 * остального — `undefined`.
 *
 * @internal
 */
export function groupHandleOf(binding: unknown): object | undefined {
  const handle = isModelContainerSignal(binding) ? (binding as object) : signalsOf(binding);
  return handle !== undefined && !isModelArraySignal(handle) ? handle : undefined;
}

/**
 * Запасной шаблон нового элемента массива — `initialValue` узла-массива схемы. Действует, только
 * если модель своего шаблона не объявила (`arrayOf`): так живут формы, чья модель строится из
 * данных без кода.
 *
 * @internal
 */
export function provideArrayBlank(handle: unknown, initialValue: unknown): void {
  const node = containerNodeOf(handle);
  if (node?.kind === 'array') node.provideBlank(blankFrom(initialValue));
}

/**
 * Value-фасад модели (под-модель или фасад массива), а не обычный объект?
 *
 * Обходчикам чужих деревьев (схема формы) в фасад спускаться нельзя: чтение его ключей — это
 * реактивное чтение значений модели.
 *
 * @internal
 */
export function isModelFacade(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  return arrayByFacade.has(value) || rootByFacade.has(value);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
