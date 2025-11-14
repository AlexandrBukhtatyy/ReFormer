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

import { signal, computed, effect } from '@preact/signals-react';
import type { Signal, ReadonlySignal } from '@preact/signals-react';
import { FormNode, type SetValueOptions } from './form-node';
import type {
  ValidationError,
  FieldStatus,
  ValidationSchemaFn,
  FormSchema,
  GroupNodeConfig,
} from '../types';
import type { GroupNodeWithControls } from '../types/group-node-proxy';
import { createFieldPath } from '../validators';
import { ValidationApplicator } from '../validators/validation-applicator';
import type { BehaviorSchemaFn } from '../behaviors/types';
import { BehaviorRegistry } from '../behaviors/behavior-registry';
import { BehaviorApplicator } from '../behaviors/behavior-applicator';
import { FieldPathNavigator } from '../utils/field-path-navigator';
import { NodeFactory } from '../factories/node-factory';
import { SubscriptionManager } from '../utils/subscription-manager';
import { ValidationRegistry } from '../validators/validation-registry';
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
export class GroupNode<T extends Record<string, any> = any> extends FormNode<T> {
  // ============================================================================
  // Приватные поля
  // ============================================================================
  public id = uuidv4();
  private fields: Map<keyof T, FormNode<any>>;
  private _submitting: Signal<boolean>;
  private _disabled: Signal<boolean>;

  /**
   * Form-level validation errors (не связанные с конкретным полем)
   * Используется для server-side errors или кросс-полевой валидации
   */
  private _formErrors: Signal<ValidationError[]>;

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

    this.fields = new Map();
    this._submitting = signal(false);
    this._disabled = signal(false);
    this._formErrors = signal<ValidationError[]>([]);

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
      this.fields.set(key as keyof T, node);
    }

    // Создать computed signals
    // Computed signal автоматически кеширует результат (мемоизация)
    // Если зависимости (field.value.value) не изменились, вернет закешированный объект
    // Это обеспечивает reference equality и O(1) при повторных вызовах
    this.value = computed(() => {
      const result = {} as T;
      this.fields.forEach((field, key) => {
        result[key] = field.value.value;
      });
      return result;
    });

    this.valid = computed(() => {
      // Проверяем отсутствие form-level errors
      const hasFormErrors = this._formErrors.value.length > 0;
      if (hasFormErrors) return false;

      // Проверяем все поля
      return Array.from(this.fields.values()).every((field) => field.valid.value);
    });

    this.invalid = computed(() => !this.valid.value);

    this.pending = computed(() =>
      Array.from(this.fields.values()).some((field) => field.pending.value)
    );

    this.touched = computed(() =>
      Array.from(this.fields.values()).some((field) => field.touched.value)
    );

    this.dirty = computed(() =>
      Array.from(this.fields.values()).some((field) => field.dirty.value)
    );

    this.errors = computed(() => {
      const allErrors: ValidationError[] = [];

      // Добавляем form-level errors
      allErrors.push(...this._formErrors.value);

      // Добавляем field-level errors
      this.fields.forEach((field) => {
        allErrors.push(...field.errors.value);
      });

      return allErrors;
    });

    this.status = computed(() => {
      if (this._disabled.value) return 'disabled';
      if (this.pending.value) return 'pending';
      if (this.invalid.value) return 'invalid';
      return 'valid';
    });

    this.submitting = computed(() => this._submitting.value);

    // Создать Proxy для прямого доступа к полям
    const proxy = new Proxy(this, {
      get(target, prop: string | symbol) {
        // Приоритет 1: Собственные свойства и методы GroupNode
        if (prop in target) {
          return (target as any)[prop];
        }

        // Приоритет 2: Поля формы
        if (typeof prop === 'string' && target.fields.has(prop as keyof T)) {
          return target.fields.get(prop as keyof T);
        }

        // Fallback
        return undefined;
      },
    });

    // ✅ Сохраняем Proxy-инстанс перед применением схем
    // Это позволяет BehaviorContext получить доступ к прокси через formNode
    this._proxyInstance = proxy;

    // Применяем схемы, если они переданы (новый API)
    if (behaviorSchema) {
      this.applyBehaviorSchema(behaviorSchema);
    }
    if (validationSchema) {
      this.applyValidationSchema(validationSchema);
    }

    // ✅ ВАЖНО: Возвращаем Proxy для прямого доступа к полям
    // Это позволяет писать form.email вместо form.controls.email
    // Используем GroupNodeWithControls для правильной типизации вложенных форм и массивов
    return proxy as GroupNodeWithControls<T>;
  }

  // ============================================================================
  // Реализация абстрактных методов FormNode
  // ============================================================================

  getValue(): T {
    const result = {} as T;
    this.fields.forEach((field, key) => {
      result[key] = field.getValue();
    });
    return result;
  }

  setValue(value: T, options?: SetValueOptions): void {
    for (const [key, fieldValue] of Object.entries(value)) {
      const field = this.fields.get(key as keyof T);
      if (field) {
        field.setValue(fieldValue, options);
      }
    }
  }

  patchValue(value: Partial<T>): void {
    for (const [key, fieldValue] of Object.entries(value)) {
      const field = this.fields.get(key as keyof T);
      if (field && fieldValue !== undefined) {
        field.setValue(fieldValue);
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
    this.fields.forEach((field, key) => {
      const resetValue = value?.[key];
      field.reset(resetValue);
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
    this.fields.forEach((field) => {
      if ('resetToInitial' in field && typeof field.resetToInitial === 'function') {
        field.resetToInitial();
      } else {
        field.reset();
      }
    });
  }

  async validate(): Promise<boolean> {
    // Шаг 1: Валидация всех полей
    await Promise.all(Array.from(this.fields.values()).map((field) => field.validate()));

    // Шаг 2: Применение contextual валидаторов из validation schema
    // Используем локальный реестр вместо глобального
    const validators = this.validationRegistry.getValidators();
    if (validators && validators.length > 0) {
      await this.applyContextualValidators(validators);
    }

    // Проверяем, все ли поля валидны
    return Array.from(this.fields.values()).every((field) => field.valid.value);
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
    this._formErrors.value = errors;
  }

  /**
   * Очистить все errors (form-level + field-level)
   */
  clearErrors(): void {
    // Очищаем form-level errors
    this._formErrors.value = [];

    // Очищаем field-level errors
    this.fields.forEach((field) => field.clearErrors());
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
    this.fields.forEach((field) => field.markAsTouched());
  }

  /**
   * Hook: вызывается после markAsUntouched()
   *
   * Для GroupNode: рекурсивно помечаем все дочерние поля как untouched
   */
  protected onMarkAsUntouched(): void {
    this.fields.forEach((field) => field.markAsUntouched());
  }

  /**
   * Hook: вызывается после markAsDirty()
   *
   * Для GroupNode: рекурсивно помечаем все дочерние поля как dirty
   */
  protected onMarkAsDirty(): void {
    this.fields.forEach((field) => field.markAsDirty());
  }

  /**
   * Hook: вызывается после markAsPristine()
   *
   * Для GroupNode: рекурсивно помечаем все дочерние поля как pristine
   */
  protected onMarkAsPristine(): void {
    this.fields.forEach((field) => field.markAsPristine());
  }

  // ============================================================================
  // Дополнительные методы (из FormStore)
  // ============================================================================

  /**
   * Отправить форму
   * Валидирует форму и вызывает onSubmit если форма валидна
   */
  async submit<R = any>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> {
    this.markAsTouched();

    const isValid = await this.validate();
    if (!isValid) {
      return null;
    }

    this._submitting.value = true;
    try {
      const result = await onSubmit(this.getValue());
      return result;
    } finally {
      this._submitting.value = false;
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
      // ✅ Передаём proxy-инстанс, если доступен (консистентность с applyBehaviorSchema)
      const formToUse = (this._proxyInstance || this) as GroupNodeWithControls<T>;
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
  public getFieldByPath(path: string): FormNode<any> | undefined {
    // Проверка на некорректные пути (leading/trailing dots)
    if (path.startsWith('.') || path.endsWith('.')) {
      return undefined;
    }

    // ✅ Используем FieldPathNavigator вместо ручного парсинга
    const segments = this.pathNavigator.parsePath(path);
    if (segments.length === 0) {
      return undefined;
    }

    let current: FormNode<any> | undefined = this;

    for (const segment of segments) {
      // Доступ к полю
      if (!(current instanceof GroupNode)) {
        return undefined;
      }

      current = current.fields.get(segment.key as any);
      if (!current) return undefined;

      // Если есть индекс, получаем элемент массива
      if (segment.index !== undefined) {
        // Используем duck typing вместо instanceof из-за circular dependency
        if ('at' in current && 'length' in current && typeof (current as any).at === 'function') {
          const item: FormNode<any> | undefined = (current as any).at(segment.index);
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
  async applyContextualValidators(validators: any[]): Promise<void> {
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
  private createNode(config: any): FormNode<any> {
    // ✅ Полное делегирование NodeFactory
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
    const sourceField = this.fields.get(sourceKey);
    const targetField = this.fields.get(targetKey);

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
      const transformedValue = transform ? transform(sourceValue as T[K1]) : (sourceValue as any);

      targetField.setValue(transformedValue, { emitEvent: false });
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
    callback: (value: any) => void | Promise<void>
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
      callback(value);
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
    // Синхронизируем _disabled signal с _status для обратной совместимости
    this._disabled.value = true;

    this.fields.forEach((field) => {
      field.disable();
    });
  }

  /**
   * Hook: вызывается после enable()
   *
   * Для GroupNode: рекурсивно включаем все дочерние поля
   */
  protected onEnable(): void {
    // Синхронизируем _disabled signal с _status для обратной совместимости
    this._disabled.value = false;

    this.fields.forEach((field) => {
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
    this.fields.forEach((field) => {
      if ('dispose' in field && typeof field.dispose === 'function') {
        field.dispose();
      }
    });
  }
}
