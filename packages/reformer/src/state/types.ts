/**
 * Типы слоя данных FormModel (M1)
 *
 * FormModel — реактивный proxy над обычным JS-объектом: держит ТОЛЬКО значения
 * (как сигналы `@preact/signals-core`). Источник истины значения под архитектурой M1.
 *
 * - value-доступ: `model.field` читает/пишет значение «как у обычного объекта»;
 *   вложенные объекты → под-модель {@link FormModel} (с `.$` и {@link ModelApi}), массивы → {@link ModelArray}.
 * - escape-hatch: `model.$.field` отдаёт сам {@link PathAwareSignal} (для привязки в схеме);
 *   узлы-контейнеры дерева `$` (корень, группы, массивы) — тоже сигналы (`ReadonlySignal`
 *   агрегированного значения), поэтому `model.$.subscribe(…)` / `model.$.group.value` работают.
 *
 * @group Model
 * @module state/types
 */

import type { ReadonlySignal, Signal } from '@preact/signals-core';

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
 * Карта под-сигналов объекта в дереве `model.$` (без свойств самого узла — их добавляет
 * {@link ModelGroupSignals}).
 *
 * @group Model
 */
export type ModelSignals<T> = {
  [K in keyof T]: ModelSignalNode<T[K]>;
};

/**
 * Свойства контейнерного узла дерева `$`, «поверх» карты детей. Ключи детей вырезаются из
 * {@link ReadonlySignal}: доступ к полю формы всегда выигрывает у одноимённого свойства сигнала
 * (так же ведёт себя рантайм), поэтому `{ value: string }` не порождает конфликта типов.
 * @internal
 */
type ContainerSignal<T, TKeys extends PropertyKey> = Omit<ReadonlySignal<T>, TKeys>;

/**
 * Узел-группа дерева `model.$`: доступ к под-сигналам полей ({@link ModelSignals}) И одновременно
 * {@link ReadonlySignal} агрегированного значения группы — `.value`/`.peek()`/`.subscribe()`.
 *
 * ⚠️ Поле формы с именем `value`/`peek`/`subscribe`/`valueOf`/`toString`/`toJSON`/`brand` затеняет
 * одноимённое свойство сигнала (редкий краевой случай); `subscribe` при этом продолжает работать.
 *
 * @group Model
 */
export type ModelGroupSignals<T> = ModelSignals<T> & ContainerSignal<T, keyof T>;

/**
 * Узел-массив дерева `model.$`: индексируемый доступ к под-сигналам элементов, реактивная `length`
 * и {@link ReadonlySignal} значения массива целиком (реагирует и на правку элемента, и на изменение
 * состава — push/removeAt/move).
 *
 * @group Model
 */
export type ModelArraySignals<U, V> = ContainerSignal<V, 'length'> & {
  readonly length: number;
  readonly [index: number]: ModelSignalNode<U>;
};

/**
 * Узел дерева сигналов `model.$`: массив → {@link ModelArraySignals}, Opaque (Date/File/Blob)
 * и примитив → {@link PathAwareSignal}, объект → {@link ModelGroupSignals}. Для примитивных
 * и Opaque массивов элемент — сам сигнал листа (а не под-дерево), поэтому `model.$.tags[0]` — это
 * `PathAwareSignal<string>`, а не `ModelGroupSignals<never>`.
 * @internal
 */
type ModelSignalNode<V> =
  NonNullable<V> extends ReadonlyArray<infer U>
    ? ModelArraySignals<U, NonNullable<V>>
    : NonNullable<V> extends Opaque
      ? PathAwareSignal<V>
      : NonNullable<V> extends object
        ? ModelGroupSignals<NonNullable<V>>
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
  /**
   * Escape-hatch к сигналам: `model.$.loanType` → `PathAwareSignal<LoanType>`.
   * Сам узел — {@link ReadonlySignal} модели целиком: `model.$.subscribe(v => …)`.
   */
  readonly $: ModelGroupSignals<T>;
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
