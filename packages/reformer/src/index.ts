export * from './core/types';
export * from './core/factories';
export * from './core/utils';

// Слой данных FormModel (M1)
export * from './core/model';

export { FormNode } from './core/nodes/form-node';
export { FieldNode } from './core/nodes/field-node';
export { GroupNode } from './core/nodes/group-node';
export { ArrayNode } from './core/nodes/array-node';
export { ModelArrayNode } from './core/nodes/model-array-node';
export type { ModelArrayControl } from './core/nodes/model-array-node';
export type { SetValueOptions } from './core/nodes/form-node';

export { useFormControl } from './hooks/useFormControl';
export { useFormControlValue } from './hooks/useFormControlValue';
export { useArrayLength } from './hooks/useArrayLength';
export type { FieldControlState, ArrayControlState } from './hooks/types';

// Validators namespace (чистые фабрики). Legacy behaviors-namespace и validateForm удалены (Ф7);
// M1-behaviors (computeFrom/enableWhen/…) экспортируются из './core/model'.
export * as validators from './core/validation';
