// Main compound component
export { FieldArray } from './FieldArray';
export type { FieldArrayHandle } from './FieldArray';

// Sub-components (also available as FieldArray.List, etc.)
export { FieldArrayList } from './FieldArrayList';
export { FieldArrayAddButton } from './FieldArrayAddButton';
export { FieldArrayRemoveButton } from './FieldArrayRemoveButton';
export { FieldArrayEmpty } from './FieldArrayEmpty';
export { FieldArrayCount } from './FieldArrayCount';
export { FieldArrayItemIndex } from './FieldArrayItemIndex';
export { FieldArrayError } from './FieldArrayError';

// Hook
export { useFieldArray } from './useFieldArray';
export type { UseFieldArrayReturn } from './useFieldArray';

// Context and hooks
export {
  FieldArrayContext,
  FieldArrayItemContext,
  useFieldArrayContext,
  useFieldArrayItemContext,
} from './FieldArrayContext';

// Types
export type {
  FieldArrayRootProps,
  FieldArrayListProps,
  FieldArrayItemRenderProps,
  FieldArrayAddButtonProps,
  FieldArrayRemoveButtonProps,
  FieldArrayEmptyProps,
  FieldArrayCountProps,
  FieldArrayItemIndexProps,
  FieldArrayErrorProps,
  FieldArrayControl,
} from './types';

export type {
  FieldArrayContextValue,
  FieldArrayItemContextValue,
  FieldArrayItem,
} from './FieldArrayContext';
