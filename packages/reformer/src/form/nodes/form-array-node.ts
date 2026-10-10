/**
 * FormArrayNode — реализация {@link FormArray}: массив под-форм над массивом модели.
 *
 * Данными не владеет: мутации уходят в массив модели, формы строк держатся за под-модели (кэш по
 * идентичности фасада элемента) и при `move`/`swap` не пересоздаются. Выпавшие строки
 * детерминированно диспозятся.
 *
 * @internal
 * @module form/nodes/form-array-node
 */

import { computed, effect, signal, type ReadonlySignal } from '@preact/signals-core';
import type { ValidationIssue } from '../types/contracts';
import type { FormArray, FormGroup } from '../types/nodes';
import type { FormModel } from '../../model/types';
import { createAggregateSignals } from '../aggregate-signals';
import { rowKeyOf } from '../schema/row-key';
import { NODE_KIND, rawNode, type InternalFormNode } from './node-kind';
import { createAvailability, createIssues } from './state';

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
  /** Форма строки по фасаду под-модели элемента. */
  private readonly cache = new WeakMap<object, FormGroup<T>>();
  /** Под-модели строк, для которых сейчас есть формы, — «прежний» набор для сверки. */
  private mounted: FormModel<T>[] = [];
  private readonly initial: T[];
  private readonly own = createIssues();
  private readonly availability = createAvailability();
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
          row = buildRow(rowModel);
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
      stale.forEach((row) => rawNode(row).dispose());
    });

    this.value = computed(() => this.rows.value.map((row) => row.value.value));
    const aggregate = createAggregateSignals({
      getChildren: () => this.rows.value,
      ownIssues: this.own.list,
    });
    this.valid = aggregate.valid;
    this.invalid = aggregate.invalid;
    this.pending = aggregate.pending;
    this.touched = aggregate.touched;
    this.dirty = aggregate.dirty;
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
    const rowModel = this.control.at(index);
    if (rowModel === undefined) {
      throw new RangeError(`[@reformer/core] FormArray.keyAt: no row at index ${index}`);
    }
    return String(rowKeyOf(rowModel));
  }

  push(item?: T): void {
    this.control.push(item);
  }

  insert(index: number, item?: T): void {
    this.control.insertAt(index, item);
  }

  removeAt(index: number): void {
    this.control.removeAt(index);
  }

  move(from: number, to: number): void {
    this.control.move(from, to);
  }

  swap(first: number, second: number): void {
    this.control.swap(first, second);
  }

  clear(): void {
    this.control.clear();
  }

  getValue(): T[] {
    return this.control.toArray();
  }

  setValue(values: T[]): void {
    this.control.clear();
    (values ?? []).forEach((item) => this.control.push(item));
  }

  reset(values?: T[]): void {
    this.own.clear();
    this.setValue(values ?? this.initial);
  }

  markAsTouched(): void {
    this.rows.value.forEach((row) => row.markAsTouched());
  }

  markAsUntouched(): void {
    this.rows.value.forEach((row) => row.markAsUntouched());
  }

  disable(): void {
    this.availability.setDisabled(true);
    this.rows.value.forEach((row) => row.disable());
  }

  enable(): void {
    this.availability.setDisabled(false);
    this.rows.value.forEach((row) => row.enable());
  }

  setIssues(issues: readonly ValidationIssue[]): void {
    this.own.set(issues);
  }

  clearIssues(): void {
    this.own.clear();
    this.rows.value.forEach((row) => row.clearIssues());
  }

  /** Ожидание массива выводится из строк. @internal */
  setPending(): void {}

  /** Остановить синхронизацию и диспозить формы всех строк. @internal */
  dispose(): void {
    this.stopSync();
    this.rows.value.forEach((row) => rawNode(row).dispose());
    this.mounted = [];
  }
}
