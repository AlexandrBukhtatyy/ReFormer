/**
 * StateManager - управление состоянием GroupNode
 *
 * Инкапсулирует всю логику создания и управления сигналами состояния:
 * - Приватные сигналы (submitting, disabled, formErrors)
 * - Публичные computed signals (value, valid, invalid, touched, dirty, pending, errors, status, submitting)
 *
 * Извлечено из GroupNode для соблюдения SRP (Single Responsibility Principle).
 * Отвечает только за логику управления состоянием формы.
 *
 * @template T Тип формы (объект)
 *
 * @example
 * ```typescript
 * class GroupNode {
 *   private stateManager: StateManager<T>;
 *
 *   constructor(schema: FormSchema<T>) {
 *     this.fieldRegistry = new FieldRegistry<T>();
 *     // ... создание полей ...
 *     this.stateManager = new StateManager(this.fieldRegistry);
 *
 *     // Доступ к computed signals
 *     this.value = this.stateManager.value;
 *     this.valid = this.stateManager.valid;
 *   }
 * }
 * ```
 */

import { signal, computed } from '@preact/signals-core';
import type { Signal, ReadonlySignal } from '@preact/signals-core';
import type { ValidationError, FieldStatus, FormFields } from '../../types';
import type { FieldRegistry } from './field-registry';

/**
 * Менеджер состояния для GroupNode
 *
 * Создает и управляет всеми сигналами состояния формы:
 * - value - значение формы как объект
 * - valid/invalid - валидность формы
 * - touched/dirty - пользовательское взаимодействие
 * - pending - асинхронная валидация в процессе
 * - errors - все ошибки валидации (form-level + field-level)
 * - status - общий статус формы
 * - submitting - флаг отправки формы
 *
 * @template T Тип формы (объект)
 */
export class StateManager<T extends FormFields> {
  // ============================================================================
  // Приватные сигналы (мутабельные)
  // ============================================================================

  /**
   * Флаг отправки формы
   * Устанавливается в true во время отправки формы на сервер
   */
  private _submitting: Signal<boolean>;

  /**
   * Флаг disabled состояния
   * Если true, форма считается disabled
   */
  private _disabled: Signal<boolean>;

  /**
   * Form-level validation errors (не связанные с конкретным полем)
   * Используется для server-side errors или кросс-полевой валидации
   */
  private _formErrors: Signal<ValidationError[]>;

  // ============================================================================
  // Публичные computed signals (read-only)
  // ============================================================================

  /**
   * Значение формы как объект
   *
   * Computed signal, который автоматически пересчитывается при изменении любого поля.
   * Использует мемоизацию - если зависимости не изменились, вернет закешированный объект.
   *
   * @example
   * ```typescript
   * const form = new GroupNode({ email: { value: 'test@mail.com' } });
   * console.log(form.value.value); // { email: 'test@mail.com' }
   * ```
   */
  public readonly value: ReadonlySignal<T>;

  /**
   * Форма валидна?
   *
   * Computed signal. Форма валидна, если:
   * - Нет form-level errors
   * - Все поля валидны
   */
  public readonly valid: ReadonlySignal<boolean>;

  /**
   * Форма невалидна?
   *
   * Computed signal. Инверсия valid.
   */
  public readonly invalid: ReadonlySignal<boolean>;

  /**
   * Хотя бы одно поле touched?
   *
   * Computed signal. Возвращает true, если хотя бы одно поле было touched.
   */
  public readonly touched: ReadonlySignal<boolean>;

  /**
   * Хотя бы одно поле dirty?
   *
   * Computed signal. Возвращает true, если хотя бы одно поле изменилось.
   */
  public readonly dirty: ReadonlySignal<boolean>;

  /**
   * Асинхронная валидация в процессе?
   *
   * Computed signal. Возвращает true, если хотя бы одно поле находится в pending состоянии.
   */
  public readonly pending: ReadonlySignal<boolean>;

  /**
   * Все ошибки валидации
   *
   * Computed signal. Возвращает массив всех ошибок:
   * - Form-level errors
   * - Field-level errors (из всех вложенных полей)
   */
  public readonly errors: ReadonlySignal<ValidationError[]>;

  /**
   * Общий статус формы
   *
   * Computed signal. Возможные значения:
   * - 'disabled' - форма disabled
   * - 'pending' - асинхронная валидация в процессе
   * - 'invalid' - форма невалидна
   * - 'valid' - форма валидна
   */
  public readonly status: ReadonlySignal<FieldStatus>;

  /**
   * Форма в процессе отправки?
   *
   * Computed signal (обертка над _submitting для read-only доступа).
   */
  public readonly submitting: ReadonlySignal<boolean>;

  // ============================================================================
  // Конструктор
  // ============================================================================

  /**
   * Создать менеджер состояния
   *
   * @param fieldRegistry - реестр полей формы
   */
  constructor(private readonly fieldRegistry: FieldRegistry<T>) {
    // Инициализация приватных сигналов
    this._submitting = signal(false);
    this._disabled = signal(false);
    this._formErrors = signal<ValidationError[]>([]);

    // Создание computed signals

    // Computed signal для значения формы
    // Автоматически кеширует результат (мемоизация)
    // Первый вызов: O(n) где n = количество полей
    // Повторные вызовы (если зависимости не изменились): O(1) (возврат кешированного объекта)
    this.value = computed(() => {
      const result = {} as T;
      this.fieldRegistry.forEach((field, key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = field.value.value as any;
      });
      return result;
    });

    // Computed signal для валидности формы
    this.valid = computed(() => {
      // Проверяем отсутствие form-level errors
      const hasFormErrors = this._formErrors.value.length > 0;
      if (hasFormErrors) return false;

      // Проверяем все поля
      return Array.from(this.fieldRegistry.values()).every((field) => field.valid.value);
    });

    // Computed signal для невалидности (инверсия valid)
    this.invalid = computed(() => !this.valid.value);

    // Computed signal для pending состояния
    this.pending = computed(() =>
      Array.from(this.fieldRegistry.values()).some((field) => field.pending.value)
    );

    // Computed signal для touched состояния
    this.touched = computed(() =>
      Array.from(this.fieldRegistry.values()).some((field) => field.touched.value)
    );

    // Computed signal для dirty состояния
    this.dirty = computed(() =>
      Array.from(this.fieldRegistry.values()).some((field) => field.dirty.value)
    );

    // Computed signal для ошибок (form-level + field-level)
    this.errors = computed(() => {
      const allErrors: ValidationError[] = [];

      // Добавляем form-level errors
      allErrors.push(...this._formErrors.value);

      // Добавляем field-level errors
      this.fieldRegistry.forEach((field) => {
        allErrors.push(...field.errors.value);
      });

      return allErrors;
    });

    // Computed signal для статуса формы
    this.status = computed(() => {
      if (this._disabled.value) return 'disabled';
      if (this.pending.value) return 'pending';
      if (this.invalid.value) return 'invalid';
      return 'valid';
    });

    // Computed signal для submitting (read-only обертка)
    this.submitting = computed(() => this._submitting.value);
  }

  // ============================================================================
  // Публичные методы для управления состоянием
  // ============================================================================

  /**
   * Установить form-level ошибки
   *
   * @param errors - массив ошибок валидации
   *
   * @example
   * ```typescript
   * // Server-side ошибки
   * stateManager.setFormErrors([
   *   { code: 'server_error', message: 'Пользователь с таким email уже существует' }
   * ]);
   * ```
   */
  setFormErrors(errors: ValidationError[]): void {
    this._formErrors.value = errors;
  }

  /**
   * Очистить form-level ошибки
   */
  clearFormErrors(): void {
    this._formErrors.value = [];
  }

  /**
   * Получить form-level ошибки
   */
  getFormErrors(): ValidationError[] {
    return this._formErrors.value;
  }

  /**
   * Установить флаг submitting
   *
   * @param value - true если форма отправляется, false если нет
   *
   * @example
   * ```typescript
   * stateManager.setSubmitting(true);
   * await api.submitForm(form.getValue());
   * stateManager.setSubmitting(false);
   * ```
   */
  setSubmitting(value: boolean): void {
    this._submitting.value = value;
  }

  /**
   * Установить флаг disabled
   *
   * @param value - true если форма disabled, false если нет
   */
  setDisabled(value: boolean): void {
    this._disabled.value = value;
  }

  /**
   * Получить флаг disabled
   */
  isDisabled(): boolean {
    return this._disabled.value;
  }
}
