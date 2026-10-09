// ============================================================================
// Общие контракт-типы валидации и статуса — из ./contracts.
// Реэкспортируются здесь, чтобы form-код импортировал их привычно из `form/types`.
// ============================================================================

export type { ValidationError, ErrorFilterOptions, FieldStatus } from './contracts';

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
  ComponentRef,
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

export type { FormProxy } from './form-proxy';
