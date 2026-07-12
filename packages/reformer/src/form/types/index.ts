// ============================================================================
// Общие контракт-типы значения/валидации — из state-слоя (model/contracts).
// Реэкспортируются здесь, чтобы form-код импортировал их привычно из `form/types`.
// ============================================================================

export type {
  FormValue,
  UnknownFormValue,
  ValidatorFn,
  AsyncValidatorOptions,
  AsyncValidatorFn,
  ValidationError,
  ErrorFilterOptions,
  FieldStatus,
} from './contracts';

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
