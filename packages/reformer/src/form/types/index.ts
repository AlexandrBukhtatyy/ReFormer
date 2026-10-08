// ============================================================================
// Общие контракт-типы значения и валидации — из ./contracts.
// Реэкспортируются здесь, чтобы form-код импортировал их привычно из `form/types`.
// ============================================================================

export type { FormValue, ValidationError, ErrorFilterOptions, FieldStatus } from './contracts';

// ============================================================================
// Конфиг ноды поля
// ============================================================================

export type { FieldConfig } from './field-config';

// ============================================================================
// Опции фабрик валидаторов
// ============================================================================

export type { ValidateOptions } from './validation-schema';

// ============================================================================
// Узел схемы формы: union четырёх видов и их ручки
// ============================================================================

export type {
  FormSchemaNode,
  SchemaFieldNode,
  SchemaArrayNode,
  SchemaPartNode,
  SchemaContainerNode,
  SchemaChild,
  SchemaValueHandle,
  SchemaArrayHandle,
  SchemaGroupHandle,
  SchemaArrayControl,
} from './schema-node';

// ============================================================================
// Re-exports from form-proxy (Typed Proxy Access)
// ============================================================================

export type { FormControlsProxy, FormProxy, FormArrayProxy } from './form-proxy';

// ============================================================================
// Utility Types для избежания инлайновых типов
// ============================================================================

/**
 * Интерфейс для узлов-массивов (с методом at)
 * Используется для duck typing при обходе путей
 * @internal
 */
export interface ArrayNodeLike {
  at(index: number): FormNode<unknown> | undefined;
  length: unknown;
}

// Импортируем FormNode для типа ArrayNodeLike
import type { FormNode } from '../nodes/form-node';
