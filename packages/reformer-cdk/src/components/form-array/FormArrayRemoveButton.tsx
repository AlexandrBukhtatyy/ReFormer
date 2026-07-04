import { forwardRef, useContext } from 'react';
import { useFormControl } from '@reformer/core';
import { Slot } from '../form-wizard/Slot';
import { FormArrayContext, useFormArrayItemContext } from './FormArrayContext';
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
  ({ children, asChild = false, disabled, ...props }, ref) => {
    const { remove } = useFormArrayItemContext();
    // Отражаем disabled-состояние родительского массива (доступно внутри FormArray.List →
    // FormArray.Root). Читаем через сырой useContext, чтобы не бросать вне Root; при отсутствии
    // контекста useFormControl(undefined) даёт disabled=false. После arrayNode.disable() массив
    // структурно неизменяем, поэтому кнопка удаления должна быть отключена.
    const arrayContext = useContext(FormArrayContext);
    const { disabled: arrayDisabled } = useFormControl(arrayContext?.control);
    const isDisabled = disabled || arrayDisabled;

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return;
          remove();
        }}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

FormArrayRemoveButton.displayName = 'FormArray.RemoveButton';
