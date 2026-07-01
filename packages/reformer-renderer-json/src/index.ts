/**
 * @reformer/renderer-json
 *
 * JSON-based form renderer for @reformer ecosystem
 *
 * @packageDocumentation
 */

// ============================================================================
// Main Component
// ============================================================================

export { JsonFormRenderer } from './components/json-form-renderer';
export type { JsonFormRendererProps } from './components/json-form-renderer';
export { SchemaErrorPanel } from './components/schema-error-panel';
export type { SchemaErrorPanelProps } from './components/schema-error-panel';

// ============================================================================
// JSON Schema Types
// ============================================================================

export type {
  JsonFormSchema,
  JsonNode,
  JsonFieldNode,
  JsonArrayNode,
  JsonContainerNode,
} from './types/json-schema';
export { isFieldNode, isArrayNode, isContainerNode } from './types/json-schema';

// Операторы JSON-схемы (M1): СТРОКОВЫЕ ссылки на модель/реестр ("$model(path)" и т.д.)
export { parseOperator, isModelOp, isComponentOp, isDataSourceOp } from './operators';
export type { ModelOp, ComponentOp, DataSourceOp, JsonOperator, ParsedOperator } from './operators';

// ============================================================================
// Component Registry
// ============================================================================

export { defineRegistry } from './registry/component-registry';
export { FIELD_WRAPPER } from './registry/constants';
export type { ComponentRegistry, ComponentMetadata, RegistryBuilder } from './registry/types';

// ============================================================================
// Context Provider & Settings
// ============================================================================

export { JsonRendererProvider, useJsonRendererSettings } from './context/json-renderer-context';
export type {
  JsonRendererSettings,
  JsonRendererProviderProps,
} from './context/json-renderer-context';

// ============================================================================
// Converter (for advanced use cases)
// ============================================================================

export {
  createRenderSchemaFromJsonM1,
  convertJsonToM1Tree,
} from './converter/json-to-render-schema';

// ============================================================================
// JSON Schema (мета-схема form-DSL) — ajv-free утилиты
// ============================================================================
//
// Сам валидатор `validateFormSchema` (тянет ajv) живёт в subpath-экспорте
// `@reformer/renderer-json/validate`, чтобы ajv не попадал в основной render-бандл.

export {
  formSchemaMetaSchema,
  buildFormSchemaMetaSchema,
  getComponentNames,
  getDataSourceNames,
} from './schema';
