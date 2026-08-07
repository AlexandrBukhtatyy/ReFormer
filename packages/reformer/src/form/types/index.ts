// ============================================================================
// Общие контракт-типы значения/валидации — из state-слоя (model/contracts).
// Реэкспортируются здесь, чтобы form-код импортировал их привычно из `form/types`.
// ============================================================================

export type {
  FormValue,
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

// AsyncValidator / ConditionFn / ValidateAsyncOptions удалены в 7.0 — осиротевшие остатки
// операторов `validateAsync`/`applyWhen`, снятых ещё в Ф7 и рантаймом не потреблявшихся.
export type { Validator, ValidateOptions } from './validation-schema';

// ============================================================================
// Re-exports from deep-schema
// ============================================================================

// ArrayConfig удалён в 7.0: тип расходился с рантаймом (описывал `{ itemSchema, initial }`,
// а NodeFactory.isArrayConfig распознаёт `{ schema, initialItems }` — см. ConfigWithSchema).
export type { FormSchema } from './deep-schema';

// ============================================================================
// Re-exports from schema-node (узел единой схемы M1)
// ============================================================================

// SchemaValidator удалён в 7.0 вместе с полями FormSchemaNode.validators/asyncValidators,
// которые он типизировал: дерево-движок, исполнявший их, снят ещё в Ф7.
export type { FormSchemaNode, SchemaArrayControl } from './schema-node';

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
 * Тип для проверки на функцию в conditional types
 * Используется вместо Function для type narrowing
 * @internal
 */
export type AnyFunction = (...args: never[]) => unknown;
