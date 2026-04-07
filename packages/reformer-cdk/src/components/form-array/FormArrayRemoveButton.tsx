import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormArrayItemContext } from './FormArrayContext';
import type { FormArrayRemoveButtonProps } from './types';

/**
 * FormArray.RemoveButton - Button to remove current item (must be inside FormArray.List)
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.List>
 *   {({ control }) => (
 *     <div>
 *       <ItemForm control={control} />
 *       <FormArray.RemoveButton className="text-red-500">
 *         Remove
 *       </FormArray.RemoveButton>
 *     </div>
 *   )}
 * </FormArray.List>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormArray.RemoveButton asChild>
 *   <IconButton icon="trash" aria-label="Remove" />
 * </FormArray.RemoveButton>
 * ```
 */
export const FormArrayRemoveButton = forwardRef<HTMLButtonElement, FormArrayRemoveButtonProps>(
  ({ children, asChild = false, ...props }, ref) => {
    const { remove } = useFormArrayItemContext();

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp ref={ref} type={asChild ? undefined : 'button'} onClick={remove} {...props}>
        {children}
      </Comp>
    );
  }
);

FormArrayRemoveButton.displayName = 'FormArray.RemoveButton';
