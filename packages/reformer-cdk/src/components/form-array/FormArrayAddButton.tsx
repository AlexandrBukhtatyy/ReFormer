import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormArrayContext } from './FormArrayContext';
import type { FormArrayAddButtonProps } from './types';

/**
 * FormArray.AddButton - Button to add new items to the array
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.AddButton className="btn-primary">
 *   + Add Item
 * </FormArray.AddButton>
 * ```
 *
 * @example With initial value
 * ```tsx
 * <FormArray.AddButton initialValue={{ status: 'draft' }}>
 *   Add Draft
 * </FormArray.AddButton>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormArray.AddButton asChild initialValue={{ name: '' }}>
 *   <MyButton variant="primary">+ Add Item</MyButton>
 * </FormArray.AddButton>
 * ```
 */
export const FormArrayAddButton = forwardRef<HTMLButtonElement, FormArrayAddButtonProps>(
  ({ children, initialValue, asChild = false, ...props }, ref) => {
    const { add } = useFormArrayContext();

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        onClick={() => add(initialValue)}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

FormArrayAddButton.displayName = 'FormArray.AddButton';
