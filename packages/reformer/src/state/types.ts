/**
 * Типы слоя данных FormModel (M1)
 *
 * FormModel — реактивный proxy над обычным JS-объектом: держит ТОЛЬКО значения
 * (как сигналы `@preact/signals-core`). Источник истины значения под архитектурой M1.
 *
 * - value-доступ: `model.field` читает/пишет значение «как у обычного объекта»;
 *   вложенные объекты → под-модель {@link FormModel} (с `.$` и {@link ModelApi}), массивы → {@link ModelArray}.
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
 * Фасад элемента массива при обходе (`at`/`map`/`forEach`): массив → {@link ModelArray},
 * Opaque (Date/File/Blob) и примитив → значение, объект → под-модель {@link FormModel}.
 * Зеркалит листовой/объектный сплит {@link ModelValue} (но объект → под-модель с API),
 * чтобы `files: File[]`/`dates: Date[]`/вложенные массивы не мис-типизировались как `FormModel`.
 * @internal
 */
type ModelArrayItem<U> =
  NonNullable<U> extends ReadonlyArray<infer E>
    ? ModelArray<E>
    : NonNullable<U> extends Opaque
      ? U
      : NonNullable<U> extends object
        ? FormModel<NonNullable<U>>
        : U;

/**
 * Значение поля в value-доступе модели:
 * - массив → {@link ModelArray}
 * - спец-объект (Date/File/Blob) → как есть
 * - объект → под-модель {@link FormModel} (value-доступ + `.$`-сигналы + API get/set/patch/…);
 *   промоутится рантаймом (`makeFormModel`); сигналы идентичны `model.$.<path>`
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
        ? FormModel<NonNullable<V>>
        : V;

/**
 * Карта value-полей объекта (value-половина {@link FormModel}): поля доступны как обычные свойства
 * (чтение реактивно внутри `effect`/`computed`, запись — присваиванием). Вложенные объекты-поля
 * резолвятся в под-модели {@link FormModel} (см. {@link ModelValue}), массивы — в {@link ModelArray}.
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
  /**
   * Путь массива в модели (dot-нотация). Предоставляется рантаймом (value-прокси) и требуется
   * рендер-слою для резолва узла массива (напр. `ArrayRenderNode` в `@reformer/renderer-react`).
   */
  readonly __path: string;
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
  /** Элемент по индексу: объект → под-модель, массив → {@link ModelArray}, лист → значение. */
  at(
    index: number
  ): NonNullable<U> extends object ? ModelArrayItem<U> : ModelArrayItem<U> | undefined;
  /** Map по элементам (объект → {@link FormModel}, Opaque/примитив → значение, массив → {@link ModelArray}). */
  map<R>(fn: (item: ModelArrayItem<U>, index: number) => R): R[];
  /** Итерация по элементам (см. {@link ModelArrayItem}). */
  forEach(fn: (item: ModelArrayItem<U>, index: number) => void): void;
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
  [K in keyof T]: ModelSignalNode<T[K]>;
};

/**
 * Узел дерева сигналов `model.$`: массив → индексируемый узел под-сигналов, Opaque (Date/File/Blob)
 * и примитив → {@link PathAwareSignal}, объект → вложенное дерево {@link ModelSignals}. Для примитивных
 * и Opaque массивов элемент — сам сигнал листа (а не под-дерево), поэтому `model.$.tags[0]` — это
 * `PathAwareSignal<string>`, а не `ModelSignals<never>`.
 * @internal
 */
type ModelSignalNode<V> =
  NonNullable<V> extends ReadonlyArray<infer U>
    ? { readonly length: number; readonly [index: number]: ModelSignalNode<U> }
    : NonNullable<V> extends Opaque
      ? PathAwareSignal<V>
      : NonNullable<V> extends object
        ? ModelSignals<NonNullable<V>>
        : PathAwareSignal<V>;

/**
 * API уровня модели (доступно на корне, под-моделях вложенных объектов-групп и элементов массива).
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
  /**
   * Полная установка значений: принимает объект целиком (все ключи `T`) и записывает их в модель.
   * Производными полями (цели `compute`) владеет compute — их значения из payload игнорируются.
   * Не меняет initial-снимок. Для частичного обновления (только переданные ключи) — {@link ModelApi.patch}.
   */
  set(value: T): void;
  /**
   * Частичное слияние значений (load/patch с сервера): обновляет только переданные ключи,
   * отсутствующие ключи НЕ трогаются. Не меняет initial-снимок.
   */
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
 * FormModel — под-модель объекта `T`: value-доступ ({@link ModelObject}) + `.$`-сигналы + {@link ModelApi}
 * (get/set/patch/isDirty/reset/signalAt). Вложенные объекты-группы модели — тоже {@link FormModel}
 * (доступны как `model.<group>`), поэтому `model.<group>.$.<field>` эквивалентно `model.$.<group>.<field>`.
 *
 * @group Model
 */
export type FormModel<T> = ModelObject<T> & ModelApi<T>;
