/**
 * Чтение и правка живой модели формы по `$model`-пути.
 *
 * ## Одна цепочка на чтение и на запись
 *
 * ```text
 * $model-путь → model.signalAt(path) → getNodeForSignal(sig) → FieldNode
 * ```
 *
 * Оба звена — публичный API `@reformer/core`. Пишет панель ТЕМ ЖЕ вызовом, каким пишет контрол:
 * рендерер зовёт `fieldNode.setValue(v)` на изменение и `fieldNode.markAsTouched()` на blur
 * (`renderer-react/src/core/render-node.tsx`). Поэтому «вторая точка ввода разойдётся с формой»
 * здесь не наступает — точка одна, и `compute`, `copyFrom`, `onChange`, `enableWhen`, `resetWhen`
 * отрабатывают сами: они подписаны на сигнал, а не на событие интерфейса.
 *
 * ## Писать через УЗЛЫ, а не через `model.set`
 *
 * `ModelApi.set` в ядре — побайтовый алиас `patch` вопреки собственному JSDoc (открытый дефект
 * ReFormer-kci). Панель, писавшая бы через него, унаследовала бы этот разрыв между обещанием
 * и поведением; узел таких сюрпризов не содержит. Отсюда же массовая вставка: по узлам поштучно,
 * а не одним вызовом.
 *
 * ## Производные пути не редактируются
 *
 * Целями `compute` владеет само поведение: групповая запись сверяется с derived-guard и записанное
 * ИГНОРИРУЕТ. Панель обязана знать это заранее ({@link readNodeState}) — иначе человек пишет,
 * значение возвращается, и он идёт искать несуществующий баг.
 *
 * @module lib/form-inspect/index
 */

import { getNodeForSignal, isDerived } from '@reformer/core';

/** Значения модели. Приходят из схемы, и сузить их нечем. */
type Shape = Record<string, unknown>;

/** Что панель умеет показать про один путь. */
export type RowKind = 'leaf' | 'group' | 'array';

/** Одна строка дерева значений. */
export interface ModelRow {
  /** `$model`-путь: то же, чем адресует схема. */
  readonly path: string;
  readonly value: unknown;
  readonly kind: RowKind;
  /** Глубина вложенности — для отступа. */
  readonly depth: number;
}

function isPlainObject(value: unknown): value is Shape {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Плоский список путей модели в порядке обхода.
 *
 * Массивы НЕ раскрываются поэлементно: элементы адресуются `items[0].name`, а панель работает
 * с `$model`-путями схемы, где такого пути нет. Массив показывается одной строкой и правится
 * целиком — этого хватает, чтобы добавить и убрать элементы.
 */
export function collectRows(model: unknown, prefix = '', depth = 0): ModelRow[] {
  if (!isPlainObject(model)) return [];
  const out: ModelRow[] = [];
  for (const [key, value] of Object.entries(model)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (Array.isArray(value)) {
      out.push({ path, value, kind: 'array', depth });
      continue;
    }
    if (isPlainObject(value)) {
      out.push({ path, value, kind: 'group', depth });
      out.push(...collectRows(value, path, depth + 1));
      continue;
    }
    out.push({ path, value, kind: 'leaf', depth });
  }
  return out;
}

/** Что известно про узел пути. */
export interface NodeState {
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly errors: readonly string[];
  /** Цель `compute`: запись игнорируется поведением, и панель обязана сказать это заранее. */
  readonly derived: boolean;
  /**
   * Когда контрол на самом деле пишет в модель.
   *
   * `blur`/`submit` означают, что правка из панели равна «ввёл и ушёл с поля», а не «печатает
   * прямо сейчас»: контрол при такой настройке держит значение у себя и пишет позже.
   *
   * Умолчание ядра — `blur`, то есть это касается ВСЕХ полей, а не редких. Поведение
   * предсказуемое, но панель обязана его показать: человек, правящий значение, видит форму
   * такой, какой она станет после ухода с поля.
   */
  readonly updateOn: 'change' | 'blur' | 'submit';
}

/** Узел формы в объёме, которым пользуется панель. Структурная копия `FormNode`. */
interface FieldNodeLike {
  getValue?(): unknown;
  setValue?(value: unknown, options?: { emitEvent?: boolean }): void;
  markAsTouched?(): void;
  resetToInitial?(): void;
  disable?(): void;
  enable?(): void;
  setErrors?(errors: readonly { code?: string; message?: string }[]): void;
  getUpdateOn?(): 'change' | 'blur' | 'submit';
  touched?: { readonly value: boolean };
  dirty?: { readonly value: boolean };
  disabled?: { readonly value: boolean };
  errors?: { readonly value: readonly { message?: string; code?: string }[] };
}

/** Модель в объёме, которым пользуется панель. */
interface ModelLike {
  signalAt?(path: string): unknown;
  get?(): unknown;
}

/** Сигнал пути либо `undefined`. Отдельно, потому что нужен и чтению, и записи. */
function signalAt(model: unknown, path: string): unknown {
  const api = model as ModelLike | null;
  return typeof api?.signalAt === 'function' ? api.signalAt(path) : undefined;
}

/** Узел пути либо `null`. `null` — путь есть в значениях, но формой не представлен. */
export function nodeAt(model: unknown, path: string): unknown {
  const signal = signalAt(model, path);
  if (signal === undefined || signal === null) return null;
  return getNodeForSignal(signal as never) ?? null;
}

/** Значение по пути прямо из сигнала: снимок модели может отставать от только что записанного. */
export function valueAt(model: unknown, path: string): unknown {
  const signal = signalAt(model, path) as { value?: unknown } | undefined;
  return signal?.value;
}

/**
 * Состояние узла пути. `null` — узла нет (чистый контейнер, путь вне формы).
 */
export function readNodeState(model: unknown, path: string): NodeState | null {
  const node = nodeAt(model, path) as FieldNodeLike | null;
  if (node === null) return null;
  const signal = signalAt(model, path);
  return {
    touched: node.touched?.value === true,
    dirty: node.dirty?.value === true,
    disabled: node.disabled?.value === true,
    errors: (node.errors?.value ?? []).map((error) => error.message ?? error.code ?? 'ошибка'),
    derived: signal === undefined ? false : isDerived(signal as never),
    updateOn: node.getUpdateOn?.() ?? 'change',
  };
}

/** Как писать значение. */
export interface WriteOptions {
  /**
   * Сырая запись: значение ложится в модель, событие изменения не идёт, `touched` не поднимается.
   *
   * Ради этого режима правка модели и заводится: подать форме то, чего интерфейс не производит —
   * `null` в обязательном, число вне `min`, значение вне списка опций. Так выглядят данные,
   * пришедшие с бэкенда или из формы прежней версии схемы.
   */
  readonly raw?: boolean;
}

/** Почему запись не прошла. */
export type WriteFailure = 'no-node' | 'derived' | 'read-only';

/**
 * Пишет значение по пути тем же вызовом, каким пишет контрол.
 *
 * @returns `null` при успехе либо причину отказа.
 */
export function writeValue(
  model: unknown,
  path: string,
  value: unknown,
  options: WriteOptions = {}
): WriteFailure | null {
  const state = readNodeState(model, path);
  if (state === null) return 'no-node';
  // Отказ ДО записи: поведение всё равно вернёт своё значение, но человек узнает почему.
  if (state.derived) return 'derived';

  const node = nodeAt(model, path) as FieldNodeLike | null;
  if (typeof node?.setValue !== 'function') return 'read-only';

  node.setValue(value, options.raw === true ? { emitEvent: false } : undefined);
  // Как ввод человеком: контрол на blur зовёт ровно это.
  if (options.raw !== true) node.markAsTouched?.();
  return null;
}

/** Операции над узлом сверх записи значения — по одному вызову каждая. */
export function resetNode(model: unknown, path: string): boolean {
  const node = nodeAt(model, path) as FieldNodeLike | null;
  if (typeof node?.resetToInitial !== 'function') return false;
  node.resetToInitial();
  return true;
}

export function setNodeDisabled(model: unknown, path: string, disabled: boolean): boolean {
  const node = nodeAt(model, path) as FieldNodeLike | null;
  const method = disabled ? node?.disable : node?.enable;
  if (typeof method !== 'function') return false;
  method.call(node);
  return true;
}

/** Подставляет ошибку, как будто её вернул сервер. */
export function setNodeError(model: unknown, path: string, message: string): boolean {
  const node = nodeAt(model, path) as FieldNodeLike | null;
  if (typeof node?.setErrors !== 'function') return false;
  node.setErrors(message === '' ? [] : [{ code: 'fixture', message }]);
  return true;
}

/** Снимок модели целиком — для копирования в буфер и вставки в фикстуру. */
export function snapshot(model: unknown): unknown {
  const api = model as ModelLike | null;
  return typeof api?.get === 'function' ? api.get() : undefined;
}
