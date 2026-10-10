/**
 * GroupNode - узел группы полей формы
 *
 * Представляет группу полей (объект), где каждое поле может быть:
 * - FieldNode (простое поле)
 * - GroupNode (вложенная группа)
 * - ModelArrayNode (массив под-форм)
 *
 * Наследует от FormNode и реализует все его абстрактные методы
 *
 * @group Nodes
 */

import { signal, computed, batch } from '@preact/signals-core';
import type { Signal, ReadonlySignal } from '@preact/signals-core';
import { FormNode } from './form-node';
import type { ValidationIssue, FieldStatus } from '../types/index';
import type { FormProxy } from '../types/form-proxy';
import { createAggregateSignals } from '../aggregate-signals';
import { buildFormProxy } from '../form-proxy-builder';
import { isDerived } from '../../model/derived-registry';

/**
 * GroupNode - узел для группы полей
 *
 * Собирается из готовых нод детей. Обычно группу строит сборка формы
 * (`createFormFromModel({ model, schema })`) по виду узлов модели; схема валидации и поведение
 * живут на слое модели (`validateModel` из `@reformer/core/validation`,
 * `defineFormBehavior`), а не на ноде.
 *
 * @group Nodes
 *
 * @example
 * ```typescript
 * const model = createModel({ email: '', password: '' });
 * const form = createFormFromModel({ model });
 *
 * // Прямой доступ к полям через Proxy
 * form.email.setValue('test@mail.com');
 * console.log(form.valid.value);
 * ```
 */
export class GroupNode<T> extends FormNode<T> {
  // ============================================================================
  // Приватные поля
  // ============================================================================
  public id = crypto.randomUUID();

  /**
   * Ноды детей по именам полей данных
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _fields = new Map<keyof T, FormNode<any>>();

  /**
   * Ссылка на Proxy-инстанс
   */
  private _proxyInstance?: FormProxy<T>;

  /**
   * Cleanup декларативной схемы поведения (createForm({ behavior })). Вызывается в dispose().
   */
  private _behaviorCleanup?: () => void;

  // ============================================================================
  // Приватные сигналы состояния
  // ============================================================================

  /** Флаг disabled состояния */
  private readonly _disabled: Signal<boolean> = signal(false);

  /** Form-level validation issues */
  private readonly _formIssues: Signal<ValidationIssue[]> = signal<ValidationIssue[]>([]);

  /**
   * Связь листовой ноды-ребёнка → её сигнал модели (тот, что помечает `markDerived`).
   * Нужна bulk-сеттерам (`setValue`/`patchValue`), чтобы корректно определять derived-поля:
   * `field.value` — computed-обёртка, отличная от записываемого сигнала модели. @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _fieldSignals = new WeakMap<FormNode<any>, Signal<unknown>>();

  // ============================================================================
  // Публичные computed signals
  // ============================================================================

  public readonly value: ReadonlySignal<T>;
  public readonly valid: ReadonlySignal<boolean>;
  public readonly invalid: ReadonlySignal<boolean>;
  public readonly touched: ReadonlySignal<boolean>;
  public readonly dirty: ReadonlySignal<boolean>;
  public readonly pending: ReadonlySignal<boolean>;
  public readonly issues: ReadonlySignal<ValidationIssue[]>;
  public readonly status: ReadonlySignal<FieldStatus>;

  // ============================================================================
  // Конструктор
  // ============================================================================

  /**
   * @param fields - Готовые ноды детей по именам полей данных. Вид ребёнка (поле, группа, массив)
   *   определён тем, какую ноду передали: по именам и значениям группа ничего не угадывает,
   *   поэтому поле данных может называться как угодно.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(fields: Iterable<readonly [string, FormNode<any>]>) {
    super();

    for (const [key, node] of fields) {
      this._fields.set(key as keyof T, node);
    }

    // ========================================================================
    // Создание computed signals через createAggregateSignals
    // ========================================================================

    // Computed signal для значения формы (специфичен для GroupNode)
    this.value = computed(() => {
      const result = {} as T;
      this._fields.forEach((field, key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = field.value.value as any;
      });
      return result;
    });

    // Агрегированные signals через общую утилиту
    const aggregateSignals = createAggregateSignals({
      getChildren: () => Array.from(this._fields.values()),
      ownErrors: this._formIssues,
      disabled: this._disabled,
    });

    this.valid = aggregateSignals.valid;
    this.invalid = aggregateSignals.invalid;
    this.pending = aggregateSignals.pending;
    this.touched = aggregateSignals.touched;
    this.dirty = aggregateSignals.dirty;
    this.issues = aggregateSignals.issues;
    this.status = aggregateSignals.status;

    // Proxy создаётся лениво при первом вызове getProxy().
    // Для Proxy-доступа к полям используйте фабрику формы или getProxy().
  }

  // ============================================================================
  // Приватный метод для создания Proxy
  // ============================================================================

  /**
   * Создать Proxy для типобезопасного доступа к полям
   * @see buildFormProxy
   */
  private buildProxy(): FormProxy<T> {
    return buildFormProxy(this, this._fields as Map<keyof T, FormNode<unknown>>);
  }

  // ============================================================================
  // Реализация абстрактных методов FormNode
  // ============================================================================

  getValue(): T {
    const result = {} as T;
    this._fields.forEach((field, key) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result[key] = field.getValue() as any;
    });
    return result;
  }

  setValue(value: T): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [key, fieldValue] of Object.entries(value as any)) {
      const field = this._fields.get(key as keyof T);
      if (field) {
        // Производные поля (цели compute) не затираем при bulk-set. Сверяем с записываемым
        // сигналом модели (его помечает markDerived), а не с computed-обёрткой field.value.
        const derivedSig = this._fieldSignals.get(field) ?? (field.value as Signal<unknown>);
        if (isDerived(derivedSig)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field.setValue(fieldValue as any);
      }
    }
  }

  patchValue(value: Partial<T>): void {
    // Используем batch чтобы все обновления происходили атомарно
    batch(() => {
      for (const [key, fieldValue] of Object.entries(value)) {
        const field = this._fields.get(key as keyof T);
        if (field && fieldValue !== undefined) {
          // Производные поля (цели compute) не затираем при bulk-patch. Сверяем с записываемым
          // сигналом модели (его помечает markDerived), а не с computed-обёрткой field.value.
          const derivedSig = this._fieldSignals.get(field) ?? (field.value as Signal<unknown>);
          if (isDerived(derivedSig)) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          field.setValue(fieldValue as any);
        }
      }
    });
  }

  /**
   * Сбросить группу: значения, ошибки и флаги touched / dirty всех полей.
   *
   * Без аргумента значения возвращаются к тем, с которыми форма создана. Это форма «с чистого
   * листа», а не точка отсчёта модели: после загрузки данных и `model.captureInitial()` к
   * загруженным значениям возвращает `model.reset()`, а не этот метод.
   *
   * @param value - значения для сброса; поле без значения возвращается к значению создания
   *
   * @example
   * ```typescript
   * form.reset(); // к значениям, с которыми форма создана
   * form.reset({ email: 'new@mail.com', password: '' }); // к новым значениям
   * ```
   */
  reset(value?: T): void {
    // Сбрасываем и form-level ошибки (setIssues) — иначе форма остаётся invalid после reset.
    // Так же ModelArrayNode.reset() очищает свои _arrayIssues.
    this._formIssues.value = [];
    this._fields.forEach((field, key) => {
      const resetValue = value?.[key];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field.reset(resetValue as any);
    });
  }

  /**
   * Установить form-level validation issues
   */
  setIssues(issues: ValidationIssue[]): void {
    this._formIssues.value = issues;
  }

  /**
   * Очистить все issues (form-level + field-level)
   */
  clearIssues(): void {
    this._formIssues.value = [];
    this._fields.forEach((field) => field.clearIssues());
  }

  /**
   * Ноды детей по именам полей данных. По наличию этого свойства гарды типов отличают группу
   * от поля; для доступа к полю пользуйтесь прокси формы — `form.email`, а для поля, имя
   * которого занято членом ноды (`value`, `issues`, `status`), — `form.$.value`.
   */
  get fields(): Map<keyof T, FormNode<unknown>> {
    return this._fields;
  }

  /**
   * Получить Proxy-инстанс для прямого доступа к полям
   *
   * Proxy позволяет обращаться к полям формы напрямую через точечную нотацию:
   * `form.email`, `form.address.city`.
   *
   * @returns Proxy-инстанс с типобезопасным доступом к полям или сама форма, если proxy не доступен
   *
   * @example
   * ```typescript
   * const model = createModel({ email: '', name: '' });
   * const proxy = createFormFromModel({ model });
   *
   * console.log(proxy.email.value.value); // Прямой доступ к полю
   * ```
   */
  getProxy(): FormProxy<T> {
    // Lazy initialization: создаём proxy только при первом обращении
    if (!this._proxyInstance) {
      this._proxyInstance = this.buildProxy();
    }
    return this._proxyInstance;
  }

  // ============================================================================
  // Protected hooks (Template Method pattern)
  // ============================================================================

  protected onMarkAsTouched(): void {
    this._fields.forEach((field) => field.markAsTouched());
  }

  protected onMarkAsUntouched(): void {
    this._fields.forEach((field) => field.markAsUntouched());
  }

  protected onMarkAsDirty(): void {
    this._fields.forEach((field) => field.markAsDirty());
  }

  protected onMarkAsPristine(): void {
    this._fields.forEach((field) => field.markAsPristine());
  }

  /**
   * Hook: вызывается после disable()
   */
  protected onDisable(): void {
    this._disabled.value = true;
    this._fields.forEach((field) => field.disable());
  }

  /**
   * Hook: вызывается после enable()
   */
  protected onEnable(): void {
    this._disabled.value = false;
    this._fields.forEach((field) => field.enable());
  }

  /**
   * Прикрепить cleanup декларативной схемы поведения (вызывается createForm).
   * @internal
   */
  attachBehaviorCleanup(cleanup: () => void): void {
    this._behaviorCleanup = cleanup;
  }

  /**
   * Связать листовую ноду-ребёнка с её сигналом модели. Вызывается `createForm` для каждого
   * листового поля на его владеющей группе — по нему bulk-сеттеры узнают производные поля.
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerFieldSignal(node: FormNode<any>, signal: Signal<unknown>): void {
    this._fieldSignals.set(node, signal);
  }

  /**
   * Очистить все ресурсы узла
   */
  dispose(): void {
    this._behaviorCleanup?.();
    this._behaviorCleanup = undefined;
    this._fields.forEach((field) => {
      if ('dispose' in field && typeof field.dispose === 'function') {
        field.dispose();
      }
    });
  }
}
