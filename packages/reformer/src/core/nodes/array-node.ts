/**
 * ArrayNode - узел формы для работы с массивами
 *
 * Управляет массивом форм с поддержкой:
 * - Динамического добавления/удаления элементов
 * - Валидации всех элементов
 * - Реактивного состояния через signals
 *
 * @group Nodes
 */

import { signal, computed, effect } from '@preact/signals-core';
import type { Signal, ReadonlySignal } from '@preact/signals-core';
import { FormNode, type SetValueOptions } from './form-node';
import { GroupNode } from './group-node';
import { uniqueId, SubscriptionKey } from '../utils/unique-id';
import { FormErrorHandler, ErrorStrategy } from '../utils/error-handler';
import { createAggregateSignals } from '../utils/aggregate-signals';
import type {
  FieldStatus,
  ValidationError,
  WithValidationSchema,
  WithBehaviorSchema,
  FormFields,
} from '../types';
import type { FormSchema } from '../types/deep-schema';
import type { FormProxy } from '../types/form-proxy';
import { SubscriptionManager } from '../utils/subscription-manager';

/**
 * ArrayNode - массив форм с реактивным состоянием
 *
 * @group Nodes
 *
 * @example
 * ```typescript
 * const array = new ArrayNode({
 *   title: { value: '', component: Input },
 *   price: { value: 0, component: Input },
 * });
 *
 * array.push({ title: 'Item 1', price: 100 });
 * array.at(0)?.title.setValue('Updated');
 * console.log(array.length.value); // 1
 * ```
 */
export class ArrayNode<T extends FormFields> extends FormNode<T[]> {
  // ============================================================================
  // Приватные поля
  // ============================================================================

  private items: Signal<FormNode<T>[]>;
  private itemSchema: FormSchema<T>;
  private initialItems: Partial<T>[];

  /**
   * Менеджер подписок для централизованного cleanup
   * Использует SubscriptionManager вместо массива для управления подписками
   */
  private disposers = new SubscriptionManager();

  /** Array-level validation errors (e.g., "минимум 1 элемент") */
  private readonly _arrayErrors: Signal<ValidationError[]> = signal<ValidationError[]>([]);

  // ============================================================================
  // Приватные поля для сохранения схем
  // ============================================================================

  private validationSchemaFn?: unknown;
  private behaviorSchemaFn?: unknown;

  // ============================================================================
  // Публичные computed signals
  // ============================================================================

  public readonly value: ReadonlySignal<T[]>;
  public readonly valid: ReadonlySignal<boolean>;
  public readonly invalid: ReadonlySignal<boolean>;
  public readonly touched: ReadonlySignal<boolean>;
  public readonly dirty: ReadonlySignal<boolean>;
  public readonly pending: ReadonlySignal<boolean>;
  public readonly errors: ReadonlySignal<ValidationError[]>;
  public readonly status: ReadonlySignal<FieldStatus>;
  public readonly length: ReadonlySignal<number>;

  // ============================================================================
  // Конструктор
  // ============================================================================

  constructor(schema: FormSchema<T>, initialItems: Partial<T>[] = []) {
    super();

    this.itemSchema = schema;
    this.initialItems = initialItems;
    this.items = signal<FormNode<T>[]>([]);

    // Создать начальные элементы
    for (const initialValue of initialItems) {
      this.push(initialValue);
    }

    // ============================================================================
    // Computed signals через createAggregateSignals
    // ============================================================================

    // Специфичные для ArrayNode
    this.length = computed(() => this.items.value.length);
    this.value = computed(() => this.items.value.map((item) => item.value.value as T));

    // Агрегированные signals через общую утилиту
    const aggregateSignals = createAggregateSignals({
      getChildren: () => this.items.value,
      ownErrors: this._arrayErrors,
    });

    this.valid = aggregateSignals.valid;
    this.invalid = aggregateSignals.invalid;
    this.pending = aggregateSignals.pending;
    this.touched = aggregateSignals.touched;
    this.dirty = aggregateSignals.dirty;
    this.errors = aggregateSignals.errors;
    this.status = aggregateSignals.status;
  }

  // ============================================================================
  // CRUD операции
  // ============================================================================

  /**
   * Добавить элемент в конец массива
   * @param initialValue - Начальные значения для нового элемента
   */
  push(initialValue?: Partial<T>): void {
    const newItem = this.createItem(initialValue);
    this.items.value = [...this.items.value, newItem];
  }

  /**
   * Удалить элемент по индексу
   * @param index - Индекс элемента для удаления
   *
   * @remarks
   * Вызывает dispose() на удаляемом элементе для очистки подписок
   */
  removeAt(index: number): void {
    if (index < 0 || index >= this.items.value.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `ArrayNode: index ${index} out of bounds (length: ${this.items.value.length})`
        );
      }
      return;
    }

    // Получаем элемент для dispose перед удалением
    const itemToRemove = this.items.value[index];

    // Удаляем из массива
    this.items.value = this.items.value.filter((_, i) => i !== index);

    // Очищаем ресурсы удаленного элемента
    if (itemToRemove && 'dispose' in itemToRemove && typeof itemToRemove.dispose === 'function') {
      itemToRemove.dispose();
    }
  }

  /**
   * Вставить элемент в массив
   * @param index - Индекс для вставки
   * @param initialValue - Начальные значения для нового элемента
   */
  insert(index: number, initialValue?: Partial<T>): void {
    if (index < 0 || index > this.items.value.length) {
      if (import.meta.env.DEV) {
        console.warn(
          `ArrayNode: index ${index} out of bounds (length: ${this.items.value.length})`
        );
      }
      return;
    }

    const newItem = this.createItem(initialValue);
    const newItems = [...this.items.value];
    newItems.splice(index, 0, newItem);
    this.items.value = newItems;
  }

  /**
   * Удалить все элементы массива
   *
   * @remarks
   * Вызывает dispose() на всех элементах для очистки подписок
   */
  clear(): void {
    // Сохраняем ссылки на элементы для dispose
    const itemsToDispose = [...this.items.value];

    // Очищаем массив
    this.items.value = [];

    // Очищаем ресурсы всех элементов
    itemsToDispose.forEach((item) => {
      if ('dispose' in item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
  }

  /**
   * Получить элемент по индексу
   * @param index - Индекс элемента
   * @returns Типизированный GroupNode proxy или undefined если индекс вне границ
   */
  at(index: number): FormProxy<T> | undefined {
    const item = this.items.value[index];
    if (!item) return undefined;
    // Возвращаем proxy для доступа к полям элемента
    return (item as unknown as { getProxy: () => FormProxy<T> }).getProxy();
  }

  // ============================================================================
  // Реализация абстрактных методов
  // ============================================================================

  getValue(): T[] {
    return this.items.value.map((item) => item.getValue());
  }

  setValue(values: T[], options?: SetValueOptions): void {
    this.clear();
    values.forEach((value) => this.push(value));

    // Запускаем валидацию если emitEvent !== false
    // Fire-and-forget (не ждем результат, как в FieldNode)
    if (options?.emitEvent !== false) {
      this.validate().catch((error) => {
        // Логируем системные ошибки через централизованный обработчик
        // Ошибки валидации уже обработаны и сохранены в errors signal
        FormErrorHandler.handle(error, 'ArrayNode.setValue', ErrorStrategy.LOG);
      });
    }
  }

  patchValue(values: (T | undefined)[]): void {
    values.forEach((value, index) => {
      if (this.items.value[index] && value !== undefined) {
        this.items.value[index].patchValue(value);
      }
    });
  }

  /**
   * Сбросить массив к указанным значениям (или очистить)
   *
   * @param values - опциональный массив значений для сброса
   *
   * @remarks
   * Очищает текущий массив и заполняет новыми элементами
   *
   * @example
   * ```typescript
   * // Очистить массив
   * arrayNode.reset();
   *
   * // Сбросить к новым значениям
   * arrayNode.reset([{ name: 'Item 1' }, { name: 'Item 2' }]);
   * ```
   */
  reset(values?: T[]): void {
    this._arrayErrors.value = [];
    this.clear();
    if (values) {
      values.forEach((value) => this.push(value));
    }
  }

  /**
   * Сбросить массив к исходным значениям (initialItems)
   *
   * @remarks
   * Восстанавливает массив в состояние, которое было при создании ArrayNode.
   * Более явный способ сброса к начальным значениям по сравнению с reset()
   *
   * Полезно когда:
   * - Пользователь нажал "Cancel" - вернуть массив к исходным элементам
   * - Массив был изменен через reset(newValues), но нужно вернуться к началу
   * - Явное намерение показать "отмена всех изменений"
   *
   * @example
   * ```typescript
   * const arrayNode = new ArrayNode(
   *   { name: { value: '', component: Input } },
   *   [{ name: 'Initial 1' }, { name: 'Initial 2' }]
   * );
   *
   * arrayNode.push({ name: 'New Item' });
   * arrayNode.reset([{ name: 'Temp' }]);
   * console.log(arrayNode.length.value); // 1
   *
   * arrayNode.resetToInitial();
   * console.log(arrayNode.length.value); // 2
   * console.log(arrayNode.at(0)?.name.value.value); // 'Initial 1'
   * ```
   */
  resetToInitial(): void {
    this._arrayErrors.value = [];
    this.clear();
    this.initialItems.forEach((value) => this.push(value));
  }

  async validate(): Promise<boolean> {
    const results = await Promise.all(this.items.value.map((item) => item.validate()));
    return results.every(Boolean);
  }

  /**
   * Установить array-level validation errors
   *
   * @param errors - Массив ошибок валидации уровня массива
   *
   * @example
   * ```typescript
   * arrayNode.setErrors([{
   *   code: 'minItems',
   *   message: 'Минимум 1 элемент обязателен',
   * }]);
   * ```
   */
  setErrors(errors: ValidationError[]): void {
    this._arrayErrors.value = errors;
  }

  /**
   * Очистить все errors (array-level + item-level)
   *
   * @example
   * ```typescript
   * arrayNode.clearErrors();
   * console.log(arrayNode.errors.value); // []
   * ```
   */
  clearErrors(): void {
    this._arrayErrors.value = [];
    this.items.value.forEach((item) => item.clearErrors());
  }

  // ============================================================================
  // Protected hooks (Template Method pattern)
  // ============================================================================

  /**
   * Hook: вызывается после markAsTouched()
   *
   * Для ArrayNode: рекурсивно помечаем все элементы массива как touched
   */
  protected onMarkAsTouched(): void {
    this.items.value.forEach((item) => item.markAsTouched());
  }

  /**
   * Hook: вызывается после markAsUntouched()
   *
   * Для ArrayNode: рекурсивно помечаем все элементы массива как untouched
   */
  protected onMarkAsUntouched(): void {
    this.items.value.forEach((item) => item.markAsUntouched());
  }

  /**
   * Hook: вызывается после markAsDirty()
   *
   * Для ArrayNode: рекурсивно помечаем все элементы массива как dirty
   */
  protected onMarkAsDirty(): void {
    this.items.value.forEach((item) => item.markAsDirty());
  }

  /**
   * Hook: вызывается после markAsPristine()
   *
   * Для ArrayNode: рекурсивно помечаем все элементы массива как pristine
   */
  protected onMarkAsPristine(): void {
    this.items.value.forEach((item) => item.markAsPristine());
  }

  // ============================================================================
  // Итерация
  // ============================================================================

  /**
   * Итерировать по элементам массива
   * @param callback - Функция, вызываемая для каждого элемента с типизированным GroupNode proxy
   */
  forEach(callback: (item: FormProxy<T>, index: number) => void): void {
    this.items.value.forEach((item, index) => {
      const proxy = (item as unknown as { getProxy: () => FormProxy<T> }).getProxy();
      callback(proxy, index);
    });
  }

  /**
   * Маппинг элементов массива
   * @param callback - Функция преобразования с типизированным GroupNode proxy
   * @returns Новый массив результатов
   */
  map<R>(callback: (item: FormProxy<T>, index: number) => R): R[] {
    return this.items.value.map((item, index) => {
      const proxy = (item as unknown as { getProxy: () => FormProxy<T> }).getProxy();
      return callback(proxy, index);
    });
  }

  // ============================================================================
  // Private методы
  // ============================================================================

  /**
   * Создать новый элемент массива на основе схемы
   * @param initialValue - Начальные значения
   */
  private createItem(initialValue?: Partial<T>): FormNode<T> {
    // Определить тип узла на основе схемы
    if (this.isGroupSchema(this.itemSchema)) {
      const node = new GroupNode(this.itemSchema as unknown as never);
      if (initialValue) {
        node.patchValue(initialValue);
      }

      // Применяем validation schema к новому элементу, если она была установлена
      if (this.validationSchemaFn && 'applyValidationSchema' in node) {
        (node as unknown as WithValidationSchema).applyValidationSchema(this.validationSchemaFn);
      }

      //  Применяем behavior schema к новому элементу, если она была установлена
      if (this.behaviorSchemaFn && 'applyBehaviorSchema' in node) {
        (node as unknown as WithBehaviorSchema).applyBehaviorSchema(this.behaviorSchemaFn);
      }

      return node as unknown as FormNode<T>;
    }

    // Если схема - FieldConfig, ArrayNode не поддерживает примитивные массивы
    throw new Error(
      'ArrayNode поддерживает только GroupNode элементы. ' +
        'Для массива примитивов используйте обычное поле с типом массива.'
    );
  }

  /**
   * Проверить, является ли схема групповой (объект полей)
   * @param schema - Схема для проверки
   */
  private isGroupSchema(schema: unknown): boolean {
    return (
      typeof schema === 'object' &&
      schema !== null &&
      !('component' in schema) &&
      !Array.isArray(schema)
    );
  }

  // ============================================================================
  // Validation Schema
  // ============================================================================

  /**
   * Применить validation schema ко всем элементам массива
   *
   * Validation schema будет применена к:
   * - Всем существующим элементам
   * - Всем новым элементам, добавляемым через push/insert
   *
   * @param schemaFn - Функция валидации для элемента массива
   *
   * @example
   * ```typescript
   * import { propertyValidation } from './validation/property-validation';
   *
   * form.properties.applyValidationSchema(propertyValidation);
   * ```
   */
  applyValidationSchema(schemaFn: unknown): void {
    // Сохраняем validation schema для применения к новым элементам
    this.validationSchemaFn = schemaFn;

    // Применяем validation schema ко всем существующим элементам
    this.items.value.forEach((item) => {
      if (
        'applyValidationSchema' in item &&
        typeof (item as WithValidationSchema).applyValidationSchema === 'function'
      ) {
        (item as WithValidationSchema).applyValidationSchema(schemaFn);
      }
    });
  }

  /**
   * Применить behavior schema ко всем элементам ArrayNode
   *
   * Автоматически применяется к новым элементам при push/insert.
   *
   * @param schemaFn - Behavior schema функция
   *
   * @example
   * ```typescript
   * import { addressBehavior } from './behaviors/address-behavior';
   *
   * form.addresses.applyBehaviorSchema(addressBehavior);
   * ```
   */
  applyBehaviorSchema(schemaFn: unknown): void {
    // Сохраняем behavior schema для применения к новым элементам
    this.behaviorSchemaFn = schemaFn;

    // Применяем behavior schema ко всем существующим элементам
    this.items.value.forEach((item) => {
      if (
        'applyBehaviorSchema' in item &&
        typeof (item as WithBehaviorSchema).applyBehaviorSchema === 'function'
      ) {
        (item as WithBehaviorSchema).applyBehaviorSchema(schemaFn);
      }
    });
  }

  // ============================================================================
  // Методы-помощники для реактивности (Фаза 1)
  // ============================================================================

  /**
   * Подписка на изменения конкретного поля во всех элементах массива
   * Срабатывает при изменении значения поля в любом элементе
   *
   * @param fieldKey - Ключ поля для отслеживания
   * @param callback - Функция, вызываемая при изменении, получает массив всех значений и индекс измененного элемента
   * @returns Функция отписки для cleanup
   *
   * @example
   * ```typescript
   * // Автоматический пересчет общей стоимости при изменении цен
   * const dispose = form.existingLoans.watchItems(
   *   'remainingAmount',
   *   (amounts) => {
   *     const totalDebt = amounts.reduce((sum, amount) => sum + (amount || 0), 0);
   *     form.totalDebt.setValue(totalDebt);
   *   }
   * );
   *
   * // При изменении любого remainingAmount → пересчитается totalDebt
   * form.existingLoans.at(0)?.remainingAmount.setValue(500000);
   *
   * // Cleanup
   * useEffect(() => dispose, []);
   * ```
   */
  watchItems<K extends keyof T>(
    fieldKey: K,
    callback: (values: Array<T[K] | undefined>) => void | Promise<void>
  ): () => void {
    const dispose = effect(() => {
      // Отслеживаем изменения всех элементов массива
      const values = this.items.value.map((item) => {
        if (item instanceof GroupNode) {
          const field = item.getFieldByPath(fieldKey as string);
          return field?.value.value as T[K];
        }
        return undefined;
      });

      callback(values);
    });

    // Регистрируем через SubscriptionManager и возвращаем unsubscribe
    const key = uniqueId(SubscriptionKey.WatchItems);
    return this.disposers.add(key, dispose);
  }

  /**
   * Подписка на изменение длины массива
   * Срабатывает при добавлении/удалении элементов
   *
   * @param callback - Функция, вызываемая при изменении длины, получает новую длину
   * @returns Функция отписки для cleanup
   *
   * @example
   * ```typescript
   * // Обновление счетчика элементов в UI
   * const dispose = form.properties.watchLength((length) => {
   *   console.log(`Количество объектов недвижимости: ${length}`);
   *   form.propertyCount.setValue(length);
   * });
   *
   * form.properties.push({ title: 'Квартира', value: 5000000 });
   * // Выведет: "Количество объектов недвижимости: 1"
   *
   * // Cleanup
   * useEffect(() => dispose, []);
   * ```
   */
  watchLength(callback: (length: number) => void | Promise<void>): () => void {
    const dispose = effect(() => {
      const currentLength = this.length.value;
      callback(currentLength);
    });

    // Регистрируем через SubscriptionManager и возвращаем unsubscribe
    const key = uniqueId(SubscriptionKey.WatchLength);
    return this.disposers.add(key, dispose);
  }

  /**
   * Очистить все ресурсы узла
   * Рекурсивно очищает все subscriptions и элементы массива
   *
   * @example
   * ```typescript
   * useEffect(() => {
   *   return () => {
   *     arrayNode.dispose();
   *   };
   * }, []);
   * ```
   */
  dispose(): void {
    // Очищаем все subscriptions через SubscriptionManager
    this.disposers.dispose();

    // Очищаем элементы массива
    this.items.value.forEach((item) => {
      if ('dispose' in item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
  }

  /**
   * Hook: вызывается после disable()
   *
   * Для ArrayNode: рекурсивно отключаем все элементы массива
   *
   * @example
   * ```typescript
   * // Отключить весь массив полей
   * form.items.disable();
   *
   * // Все элементы становятся disabled
   * form.items.forEach(item => {
   *   console.log(item.status.value); // 'disabled'
   * });
   * ```
   */
  protected onDisable(): void {
    this.items.value.forEach((item) => {
      item.disable();
    });
  }

  /**
   * Hook: вызывается после enable()
   *
   * Для ArrayNode: рекурсивно включаем все элементы массива
   *
   * @example
   * ```typescript
   * // Включить весь массив полей
   * form.items.enable();
   *
   * // Все элементы становятся enabled
   * form.items.forEach(item => {
   *   console.log(item.status.value); // 'valid' или 'invalid'
   * });
   * ```
   */
  protected onEnable(): void {
    this.items.value.forEach((item) => {
      item.enable();
    });
  }
}
