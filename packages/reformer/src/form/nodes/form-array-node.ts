/**
 * FormArrayNode — реализация {@link FormArray}: массив под-форм над массивом модели.
 *
 * Данными не владеет: мутации уходят в массив модели, формы строк держатся за под-модели (кэш по
 * идентичности фасада элемента) и при `move`/`swap` не пересоздаются. Выпавшие строки
 * детерминированно диспозятся.
 *
 * Элемент `null` в массиве модели (пришёл с сервера) строкой формы не становится. Индексы ноды —
 * `at`, `keyAt`, `insert`, `removeAt`, `move`, `swap` — считаются по строкам формы и переводятся
 * в индексы модели, поэтому кнопка «Удалить» у строки удаляет её, а не соседний `null`.
 *
 * @internal
 * @module form/nodes/form-array-node
 */

import { computed, effect, signal, untracked, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationIssue } from '../types/contracts';
import type { FormArray, FormGroup } from '../types/nodes';
import type { FormModel } from '../../model/types';
import { referenceOf } from '../../model/model-value-proxy';
import { createAggregateSignals } from '../aggregate-signals';
import { rowKeyOf } from '../schema/row-key';
import { NODE_KIND, rawNode, type InternalFormNode } from './node-kind';
import { createAvailability, createIssues, createPending } from './state';

/** Реактивный массив модели в объёме, которым пользуется нода. */
export interface ModelArrayControl<TItem extends object> {
  readonly length: number;
  at(index: number): FormModel<TItem> | undefined;
  push(item?: TItem): void;
  insertAt(index: number, item?: TItem): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
  swap(first: number, second: number): void;
  clear(): void;
  toArray(): TItem[];
}

export class FormArrayNode<T extends object> implements FormArray<T>, InternalFormNode<T[]> {
  readonly [NODE_KIND] = 'array' as const;

  readonly value: ReadonlySignal<T[]>;
  readonly valid: ReadonlySignal<boolean>;
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>;
  readonly disabled: ReadonlySignal<boolean>;
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly issues: ReadonlySignal<readonly ValidationIssue[]>;
  readonly ownIssues: ReadonlySignal<readonly ValidationIssue[]>;

  private readonly rows = signal<FormGroup<T>[]>([]);
  /**
   * Состав массива меняли методами ноды после создания или сброса. Как `dirty` поля: ставит запись
   * через форму (`push`, `removeAt`, `move`, `setValue`…), а не запись в модель — загрузка данных
   * массив изменённым не делает. Операция, которая состав не поменяла (`clear` пустого массива,
   * `move(i, i)`), — тоже: поведение «очистить список при снятом флаге» после сброса формы её не
   * испачкает. Снимает `reset`.
   */
  private readonly reshaped = signal(false);
  /** Форма строки по фасаду под-модели элемента. */
  private readonly cache = new WeakMap<object, FormGroup<T>>();
  /** Под-модели строк, для которых сейчас есть формы, — «прежний» набор для сверки. */
  private mounted: FormModel<T>[] = [];
  private readonly initial: T[];
  private readonly own = createIssues();
  private readonly availability = createAvailability();
  /** Ожидание async-правила на ручке самого массива. */
  private readonly ownPending = createPending();
  private readonly stopSync: () => void;

  /**
   * @param control - Массив модели (`model.<путь>`).
   * @param buildRow - Форма строки по её под-модели; инъекция снимает цикл импорта со сборкой.
   */
  constructor(
    private readonly control: ModelArrayControl<T>,
    buildRow: (rowModel: FormModel<T>) => FormGroup<T>
  ) {
    this.initial = control.toArray();

    this.stopSync = effect(() => {
      const length = control.length;
      const nextModels: FormModel<T>[] = [];
      const next: FormGroup<T>[] = [];
      for (let index = 0; index < length; index++) {
        const rowModel = control.at(index);
        if (!rowModel) continue;
        let row = this.cache.get(rowModel);
        if (!row) {
          // Построение и выключение строки читают её сигналы (вложенный массив, поведение строки) —
          // вне отслеживания: синхронизация зависит только от состава массива.
          row = untracked(() => {
            const built = buildRow(rowModel);
            // Строка, добавленная в выключенный массив, рождается выключенной — как остальные.
            if (this.availability.disabled.peek()) built.disable();
            return built;
          });
          this.cache.set(rowModel, row);
        }
        nextModels.push(rowModel);
        next.push(row);
      }
      // Строки выпавших элементов собираются до обновления: перестановка набор не меняет.
      const kept = new Set<FormModel<T>>(nextModels);
      const stale: FormGroup<T>[] = [];
      for (const previous of this.mounted) {
        if (kept.has(previous)) continue;
        const row = this.cache.get(previous);
        this.cache.delete(previous);
        if (row) stale.push(row);
      }
      this.mounted = nextModels;
      this.rows.value = next;
      // Снятие — тоже вне отслеживания: иначе чтения внутри него (строки вложенного массива,
      // пользовательский `onDispose`) подписали бы синхронизацию на уже снятую строку, и её формы
      // жили бы в источниках effect'а до следующего изменения массива.
      untracked(() => stale.forEach((row) => rawNode(row).dispose()));
    });

    this.value = computed(() => this.rows.value.map((row) => row.value.value));
    const { disabled } = this.availability;
    const aggregate = createAggregateSignals({
      getChildren: () => this.rows.value,
      ownIssues: this.own.list,
      ownPending: computed(() => !disabled.value && this.ownPending.active.value),
      disabled,
    });
    this.valid = aggregate.valid;
    this.invalid = aggregate.invalid;
    this.pending = aggregate.pending;
    this.touched = aggregate.touched;
    this.dirty = computed(() => this.reshaped.value || aggregate.dirty.value);
    this.issues = aggregate.issues;
    this.ownIssues = this.own.list;
    this.disabled = this.availability.disabled;
  }

  get length(): number {
    return this.rows.value.length;
  }

  at(index: number): FormGroup<T> | undefined {
    return this.rows.value[index];
  }

  map<R>(callback: (row: FormGroup<T>, index: number) => R): R[] {
    return this.rows.value.map(callback);
  }

  forEach(callback: (row: FormGroup<T>, index: number) => void): void {
    this.rows.value.forEach(callback);
  }

  keyAt(index: number): string {
    // По строкам формы, как `at`: `mounted` обновляется вместе с `rows` в синхронизации.
    const rowModel = index < this.rows.value.length ? this.mounted[index] : undefined;
    if (rowModel === undefined) {
      throw new RangeError(`[@reformer/core] FormArray.keyAt: no row at index ${index}`);
    }
    return String(rowKeyOf(rowModel));
  }

  push(item?: T): void {
    this.reshape(() => this.control.push(item));
  }

  insert(index: number, item?: T): void {
    this.reshape(() => this.control.insertAt(this.modelIndex(index), item));
  }

  removeAt(index: number): void {
    this.reshape(() => this.control.removeAt(this.modelIndex(index)));
  }

  move(from: number, to: number): void {
    this.reshape(() => this.control.move(this.modelIndex(from), this.modelIndex(to)));
  }

  swap(first: number, second: number): void {
    this.reshape(() => this.control.swap(this.modelIndex(first), this.modelIndex(second)));
  }

  clear(): void {
    this.reshape(() => this.control.clear());
  }

  getValue(): T[] {
    return this.control.toArray();
  }

  setValue(values: T[]): void {
    this.reshape(() => {
      this.control.clear();
      (values ?? []).forEach((item) => this.control.push(item));
    });
  }

  /**
   * Сбросить массив: строки, замечания и `dirty`. Без аргумента — к точке отсчёта модели, той же, к
   * которой возвращает `model.reset()`: элементам создания модели либо последнего
   * `captureInitial()`.
   */
  reset(values?: T[]): void {
    this.own.clear();
    this.setValue(values ?? this.referenceItems());
    this.reshaped.value = false;
  }

  /** Строки пересобираются из значений создания — их поведение считает заново. @internal */
  resetToCreation(): void {
    this.own.clear();
    this.setValue(this.initial);
    this.reshaped.value = false;
  }

  /** Точка отсчёта модели за массивом; без модели — элементы создания. */
  private referenceItems(): T[] {
    const reference = referenceOf(this.control);
    return reference === undefined ? this.initial : (reference.value as T[]);
  }

  markAsTouched(): void {
    this.rows.value.forEach((row) => row.markAsTouched());
  }

  markAsUntouched(): void {
    this.rows.value.forEach((row) => row.markAsUntouched());
  }

  disable(): void {
    this.availability.setDisabled(true);
    // Как у поля: выключенная нода замечаний не держит.
    this.own.clear();
    this.rows.value.forEach((row) => row.disable());
  }

  /** Включить массив и строки; поля с блокировкой из схемы (`disabled: true`) остаются выключенными. */
  enable(): void {
    this.availability.setDisabled(false);
    this.rows.value.forEach((row) => rawNode(row).enableFromParent());
  }

  /** Каскад от контейнера — то же, что `enable()`: своей блокировки из схемы у массива нет. @internal */
  enableFromParent(): void {
    this.enable();
  }

  setIssues(issues: readonly ValidationIssue[]): void {
    this.own.set(issues);
  }

  clearIssues(): void {
    this.own.clear();
    this.rows.value.forEach((row) => row.clearIssues());
  }

  /** Своё ожидание async-правила на ручке массива; ожидание строк агрегат добавит сам. @internal */
  setPending(pending: boolean): void {
    this.ownPending.mark(pending);
  }

  /** Выполнить мутацию массива модели и отметить `dirty`, если состав строк изменился. */
  private reshape(mutate: () => void): void {
    const before = this.composition();
    mutate();
    const after = this.composition();
    if (after.length !== before.length || after.some((row, index) => row !== before[index])) {
      this.reshaped.value = true;
    }
  }

  /**
   * Индекс модели для индекса строки формы. Без `null`-элементов они совпадают; с ними строка `i` —
   * `i`-й непустой элемент, а индекс за последней строкой — конец массива модели. Читает модель, а не
   * `mounted`: внутри `batch` синхронизация ещё не прошла.
   */
  private modelIndex(index: number): number {
    return untracked(() => {
      const present: number[] = [];
      for (let position = 0; position < this.control.length; position++) {
        if (this.control.at(position)) present.push(position);
      }
      if (present.length === this.control.length) return index;
      if (index >= 0 && index < present.length) return present[index];
      return index === present.length ? this.control.length : index;
    });
  }

  /** Под-модели строк по порядку — без подписки: мутацию могут вызвать из effect'а поведения. */
  private composition(): (FormModel<T> | undefined)[] {
    return untracked(() =>
      Array.from({ length: this.control.length }, (_, index) => this.control.at(index))
    );
  }

  /** Остановить синхронизацию и диспозить формы всех строк. @internal */
  dispose(): void {
    this.stopSync();
    this.rows.peek().forEach((row) => rawNode(row).dispose());
    this.mounted = [];
  }
}
