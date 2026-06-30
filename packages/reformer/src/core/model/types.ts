/**
 * Типы слоя данных FormModel (M1)
 *
 * FormModel — реактивный proxy над обычным JS-объектом: держит ТОЛЬКО значения
 * (как сигналы `@preact/signals-core`). Источник истины значения под архитектурой M1.
 *
 * - value-доступ: `model.field` читает/пишет значение «как у обычного объекта»;
 *   вложенные объекты → вложенный proxy, массивы → {@link ModelArray}.
 * - escape-hatch: `model.$.field` отдаёт сам {@link PathAwareSignal} (для привязки в схеме).
 *
 * @group Model
 * @module core/model/types
 */

import type { Signal } from '@preact/signals-core';

/**
 * Сигнал, который знает свой путь в модели (`'personalData.lastName'`).
 * Используется как «ручка поля»: и привязка value в схеме, и идентичность для testId/devtools.
 *
 * @group Model
 */
export type PathAwareSignal<T> = Signal<T> & {
  /** Путь поля в модели (dot-нотация). На элементах массива включает индекс. */
  readonly __path: string;
};

/**
 * Спец-объекты, которые трактуются как листья (не разворачиваются в под-модель).
 * @internal
 */
type Opaque = Date | File | Blob;

/**
 * Значение поля в value-доступе модели:
 * - массив → {@link ModelArray}
 * - спец-объект (Date/File/Blob) → как есть
 * - объект → вложенный value-proxy
 * - примитив → значение
 *
 * @group Model
 */
export type ModelValue<V> =
  NonNullable<V> extends ReadonlyArray<infer U>
    ? ModelArray<U>
    : NonNullable<V> extends Opaque
      ? V
      : NonNullable<V> extends object
        ? ModelObject<NonNullable<V>>
        : V;

/**
 * value-proxy объекта: поля доступны как обычные свойства (чтение реактивно
 * внутри `effect`/`computed`, запись — присваиванием).
 *
 * @group Model
 */
export type ModelObject<T> = {
  [K in keyof T]: ModelValue<T[K]>;
};

/**
 * Реактивный массив модели. Мутации (`push`/`removeAt`/…) меняют длину реактивно;
 * `map`/`forEach`/`at` отдают под-модель элемента ({@link FormModel}) для объектных элементов.
 *
 * @group Model
 */
export interface ModelArray<U> {
  /** Реактивная длина. */
  readonly length: number;
  /** Добавить элемент в конец (значение элемента целиком). */
  push(item: U): void;
  /** Вставить элемент по индексу. */
  insertAt(index: number, item: U): void;
  /** Удалить элемент по индексу. */
  removeAt(index: number): void;
  /** Переместить элемент. */
  move(from: number, to: number): void;
  /** Поменять местами два элемента. */
  swap(a: number, b: number): void;
  /** Очистить массив. */
  clear(): void;
  /** Под-модель элемента по индексу (для объектных элементов) или значение (для примитивных). */
  at(index: number): U extends object ? FormModel<U> : U | undefined;
  /** Map по элементам: объектные → {@link FormModel}, примитивные → значение. */
  map<R>(fn: (item: U extends object ? FormModel<U> : U, index: number) => R): R[];
  /** Итерация по элементам. */
  forEach(fn: (item: U extends object ? FormModel<U> : U, index: number) => void): void;
  /** Снимок массива значений (без подписки). */
  toArray(): U[];
  /** Индексный value-доступ. */
  [index: number]: ModelValue<U>;
}

/**
 * Дерево сигналов (escape-hatch `model.$`): листья → {@link PathAwareSignal},
 * объекты → вложенное дерево, массивы → индексируемое дерево под-сигналов.
 *
 * @group Model
 */
export type ModelSignals<T> = {
  [K in keyof T]: NonNullable<T[K]> extends ReadonlyArray<infer U>
    ? { readonly length: number; readonly [index: number]: ModelSignals<U & object> }
    : NonNullable<T[K]> extends Opaque
      ? PathAwareSignal<T[K]>
      : NonNullable<T[K]> extends object
        ? ModelSignals<NonNullable<T[K]>>
        : PathAwareSignal<T[K]>;
};

/**
 * API уровня модели (доступно на корне и под-моделях элементов массива).
 *
 * ⚠️ Имена методов (`$`/`get`/`set`/`patch`/`isDirty`/`reset`/`signalAt`/`captureInitial`)
 * зарезервированы: одноимённое поле формы их затеняет (редкий краевой случай).
 *
 * @group Model
 */
export interface ModelApi<T> {
  /** Escape-hatch к сигналам: `model.$.loanType` → `PathAwareSignal<LoanType>`. */
  readonly $: ModelSignals<T>;
  /** Снимок значений (без подписки) — для submit. */
  get(): T;
  /** Массовая замена значений (load с сервера). Не меняет initial-снимок. */
  set(value: Partial<T>): void;
  /** Частичное слияние значений. */
  patch(value: Partial<T>): void;
  /** Отличаются ли текущие значения от initial-снимка (value-diff). */
  isDirty(): boolean;
  /** Сбросить значения к initial-снимку. */
  reset(): void;
  /** Зафиксировать текущие значения как новый initial-снимок («точка отсчёта»). */
  captureInitial(): void;
  /** Резолв строкового пути в сигнал (для error-routing/мостов). */
  signalAt(path: string): PathAwareSignal<unknown> | undefined;
}

/**
 * FormModel — value-proxy объекта `T` + {@link ModelApi}.
 *
 * @group Model
 */
export type FormModel<T> = ModelObject<T> & ModelApi<T>;
