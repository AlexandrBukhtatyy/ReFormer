export * from './core/types';
export * from './core/factories';
export * from './core/utils';

export { FormNode } from './core/nodes/form-node';
export { FieldNode } from './core/nodes/field-node';
export { GroupNode } from './core/nodes/group-node';
export { ArrayNode } from './core/nodes/array-node';
export type { SetValueOptions } from './core/nodes/form-node';

export { useFormControl } from './hooks/useFormControl';
export { useFormControlValue } from './hooks/useFormControlValue';
export type { FieldControlState, ArrayControlState } from './hooks/types';

export type { BehaviorSchemaFn } from './core/behavior/types';

// Utility for multi-step form validation
export { validateForm } from './core/validation/validate-form';

// Re-export behaviors and validators as namespaces to avoid naming conflicts
// (both have 'apply' and 'applyWhen' exports)
// This also ensures all imports share the same static registry instances
export * as behaviors from './core/behavior';
export * as validators from './core/validation';
