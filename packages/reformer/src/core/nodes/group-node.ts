/**
 * GroupNode - узел группы полей формы
 *
 * Представляет группу полей (объект), где каждое поле может быть:
 * - FieldNode (простое поле)
 * - GroupNode (вложенная группа)
 * - ArrayNode (массив форм)
 *
 * Наследует от FormNode и реализует все его абстрактные методы
 *
 * @group Nodes
 */

import { signal, computed, effect, batch } from '@preact/signals-core';
import type { Signal, ReadonlySignal } from '@preact/signals-core';
import { FormNode, type SetValueOptions } from './form-node';
import type {
  ValidationError,
  FieldStatus,
  ValidationSchemaFn,
  ValidatorRegistration,
  FormSchema,
  GroupNodeConfig,
  FormValue,
  ArrayNodeLike,
} from '../types';
import type { FormProxy } from '../types/form-proxy';
import { createFieldPath } from '../validation';
import { uniqueId, SubscriptionKey } from '../utils/unique-id';
import { ValidationApplicator } from '../validation/validation-applicator';
import type { BehaviorSchemaFn } from '../behavior/types';
import { BehaviorRegistry } from '../behavior/behavior-registry';
import { FieldPathNavigator } from '../utils/field-path-navigator';
import { NodeFactory } from '../factories/node-factory';
import { SubscriptionManager } from '../utils/subscription-manager';
import { ValidationRegistry } from '../validation/validation-registry';
import { createAggregateSignals } from '../utils/aggregate-signals';
import { buildFormProxy } from '../utils/form-proxy-builder';
import { FormSubmitter, type SubmitOptions, type SubmitResult } from '../utils/form-submitter';

/**
 * GroupNode - узел для группы полей
 *
 * Поддерживает два API:
 * 1. Старый API (только schema) - обратная совместимость
 * 2. Новый API (config с form, behavior, validation) - автоматическое применение схем
 *
 * @group Nodes
 *
 * @example
 * ```typescript
 * // 1. Старый способ (обратная совместимость)
 * const simpleForm = new GroupNode({
 *   email: { value: '', component: Input },
 *   password: { value: '', component: Input },
 * });
 *
 * // 2. Новый способ (с behavior и validation схемами)
 * const fullForm = new GroupNode({
 *   form: {
 *     email: { value: '', component: Input },
 *     password: { value: '', component: Input },
 *   },
 *   behavior: (path) => {
 *     computeFrom(path.email, [path.email], (values) => values[0]?.trim());
 *   },
 *   validation: (path) => {
 *     required(path.email, { message: 'Email обязателен' });
 *     email(path.email);
 *     required(path.password);
 *     minLength(path.password, 8);
 *   },
 * });
 *
 * // Прямой доступ к полям через Proxy
 * fullForm.email.setValue('test@mail.com');
 * await fullForm.validate();
 * console.log(fullForm.valid.value); // true
 * ```
 */
export class GroupNode<T> extends FormNode<T> {
  // ============================================================================
  // Приватные поля
  // ============================================================================
  public id = crypto.randomUUID();

  /**
   * Коллекция полей формы (упрощённый Map вместо FieldRegistry)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _fields = new Map<keyof T, FormNode<any>>();

  /**
   * Менеджер подписок для централизованного cleanup
   */
  private disposers = new SubscriptionManager();

  /**
   * Ссылка на Proxy-инстанс для использования в BehaviorContext
   */
  private _proxyInstance?: FormProxy<T>;

  /**
   * Навигатор для работы с путями к полям
   */
  private readonly pathNavigator = new FieldPathNavigator();

  /**
   * Фабрика для создания узлов формы
   */
  private readonly nodeFactory = new NodeFactory();

  /**
   * Реестр валидаторов для этой формы
   * Может быть инжектирован через config._validationRegistry для тестирования
   */
  private readonly validationRegistry: ValidationRegistry;

  /**
   * Реестр behaviors для этой формы
   * Может быть инжектирован через config._behaviorRegistry для тестирования
   */
  private readonly behaviorRegistry: BehaviorRegistry;

  /**
   * Аппликатор для применения валидаторов к форме
   */
  private readonly validationApplicator = new ValidationApplicator(this);

  // ============================================================================
  // Приватные сигналы состояния (inline из StateManager)
  // ============================================================================

  /** Управление отправкой формы */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly formSubmitter: FormSubmitter<any>;

  /** Флаг disabled состояния */
  private readonly _disabled: Signal<boolean> = signal(false);

  /** Form-level validation errors */
  private readonly _formErrors: Signal<ValidationError[]> = signal<ValidationError[]>([]);

  // ============================================================================
  // Публичные computed signals
  // ============================================================================

  public readonly value: ReadonlySignal<T>;
  public readonly valid: ReadonlySignal<boolean>;
  public readonly invalid: ReadonlySignal<boolean>;
  public readonly touched: ReadonlySignal<boolean>;
  public readonly dirty: ReadonlySignal<boolean>;
  public readonly pending: ReadonlySignal<boolean>;
  public readonly errors: ReadonlySignal<ValidationError[]>;
  public readonly status: ReadonlySignal<FieldStatus>;
  public readonly submitting: ReadonlySignal<boolean>;

  // ============================================================================
  // Конструктор с перегрузками
  // ============================================================================

  /**
   * Создать GroupNode только со схемой формы (обратная совместимость)
   */
  constructor(schema: FormSchema<T>);

  /**
   * Создать GroupNode с полной конфигурацией (form, behavior, validation)
   */
  constructor(config: GroupNodeConfig<T>);

  constructor(schemaOrConfig: FormSchema<T> | GroupNodeConfig<T>) {
    super();

    // Инициализация FormSubmitter (должна быть первой, т.к. submitting сигнал используется ниже)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.formSubmitter = new FormSubmitter(this as any);

    // Определяем, что передано: schema или config
    const isConfig = 'form' in schemaOrConfig;
    const config = isConfig ? (schemaOrConfig as GroupNodeConfig<T>) : undefined;
    const formSchema = isConfig
      ? (schemaOrConfig as GroupNodeConfig<T>).form
      : (schemaOrConfig as FormSchema<T>);
    const behaviorSchema = isConfig ? (schemaOrConfig as GroupNodeConfig<T>).behavior : undefined;
    const validationSchema = isConfig
      ? (schemaOrConfig as GroupNodeConfig<T>).validation
      : undefined;

    // Инициализация реестров (с поддержкой DI для тестирования)
    this.validationRegistry =
      (config?._validationRegistry as ValidationRegistry) ?? new ValidationRegistry();
    this.behaviorRegistry =
      (config?._behaviorRegistry as BehaviorRegistry) ?? new BehaviorRegistry();

    // Создать поля из схемы с поддержкой вложенности
    for (const [key, fieldConfig] of Object.entries(formSchema)) {
      const node = this.createNode(fieldConfig);
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
      ownErrors: this._formErrors,
      disabled: this._disabled,
    });

    this.valid = aggregateSignals.valid;
    this.invalid = aggregateSignals.invalid;
    this.pending = aggregateSignals.pending;
    this.touched = aggregateSignals.touched;
    this.dirty = aggregateSignals.dirty;
    this.errors = aggregateSignals.errors;
    this.status = aggregateSignals.status;

    // Делегирование submitting к FormSubmitter
    this.submitting = this.formSubmitter.submitting;

    // ========================================================================
    // Lazy Proxy Initialization
    // ========================================================================
    // Proxy создаётся лениво при первом вызове getProxy()
    // Это улучшает производительность для форм, где proxy не используется напрямую

    // Применяем схемы, если они переданы (новый API)
    if (behaviorSchema) {
      this.applyBehaviorSchema(behaviorSchema);
    }
    if (validationSchema) {
      this.applyValidationSchema(validationSchema);
    }

    // Конструктор возвращает this (стандартное поведение)
    // Для Proxy-доступа к полям используйте createForm() или getProxy()
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

  setValue(value: T, options?: SetValueOptions): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [key, fieldValue] of Object.entries(value as any)) {
      const field = this._fields.get(key as keyof T);
      if (field) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field.setValue(fieldValue as any, options);
      }
    }
  }

  patchValue(value: Partial<T>): void {
    // Используем batch чтобы все обновления происходили атомарно
    // emitEvent: false предотвращает N валидаций при обновлении N полей
    // Валидация НЕ запускается автоматически - вызовите validate() если нужно
    batch(() => {
      for (const [key, fieldValue] of Object.entries(value)) {
        const field = this._fields.get(key as keyof T);
        if (field && fieldValue !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          field.setValue(fieldValue as any, { emitEvent: false });
        }
      }
    });
  }

  /**
   * Сбросить форму к указанным значениям (или к initialValues)
   *
   * @param value - опциональный объект со значениями для сброса
   *
   * @remarks
   * Рекурсивно вызывает reset() для всех полей формы
   *
   * @example
   * ```typescript
   * // Сброс к initialValues
   * form.reset();
   *
   * // Сброс к новым значениям
   * form.reset({ email: 'new@mail.com', password: '' });
   * ```
   */
  reset(value?: T): void {
    this._fields.forEach((field, key) => {
      const resetValue = value?.[key];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field.reset(resetValue as any);
    });
  }

  /**
   * Сбросить форму к исходным значениям (initialValues)
   */
  resetToInitial(): void {
    this._fields.forEach((field) => {
      if ('resetToInitial' in field && typeof field.resetToInitial === 'function') {
        field.resetToInitial();
      } else {
        field.reset();
      }
    });
  }

  async validate(): Promise<boolean> {
    // Очищаем ошибки перед валидацией
    this.clearErrors();

    // Валидация всех полей
    await Promise.all(Array.from(this._fields.values()).map((field) => field.validate()));

    // Применение contextual валидаторов из validation schema
    const validators = this.validationRegistry.getValidators();
    if (validators && validators.length > 0) {
      await this.applyContextualValidators(validators);
    }

    // Проверяем, все ли поля валидны
    return Array.from(this._fields.values()).every(
      (field) => field.valid.value || field.disabled.value
    );
  }

  /**
   * Установить form-level validation errors
   */
  setErrors(errors: ValidationError[]): void {
    this._formErrors.value = errors;
  }

  /**
   * Очистить все errors (form-level + field-level)
   */
  clearErrors(): void {
    this._formErrors.value = [];
    this._fields.forEach((field) => field.clearErrors());
  }

  /**
   * Получить поле по ключу
   */
  getField<K extends keyof T>(key: K): FormNode<T[K]> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this._fields.get(key) as any;
  }

  /**
   * Получить Map всех полей формы (для совместимости)
   */
  get fields(): Map<keyof T, FormNode<FormValue>> {
    return this._fields;
  }

  /**
   * Получить Proxy-инстанс для прямого доступа к полям
   *
   * Proxy позволяет обращаться к полям формы напрямую через точечную нотацию:
   * - form.email вместо form.fields.get('email')
   * - form.address.city вместо form.fields.get('address').fields.get('city')
   *
   * Используется в:
   * - BehaviorApplicator для доступа к полям в behavior functions
   * - ValidationApplicator для доступа к форме в tree validators
   *
   * @returns Proxy-инстанс с типобезопасным доступом к полям или сама форма, если proxy не доступен
   *
   * @example
   * ```typescript
   * const form = new GroupNode({
   *   controls: {
   *     email: new FieldNode({ value: '' }),
   *     name: new FieldNode({ value: '' })
   *   }
   * });
   *
   * const proxy = form.getProxy();
   * console.log(proxy.email.value); // Прямой доступ к полю
   * ```
   */
  getProxy(): FormProxy<T> {
    // Lazy initialization: создаём proxy только при первом обращении
    if (!this._proxyInstance) {
      this._proxyInstance = this.buildProxy();
    }
    return this._proxyInstance;
  }

  /**
   * Получить все поля формы как итератор
   */
  getAllFields(): IterableIterator<FormNode<FormValue>> {
    return this._fields.values();
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

  // ============================================================================
  // Дополнительные методы (из FormStore)
  // ============================================================================

  /**
   * Отправить форму
   *
   * @param onSubmit - Callback для отправки данных
   * @param options - Опции submit (skipValidation, skipTouch)
   * @returns Результат от onSubmit или null если валидация не пройдена
   */
  async submit<R>(
    onSubmit: (values: T) => Promise<R> | R,
    options?: SubmitOptions
  ): Promise<R | null> {
    return this.formSubmitter.submit(onSubmit, options);
  }

  /**
   * Отправить форму с расширенным результатом
   *
   * @param onSubmit - Callback для отправки данных
   * @param options - Опции submit
   * @returns Объект SubmitResult с данными, статусом и возможной ошибкой
   */
  async submitWithResult<R>(
    onSubmit: (values: T) => Promise<R> | R,
    options?: SubmitOptions
  ): Promise<SubmitResult<R>> {
    return this.formSubmitter.submitWithResult(onSubmit, options);
  }

  /**
   * Применить validation schema к форме
   *
   * Использует локальный реестр валидаторов (this.validationRegistry)
   * вместо глобального Singleton для изоляции форм друг от друга.
   */
  applyValidationSchema(schemaFn: ValidationSchemaFn<T>): void {
    this.validationRegistry.beginRegistration();

    try {
      const path = createFieldPath<T>();
      schemaFn(path);
      //  Используем публичный метод getProxy() для получения proxy-инстанса
      const formToUse = this.getProxy();
      this.validationRegistry.endRegistration(formToUse);
    } catch (error) {
      console.error('Error applying validation schema:', error);
      throw error;
    }
  }

  /**
   * Применить behavior schema к форме
   * @returns Функция cleanup для отписки от всех behaviors
   */
  applyBehaviorSchema(schemaFn: BehaviorSchemaFn<T>): () => void {
    this.behaviorRegistry.beginRegistration();

    try {
      const path = createFieldPath<T>();
      schemaFn(path);
      const result = this.behaviorRegistry.endRegistration(this.getProxy());
      return result.cleanup;
    } catch (error) {
      console.error('Error applying behavior schema:', error);
      throw error;
    }
  }

  /**
   * Получить вложенное поле по пути
   *
   * Поддерживаемые форматы путей:
   * - Simple: "email" - получить поле верхнего уровня
   * - Nested: "address.city" - получить вложенное поле
   * - Array index: "items[0]" - получить элемент массива по индексу
   * - Combined: "items[0].name" - получить поле элемента массива
   *
   * @param path - Путь к полю
   * @returns FormNode если найдено, undefined если путь не существует
   *
   * @example
   * ```typescript
   * const form = new GroupNode({
   *   email: { value: '', component: Input },
   *   address: {
   *     city: { value: '', component: Input }
   *   },
   *   items: [{ name: { value: '', component: Input } }]
   * });
   *
   * form.getFieldByPath('email');           // FieldNode
   * form.getFieldByPath('address.city');    // FieldNode
   * form.getFieldByPath('items[0]');        // GroupNode
   * form.getFieldByPath('items[0].name');   // FieldNode
   * form.getFieldByPath('invalid.path');    // undefined
   * ```
   */
  public getFieldByPath(path: string): FormNode<FormValue> | undefined {
    // Проверка на некорректные пути (leading/trailing dots)
    if (path.startsWith('.') || path.endsWith('.')) {
      return undefined;
    }

    //  Используем FieldPathNavigator вместо ручного парсинга
    const segments = this.pathNavigator.parsePath(path);
    if (segments.length === 0) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: FormNode<FormValue> | undefined = this as any;

    for (const segment of segments) {
      // Доступ к полю
      if (!(current instanceof GroupNode)) {
        return undefined;
      }

      current = current.getField(segment.key as unknown as never);
      if (!current) return undefined;

      // Если есть индекс, получаем элемент массива
      if (segment.index !== undefined) {
        // Используем duck typing вместо instanceof из-за circular dependency
        if (
          'at' in current &&
          'length' in current &&
          typeof (current as ArrayNodeLike).at === 'function'
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const item: FormNode<any> | undefined = (current as ArrayNodeLike).at(segment.index);
          if (!item) return undefined;
          current = item;
        } else {
          return undefined;
        }
      }
    }

    return current;
  }

  /**
   * Применить contextual валидаторы к полям
   *
   * ✅ РЕФАКТОРИНГ: Делегирование ValidationApplicator (SRP)
   *
   * Логика применения валидаторов извлечена в ValidationApplicator для:
   * - Соблюдения Single Responsibility Principle
   * - Уменьшения размера GroupNode (~120 строк)
   * - Улучшения тестируемости
   *
   * @param validators Зарегистрированные валидаторы
   */
  async applyContextualValidators(validators: ValidatorRegistration[]): Promise<void> {
    await this.validationApplicator.apply(validators);
  }

  // ============================================================================
  // Private методы для создания узлов
  // ============================================================================

  /**
   * Создать узел на основе конфигурации
   *
   * ✅ РЕФАКТОРИНГ: Полное делегирование NodeFactory
   *
   * NodeFactory теперь обрабатывает:
   * - Массивы [schema, ...items]
   * - FieldConfig
   * - GroupConfig
   * - ArrayConfig
   *
   * @param config Конфигурация узла
   * @returns Созданный узел формы
   * @private
   */
  private createNode(config: unknown): FormNode<FormValue> {
    //  Полное делегирование NodeFactory
    // NodeFactory теперь поддерживает массивы напрямую
    return this.nodeFactory.createNode(config);
  }

  // ============================================================================
  // Методы-помощники для реактивности (Фаза 1)
  // ============================================================================

  /**
   * Связывает два поля: при изменении source автоматически обновляется target
   */
  linkFields<K1 extends keyof T, K2 extends keyof T>(
    sourceKey: K1,
    targetKey: K2,
    transform?: (value: T[K1]) => T[K2]
  ): () => void {
    const sourceField = this._fields.get(sourceKey);
    const targetField = this._fields.get(targetKey);

    if (!sourceField || !targetField) {
      const missingField = !sourceField ? sourceKey : targetKey;
      throw new Error(`GroupNode.linkFields: field "${String(missingField)}" not found`);
    }

    const dispose = effect(() => {
      const sourceValue = sourceField.value.value;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedValue = transform ? transform(sourceValue as any) : (sourceValue as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetField.setValue(transformedValue as any, { emitEvent: false });
    });

    const key = uniqueId(SubscriptionKey.LinkFields);
    return this.disposers.add(key, dispose);
  }

  /**
   * Подписка на изменения вложенного поля по строковому пути
   * Поддерживает вложенные пути типа "address.city"
   *
   * @param fieldPath - Строковый путь к полю (например, "address.city")
   * @param callback - Функция, вызываемая при изменении поля
   * @returns Функция отписки для cleanup
   *
   * @example
   * ```typescript
   * // Подписка на изменение страны для загрузки городов
   * const dispose = form.watchField(
   *   'registrationAddress.country',
   *   async (countryCode) => {
   *     if (countryCode) {
   *       const cities = await fetchCitiesByCountry(countryCode);
   *       form.registrationAddress.city.updateComponentProps({
   *         options: cities
   *       });
   *     }
   *   }
   * );
   *
   * // Cleanup
   * useEffect(() => dispose, []);
   * ```
   */
  watchField<K extends keyof T>(
    fieldPath: K extends string ? K : string,
    callback: (value: T[K]) => void | Promise<void>
  ): () => void {
    const field = this.getFieldByPath(fieldPath as string);

    if (!field) {
      throw new Error(`GroupNode.watchField: field "${fieldPath}" not found`);
    }

    const dispose = effect(() => {
      const value = field.value.value;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback(value as any);
    });

    // Регистрируем через SubscriptionManager и возвращаем unsubscribe
    const key = uniqueId(SubscriptionKey.WatchField);
    return this.disposers.add(key, dispose);
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
   * Очистить все ресурсы узла
   */
  dispose(): void {
    this.disposers.dispose();
    this._fields.forEach((field) => {
      if ('dispose' in field && typeof field.dispose === 'function') {
        field.dispose();
      }
    });
  }
}
