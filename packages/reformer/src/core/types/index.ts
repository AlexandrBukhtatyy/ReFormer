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
 * Асинхронная функция валидации
 * @group Types
 * @category Validation Types
 */
export type AsyncValidatorFn<T = FormValue> = (value: T) => Promise<ValidationError | null>;

/**
 * Ошибка валидации
 * @group Types
 * @category Validation Types
 */
export interface ValidationError {
  code: string;
  message: string;
  params?: FormFields;
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
  params?: FormFields;

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
export type { FieldPath, FieldPathNode } from '../types/field-path';

// ============================================================================
// Re-exports from validation-schema
// ============================================================================

export type {
  ContextualValidatorFn,
  ContextualAsyncValidatorFn,
  TreeValidatorFn,
  ConditionFn,
  ValidateOptions,
  ValidateAsyncOptions,
  ValidateTreeOptions,
  ValidationSchemaFn,
  ValidatorRegistration,
} from './validation-schema';

// ============================================================================
// Re-exports from deep-schema
// ============================================================================

export type { FormSchema, ArrayConfig } from './deep-schema';

// ============================================================================
// Re-exports from form-context (Unified Context)
// ============================================================================

export type { FormContext } from './form-context';

// ============================================================================
// Re-exports from group-node-proxy (Typed Proxy Access)
// ============================================================================

export type {
  FormNodeControls,
  GroupNodeWithControls,
  ArrayNodeWithControls,
} from './group-node-proxy';

// ============================================================================
// GroupNode Configuration (with schemas)
// ============================================================================

import type { BehaviorSchemaFn } from '../behavior/types';
import type { FormSchema } from './deep-schema';
import type { ValidationSchemaFn } from './validation-schema';

/**
 * Конфигурация GroupNode с поддержкой схем
 * Используется для создания форм с автоматическим применением behavior и validation схем
 *
 * @group Types
 * @category Configuration Types
 */
export interface GroupNodeConfig<T> {
  /** Схема структуры формы (поля и их конфигурация) */
  form: FormSchema<T>;

  /** Схема реактивного поведения (copyFrom, enableWhen, computeFrom и т.д.) */
  behavior?: BehaviorSchemaFn<T>;

  /** Схема валидации (required, email, minLength и т.д.) */
  validation?: ValidationSchemaFn<T>;
}

// ============================================================================
// Utility Types для избежания инлайновых типов
// ============================================================================

/**
 * Тип для Record с unknown значениями
 * Используется вместо инлайнового `Record<string, unknown>`
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnknownRecord = Record<string, any>;

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
 * Тип для конфига с полями (FormSchema generic constraint)
 * Используется вместо `Record<string, any>` для схем форм
 * @deprecated
 * @internal
 */
export type FormFields = Record<string, FormValue>;

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
