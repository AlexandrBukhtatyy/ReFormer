/**
 * FormNode - абстрактный базовый класс для всех узлов формы
 *
 * Аналог AbstractControl из Angular Forms
 * Унифицирует работу с полями (FieldNode), группами (GroupNode) и массивами (ArrayNode)
 *
 * Использует Template Method паттерн для управления состоянием:
 * - Публичные методы (markAsTouched, disable и т.д.) реализованы в базовом классе
 * - Protected hooks (onMarkAsTouched, onDisable и т.д.) переопределяются в наследниках
 */

import { signal, computed, type ReadonlySignal, type Signal } from '@preact/signals-core';
import type { FieldStatus, ValidationError, ErrorFilterOptions } from '../types';

/**
 * Опции для setValue
 */
export interface SetValueOptions {
  /** Не вызывать событие изменения (не триггерить валидацию) */
  emitEvent?: boolean;
  /** Обновить только этот узел, не распространять на родителей */
  onlySelf?: boolean;
}

/**
 * Абстрактный базовый класс для всех узлов формы
 *
 * Все узлы (поля, группы, массивы) наследуют от этого класса
 * и реализуют единый интерфейс для работы с состоянием и валидацией
 *
 * Template Method паттерн используется для управления состоянием:
 * - Общие signals (_touched, _dirty, _status) определены в базовом классе
 * - Публичные методы (markAsTouched, disable и т.д.) реализованы здесь
 * - Protected hooks (onMarkAsTouched, onDisable и т.д.) переопределяются в наследниках
 */
export abstract class FormNode<T = any> {
  // ============================================================================
  // Protected состояние (для Template Method паттерна)
  // ============================================================================

  /**
   * Пользователь взаимодействовал с узлом (touched)
   * Protected: наследники могут читать/изменять через методы
   */
  protected _touched: Signal<boolean> = signal(false);

  /**
   * Значение узла было изменено (dirty)
   * Protected: наследники могут читать/изменять через методы
   */
  protected _dirty: Signal<boolean> = signal(false);

  /**
   * Текущий статус узла
   * Protected: наследники могут читать/изменять через методы
   */
  protected _status: Signal<FieldStatus> = signal<FieldStatus>('valid');

  // ============================================================================
  // Публичные computed signals (readonly для внешнего мира)
  // ============================================================================

  /**
   * Пользователь взаимодействовал с узлом (touched)
   * Computed из _touched для предоставления readonly интерфейса
   */
  readonly touched: ReadonlySignal<boolean> = computed(() => this._touched.value);

  /**
   * Пользователь не взаимодействовал с узлом (untouched)
   */
  readonly untouched: ReadonlySignal<boolean> = computed(() => !this._touched.value);

  /**
   * Значение узла было изменено (dirty)
   * Computed из _dirty для предоставления readonly интерфейса
   */
  readonly dirty: ReadonlySignal<boolean> = computed(() => this._dirty.value);

  /**
   * Значение узла не было изменено (pristine)
   */
  readonly pristine: ReadonlySignal<boolean> = computed(() => !this._dirty.value);

  /**
   * Текущий статус узла
   * Computed из _status для предоставления readonly интерфейса
   */
  readonly status: ReadonlySignal<FieldStatus> = computed(() => this._status.value);

  /**
   * Узел отключен (disabled)
   */
  readonly disabled: ReadonlySignal<boolean> = computed(() => this._status.value === 'disabled');

  /**
   * Узел включен (enabled)
   */
  readonly enabled: ReadonlySignal<boolean> = computed(() => this._status.value !== 'disabled');

  // ============================================================================
  // Реактивные signals (должны быть реализованы в подклассах)
  // ============================================================================

  /**
   * Текущее значение узла
   * - Для FieldNode: значение поля
   * - Для GroupNode: объект со значениями всех полей
   * - Для ArrayNode: массив значений элементов
   */
  abstract readonly value: ReadonlySignal<T>;

  /**
   * Узел валиден (все валидаторы прошли успешно)
   */
  abstract readonly valid: ReadonlySignal<boolean>;

  /**
   * Узел невалиден (есть ошибки валидации)
   */
  abstract readonly invalid: ReadonlySignal<boolean>;

  /**
   * Выполняется асинхронная валидация
   */
  abstract readonly pending: ReadonlySignal<boolean>;

  /**
   * Массив ошибок валидации
   */
  abstract readonly errors: ReadonlySignal<ValidationError[]>;

  // ============================================================================
  // Методы управления значениями
  // ============================================================================

  /**
   * Получить значение узла (non-reactive)
   * Использует .peek() для получения значения без создания зависимости
   */
  abstract getValue(): T;

  /**
   * Установить значение узла
   * @param value - новое значение
   * @param options - опции установки значения
   */
  abstract setValue(value: T, options?: SetValueOptions): void;

  /**
   * Частично обновить значение узла
   * Для FieldNode: работает как setValue
   * Для GroupNode: обновляет только указанные поля
   * Для ArrayNode: обновляет только указанные элементы
   *
   * @param value - частичное значение для обновления
   */
  abstract patchValue(value: Partial<T>): void;

  /**
   * Сбросить узел к начальному состоянию
   * @param value - опциональное новое начальное значение
   */
  abstract reset(value?: T): void;

  // ============================================================================
  // Методы валидации
  // ============================================================================

  /**
   * Запустить валидацию узла
   * @returns Promise<boolean> - true если валидация успешна
   */
  abstract validate(): Promise<boolean>;

  /**
   * Установить ошибки валидации извне
   * @param errors - массив ошибок
   */
  abstract setErrors(errors: ValidationError[]): void;

  /**
   * Очистить ошибки валидации
   */
  abstract clearErrors(): void;

  /**
   * Получить ошибки валидации с фильтрацией
   *
   * Позволяет фильтровать ошибки по различным критериям:
   * - По коду ошибки
   * - По сообщению (частичное совпадение)
   * - По параметрам
   * - Через кастомный предикат
   *
   * Без параметров возвращает все ошибки (эквивалент errors.value)
   *
   * @param options - Опции фильтрации ошибок
   * @returns Отфильтрованный массив ошибок валидации
   *
   * @example
   * ```typescript
   * // Все ошибки
   * const allErrors = form.getErrors();
   *
   * // Ошибки с конкретным кодом
   * const requiredErrors = form.getErrors({ code: 'required' });
   *
   * // Ошибки с несколькими кодами
   * const errors = form.getErrors({ code: ['required', 'email'] });
   *
   * // Ошибки по сообщению
   * const passwordErrors = form.getErrors({ message: 'Password' });
   *
   * // Ошибки по параметрам
   * const minLengthErrors = form.getErrors({
   *   params: { minLength: 8 }
   * });
   *
   * // Кастомная фильтрация
   * const customErrors = form.getErrors({
   *   predicate: (err) => err.code.startsWith('custom_')
   * });
   * ```
   */
  getErrors(options?: ErrorFilterOptions): ValidationError[] {
    const allErrors = this.errors.value;

    // Без фильтрации - вернуть все ошибки
    if (!options) {
      return allErrors;
    }

    return allErrors.filter((error) => {
      // Фильтр по коду
      if (options.code !== undefined) {
        const codes = Array.isArray(options.code) ? options.code : [options.code];
        if (!codes.includes(error.code)) {
          return false;
        }
      }

      // Фильтр по сообщению (частичное совпадение, регистронезависимый)
      if (options.message !== undefined) {
        if (!error.message.toLowerCase().includes(options.message.toLowerCase())) {
          return false;
        }
      }

      // Фильтр по параметрам
      if (options.params !== undefined) {
        if (!error.params) {
          return false;
        }

        // Проверяем, что все ключи из options.params присутствуют в error.params
        // и имеют те же значения
        for (const [key, value] of Object.entries(options.params)) {
          if (error.params[key] !== value) {
            return false;
          }
        }
      }

      // Кастомный предикат
      if (options.predicate !== undefined) {
        if (!options.predicate(error)) {
          return false;
        }
      }

      return true;
    });
  }

  // ============================================================================
  // Методы управления состоянием (Template Method)
  // ============================================================================

  /**
   * Отметить узел как touched (пользователь взаимодействовал)
   *
   * Template Method: обновляет signal в базовом классе,
   * вызывает hook для кастомной логики в наследниках
   */
  markAsTouched(): void {
    this._touched.value = true;
    this.onMarkAsTouched();
  }

  /**
   * Отметить узел как untouched
   *
   * Template Method: обновляет signal в базовом классе,
   * вызывает hook для кастомной логики в наследниках
   */
  markAsUntouched(): void {
    this._touched.value = false;
    this.onMarkAsUntouched();
  }

  /**
   * Отметить узел как dirty (значение изменено)
   *
   * Template Method: обновляет signal в базовом классе,
   * вызывает hook для кастомной логики в наследниках
   */
  markAsDirty(): void {
    this._dirty.value = true;
    this.onMarkAsDirty();
  }

  /**
   * Отметить узел как pristine (значение не изменено)
   *
   * Template Method: обновляет signal в базовом классе,
   * вызывает hook для кастомной логики в наследниках
   */
  markAsPristine(): void {
    this._dirty.value = false;
    this.onMarkAsPristine();
  }

  /**
   * Пометить все поля (включая вложенные) как touched
   * Алиас для markAsTouched(), но более явно показывает намерение
   * пометить ВСЕ поля рекурсивно
   *
   * Полезно для:
   * - Показа всех ошибок валидации перед submit
   * - Принудительного отображения ошибок при нажатии "Validate All"
   * - Отображения невалидных полей в wizard/step form
   *
   * @example
   * ```typescript
   * // Показать все ошибки перед submit
   * form.touchAll();
   * const isValid = await form.validate();
   * if (!isValid) {
   *   // Все ошибки теперь видны пользователю
   * }
   *
   * // Или использовать submit() который уже вызывает touchAll
   * await form.submit(async (values) => {
   *   await api.save(values);
   * });
   * ```
   */
  touchAll(): void {
    this.markAsTouched();
  }

  // ============================================================================
  // Методы управления доступностью (Template Method)
  // ============================================================================

  /**
   * Отключить узел
   *
   * Template Method: обновляет статус в базовом классе,
   * вызывает hook для кастомной логики в наследниках
   *
   * Отключенные узлы не проходят валидацию и не включаются в getValue()
   */
  disable(): void {
    this._status.value = 'disabled';
    this.onDisable();
  }

  /**
   * Включить узел
   *
   * Template Method: обновляет статус в базовом классе,
   * вызывает hook для кастомной логики в наследниках
   */
  enable(): void {
    this._status.value = 'valid';
    this.onEnable();
  }

  /**
   * Очистить все ресурсы узла
   * Должен вызываться при unmount компонента для предотвращения memory leaks
   *
   * @example
   * ```typescript
   * // React component
   * useEffect(() => {
   *   return () => {
   *     form.dispose(); // Cleanup при unmount
   *   };
   * }, []);
   * ```
   */
  dispose?(): void;

  // ============================================================================
  // Protected hooks (для переопределения в наследниках)
  // ============================================================================

  /**
   * Hook: вызывается после markAsTouched()
   *
   * Переопределите в наследниках для дополнительной логики:
   * - GroupNode: пометить все дочерние узлы как touched
   * - ArrayNode: пометить все элементы массива как touched
   * - FieldNode: пустая реализация (нет дочерних узлов)
   *
   * @example
   * ```typescript
   * // GroupNode
   * protected onMarkAsTouched(): void {
   *   this.fields.forEach(field => field.markAsTouched());
   * }
   * ```
   */
  protected onMarkAsTouched(): void {
    // Пустая реализация по умолчанию
    // Наследники переопределяют при необходимости
  }

  /**
   * Hook: вызывается после markAsUntouched()
   *
   * Переопределите в наследниках для дополнительной логики:
   * - GroupNode: пометить все дочерние узлы как untouched
   * - ArrayNode: пометить все элементы массива как untouched
   * - FieldNode: пустая реализация (нет дочерних узлов)
   */
  protected onMarkAsUntouched(): void {
    // Пустая реализация по умолчанию
  }

  /**
   * Hook: вызывается после markAsDirty()
   *
   * Переопределите в наследниках для дополнительной логики:
   * - GroupNode: может обновить родительскую форму
   * - ArrayNode: может обновить родительскую форму
   * - FieldNode: пустая реализация
   */
  protected onMarkAsDirty(): void {
    // Пустая реализация по умолчанию
  }

  /**
   * Hook: вызывается после markAsPristine()
   *
   * Переопределите в наследниках для дополнительной логики:
   * - GroupNode: пометить все дочерние узлы как pristine
   * - ArrayNode: пометить все элементы массива как pristine
   * - FieldNode: пустая реализация
   */
  protected onMarkAsPristine(): void {
    // Пустая реализация по умолчанию
  }

  /**
   * Hook: вызывается после disable()
   *
   * Переопределите в наследниках для дополнительной логики:
   * - GroupNode: отключить все дочерние узлы
   * - ArrayNode: отключить все элементы массива
   * - FieldNode: очистить ошибки валидации
   *
   * @example
   * ```typescript
   * // GroupNode
   * protected onDisable(): void {
   *   this.fields.forEach(field => field.disable());
   * }
   * ```
   */
  protected onDisable(): void {
    // Пустая реализация по умолчанию
  }

  /**
   * Hook: вызывается после enable()
   *
   * Переопределите в наследниках для дополнительной логики:
   * - GroupNode: включить все дочерние узлы
   * - ArrayNode: включить все элементы массива
   * - FieldNode: пустая реализация
   */
  protected onEnable(): void {
    // Пустая реализация по умолчанию
  }
}
