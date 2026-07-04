// ============================================================================
// Form Value Types
// ============================================================================

/**
 * Represents any valid form value type
 * Use this instead of 'any' for form values to maintain type safety
 *
 * @group Types
 * @category Core Types
 */
export type FormValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | File
  | FormValue[]
  | { [key: string]: FormValue };

/**
 * Type-safe alternative to 'any' for unknown form values
 * Requires explicit type checking before use
 * @internal
 */
export type UnknownFormValue = unknown;

// ============================================================================
// Validator Types
// ============================================================================

/**
 * Синхронная функция валидации
 * @group Types
 * @category Validation Types
 */
export type ValidatorFn<T = FormValue> = (value: T) => ValidationError | null;

/**
 * Опции для асинхронного валидатора
 * @group Types
 * @category Validation Types
 */
export interface AsyncValidatorOptions {
  /**
   * AbortSignal для отмены валидации
   * Позволяет отменить асинхронную операцию при новой валидации
   */
  signal?: AbortSignal;
}

/**
 * Асинхронная функция валидации
 *
 * @param value - Значение для валидации
 * @param options - Опции валидации (опционально)
 * @returns Promise с ошибкой валидации или null если значение валидно
 *
 * @example
 * ```typescript
 * // Простой валидатор (без поддержки отмены)
 * const emailExists: AsyncValidatorFn<string> = async (value) => {
 *   const exists = await checkEmail(value);
 *   return exists ? { code: 'exists', message: 'Email already exists' } : null;
 * };
 *
 * // Валидатор с поддержкой отмены
 * const emailExistsAbortable: AsyncValidatorFn<string> = async (value, options) => {
 *   const exists = await fetch(`/api/check-email?email=${value}`, {
 *     signal: options?.signal // Передаём signal в fetch для отмены запроса
 *   });
 *   return exists ? { code: 'exists', message: 'Email already exists' } : null;
 * };
 * ```
 *
 * @group Types
 * @category Validation Types
 */
export type AsyncValidatorFn<T = FormValue> = (
  value: T,
  options?: AsyncValidatorOptions
) => Promise<ValidationError | null>;

/**
 * Ошибка валидации
 * @group Types
 * @category Validation Types
 */
export interface ValidationError {
  code: string;
  message: string;
  params?: Record<string, FormValue>;
  /** Severity level: 'error' (default) blocks submission, 'warning' shows message but allows submission */
  severity?: 'error' | 'warning';
}

/**
 * Опции для фильтрации ошибок в методе getErrors()
 * @group Types
 * @category Validation Types
 */
export interface ErrorFilterOptions {
  /** Фильтр по коду ошибки */
  code?: string | string[];

  /** Фильтр по сообщению (поддерживает частичное совпадение) */
  message?: string;

  /** Фильтр по параметрам ошибки */
  params?: Record<string, FormValue>;

  /** Кастомный предикат для фильтрации */
  predicate?: (error: ValidationError) => boolean;
}

// ============================================================================
// Field Status
// ============================================================================

/**
 * Статус поля формы
 * @group Types
 * @category Core Types
 */
export type FieldStatus = 'valid' | 'invalid' | 'pending' | 'disabled';

// ============================================================================
// Field Configuration (re-exported from deep-schema)
// ============================================================================

// Import and re-export FieldConfig from deep-schema for single source of truth
export type { FieldConfig } from './deep-schema';

// ============================================================================
// Re-exports from validation-schema (чистые валидаторы M1)
// ============================================================================

export type {
  Validator,
  AsyncValidator,
  ConditionFn,
  ValidateOptions,
  ValidateAsyncOptions,
} from './validation-schema';

// ============================================================================
// Re-exports from deep-schema
// ============================================================================

export type { FormSchema, ArrayConfig } from './deep-schema';

// ============================================================================
// Re-exports from schema-node (узел единой схемы M1)
// ============================================================================

export type { FormSchemaNode, SchemaArrayControl, SchemaValidator } from './schema-node';

// ============================================================================
// Re-exports from form-proxy (Typed Proxy Access)
// ============================================================================

export type { FormControlsProxy, FormProxy, FormArrayProxy } from './form-proxy';

// ============================================================================
// GroupNode Configuration
// ============================================================================

import type { FormSchema } from './deep-schema';

/**
 * Конфигурация GroupNode.
 *
 * Под M1 группа создаётся из плоской {@link FormSchema} (дерево field-конфигов). Обёртка
 * `{ form }` сохранена для совместимости вызова, legacy behavior/validation-схемы удалены (Ф7).
 *
 * @group Types
 * @category Configuration Types
 */
export interface GroupNodeConfig<T> {
  /** Схема структуры формы (поля и их конфигурация) */
  form: FormSchema<T>;
}

// ============================================================================
// Utility Types для избежания инлайновых типов
// ============================================================================

/**
 * Тип для Record с unknown значениями
 * Используется вместо инлайнового `Record<string, unknown>`
 * @internal
 */
export type UnknownRecord = Record<string, unknown>;

/**
 * Интерфейс для узлов с методом applyValidationSchema
 * @internal
 */
export interface WithValidationSchema {
  applyValidationSchema(schemaFn: unknown): void;
}

/**
 * Интерфейс для узлов с методом applyBehaviorSchema
 * @internal
 */
export interface WithBehaviorSchema {
  applyBehaviorSchema(schemaFn: unknown): void;
}

/**
 * Интерфейс для узлов, похожих на ArrayNode (с методом at)
 * Используется для duck typing при обходе путей
 * @internal
 */
export interface ArrayNodeLike {
  at(index: number): FormNode<unknown> | undefined;
  length: unknown;
}

// Импортируем FormNode для типа ArrayNodeLike
import type { FormNode } from '../nodes/form-node';

/**
 * Конфиг с полем schema (для ArrayConfig)
 * @internal
 */
export interface ConfigWithSchema {
  schema: unknown;
  initialItems?: unknown[];
}

/**
 * Конфиг с полем value (для извлечения значений)
 * @internal
 */
export interface ConfigWithValue {
  value: unknown;
}

/**
 * Тип для путей к полям (field paths)
 * Используется в навигации по полям вместо any
 * @internal
 */
export type FieldPathSegment = {
  key: string;
  index?: number;
};

/**
 * Тип для коллбэков и обработчиков событий
 * Используется вместо (...args: any[]) => any
 * @internal
 */
export type UnknownCallback = (...args: unknown[]) => unknown;

/**
 * Тип для проверки на функцию в conditional types
 * Используется вместо Function для type narrowing
 * @internal
 */
export type AnyFunction = (...args: never[]) => unknown;

/**
 * Тип для результатов загрузки ресурсов
 * @internal
 */
export type ResourceLoadResult = unknown;
