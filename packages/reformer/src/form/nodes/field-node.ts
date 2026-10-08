/**
 * FieldNode - узел поля формы
 *
 * Держит состояние одного поля: touched / dirty / status / errors / componentProps. Значением
 * не владеет — ссылается на сигнал модели.
 *
 * @group Nodes
 */

import { signal, computed } from '@preact/signals-core';
import type { Signal, ReadonlySignal } from '@preact/signals-core';
import { FormNode } from './form-node';
import type { FieldConfig, FieldStatus, ValidationError } from '../types/index';
import { FormStatusMachine } from '../status-machine';

/**
 * FieldNode - узел для отдельного поля формы
 *
 * Правил валидации нода не исполняет: они живут в схеме валидации
 * (`defineValidationSchema`, `@reformer/core/validation`), а раннер разносит ошибки по нодам
 * через {@link FieldNode.setErrors}.
 *
 * @group Nodes
 *
 * @example
 * ```typescript
 * const model = createModel({ email: '' });
 * const field = new FieldNode({ valueSignal: model.$.email, component: Input });
 *
 * field.setValue('test@mail.com');
 * model.email; // 'test@mail.com'
 * field.setErrors([{ code: 'taken', message: 'Занято' }]);
 * field.valid.value; // false
 * ```
 */
export class FieldNode<T> extends FormNode<T> {
  // ============================================================================
  // Приватные сигналы
  // ============================================================================

  private _value: Signal<T>;
  private _errors: Signal<ValidationError[]>;
  // _touched, _dirty наследуются от FormNode (protected)
  // _status управляется через statusMachine
  private _componentProps: Signal<Record<string, unknown>>;

  /**
   * State machine для управления статусом поля
   * Централизует логику переходов между valid/invalid/pending/disabled
   */
  private readonly statusMachine: FormStatusMachine;

  // ============================================================================
  // Публичные computed signals
  // ============================================================================

  public readonly value: ReadonlySignal<T>;
  // valid, invalid, pending, status, disabled берутся из statusMachine
  public readonly valid: ReadonlySignal<boolean>;
  public readonly invalid: ReadonlySignal<boolean>;
  public readonly pending: ReadonlySignal<boolean>;
  // Override status и disabled из базового класса
  public override readonly status: ReadonlySignal<FieldStatus>;
  public override readonly disabled: ReadonlySignal<boolean>;
  // touched, dirty наследуются от FormNode
  public readonly errors: ReadonlySignal<ValidationError[]>;
  public readonly componentProps: ReadonlySignal<Record<string, unknown>>;

  /**
   * Вычисляемое свойство: нужно ли показывать ошибку
   * Ошибка показывается если поле невалидно И (touched ИЛИ dirty)
   */
  public readonly shouldShowError: ReadonlySignal<boolean>;

  // ============================================================================
  // Конфигурация
  // ============================================================================

  /**
   * Значение, с которым создана нода, — к нему возвращает {@link FieldNode.reset} без аргумента.
   * Это не точка отсчёта модели: `model.captureInitial()` его не меняет.
   */
  private readonly defaultValue: T;

  /** Сколько прогонов валидации сейчас ждут async-правила этого поля. */
  private pendingRuns = 0;

  public readonly component: FieldConfig<T>['component'];

  // ============================================================================
  // Конструктор
  // ============================================================================

  constructor(config: FieldConfig<T>) {
    super();

    this.component = config.component;

    // Нода не владеет значением: источник истины — сигнал модели.
    this._value = config.valueSignal;
    // Снимок значения на момент построения — к нему возвращает reset() без аргумента.
    this.defaultValue = this._value.peek();
    this._errors = signal<ValidationError[]>([]);
    // _touched, _dirty инициализируются в FormNode
    this._componentProps = signal(config.componentProps || {});

    // Инициализация state machine для управления статусом
    // Начальный статус: disabled если config.disabled, иначе valid
    this.statusMachine = new FormStatusMachine(config.disabled ? 'disabled' : 'valid');

    // Создание computed signals
    this.value = computed(() => this._value.value);
    // Статусные signals - создаём computed мосты к statusMachine
    // для избежания потенциальных циклических зависимостей
    this.valid = computed(() => this.statusMachine.valid.value);
    this.invalid = computed(() => this.statusMachine.invalid.value);
    this.pending = computed(() => this.statusMachine.pending.value);
    this.status = computed(() => this.statusMachine.status.value);
    this.disabled = computed(() => this.statusMachine.disabled.value);
    // touched, dirty создаются в FormNode
    this.errors = computed(() => this._errors.value);
    this.componentProps = computed(() => this._componentProps.value);
    this.shouldShowError = computed(
      () => this.statusMachine.invalid.value && (this._touched.value || this._dirty.value)
    );
  }

  // ============================================================================
  // Реализация абстрактных методов FormNode
  // ============================================================================

  getValue(): T {
    return this._value.peek();
  }

  setValue(value: T): void {
    this._value.value = value;
    this._dirty.value = true;
  }

  patchValue(value: Partial<T>): void {
    this.setValue(value as T);
  }

  /**
   * Сбросить поле: значение, ошибки и флаги touched / dirty.
   *
   * Без аргумента значение возвращается к тому, с которым нода создана. Это значение формы «с
   * чистого листа», а не точка отсчёта модели: после загрузки данных и `model.captureInitial()`
   * к загруженным значениям возвращает `model.reset()`, а не этот метод.
   *
   * @param value - значение для сброса; не задано — значение, с которым создана нода
   *
   * @example
   * ```typescript
   * const model = createModel({ name: 'initial' });
   * const field = new FieldNode({ valueSignal: model.$.name });
   *
   * field.setValue('changed');
   * field.reset('temp value'); // 'temp value'
   * field.reset(); // 'initial'
   * ```
   */
  reset(value?: T): void {
    this._value.value = value !== undefined ? value : this.defaultValue;
    this._errors.value = [];
    this._touched.value = false;
    this._dirty.value = false;
    this.syncStatus();
  }

  /**
   * Текущая валидность поля.
   *
   * Правил нода не исполняет: метод отражает ошибки, которые разнёс раннер схемы валидации
   * (`validateModel` из `@reformer/core/validation`), и ничего не стирает.
   *
   * @returns `true`, если у поля нет блокирующих ошибок (`severity: 'warning'` не блокирует)
   */
  validate(): Promise<boolean> {
    return Promise.resolve(!this.hasBlockingErrors());
  }

  setErrors(errors: ValidationError[]): void {
    this._errors.value = errors;
    this.syncStatus();
  }

  clearErrors(): void {
    this._errors.value = [];
    this.syncStatus();
  }

  /**
   * Отметить, что у поля идёт проверка: раннер схемы валидации зовёт метод парой на время
   * async-правил. Вызовы считаются — поле остаётся в `pending`, пока идёт хотя бы один прогон
   * (устаревший прогон снимает только свою отметку).
   */
  override setPending(pending: boolean): void {
    this.pendingRuns = Math.max(0, this.pendingRuns + (pending ? 1 : -1));
    this.syncStatus();
  }

  /** Есть ли у поля блокирующие ошибки (`severity: 'warning'` не блокирует). */
  private hasBlockingErrors(): boolean {
    return this._errors.peek().some((error) => error.severity !== 'warning');
  }

  /**
   * Привести статус к состоянию поля: идёт проверка — `pending`, иначе по ошибкам. Отключённое
   * поле статус не меняет — его определит `enable()`.
   */
  private syncStatus(): void {
    if (this.pendingRuns > 0) this.statusMachine.startValidation();
    else this.statusMachine.setErrors(this.hasBlockingErrors());
  }

  // ============================================================================
  // Protected hooks (Template Method pattern)
  // ============================================================================

  /**
   * Hook: вызывается после disable()
   *
   * Для FieldNode: синхронизируем statusMachine и очищаем ошибки
   */
  protected onDisable(): void {
    this.statusMachine.disable();
    this._errors.value = [];
  }

  /**
   * Hook: вызывается после enable()
   *
   * Для FieldNode: синхронизируем statusMachine — статус определяют текущие ошибки
   */
  protected onEnable(): void {
    this.statusMachine.enable(this.hasBlockingErrors());
    this.syncStatus();
  }

  /**
   * Обновляет свойства компонента (например, опции для Select)
   *
   * @example
   * ```typescript
   * // Обновление опций для Select после загрузки справочников
   * form.registrationAddress.city.updateComponentProps({
   *   options: cities
   * });
   * ```
   */
  updateComponentProps(props: Partial<Record<string, unknown>>): void {
    this._componentProps.value = {
      ...this._componentProps.value,
      ...props,
    };
  }
}
