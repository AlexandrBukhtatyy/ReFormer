// ============================================================================
// Types
// ============================================================================

export type {
  ValidatorFn,
  AsyncValidatorFn,
  ValidationError,
  FieldStatus,
  FieldConfig,
} from './core/types';

// Validation Schema types
export type {
  ValidationContext,
  TreeValidationContext,
  ContextualValidatorFn,
  ContextualAsyncValidatorFn,
} from './core/types/validation-schema';

// Variant 5 types
export type {
  FormSchema,
  DeepControls,
  GroupControlProxy,
  ArrayControlProxy,
  ArrayConfig,
} from './core/types';

// Typed Proxy Access (решение проблемы типизации)
export type { FormNodeControls, GroupNodeWithControls, ArrayNodeWithControls } from './core/types';

// ============================================================================
// Core - New Architecture (рекомендуется)
// ============================================================================

export { FormNode } from './core/nodes/form-node';
export { FieldNode } from './core/nodes/field-node';
export { GroupNode } from './core/nodes/group-node';
export { ArrayNode } from './core/nodes/array-node';
export type { SetValueOptions } from './core/nodes/form-node';

// ============================================================================
// Validators
// ============================================================================
export { validateForm } from './core/validators/validate-form';

// ============================================================================
// Hooks
// ============================================================================

export { useFormControl } from './hooks/useFormControl';

// ============================================================================
// Resources
// ============================================================================

export { staticResource, preloadResource, partialResource, Resources } from './core/resources';

export type {
  ResourceItem,
  ResourceResult,
  ResourceConfig,
  ResourceLoadParams,
} from './core/resources';
