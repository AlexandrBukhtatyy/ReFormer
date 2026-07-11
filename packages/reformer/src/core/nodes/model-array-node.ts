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

/**
 * Узел массива, делегирующий данные массиву {@link FormModel} (архитектура M1).
 *
 * В отличие от {@link ArrayNode} (владеет элементами сам), `ModelArrayNode` НЕ владеет данными:
 * массив принадлежит модели, а узел держит per-item формы элементов (привязанные к сигналам
 * под-моделей) и синхронизирует их с длиной массива модели. Мутации (`push`/`removeAt`/`move`/…)
 * делегируются массиву модели; per-item формы кэшируются по идентичности под-модели, поэтому при
 * reorder/повторном рендере не пересоздаются (состояние и валидация сохраняются). Реализует тот же
 * контракт, что ждут секции массива и `useFormControl` (`length`/`value`/`valid`/`errors`/`at`/`push`/…).
 *
 * Обычно создаётся не напрямую, а `createForm({ model, schema })`: когда в схеме встречается узел
 * массива `{ array: model.<field>, item: (item) => itemSchema }`, форма материализует его как
 * `ModelArrayNode` и кладёт под `form.<field>` (совместим с `FormArraySection`).
 *
 * @group Nodes
 *
 * @example Массив как часть формы (через createForm)
 * ```typescript
 * const model = createModel<{ rows: { name: string; qty: number }[] }>({ rows: [] });
 *
 * const rowItem = (item: FormModel<{ name: string; qty: number }>) => ({
 *   name: { value: item.$.name, component: Input },
 *   qty: { value: item.$.qty, component: Input },
 * });
 *
 * const form = createForm({
 *   model,
 *   schema: {
 *     children: [{ array: model.rows, item: rowItem }],
 *   },
 * });
 *
 * const rows = form.rows as unknown as ModelArrayNode<{ name: string; qty: number }>;
 * rows.push({ name: 'A', qty: 1 });   // мутация уезжает в model.rows
 * rows.at(0)?.name.setValue('B');     // правка поля элемента доезжает в под-модель
 * rows.length.value;                  // 1 (реактивная длина)
 * ```
 */
export class ModelArrayNode<T extends object> extends FormNode<T[]> {
  private readonly itemNodes: Signal<FormProxy<T>[]> = signal<FormProxy<T>[]>([]);
  // Кэш per-item формы по идентичности фасада под-модели (фасады кэшируются в core).
  private readonly cache = new WeakMap<object, FormProxy<T>>();
  // Фасады под-моделей, для которых сейчас смонтированы формы — «предыдущий» набор для
  // реконсиляции в disposeSync. Выпавшие из массива элементы диспозятся и вытесняются из кэша.
  private mountedModels: FormModel<T>[] = [];
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

    // Синхронизация per-item форм с массивом модели. Формы кэшируются по фасаду элемента, поэтому
    // при reorder/повторном рендере не пересоздаются (состояние сохраняется). Выпавшие элементы
    // (removeAt/clear/setValue/reset мутируют массив модели → эффект перезапускается) детерминированно
    // диспозятся и вытесняются из кэша — иначе форма удалённого элемента продолжала бы владеть живыми
    // подписками (disposeSync вложенных ModelArrayNode, cleanup поведений, watch/computeFrom). Реордер
    // (move/swap) не меняет набор фасадов, поэтому ничего не диспозит.
    this.disposeSync = effect(() => {
      const len = control.length; // зависимость от длины массива модели
      const nextModels: FormModel<T>[] = [];
      const next: FormProxy<T>[] = [];
      for (let i = 0; i < len; i++) {
        const itemModel = control.at(i);
        if (!itemModel) continue;
        let node = this.cache.get(itemModel as unknown as object);
        if (!node) {
          node = buildItem(itemModel);
          this.cache.set(itemModel as unknown as object, node);
        }
        nextModels.push(itemModel);
        next.push(node);
      }
      // Собрать формы выпавших элементов ДО обновления состояния, чтобы НЕ диспозить при reorder
      // (move/swap сохраняют набор фасадов — nextSet содержит их все).
      const nextSet = new Set<FormModel<T>>(nextModels);
      const stale: FormProxy<T>[] = [];
      for (const prevModel of this.mountedModels) {
        if (nextSet.has(prevModel)) continue;
        const staleNode = this.cache.get(prevModel as unknown as object);
        this.cache.delete(prevModel as unknown as object); // вытеснить, чтобы не вернуть диспознутый proxy
        if (staleNode) stale.push(staleNode);
      }
      this.mountedModels = nextModels;
      this.itemNodes.value = next;
      // Детерминированный teardown форм удалённых элементов (после обновления itemNodes).
      stale.forEach((n) => this.disposeItemNode(n));
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
  // Агрегатное состояние (touched/dirty/status) выводится из детей (createAggregateSignals), поэтому
  // базовые сигналы бесполезны для чтения — состояние меняется ТОЛЬКО через per-item формы. Форвардим
  // ВСЕ hook'и (как ArrayNode), иначе markAsUntouched/Pristine/Dirty/disable/enable молча no-op.
  protected override onMarkAsTouched(): void {
    this.itemNodes.value.forEach((n) =>
      (n as unknown as { markAsTouched?: () => void }).markAsTouched?.()
    );
  }
  protected override onMarkAsUntouched(): void {
    this.itemNodes.value.forEach((n) =>
      (n as unknown as { markAsUntouched?: () => void }).markAsUntouched?.()
    );
  }
  protected override onMarkAsDirty(): void {
    this.itemNodes.value.forEach((n) =>
      (n as unknown as { markAsDirty?: () => void }).markAsDirty?.()
    );
  }
  protected override onMarkAsPristine(): void {
    this.itemNodes.value.forEach((n) =>
      (n as unknown as { markAsPristine?: () => void }).markAsPristine?.()
    );
  }
  protected override onDisable(): void {
    this.itemNodes.value.forEach((n) => (n as unknown as { disable?: () => void }).disable?.());
  }
  protected override onEnable(): void {
    this.itemNodes.value.forEach((n) => (n as unknown as { enable?: () => void }).enable?.());
  }

  /** Диспозит форму элемента (эффекты/поведения/вложенные подписки); терпима к не-GroupNode. */
  private disposeItemNode(node: FormProxy<T>): void {
    (node as unknown as { dispose?: () => void }).dispose?.();
  }

  /**
   * Очистка подписки синхронизации И детерминированный teardown всех форм элементов.
   * Без пробрасывания dispose в itemNodes эффекты/поведения каждой формы элемента (в т.ч. disposeSync
   * вложенных ModelArrayNode) остались бы жить после teardown формы — утечка подписок.
   */
  dispose(): void {
    this.disposeSync();
    // disposeSync остановлен — itemNodes.value держит последний набор; диспозим каждую форму.
    this.itemNodes.value.forEach((n) => this.disposeItemNode(n));
    this.mountedModels = [];
  }
}
