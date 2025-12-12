import type { ReactNode, ElementType } from 'react';
import type { ArrayNode, FormFields, GroupNodeWithControls } from '@reformer/core';

/**
 * Props for FormArray.Root component
 */
export interface FormArrayRootProps<T extends FormFields> {
  /** The ArrayNode control from the form */
  control: ArrayNode<T>;
  /** Child components */
  children: ReactNode;
}

/**
 * Props for FormArray.List component
 */
export interface FormArrayListProps<T extends FormFields> {
  /** Render function for each item */
  children: (item: FormArrayItemRenderProps<T>) => ReactNode;
  /** Optional className for the list container */
  className?: string;
  /** Optional element type for the container (default: 'div') */
  as?: ElementType;
}

/**
 * Props passed to the render function in FormArray.List
 */
export interface FormArrayItemRenderProps<T extends FormFields> {
  /** The form control for this item */
  control: GroupNodeWithControls<T>;
  /** Zero-based index of the item */
  index: number;
  /** Unique identifier for React key */
  id: string | number;
  /** Remove this item from the array */
  remove: () => void;
}

/**
 * Props for FormArray.AddButton component
 */
export interface FormArrayAddButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Initial value for the new item */
  initialValue?: Partial<FormFields>;
  /** Custom render function for the button */
  asChild?: boolean;
}

/**
 * Props for FormArray.RemoveButton component
 */
export interface FormArrayRemoveButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Custom render function for the button */
  asChild?: boolean;
}

/**
 * Props for FormArray.Empty component
 */
export interface FormArrayEmptyProps {
  /** Content to show when array is empty */
  children: ReactNode;
}

/**
 * Props for FormArray.Count component
 */
export interface FormArrayCountProps {
  /** Custom render function for the count */
  render?: (count: number) => ReactNode;
}

/**
 * Props for FormArray.ItemIndex component
 */
export interface FormArrayItemIndexProps {
  /** Custom render function for the index (receives 0-based index) */
  render?: (index: number) => ReactNode;
}
