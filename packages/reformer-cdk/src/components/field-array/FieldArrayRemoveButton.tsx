import { forwardRef, useContext } from 'react';
import { useFormControl } from '@reformer/core';
import { Slot } from '../form-wizard/Slot';
import { FieldArrayContext, useFieldArrayItemContext } from './FieldArrayContext';
import type { FieldArrayRemoveButtonProps } from './types';

/**
 * FieldArray.RemoveButton - Button to remove current item (must be inside FieldArray.List)
 *
 * @example Basic usage
 * ```tsx
 * <FieldArray.List>
 *   {({ control }) => (
 *     <div>
 *       <ItemForm control={control} />
 *       <FieldArray.RemoveButton className="text-red-500">
 *         Remove
 *       </FieldArray.RemoveButton>
 *     </div>
 *   )}
 * </FieldArray.List>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FieldArray.RemoveButton asChild>
 *   <IconButton icon="trash" aria-label="Remove" />
 * </FieldArray.RemoveButton>
 * ```
 */
export const FieldArrayRemoveButton = forwardRef<HTMLButtonElement, FieldArrayRemoveButtonProps>(
  ({ children, asChild = false, disabled, ...props }, ref) => {
    const { remove } = useFieldArrayItemContext();
    // Отражаем disabled-состояние родительского массива (доступно внутри FieldArray.List →
    // FieldArray.Root). Читаем через сырой useContext, чтобы не бросать вне Root; при отсутствии
    // контекста useFormControl(undefined) даёт disabled=false. После arrayNode.disable() массив
    // структурно неизменяем, поэтому кнопка удаления должна быть отключена.
    const arrayContext = useContext(FieldArrayContext);
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

FieldArrayRemoveButton.displayName = 'FieldArray.RemoveButton';
