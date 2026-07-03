// Main compound component
export { FormArray } from './FormArray';
export type { FormArrayHandle } from './FormArray';

// Sub-components (also available as FormArray.List, etc.)
export { FormArrayList } from './FormArrayList';
export { FormArrayAddButton } from './FormArrayAddButton';
export { FormArrayRemoveButton } from './FormArrayRemoveButton';
export { FormArrayEmpty } from './FormArrayEmpty';
export { FormArrayCount } from './FormArrayCount';
export { FormArrayItemIndex } from './FormArrayItemIndex';

// Hook
export { useFormArray } from './useFormArray';
export type { UseFormArrayReturn } from './useFormArray';

// Context and hooks
export {
  FormArrayContext,
  FormArrayItemContext,
  useFormArrayContext,
  useFormArrayItemContext,
} from './FormArrayContext';

// Types
export type {
  FormArrayRootProps,
  FormArrayListProps,
  FormArrayItemRenderProps,
  FormArrayAddButtonProps,
  FormArrayRemoveButtonProps,
  FormArrayEmptyProps,
  FormArrayCountProps,
  FormArrayItemIndexProps,
} from './types';

export type {
  FormArrayContextValue,
  FormArrayItemContextValue,
  FormArrayItem,
} from './FormArrayContext';
