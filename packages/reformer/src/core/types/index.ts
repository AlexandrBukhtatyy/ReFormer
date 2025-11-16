// ============================================================================
// Form Value Types
// ============================================================================

/**
 * Represents any valid form value type
 * Use this instead of 'any' for form values to maintain type safety
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
 */
export type UnknownFormValue = unknown;

// ============================================================================
// Validator Types
// ============================================================================

export type ValidatorFn<T = FormValue> = (value: T) => ValidationError | null;
export type AsyncValidatorFn<T = FormValue> = (value: T) => Promise<ValidationError | null>;

export interface ValidationError {
  code: string;
  message: string;
  params?: Record<string, FormValue>;
}

/**
 * Опции для фильтрации ошибок в методе getErrors()
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
  ValidationContext,
  TreeValidationContext,
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
// Re-exports from deep-schema (Variant 5)
// ============================================================================

export type {
  FormSchema,
  DeepControls,
  GroupControlProxy,
  ArrayControlProxy,
  ArrayConfig,
} from './deep-schema';

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
 */
export interface GroupNodeConfig<T extends Record<string, FormValue>> {
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
 * Используется вместо инлайнового Record<string, unknown>
 */
export type UnknownRecord = Record<string, unknown>;

/**
 * Интерфейс для узлов с методом applyValidationSchema
 */
export interface WithValidationSchema {
  applyValidationSchema(schemaFn: unknown): void;
}

/**
 * Интерфейс для узлов с методом applyBehaviorSchema
 */
export interface WithBehaviorSchema {
  applyBehaviorSchema(schemaFn: unknown): void;
}

/**
 * Интерфейс для узлов, похожих на ArrayNode (с методом at)
 * Используется для duck typing при обходе путей
 */
export interface ArrayNodeLike {
  at(index: number): FormNode | undefined;
  length: unknown;
}

// Импортируем FormNode для типа ArrayNodeLike
import type { FormNode } from '../nodes/form-node';

/**
 * Конфиг с полем schema (для ArrayConfig)
 */
export interface ConfigWithSchema {
  schema: unknown;
  initialItems?: unknown[];
}

/**
 * Конфиг с полем value (для извлечения значений)
 */
export interface ConfigWithValue {
  value: unknown;
}

/**
 * Generic тип для функций валидации с контекстом
 * Используется в validation-schema вместо (form: any, context: any) => ...
 */
export type GenericFormContext = Record<string, FormValue>;

/**
 * Тип для параметров валидации (validator params)
 * Используется для параметров валидаторов вместо Record<string, any>
 */
export type ValidatorParams = Record<string, FormValue>;

/**
 * Тип для конфига с полями (FormSchema generic constraint)
 * Используется вместо Record<string, any> для схем форм
 */
export type FormFields = Record<string, FormValue>;

/**
 * Тип для путей к полям (field paths)
 * Используется в навигации по полям вместо any
 */
export type FieldPathSegment = {
  key: string;
  index?: number;
};

/**
 * Тип для коллбэков и обработчиков событий
 * Используется вместо (...args: any[]) => any
 */
export type UnknownCallback = (...args: unknown[]) => unknown;

/**
 * Тип для ресурсов с параметрами загрузки
 * Используется в resources.ts вместо any
 */
export type ResourceLoadParams = UnknownRecord;

/**
 * Тип для результатов загрузки ресурсов
 */
export type ResourceLoadResult = unknown;
