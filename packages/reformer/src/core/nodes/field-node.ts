/**
 * FieldNode - узел поля формы
 *
 * Представляет одно поле формы с валидацией и состоянием
 * Наследует от FormNode и реализует все его абстрактные методы
 *
 * @group Nodes
 */

import { signal, computed, effect } from '@preact/signals-core';
import type { Signal, ReadonlySignal } from '@preact/signals-core';
import { FormNode } from './form-node';
import type { SetValueOptions } from './form-node';
import type {
  FieldConfig,
  FieldStatus,
  ValidationError,
  ValidatorFn,
  AsyncValidatorFn,
} from '../types';
import { SubscriptionManager } from '../utils/subscription-manager';
import { uniqueId, SubscriptionKey } from '../utils/unique-id';
import { FormErrorHandler, ErrorStrategy } from '../utils/error-handler';
import { FormStatusMachine } from '../utils/status-machine';

/**
 * FieldNode - узел для отдельного поля формы
 *
 * @group Nodes
 *
 * @example
 * ```typescript
 * const field = new FieldNode({
 *   value: '',
 *   component: Input,
 *   validators: [required, email],
 * });
 *
 * field.setValue('test@mail.com');
 * await field.validate();
 * console.log(field.valid.value); // true
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

  private validators: ValidatorFn<T>[];
  private asyncValidators: AsyncValidatorFn<T>[];
  private updateOn: 'change' | 'blur' | 'submit';
  private initialValue: T;
  private currentAbortController?: AbortController;
  private debounceMs: number;
  private validateDebounceTimer?: ReturnType<typeof setTimeout>;
  /**
   * Pending debounced validation state
   * Contains resolve function and AbortController for cancellation
   */
  private pendingValidation?: {
    resolve: (value: boolean) => void;
    abortController: AbortController;
  };

  /**
   * Менеджер подписок для централизованного cleanup
   * Использует SubscriptionManager вместо массива для управления подписками
   */
  private disposers = new SubscriptionManager();

  public readonly component: FieldConfig<T>['component'];

  // ============================================================================
  // Конструктор
  // ============================================================================

  constructor(config: FieldConfig<T>) {
    super();

    // Сохраняем конфигурацию
    this.validators = config.validators || [];
    this.asyncValidators = config.asyncValidators || [];
    this.updateOn = config.updateOn || 'blur';
    this.debounceMs = config.debounce || 0;
    this.component = config.component;

    // Инициализация приватных сигналов.
    // M1: если передан valueSignal (из FormModel) — используем его как источник истины значения
    // (нода НЕ владеет значением, а ссылается на сигнал модели). Иначе создаём собственный сигнал
    // из литерала config.value (legacy-путь). FieldConfig.value имеет тип T | null, но FieldNode
    // всегда работает с T; null трактуется как начальное значение типа T.
    this._value = config.valueSignal ?? signal(config.value as T);
    // initialValue — снимок значения на момент построения (для reset/resetToInitial)
    this.initialValue = this._value.peek();
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

  setValue(value: T, options?: SetValueOptions): void {
    this._value.value = value;
    this._dirty.value = true;

    if (options?.emitEvent === false) {
      return;
    }

    const hasOwnValidators = this.validators.length > 0 || this.asyncValidators.length > 0;
    const hasErrors = this._errors.value.length > 0;

    // 1. Если updateOn === 'change' → всегда валидируем
    if (this.updateOn === 'change') {
      this.validate();
      return;
    }

    // 2. Если updateOn === 'blur' или 'submit':
    //    Валидируем только если у поля есть ошибки и собственные валидаторы
    //    Это позволяет скрывать ошибку при исправлении значения
    //    Поведение:
    //    - Если значение некорректно → обновляем/показываем ошибку
    //    - Если значение корректно → скрываем ошибку
    //    Но первая валидация произойдет только при blur/submit
    if (hasErrors && hasOwnValidators) {
      this.validate();
    }
  }

  patchValue(value: Partial<T>): void {
    this.setValue(value as T);
  }

  /**
   * Сбросить поле к указанному значению (или к initialValue)
   *
   * @param value - опциональное значение для сброса. Если не указано, используется initialValue
   *
   * @remarks
   * Этот метод:
   * - Устанавливает значение в value или initialValue
   * - Очищает ошибки валидации
   * - Сбрасывает touched/dirty флаги
   * - Устанавливает статус в 'valid'
   *
   * Если вам нужно сбросить к исходному значению, используйте resetToInitial()
   *
   * @example
   * ```typescript
   * // Сброс к initialValue
   * field.reset();
   *
   * // Сброс к новому значению
   * field.reset('new value');
   * ```
   */
  reset(value?: T): void {
    this._value.value = value !== undefined ? value : this.initialValue;
    this._errors.value = [];
    this._touched.value = false;
    this._dirty.value = false;
    // Сбрасываем статус через statusMachine
    this.statusMachine.setErrors(false);
  }

  /**
   * Сбросить поле к исходному значению (initialValue)
   *
   * @remarks
   * Алиас для reset() без параметров, но более явный:
   * - resetToInitial() - явно показывает намерение вернуться к начальному значению
   * - reset() - может принимать новое значение
   *
   * Полезно когда:
   * - Пользователь нажал "Cancel" - вернуть форму в исходное состояние
   * - Форма была изменена через reset(newValue), но нужно вернуться к самому началу
   * - Явное намерение показать "отмену всех изменений"
   *
   * @example
   * ```typescript
   * const field = new FieldNode({ value: 'initial', component: Input });
   *
   * field.setValue('changed');
   * field.reset('temp value');
   * console.log(field.value.value); // 'temp value'
   *
   * field.resetToInitial();
   * console.log(field.value.value); // 'initial'
   * ```
   */
  resetToInitial(): void {
    this.reset(this.initialValue);
  }

  /**
   * Cancel any pending validation (debounced or running)
   * @private
   * @remarks
   * Centralizes all cancellation logic:
   * - Aborts pending debounced validation and resolves its promise
   * - Clears debounce timer
   * - Aborts currently running async validation
   */
  private cancelPendingValidation(): void {
    // Cancel pending debounced validation
    if (this.pendingValidation) {
      this.pendingValidation.abortController.abort();
      this.pendingValidation.resolve(false);
      this.pendingValidation = undefined;
    }

    // Clear debounce timer
    if (this.validateDebounceTimer) {
      clearTimeout(this.validateDebounceTimer);
      this.validateDebounceTimer = undefined;
    }

    // Abort currently running validation
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = undefined;
    }
  }

  /**
   * Запустить валидацию поля
   * @param options - опции валидации
   * @returns `Promise<boolean>` - true если поле валидно
   *
   * @remarks
   * Метод защищен от race conditions через AbortController.
   * При быстром вводе только последняя валидация применяет результаты.
   *
   * @example
   * ```typescript
   * // Обычная валидация
   * await field.validate();
   *
   * // С debounce
   * await field.validate({ debounce: 300 });
   * ```
   */
  async validate(options?: { debounce?: number }): Promise<boolean> {
    const debounceMs = options?.debounce ?? this.debounceMs;

    // Cancel any pending validation first
    this.cancelPendingValidation();

    // Without debounce - run immediately
    if (debounceMs <= 0 || this.asyncValidators.length === 0) {
      return this.validateImmediate();
    }

    // With debounce - create AbortController for this validation
    const abortController = new AbortController();

    return new Promise<boolean>((resolve) => {
      // Save pending state for cancellation
      this.pendingValidation = { resolve, abortController };

      this.validateDebounceTimer = setTimeout(async () => {
        this.validateDebounceTimer = undefined;

        // Check if this validation was cancelled
        if (abortController.signal.aborted) {
          resolve(false);
          return;
        }

        // Clear pending state before running
        this.pendingValidation = undefined;

        // Pass abortController to validateImmediate
        const result = await this.validateImmediate(abortController);
        resolve(result);
      }, debounceMs);

      // Listen for abort to resolve early
      abortController.signal.addEventListener(
        'abort',
        () => {
          if (this.validateDebounceTimer) {
            clearTimeout(this.validateDebounceTimer);
            this.validateDebounceTimer = undefined;
          }
          resolve(false);
        },
        { once: true }
      );
    });
  }

  /**
   * Немедленная валидация без debounce
   * @private
   * @param providedController - AbortController from debounced validate()
   * @remarks
   * Защищена от race conditions через AbortController:
   * - Отменяет предыдущую валидацию при запуске новой (if no controller provided)
   * - Передаёт AbortSignal в async валидаторы для отмены операций (например, fetch)
   * - Проверяет signal.aborted в ключевых точках
   */
  private async validateImmediate(providedController?: AbortController): Promise<boolean> {
    // Use provided controller or create a new one
    const abortController = providedController ?? new AbortController();

    // Abort previous validation only if no controller was provided
    // (i.e., called directly without debounce)
    if (!providedController) {
      this.currentAbortController?.abort();
    }

    this.currentAbortController = abortController;
    const { signal } = abortController;

    // Синхронная валидация
    const syncErrors: ValidationError[] = [];
    for (const validator of this.validators) {
      const error = validator(this._value.value);
      if (error) syncErrors.push(error);
    }

    // Проверка abort после синхронной валидации
    if (signal.aborted) {
      return false;
    }

    if (syncErrors.length > 0) {
      this._errors.value = syncErrors;
      // Only blocking errors (not warnings) affect validity
      const hasBlockingErrors = syncErrors.some((e) => e.severity !== 'warning');
      this.statusMachine.setErrors(hasBlockingErrors);
      if (hasBlockingErrors) {
        return false;
      }
    }

    // Асинхронная валидация - ПАРАЛЛЕЛЬНО с поддержкой отмены
    if (this.asyncValidators.length > 0) {
      if (signal.aborted) {
        return false;
      }

      // Начинаем асинхронную валидацию через statusMachine
      this.statusMachine.startValidation();

      try {
        // Выполняем все async валидаторы параллельно
        // Передаём signal для возможности отмены (если валидатор поддерживает)
        const asyncResults = await Promise.all(
          this.asyncValidators.map(async (validator) => {
            // Проверка abort перед каждым валидатором
            if (signal.aborted) {
              throw new DOMException('Validation aborted', 'AbortError');
            }

            try {
              // Передаём signal в валидатор (опционально)
              const result = await validator(this._value.value, { signal });

              // Проверка abort после выполнения
              if (signal.aborted) {
                throw new DOMException('Validation aborted', 'AbortError');
              }

              return result;
            } catch (error) {
              // Пробрасываем AbortError
              if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
              }
              // Используем централизованный обработчик ошибок
              return FormErrorHandler.handle(
                error,
                'FieldNode AsyncValidator',
                ErrorStrategy.CONVERT
              );
            }
          })
        );

        // Проверка abort после Promise.all
        if (signal.aborted) {
          return false;
        }

        const asyncErrors = asyncResults.filter(Boolean) as ValidationError[];
        if (asyncErrors.length > 0) {
          this._errors.value = asyncErrors;
          // Only blocking errors (not warnings) affect validity
          const hasBlockingErrors = asyncErrors.some((e) => e.severity !== 'warning');
          this.statusMachine.completeValidation(hasBlockingErrors);
          // Return valid if only warnings
          if (hasBlockingErrors) {
            return false;
          }
        }
      } catch (error) {
        // Валидация была отменена - это нормально
        if (error instanceof DOMException && error.name === 'AbortError') {
          return false;
        }
        throw error;
      }
    }

    // Финальная проверка abort
    if (signal.aborted) {
      return false;
    }

    // Очищаем ошибки только если у поля есть собственные валидаторы
    // Если валидаторов нет, значит используется ValidationSchema на уровне формы
    // и ошибки устанавливаются извне через setErrors()
    const hasOwnValidators = this.validators.length > 0 || this.asyncValidators.length > 0;

    if (hasOwnValidators) {
      this._errors.value = [];
      // Завершаем валидацию успешно
      this.statusMachine.completeValidation(false);
    }

    // Return valid if no blocking errors (warnings don't block)
    return !this._errors.value.some((e) => e.severity !== 'warning');
  }

  setErrors(errors: ValidationError[]): void {
    this._errors.value = errors;
    // Only blocking errors (not warnings) affect validity
    const hasBlockingErrors = errors.some((e) => e.severity !== 'warning');
    this.statusMachine.setErrors(hasBlockingErrors);
  }

  clearErrors(): void {
    this._errors.value = [];
    this.statusMachine.setErrors(false);
  }

  // ============================================================================
  // Protected hooks (Template Method pattern)
  // ============================================================================

  /**
   * Hook: вызывается после markAsTouched()
   *
   * Для FieldNode: если updateOn === 'blur', запускаем валидацию
   */
  protected onMarkAsTouched(): void {
    if (this.updateOn === 'blur') {
      this.validate();
    }
  }

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
   * Для FieldNode: синхронизируем statusMachine и запускаем валидацию
   */
  protected onEnable(): void {
    // enable() определит статус (valid/invalid) на основе ошибок после валидации
    this.statusMachine.enable(this._errors.value.length > 0);
    this.validate();
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

  /**
   * Динамически изменяет триггер валидации (updateOn)
   * Полезно для адаптивной валидации - например, переключиться на instant feedback после первого submit
   *
   * @param updateOn - новый триггер валидации: 'change' | 'blur' | 'submit'
   *
   * @example
   * ```typescript
   * // Сценарий 1: Instant feedback после submit
   * const form = createForm({
   *   email: {
   *     value: '',
   *     component: Input,
   *     updateOn: 'submit', // Изначально валидация только при submit
   *     validators: [required, email],
   *   },
   * });
   *
   * await form.submit(async (values) => {
   *   // После submit переключаем на instant feedback
   *   form.email.setUpdateOn('change');
   *   await api.save(values);
   * });
   *
   * // Теперь валидация происходит при каждом изменении
   *
   * // Сценарий 2: Прогрессивное улучшение
   * form.email.setUpdateOn('blur');  // Сначала только при blur
   * // ... пользователь начинает вводить ...
   * form.email.setUpdateOn('change'); // Переключаем на change для real-time feedback
   * ```
   */
  setUpdateOn(updateOn: 'change' | 'blur' | 'submit'): void {
    this.updateOn = updateOn;
  }

  getUpdateOn(): 'change' | 'blur' | 'submit' {
    return this.updateOn;
  }

  // ============================================================================
  // Методы-помощники для реактивности (Фаза 1)
  // ============================================================================

  /**
   * Подписка на изменения значения поля
   * Автоматически отслеживает изменения через @preact/signals effect
   *
   * @param callback - Функция, вызываемая при изменении значения.
   *   Для async операций передается AbortSignal во втором параметре.
   * @returns Функция отписки для cleanup
   *
   * @example
   * ```typescript
   * // Синхронный callback
   * const unsubscribe = form.email.watch((value) => {
   *   console.log('Email changed:', value);
   * });
   *
   * // Асинхронный callback с поддержкой отмены
   * const unsubscribe = form.email.watch(async (value, signal) => {
   *   const result = await fetch('/api/validate', { signal });
   *   // ...
   * });
   *
   * // Cleanup
   * useEffect(() => unsubscribe, []);
   * ```
   */
  watch(callback: (value: T, signal: AbortSignal) => void | Promise<void>): () => void {
    // AbortController для отмены async операций при dispose
    const abortController = new AbortController();

    const dispose = effect(() => {
      const currentValue = this.value.value; // track changes
      callback(currentValue, abortController.signal);
    });

    // Регистрируем через SubscriptionManager и возвращаем unsubscribe
    const key = uniqueId(SubscriptionKey.Watch);
    return this.disposers.add(key, () => {
      // Отменяем async операции перед dispose
      abortController.abort();
      dispose();
    });
  }

  /**
   * Вычисляемое значение из других полей
   * Автоматически обновляет текущее поле при изменении источников
   *
   * @param sources - Массив ReadonlySignal для отслеживания
   * @param computeFn - Функция вычисления нового значения
   * @returns Функция отписки для cleanup
   *
   * @example
   * ```typescript
   * // Автоматический расчет первоначального взноса (20% от стоимости)
   * const dispose = form.initialPayment.computeFrom(
   *   [form.propertyValue.value],
   *   (propertyValue) => {
   *     return propertyValue ? propertyValue * 0.2 : null;
   *   }
   * );
   *
   * // Cleanup
   * useEffect(() => dispose, []);
   * ```
   */
  computeFrom<TSource extends readonly unknown[]>(
    sources: ReadonlySignal<TSource[number]>[],
    computeFn: (...values: TSource) => T
  ): () => void {
    const dispose = effect(() => {
      // Читаем все источники для отслеживания
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceValues = sources.map((source) => source.value) as any as TSource;

      // Вычисляем новое значение
      const newValue = computeFn(...sourceValues);

      // Устанавливаем значение без триггера событий (избегаем циклов)
      this.setValue(newValue, { emitEvent: false });
    });

    // Регистрируем через SubscriptionManager и возвращаем unsubscribe
    const key = uniqueId(SubscriptionKey.ComputeFrom);
    return this.disposers.add(key, dispose);
  }

  /**
   * Очистить все ресурсы и таймеры
   * Должен вызываться при unmount компонента
   *
   * @remarks
   * Освобождает все ресурсы:
   * - Отписывает все subscriptions через SubscriptionManager
   * - Отменяет pending/running валидации через cancelPendingValidation()
   *
   * Использует try-finally для гарантированного cleanup даже при ошибках.
   *
   * @example
   * ```typescript
   * useEffect(() => {
   *   return () => {
   *     field.dispose();
   *   };
   * }, []);
   * ```
   */
  dispose(): void {
    try {
      // Очищаем все subscriptions через SubscriptionManager
      this.disposers.dispose();
    } finally {
      // Cancel all pending validations (debounced and running)
      // Guaranteed to run even if disposers.dispose() throws
      this.cancelPendingValidation();
    }
  }
}
