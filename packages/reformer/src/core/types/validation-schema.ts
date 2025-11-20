/**
 * Типы для validation schema паттерна
 *
 * Основано на Angular Signal Forms подходе:
 * - Валидация определяется отдельно от схемы полей
 * - Поддержка условной валидации (applyWhen)
 * - Cross-field валидация (validateTree)
 * - Асинхронная валидация с контекстом
 */

import type { FormFields, ValidationError } from './index';
import type { FieldPath } from './field-path';

// Forward declarations для избежания циклических зависимостей
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GroupNode<_T> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldNode<_T> = any;

// ============================================================================
// Контекст валидации
// ============================================================================

/**
 * Контекст валидации для отдельного поля
 * Предоставляет доступ к:
 * - Значению текущего поля
 * - Значениям других полей
 * - Всей форме
 */
export interface ValidationContext<TForm, TField> {
  /**
   * Получить текущее значение поля
   */
  value(): TField;

  /**
   * Получить значение другого поля по пути
   * @param path - Путь к полю (например, 'loanType', 'personalData.firstName')
   */
  getField<K extends keyof TForm>(path: K): TForm[K];
  getField(path: string): unknown;

  /**
   * Установить значение другого поля по пути
   * @param path - Путь к полю (например, 'loanType', 'personalData.firstName')
   * @param value - Новое значение поля
   */
  setField<K extends keyof TForm>(path: K, value: TForm[K]): void;
  setField(path: string, value: unknown): void;

  /**
   * Получить значения всей формы
   */
  formValue(): TForm;

  /**
   * Получить контроллер поля
   */
  getControl(): FieldNode<TField>;

  /**
   * Получить GroupNode
   */
  getForm(): GroupNode<TForm>;
}

/**
 * Контекст для cross-field валидации
 * Имеет доступ ко всей форме, но не к конкретному полю
 */
export interface TreeValidationContext<TForm> {
  /**
   * Получить значение поля по пути
   */
  getField<K extends keyof TForm>(path: K): TForm[K];
  getField(path: string): unknown;

  /**
   * Получить значения всей формы
   */
  formValue(): TForm;

  /**
   * Получить GroupNode
   */
  getForm(): GroupNode<TForm>;
}

// ============================================================================
// Функции валидации
// ============================================================================

/**
 * Функция валидации поля с контекстом
 */
export type ContextualValidatorFn<TForm, TField> = (
  ctx: ValidationContext<TForm, TField>
) => FormFields | null;

/**
 * Асинхронная функция валидации поля с контекстом
 */
export type ContextualAsyncValidatorFn<TForm, TField> = (
  ctx: ValidationContext<TForm, TField>
) => Promise<FormFields | null>;

/**
 * Функция cross-field валидации
 */
export type TreeValidatorFn<TForm> = (ctx: TreeValidationContext<TForm>) => ValidationError | null;

/**
 * Функция условия для applyWhen
 */
export type ConditionFn<T> = (value: T) => boolean;

// ============================================================================
// Опции валидации
// ============================================================================

/**
 * Опции для функции validate
 */
export interface ValidateOptions {
  /** Сообщение об ошибке */
  message?: string;
  /** Параметры ошибки */
  params?: FormFields;
}

/**
 * Опции для функции validateAsync
 */
export interface ValidateAsyncOptions extends ValidateOptions {
  /** Задержка перед выполнением валидации (в мс) */
  debounce?: number;
}

/**
 * Опции для функции validateTree
 */
export interface ValidateTreeOptions {
  /** Поле, к которому привязать ошибку */
  targetField?: string;
}

// ============================================================================
// Тип функции validation schema
// ============================================================================

/**
 * Функция validation schema
 *
 * Принимает FieldPath и определяет все правила валидации для формы
 */
export type ValidationSchemaFn<T> = (path: FieldPath<T>) => void;

// ============================================================================
// Внутренние типы для реализации
// ============================================================================

/**
 * Регистрация валидатора в системе
 * @internal
 */
export interface ValidatorRegistration {
  fieldPath: string;
  type: 'sync' | 'async' | 'tree';
  validator:
    | ContextualValidatorFn<unknown, unknown>
    | ContextualAsyncValidatorFn<unknown, unknown>
    | TreeValidatorFn<unknown>;
  options?: ValidateOptions | ValidateAsyncOptions | ValidateTreeOptions;
  condition?: {
    fieldPath: string;
    conditionFn: ConditionFn<unknown>;
  };
}
