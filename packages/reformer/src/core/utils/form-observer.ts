/**
 * FormObserver - утилита для отладки и мониторинга форм
 *
 * Предоставляет:
 * - Подписку на изменения в форме
 * - Логирование событий (DEV mode)
 * - Трассировку изменений состояния
 *
 * @group Utils
 * @module utils/form-observer
 */

import { effect } from '@preact/signals-core';
import type { FormFields, FormValue, FieldStatus, ValidationError } from '../types';

/**
 * Тип события изменения в форме
 */
export type FormChangeType = 'value' | 'status' | 'errors' | 'touched' | 'dirty';

/**
 * Событие изменения в форме
 */
export interface FormChangeEvent {
  /** Тип изменения */
  type: FormChangeType;
  /** Путь к полю */
  path: string;
  /** Timestamp события */
  timestamp: number;
  /** Старое значение */
  oldValue?: unknown;
  /** Новое значение */
  newValue: unknown;
}

/**
 * Интерфейс узла формы для observer
 */
export interface ObservableFormNode {
  value: { value: FormValue };
  status: { value: FieldStatus };
  errors: { value: ValidationError[] };
  touched: { value: boolean };
  dirty: { value: boolean };
}

/**
 * Интерфейс формы для observer
 */
export interface ObservableForm<T extends FormFields> {
  value: { value: T };
  status: { value: FieldStatus };
  errors: { value: ValidationError[] };
  touched: { value: boolean };
  dirty: { value: boolean };
  getFieldByPath(path: string): ObservableFormNode | undefined;
}

/**
 * Callback для обработки событий изменения
 */
export type FormChangeCallback = (event: FormChangeEvent) => void;

/**
 * Опции для FormObserver
 */
export interface FormObserverOptions {
  /** Включить логирование в консоль (по умолчанию true в DEV) */
  enableLogging?: boolean;
  /** Фильтр типов событий */
  eventTypes?: FormChangeType[];
  /** Фильтр путей полей (regex или массив) */
  pathFilter?: RegExp | string[];
}

/**
 * FormObserver - мониторинг изменений в форме
 *
 * Полезен для:
 * - Отладки сложных форм
 * - Логирования изменений для аудита
 * - Синхронизации с внешними системами
 *
 * @example
 * ```typescript
 * const observer = new FormObserver(form, {
 *   enableLogging: true,
 *   eventTypes: ['value', 'errors']
 * });
 *
 * // Подписка на события
 * const unsubscribe = observer.subscribe((event) => {
 *   console.log(`${event.type} at ${event.path}:`, event.newValue);
 * });
 *
 * // Включить трассировку
 * const disposeTracing = observer.enableTracing();
 *
 * // Cleanup
 * unsubscribe();
 * disposeTracing();
 * ```
 */
export class FormObserver<T extends FormFields> {
  private listeners = new Set<FormChangeCallback>();
  private disposers: Array<() => void> = [];
  private options: Required<FormObserverOptions>;

  /**
   * @param form - Форма для наблюдения
   * @param options - Опции observer
   */
  constructor(
    private readonly form: ObservableForm<T>,
    options?: FormObserverOptions
  ) {
    this.options = {
      enableLogging: import.meta.env.DEV ?? false,
      eventTypes: ['value', 'status', 'errors', 'touched', 'dirty'],
      pathFilter: [],
      ...options,
    };
  }

  /**
   * Подписаться на события изменения
   *
   * @param callback - Функция обработки события
   * @returns Функция отписки
   *
   * @example
   * ```typescript
   * const unsubscribe = observer.subscribe((event) => {
   *   // Отправить событие в analytics
   *   analytics.track('form_change', event);
   * });
   * ```
   */
  subscribe(callback: FormChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Включить трассировку формы
   *
   * Подписывается на изменения основных сигналов формы
   * и вызывает listeners при каждом изменении
   *
   * @returns Функция для отключения трассировки
   *
   * @example
   * ```typescript
   * const dispose = observer.enableTracing();
   *
   * // Позже, для отключения
   * dispose();
   * ```
   */
  enableTracing(): () => void {
    // Трассировка value
    if (this.shouldTrack('value')) {
      let prevValue = this.form.value.value;
      const disposeValue = effect(() => {
        const newValue = this.form.value.value;
        if (newValue !== prevValue) {
          this.emit({
            type: 'value',
            path: '',
            timestamp: Date.now(),
            oldValue: prevValue,
            newValue,
          });
          prevValue = newValue;
        }
      });
      this.disposers.push(disposeValue);
    }

    // Трассировка status
    if (this.shouldTrack('status')) {
      let prevStatus = this.form.status.value;
      const disposeStatus = effect(() => {
        const newStatus = this.form.status.value;
        if (newStatus !== prevStatus) {
          this.emit({
            type: 'status',
            path: '',
            timestamp: Date.now(),
            oldValue: prevStatus,
            newValue: newStatus,
          });
          prevStatus = newStatus;
        }
      });
      this.disposers.push(disposeStatus);
    }

    // Трассировка errors
    if (this.shouldTrack('errors')) {
      let prevErrors = this.form.errors.value;
      const disposeErrors = effect(() => {
        const newErrors = this.form.errors.value;
        if (newErrors !== prevErrors) {
          this.emit({
            type: 'errors',
            path: '',
            timestamp: Date.now(),
            oldValue: prevErrors,
            newValue: newErrors,
          });
          prevErrors = newErrors;
        }
      });
      this.disposers.push(disposeErrors);
    }

    // Трассировка touched
    if (this.shouldTrack('touched')) {
      let prevTouched = this.form.touched.value;
      const disposeTouched = effect(() => {
        const newTouched = this.form.touched.value;
        if (newTouched !== prevTouched) {
          this.emit({
            type: 'touched',
            path: '',
            timestamp: Date.now(),
            oldValue: prevTouched,
            newValue: newTouched,
          });
          prevTouched = newTouched;
        }
      });
      this.disposers.push(disposeTouched);
    }

    // Трассировка dirty
    if (this.shouldTrack('dirty')) {
      let prevDirty = this.form.dirty.value;
      const disposeDirty = effect(() => {
        const newDirty = this.form.dirty.value;
        if (newDirty !== prevDirty) {
          this.emit({
            type: 'dirty',
            path: '',
            timestamp: Date.now(),
            oldValue: prevDirty,
            newValue: newDirty,
          });
          prevDirty = newDirty;
        }
      });
      this.disposers.push(disposeDirty);
    }

    // Возвращаем функцию отключения
    return () => {
      this.disposers.forEach((dispose) => dispose());
      this.disposers = [];
    };
  }

  /**
   * Наблюдать за конкретным полем
   *
   * @param path - Путь к полю
   * @returns Функция для отключения наблюдения
   *
   * @example
   * ```typescript
   * // Наблюдать за полем email
   * const dispose = observer.watchField('email');
   * ```
   */
  watchField(path: string): () => void {
    const field = this.form.getFieldByPath(path);
    if (!field) {
      if (import.meta.env.DEV) {
        console.warn(`FormObserver: field "${path}" not found`);
      }
      return () => {};
    }

    const disposers: Array<() => void> = [];

    // Наблюдение за value
    if (this.shouldTrack('value')) {
      let prevValue = field.value.value;
      const dispose = effect(() => {
        const newValue = field.value.value;
        if (newValue !== prevValue) {
          this.emit({
            type: 'value',
            path,
            timestamp: Date.now(),
            oldValue: prevValue,
            newValue,
          });
          prevValue = newValue;
        }
      });
      disposers.push(dispose);
    }

    // Наблюдение за status
    if (this.shouldTrack('status')) {
      let prevStatus = field.status.value;
      const dispose = effect(() => {
        const newStatus = field.status.value;
        if (newStatus !== prevStatus) {
          this.emit({
            type: 'status',
            path,
            timestamp: Date.now(),
            oldValue: prevStatus,
            newValue: newStatus,
          });
          prevStatus = newStatus;
        }
      });
      disposers.push(dispose);
    }

    return () => disposers.forEach((dispose) => dispose());
  }

  /**
   * Отправить событие всем listeners
   */
  private emit(event: FormChangeEvent): void {
    // Проверка фильтра пути
    if (!this.matchesPathFilter(event.path)) {
      return;
    }

    // Логирование
    if (this.options.enableLogging) {
      console.log(`[FormObserver] ${event.type} at "${event.path || 'root'}":`, event.newValue);
    }

    // Вызов listeners
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[FormObserver] Error in listener:', error);
        }
      }
    });
  }

  /**
   * Проверить, нужно ли отслеживать тип события
   */
  private shouldTrack(type: FormChangeType): boolean {
    return this.options.eventTypes.includes(type);
  }

  /**
   * Проверить, соответствует ли путь фильтру
   */
  private matchesPathFilter(path: string): boolean {
    const { pathFilter } = this.options;

    // Если фильтр пустой, пропускаем все
    if (!pathFilter || (Array.isArray(pathFilter) && pathFilter.length === 0)) {
      return true;
    }

    // RegExp фильтр
    if (pathFilter instanceof RegExp) {
      return pathFilter.test(path);
    }

    // Массив путей
    return pathFilter.includes(path);
  }

  /**
   * Очистить все подписки и disposers
   */
  dispose(): void {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.listeners.clear();
  }
}
