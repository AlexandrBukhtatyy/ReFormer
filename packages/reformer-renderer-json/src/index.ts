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

// ============================================================================
// JSON Schema Types
// ============================================================================

export type { JsonFormSchema, JsonNode } from './types/json-schema';
export { isFieldNode, isContainerNode } from './types/json-schema';

// ============================================================================
// Component Registry
// ============================================================================

export { createComponentRegistry } from './registry/component-registry';
export { createDefaultRegistry, defaultRegistry } from './registry/default-registry';
export type { ComponentRegistry, ComponentMetadata } from './registry/types';

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

export { createRenderSchemaFromJson } from './converter/json-to-render-schema';
