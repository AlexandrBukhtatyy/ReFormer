/**
 * GroupNode - узел группы полей формы
 *
 * Представляет группу полей (объект), где каждое поле может быть:
 * - FieldNode (простое поле)
 * - GroupNode (вложенная группа)
 * - ArrayNode (массив форм)
 *
 * Наследует от FormNode и реализует все его абстрактные методы
 */

import { effect } from '@preact/signals-core';
import type { ReadonlySignal } from '@preact/signals-core';
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
import type { GroupNodeWithControls } from '../types/group-node-proxy';
import { createFieldPath } from '../validation';
import { ValidationApplicator } from '../validation/validation-applicator';
import type { BehaviorSchemaFn } from '../behavior/types';
import { BehaviorRegistry } from '../behavior/behavior-registry';
import { BehaviorApplicator } from '../behavior/behavior-applicator';
import { FieldPathNavigator } from '../utils/field-path-navigator';
import { NodeFactory } from '../factories/node-factory';
import { SubscriptionManager } from '../utils/subscription-manager';
import { ValidationRegistry } from '../validation/validation-registry';
import { FieldRegistry } from './group-node/field-registry';
import { ProxyBuilder } from './group-node/proxy-builder';
import { StateManager } from './group-node/state-manager';
import { v4 as uuidv4 } from 'uuid';

/**
 * GroupNode - узел для группы полей
 *
 * Поддерживает два API:
 * 1. Старый API (только schema) - обратная совместимость
 * 2. Новый API (config с form, behavior, validation) - автоматическое применение схем
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
  public id = uuidv4();

  /**
   * Реестр полей формы
   * Использует FieldRegistry для инкапсуляции логики управления коллекцией полей
   */
  private fieldRegistry: FieldRegistry<T>;

  /**
   * Строитель Proxy для типобезопасного доступа к полям
   * Использует ProxyBuilder для создания Proxy с расширенной функциональностью
   */
  private proxyBuilder: ProxyBuilder<T>;

  /**
   * Менеджер состояния формы
   * Инкапсулирует всю логику создания и управления сигналами состояния
   * Извлечен из GroupNode для соблюдения SRP
   */
  private stateManager: StateManager<T>;

  /**
   * Менеджер подписок для централизованного cleanup
   * Использует SubscriptionManager вместо массива для управления подписками
   */
  private disposers = new SubscriptionManager();

  /**
   * Ссылка на Proxy-инстанс для использования в BehaviorContext
   * Устанавливается в конструкторе до применения behavior schema
   */
  private _proxyInstance?: GroupNodeWithControls<T>;

  /**
   * Навигатор для работы с путями к полям
   * Использует композицию вместо дублирования логики парсинга путей
   */
  private readonly pathNavigator = new FieldPathNavigator();

  /**
   * Фабрика для создания узлов формы
   * Использует композицию для централизованного создания FieldNode/GroupNode/ArrayNode
   */
  private readonly nodeFactory = new NodeFactory();

  /**
   * Реестр валидаторов для этой формы
   * Использует композицию вместо глобального Singleton
   * Обеспечивает полную изоляцию форм друг от друга
   */
  private readonly validationRegistry = new ValidationRegistry();

  /**
   * Реестр behaviors для этой формы
   * Использует композицию вместо глобального Singleton
   * Обеспечивает полную изоляцию форм друг от друга
   */
  private readonly behaviorRegistry = new BehaviorRegistry();

  /**
   * Аппликатор для применения валидаторов к форме
   * Извлечен из GroupNode для соблюдения SRP
   * Использует композицию для управления процессом валидации
   */
  private readonly validationApplicator = new ValidationApplicator(this);

  /**
   * Аппликатор для применения behavior схемы к форме
   * Извлечен из GroupNode для соблюдения SRP
   * Использует композицию для управления процессом применения behaviors
   */
  private readonly behaviorApplicator = new BehaviorApplicator(this, this.behaviorRegistry);

  // ============================================================================
  // Публичные computed signals (делегированы в StateManager)
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

    // Инициализация модулей для управления полями и прокси
    this.fieldRegistry = new FieldRegistry<T>();
    this.proxyBuilder = new ProxyBuilder<T>(this.fieldRegistry);

    // Определяем, что передано: schema или config
    const isConfig = 'form' in schemaOrConfig;
    const formSchema = isConfig
      ? (schemaOrConfig as GroupNodeConfig<T>).form
      : (schemaOrConfig as FormSchema<T>);
    const behaviorSchema = isConfig ? (schemaOrConfig as GroupNodeConfig<T>).behavior : undefined;
    const validationSchema = isConfig
      ? (schemaOrConfig as GroupNodeConfig<T>).validation
      : undefined;

    // Создать поля из схемы с поддержкой вложенности
    for (const [key, config] of Object.entries(formSchema)) {
      const node = this.createNode(config);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.fieldRegistry.set(key as keyof T, node as any);
    }

    //  Создать менеджер состояния (инкапсулирует всю логику сигналов)
    // StateManager создает все computed signals на основе fieldRegistry
    this.stateManager = new StateManager<T>(this.fieldRegistry);

    //  Делегировать публичные свойства в StateManager
    this.value = this.stateManager.value;
    this.valid = this.stateManager.valid;
    this.invalid = this.stateManager.invalid;
    this.touched = this.stateManager.touched;
    this.dirty = this.stateManager.dirty;
    this.pending = this.stateManager.pending;
    this.errors = this.stateManager.errors;
    this.status = this.stateManager.status;
    this.submitting = this.stateManager.submitting;

    // Создать Proxy для прямого доступа к полям
    // Используем ProxyBuilder для создания Proxy с расширенной функциональностью
    const proxy = this.proxyBuilder.build(this);

    //  Сохраняем Proxy-инстанс перед применением схем
    // Это позволяет BehaviorContext получить доступ к прокси через formNode
    this._proxyInstance = proxy;

    // Применяем схемы, если они переданы (новый API)
    if (behaviorSchema) {
      this.applyBehaviorSchema(behaviorSchema);
    }
    if (validationSchema) {
      this.applyValidationSchema(validationSchema);
    }

    //  ВАЖНО: Возвращаем Proxy для прямого доступа к полям
    // Это позволяет писать form.email вместо form.controls.email
    // Используем GroupNodeWithControls для правильной типизации вложенных форм и массивов
    return proxy as GroupNodeWithControls<T>;
  }

  // ============================================================================
  // Реализация абстрактных методов FormNode
  // ============================================================================

  getValue(): T {
    const result = {} as T;
    this.fieldRegistry.forEach((field, key) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result[key] = field.getValue() as any;
    });
    return result;
  }

  setValue(value: T, options?: SetValueOptions): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [key, fieldValue] of Object.entries(value as any)) {
      const field = this.fieldRegistry.get(key as keyof T);
      if (field) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field.setValue(fieldValue as any, options);
      }
    }
  }

  patchValue(value: Partial<T>): void {
    for (const [key, fieldValue] of Object.entries(value)) {
      const field = this.fieldRegistry.get(key as keyof T);
      if (field && fieldValue !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field.setValue(fieldValue as any);
      }
    }
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
    this.fieldRegistry.forEach((field, key) => {
      const resetValue = value?.[key];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field.reset(resetValue as any);
    });
  }

  /**
   * Сбросить форму к исходным значениям (initialValues)
   *
   * @remarks
   * Рекурсивно вызывает resetToInitial() для всех полей формы.
   * Более явный способ сброса к начальным значениям по сравнению с reset()
   *
   * Полезно когда:
   * - Пользователь нажал "Cancel" - полная отмена изменений
   * - Форма была изменена через reset(newValues), но нужно вернуться к самому началу
   * - Явное намерение показать "отмена всех изменений"
   *
   * @example
   * ```typescript
   * const form = new GroupNode({
   *   email: { value: 'initial@mail.com', component: Input },
   *   name: { value: 'John', component: Input }
   * });
   *
   * form.email.setValue('changed@mail.com');
   * form.reset({ email: 'temp@mail.com', name: 'Jane' });
   * console.log(form.getValue()); // { email: 'temp@mail.com', name: 'Jane' }
   *
   * form.resetToInitial();
   * console.log(form.getValue()); // { email: 'initial@mail.com', name: 'John' }
   * ```
   */
  resetToInitial(): void {
    this.fieldRegistry.forEach((field) => {
      if ('resetToInitial' in field && typeof field.resetToInitial === 'function') {
        field.resetToInitial();
      } else {
        field.reset();
      }
    });
  }

  async validate(): Promise<boolean> {
    // Шаг 1: Валидация всех полей
    await Promise.all(Array.from(this.fieldRegistry.values()).map((field) => field.validate()));

    // Шаг 2: Применение contextual валидаторов из validation schema
    // Используем локальный реестр вместо глобального
    const validators = this.validationRegistry.getValidators();
    if (validators && validators.length > 0) {
      await this.applyContextualValidators(validators);
    }

    // Проверяем, все ли поля валидны
    return Array.from(this.fieldRegistry.values()).every((field) => field.valid.value);
  }

  /**
   * Установить form-level validation errors
   * Используется для server-side validation или кросс-полевых ошибок
   *
   * @param errors - массив ошибок уровня формы
   *
   * @example
   * ```typescript
   * // Server-side validation после submit
   * try {
   *   await api.createUser(form.getValue());
   * } catch (error) {
   *   form.setErrors([
   *     { code: 'duplicate_email', message: 'Email уже используется' }
   *   ]);
   * }
   * ```
   */
  setErrors(errors: ValidationError[]): void {
    this.stateManager.setFormErrors(errors);
  }

  /**
   * Очистить все errors (form-level + field-level)
   */
  clearErrors(): void {
    // Очищаем form-level errors
    this.stateManager.clearFormErrors();

    // Очищаем field-level errors
    this.fieldRegistry.forEach((field) => field.clearErrors());
  }

  /**
   * Получить поле по ключу
   *
   * Публичный метод для доступа к полю из fieldRegistry
   *
   * @param key - Ключ поля
   * @returns FormNode или undefined, если поле не найдено
   *
   * @example
   * ```typescript
   * const emailField = form.getField('email');
   * if (emailField) {
   *   console.log(emailField.value.value);
   * }
   * ```
   */
  getField<K extends keyof T>(key: K): FormNode<T[K]> | undefined {
    return this.fieldRegistry.get(key);
  }

  /**
   * Получить Map всех полей формы
   *
   * Используется в FieldPathNavigator для навигации по полям
   *
   * @returns Map полей формы
   */
  get fields(): FieldRegistry<T> {
    return this.fieldRegistry;
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
  getProxy(): GroupNodeWithControls<T> {
    return (this._proxyInstance || this) as GroupNodeWithControls<T>;
  }

  /**
   * Получить все поля формы как итератор
   *
   * Предоставляет доступ к внутренним полям для валидации и других операций
   *
   * @returns Итератор по всем полям формы
   *
   * @example
   * ```typescript
   * // Валидация всех полей
   * await Promise.all(
   *   Array.from(form.getAllFields()).map(field => field.validate())
   * );
   * ```
   */
  getAllFields(): IterableIterator<FormNode<FormValue>> {
    return this.fieldRegistry.values();
  }

  // ============================================================================
  // Protected hooks (Template Method pattern)
  // ============================================================================

  /**
   * Hook: вызывается после markAsTouched()
   *
   * Для GroupNode: рекурсивно помечаем все дочерние поля как touched
   */
  protected onMarkAsTouched(): void {
    this.fieldRegistry.forEach((field) => field.markAsTouched());
  }

  /**
   * Hook: вызывается после markAsUntouched()
   *
   * Для GroupNode: рекурсивно помечаем все дочерние поля как untouched
   */
  protected onMarkAsUntouched(): void {
    this.fieldRegistry.forEach((field) => field.markAsUntouched());
  }

  /**
   * Hook: вызывается после markAsDirty()
   *
   * Для GroupNode: рекурсивно помечаем все дочерние поля как dirty
   */
  protected onMarkAsDirty(): void {
    this.fieldRegistry.forEach((field) => field.markAsDirty());
  }

  /**
   * Hook: вызывается после markAsPristine()
   *
   * Для GroupNode: рекурсивно помечаем все дочерние поля как pristine
   */
  protected onMarkAsPristine(): void {
    this.fieldRegistry.forEach((field) => field.markAsPristine());
  }

  // ============================================================================
  // Дополнительные методы (из FormStore)
  // ============================================================================

  /**
   * Отправить форму
   * Валидирует форму и вызывает onSubmit если форма валидна
   */
  async submit<R>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> {
    this.markAsTouched();

    const isValid = await this.validate();
    if (!isValid) {
      return null;
    }

    this.stateManager.setSubmitting(true);
    try {
      const result = await onSubmit(this.getValue());
      return result;
    } finally {
      this.stateManager.setSubmitting(false);
    }
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
   *
   * ✅ РЕФАКТОРИНГ: Делегирование BehaviorApplicator (SRP)
   *
   * Логика применения behavior схемы извлечена в BehaviorApplicator для:
   * - Соблюдения Single Responsibility Principle
   * - Уменьшения размера GroupNode (~50 строк)
   * - Улучшения тестируемости
   * - Консистентности с ValidationApplicator
   *
   * @param schemaFn Функция описания поведения формы
   * @returns Функция cleanup для отписки от всех behaviors
   *
   * @example
   * ```typescript
   * import { copyFrom, enableWhen, computeFrom } from '@/lib/forms/core/behaviors';
   *
   * const behaviorSchema: BehaviorSchemaFn<MyForm> = (path) => {
   *   copyFrom(path.residenceAddress, path.registrationAddress, {
   *     when: (form) => form.sameAsRegistration === true
   *   });
   *
   *   enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage');
   *
   *   computeFrom(
   *     path.initialPayment,
   *     [path.propertyValue],
   *     (propertyValue) => propertyValue ? propertyValue * 0.2 : null
   *   );
   * };
   *
   * const cleanup = form.applyBehaviorSchema(behaviorSchema);
   *
   * // Cleanup при unmount
   * useEffect(() => cleanup, []);
   * ```
   */
  applyBehaviorSchema(schemaFn: BehaviorSchemaFn<T>): () => void {
    return this.behaviorApplicator.apply(schemaFn);
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
   * Поддерживает опциональную трансформацию значения
   *
   * @param sourceKey - Ключ поля-источника
   * @param targetKey - Ключ поля-цели
   * @param transform - Опциональная функция трансформации значения
   * @returns Функция отписки для cleanup
   *
   * @example
   * ```typescript
   * // Автоматический расчет минимального взноса от стоимости недвижимости
   * const dispose = form.linkFields(
   *   'propertyValue',
   *   'initialPayment',
   *   (propertyValue) => propertyValue ? propertyValue * 0.2 : null
   * );
   *
   * // При изменении propertyValue → автоматически обновится initialPayment
   * form.propertyValue.setValue(1000000);
   * // initialPayment станет 200000
   *
   * // Cleanup
   * useEffect(() => dispose, []);
   * ```
   */
  linkFields<K1 extends keyof T, K2 extends keyof T>(
    sourceKey: K1,
    targetKey: K2,
    transform?: (value: T[K1]) => T[K2]
  ): () => void {
    const sourceField = this.fieldRegistry.get(sourceKey);
    const targetField = this.fieldRegistry.get(targetKey);

    if (!sourceField || !targetField) {
      if (import.meta.env.DEV) {
        console.warn(
          `GroupNode.linkFields: field "${String(sourceKey)}" or "${String(targetKey)}" not found`
        );
      }
      return () => {}; // noop
    }

    const dispose = effect(() => {
      const sourceValue = sourceField.value.value;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedValue = transform ? transform(sourceValue as any) : (sourceValue as any);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetField.setValue(transformedValue as any, { emitEvent: false });
    });

    // Регистрируем через SubscriptionManager и возвращаем unsubscribe
    const key = `linkFields-${Date.now()}-${Math.random()}`;
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
      if (import.meta.env.DEV) {
        console.warn(`GroupNode.watchField: field "${fieldPath}" not found`);
      }
      return () => {}; // noop
    }

    const dispose = effect(() => {
      const value = field.value.value;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback(value as any);
    });

    // Регистрируем через SubscriptionManager и возвращаем unsubscribe
    const key = `watchField-${Date.now()}-${Math.random()}`;
    return this.disposers.add(key, dispose);
  }

  /**
   * Hook: вызывается после disable()
   *
   * Для GroupNode: рекурсивно отключаем все дочерние поля
   */
  protected onDisable(): void {
    // Синхронизируем disabled signal через StateManager
    this.stateManager.setDisabled(true);

    this.fieldRegistry.forEach((field) => {
      field.disable();
    });
  }

  /**
   * Hook: вызывается после enable()
   *
   * Для GroupNode: рекурсивно включаем все дочерние поля
   */
  protected onEnable(): void {
    // Синхронизируем disabled signal через StateManager
    this.stateManager.setDisabled(false);

    this.fieldRegistry.forEach((field) => {
      field.enable();
    });
  }

  /**
   * Очистить все ресурсы узла
   * Рекурсивно очищает все subscriptions и дочерние узлы
   *
   * @example
   * ```typescript
   * useEffect(() => {
   *   return () => {
   *     form.dispose();
   *   };
   * }, []);
   * ```
   */
  dispose(): void {
    // Очищаем все subscriptions через SubscriptionManager
    this.disposers.dispose();

    // Рекурсивно очищаем дочерние узлы
    this.fieldRegistry.forEach((field) => {
      if ('dispose' in field && typeof field.dispose === 'function') {
        field.dispose();
      }
    });
  }
}
