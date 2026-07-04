/**
 * FormSubmitter - управление отправкой формы
 *
 * Извлечен из GroupNode для:
 * - Единообразной обработки submit
 * - Расширяемости (hooks before/after submit)
 * - Тестируемости
 *
 * @group Utils
 * @module utils/form-submitter
 */

import { signal, computed } from '@preact/signals-core';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * Интерфейс формы для FormSubmitter
 * Минимальный контракт для работы с любой формой
 */
export interface SubmittableForm<T extends object> {
  /** Пометить все поля как touched */
  markAsTouched(): void;
  /** Валидировать форму */
  validate(): Promise<boolean>;
  /** Получить значения формы */
  getValue(): T;
}

/**
 * Опции для submit
 */
export interface SubmitOptions {
  /** Пропустить валидацию перед submit */
  skipValidation?: boolean;
  /** Пропустить markAsTouched перед submit */
  skipTouch?: boolean;
}

/**
 * Результат submit
 */
export interface SubmitResult<R> {
  /** Успешно ли выполнен submit */
  success: boolean;
  /** Результат от onSubmit callback */
  data: R | null;
  /** Ошибка, если submit не удался */
  error?: Error;
}

/**
 * FormSubmitter - управляет процессом отправки формы
 *
 * @example
 * ```typescript
 * const submitter = new FormSubmitter(form);
 *
 * // Простой submit
 * const result = await submitter.submit(async (values) => {
 *   return await api.saveForm(values);
 * });
 *
 * // Проверка состояния
 * if (submitter.submitting.value) {
 *   console.log('Форма отправляется...');
 * }
 * ```
 */
export class FormSubmitter<T extends object> {
  /** Внутренний сигнал состояния отправки */
  private readonly _submitting = signal(false);

  /** Публичный read-only сигнал состояния отправки */
  readonly submitting: ReadonlySignal<boolean> = computed(() => this._submitting.value);

  /**
   * @param form - Форма для отправки
   */
  constructor(private readonly form: SubmittableForm<T>) {}

  /**
   * Отправить форму
   *
   * Процесс:
   * 1. Помечает все поля как touched (для отображения ошибок)
   * 2. Валидирует форму
   * 3. Если валидация успешна - вызывает onSubmit
   * 4. Управляет состоянием submitting
   *
   * @param onSubmit - Callback для отправки данных
   * @param options - Опции submit
   * @returns Результат от onSubmit или null если валидация не пройдена
   *
   * @example
   * ```typescript
   * const result = await submitter.submit(async (values) => {
   *   const response = await fetch('/api/form', {
   *     method: 'POST',
   *     body: JSON.stringify(values)
   *   });
   *   return response.json();
   * });
   *
   * if (result === null) {
   *   console.log('Форма не прошла валидацию');
   * }
   * ```
   */
  async submit<R>(
    onSubmit: (values: T) => Promise<R> | R,
    options?: SubmitOptions
  ): Promise<R | null> {
    const { skipValidation = false, skipTouch = false } = options || {};

    // Помечаем все поля как touched для отображения ошибок
    if (!skipTouch) {
      this.form.markAsTouched();
    }

    // Валидируем форму
    if (!skipValidation) {
      const isValid = await this.form.validate();
      if (!isValid) {
        return null;
      }
    }

    // Устанавливаем состояние отправки
    this._submitting.value = true;

    try {
      const result = await onSubmit(this.form.getValue());
      return result;
    } finally {
      this._submitting.value = false;
    }
  }

  /**
   * Отправить форму с расширенным результатом
   *
   * В отличие от submit(), возвращает объект с информацией об успехе/ошибке
   *
   * @param onSubmit - Callback для отправки данных
   * @param options - Опции submit
   * @returns Объект SubmitResult с данными и статусом
   *
   * @example
   * ```typescript
   * const result = await submitter.submitWithResult(async (values) => {
   *   return await api.saveForm(values);
   * });
   *
   * if (result.success) {
   *   console.log('Сохранено:', result.data);
   * } else if (result.error) {
   *   console.error('Ошибка:', result.error.message);
   * } else {
   *   console.log('Валидация не пройдена');
   * }
   * ```
   */
  async submitWithResult<R>(
    onSubmit: (values: T) => Promise<R> | R,
    options?: SubmitOptions
  ): Promise<SubmitResult<R>> {
    const { skipValidation = false, skipTouch = false } = options || {};

    // Помечаем все поля как touched
    if (!skipTouch) {
      this.form.markAsTouched();
    }

    // Валидируем форму
    if (!skipValidation) {
      const isValid = await this.form.validate();
      if (!isValid) {
        return { success: false, data: null };
      }
    }

    this._submitting.value = true;

    try {
      const data = await onSubmit(this.form.getValue());
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      this._submitting.value = false;
    }
  }

  /**
   * Проверить, идет ли отправка формы
   */
  isSubmitting(): boolean {
    return this._submitting.value;
  }
}
