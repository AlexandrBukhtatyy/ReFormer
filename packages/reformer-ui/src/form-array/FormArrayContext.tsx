import { createContext, useContext } from 'react';
import type { FormFields, ArrayNode } from '@reformer/core';
import type { FormArrayItem } from './useFormArray';

/**
 * Context value for FormArray compound component
 */
export interface FormArrayContextValue<T extends FormFields = FormFields> {
  /** Array of items with their controls and actions */
  items: FormArrayItem<T>[];
  /** Current number of items */
  length: number;
  /** Whether the array is empty */
  isEmpty: boolean;
  /** Add a new item to the array */
  add: (value?: Partial<T>) => void;
  /** Remove all items */
  clear: () => void;
  /** Insert item at specific index */
  insert: (index: number, value?: Partial<T>) => void;
  /** The original ArrayNode control */
  control: ArrayNode<T>;
}

/**
 * Context value for individual array items
 */
export interface FormArrayItemContextValue<T extends FormFields = FormFields> {
  /** The form control for this item */
  control: FormArrayItem<T>['control'];
  /** Zero-based index of the item */
  index: number;
  /** Unique identifier for React key */
  id: string | number;
  /** Remove this item from the array */
  remove: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormArrayContext = createContext<FormArrayContextValue<any> | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormArrayItemContext = createContext<FormArrayItemContextValue<any> | null>(null);

/**
 * Hook to access FormArray context
 * @throws Error if used outside of FormArray.Root
 */
export function useFormArrayContext<T extends FormFields = FormFields>(): FormArrayContextValue<T> {
  const context = useContext(FormArrayContext);
  if (!context) {
    throw new Error('FormArray.* components must be used within FormArray.Root');
  }
  return context as FormArrayContextValue<T>;
}

/**
 * Hook to access current item context within FormArray.List
 * @throws Error if used outside of FormArray.List
 */
export function useFormArrayItemContext<
  T extends FormFields = FormFields,
>(): FormArrayItemContextValue<T> {
  const context = useContext(FormArrayItemContext);
  if (!context) {
    throw new Error('FormArray.Item* components must be used within FormArray.List');
  }
  return context as FormArrayItemContextValue<T>;
}
