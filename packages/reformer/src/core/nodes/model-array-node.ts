/**
 * ModelArrayNode — узел массива, делегирующий данные массиву {@link FormModel} (M1).
 *
 * В отличие от {@link ArrayNode} (владеет элементами сам), `ModelArrayNode` НЕ владеет данными:
 * массив принадлежит модели (`model.<path>`), а узел держит per-item GroupNode-прокси, привязанные
 * к сигналам под-моделей элементов, и синхронизирует их с длиной массива модели. Реализует тот же
 * контракт, что ждут `FormArraySection`/`useFormControl` (length/value/valid/errors/at/push/…).
 *
 * @group Nodes
 * @module core/nodes/model-array-node
 */

import { signal, computed, effect, type Signal, type ReadonlySignal } from '@preact/signals-core';
import { FormNode } from './form-node';
import { createAggregateSignals } from '../utils/aggregate-signals';
import type { FieldStatus, ValidationError } from '../types';
import type { FormModel } from '../model/types';
import type { FormProxy } from '../types/form-proxy';

/** Минимальный контракт реактивного массива модели, используемый узлом. */
export interface ModelArrayControl<TItem extends object> {
  readonly length: number;
  at(index: number): FormModel<TItem> | undefined;
  push(item: TItem): void;
  insertAt(index: number, item: TItem): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
  swap(a: number, b: number): void;
  clear(): void;
  toArray(): TItem[];
}

export class ModelArrayNode<T extends object> extends FormNode<T[]> {
  private readonly itemNodes: Signal<FormProxy<T>[]> = signal<FormProxy<T>[]>([]);
  // Кэш per-item формы по идентичности фасада под-модели (фасады кэшируются в core).
  private readonly cache = new WeakMap<object, FormProxy<T>>();
  private readonly initial: T[];
  private readonly _arrayErrors: Signal<ValidationError[]> = signal<ValidationError[]>([]);
  private readonly disposeSync: () => void;

  /**
   * Сигнал per-item форм. Публичен в т.ч. чтобы `isArrayNode` распознавал узел как массив
   * (duck-typing проверяет наличие `items`).
   */
  get items(): Signal<FormProxy<T>[]> {
    return this.itemNodes;
  }

  public readonly value: ReadonlySignal<T[]>;
  public readonly valid: ReadonlySignal<boolean>;
  public readonly invalid: ReadonlySignal<boolean>;
  public readonly pending: ReadonlySignal<boolean>;
  public readonly touched: ReadonlySignal<boolean>;
  public readonly dirty: ReadonlySignal<boolean>;
  public readonly errors: ReadonlySignal<ValidationError[]>;
  public readonly status: ReadonlySignal<FieldStatus>;
  public readonly length: ReadonlySignal<number>;

  /**
   * @param control Реактивный массив модели (`model.<path>`).
   * @param buildItem Строитель формы элемента по его под-модели (инъекция, чтобы избежать цикла
   *   импорта с `create-form`). Обычно `(item) => createForm({ model: item, schema: itemSchema(item) })`.
   */
  constructor(
    private readonly control: ModelArrayControl<T>,
    private readonly buildItem: (item: FormModel<T>) => FormProxy<T>
  ) {
    super();
    this.initial = control.toArray();

    // Синхронизация per-item форм с массивом модели (по длине). Формы кэшируются по фасаду элемента,
    // поэтому при reorder/повторном рендере не пересоздаются (состояние сохраняется).
    this.disposeSync = effect(() => {
      const len = control.length; // зависимость от длины массива модели
      const next: FormProxy<T>[] = [];
      for (let i = 0; i < len; i++) {
        const itemModel = control.at(i);
        if (!itemModel) continue;
        let node = this.cache.get(itemModel as unknown as object);
        if (!node) {
          node = buildItem(itemModel);
          this.cache.set(itemModel as unknown as object, node);
        }
        next.push(node);
      }
      this.itemNodes.value = next;
    });

    this.length = computed(() => this.itemNodes.value.length);
    this.value = computed(() => this.itemNodes.value.map((n) => n.value.value as T));

    const agg = createAggregateSignals({
      getChildren: () => this.itemNodes.value as unknown as FormNode<unknown>[],
      ownErrors: this._arrayErrors,
    });
    this.valid = agg.valid;
    this.invalid = agg.invalid;
    this.pending = agg.pending;
    this.touched = agg.touched;
    this.dirty = agg.dirty;
    this.errors = agg.errors;
    this.status = agg.status;
  }

  // ── Доступ к элементам ─────────────────────────────────────────────────────
  at(index: number): FormProxy<T> | undefined {
    return this.itemNodes.value[index];
  }
  map<R>(fn: (item: FormProxy<T>, index: number) => R): R[] {
    return this.itemNodes.value.map((n, i) => fn(n, i));
  }
  forEach(fn: (item: FormProxy<T>, index: number) => void): void {
    this.itemNodes.value.forEach((n, i) => fn(n, i));
  }

  // ── Мутации (делегируют массиву модели; effect пересоберёт itemNodes) ──────
  push(item?: Partial<T>): void {
    this.control.push((item ?? {}) as T);
  }
  insert(index: number, item?: Partial<T>): void {
    this.control.insertAt(index, (item ?? {}) as T);
  }
  removeAt(index: number): void {
    this.control.removeAt(index);
  }
  /**
   * Переместить элемент модель-массива. Делегирует мутацию массиву модели; внутренний `effect`
   * пересоберёт `itemNodes` в новом порядке (per-item формы сохраняются по кешу идентичности).
   */
  move(from: number, to: number): void {
    this.control.move(from, to);
  }
  /** Поменять местами два элемента модель-массива (см. {@link move}). */
  swap(a: number, b: number): void {
    this.control.swap(a, b);
  }
  clear(): void {
    this.control.clear();
  }

  // ── Абстрактные методы FormNode ────────────────────────────────────────────
  getValue(): T[] {
    return this.control.toArray();
  }
  setValue(values: T[]): void {
    this.control.clear();
    (values ?? []).forEach((v) => this.control.push(v));
  }
  patchValue(values: Partial<T[]>): void {
    this.setValue(values as T[]);
  }
  reset(values?: T[]): void {
    this._arrayErrors.value = [];
    this.setValue(values ?? this.initial);
  }
  resetToInitial(): void {
    this.reset(this.initial);
  }
  async validate(): Promise<boolean> {
    const results = await Promise.all(
      this.itemNodes.value.map((n) =>
        (n as unknown as { validate: () => Promise<boolean> }).validate()
      )
    );
    return results.every(Boolean) && this._arrayErrors.value.length === 0;
  }
  setErrors(errors: ValidationError[]): void {
    this._arrayErrors.value = errors;
  }
  clearErrors(): void {
    this._arrayErrors.value = [];
    this.itemNodes.value.forEach((n) =>
      (n as unknown as { clearErrors?: () => void }).clearErrors?.()
    );
  }

  // ── Hooks (forward к элементам) ────────────────────────────────────────────
  protected override onMarkAsTouched(): void {
    this.itemNodes.value.forEach((n) =>
      (n as unknown as { markAsTouched?: () => void }).markAsTouched?.()
    );
  }

  /** Очистка подписки синхронизации. */
  dispose(): void {
    this.disposeSync();
  }
}
