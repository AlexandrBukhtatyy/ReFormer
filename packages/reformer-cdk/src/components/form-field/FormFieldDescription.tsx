import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import type { FormFieldDescriptionProps } from './types';

/**
 * FormField.Description - Helper text for the form field.
 *
 * Renders with a stable `id` (descriptionId) that can be wired to
 * `aria-describedby` on the control. To enable automatic wiring, pass
 * `hasDescription` to the parent `FormField.Root`.
 *
 * @example
 * ```tsx
 * <FormField.Root control={control.email} hasDescription>
 *   <FormField.Label />
 *   <FormField.Control />
 *   <FormField.Description className="text-xs text-gray-500">
 *     We'll never share your email with anyone.
 *   </FormField.Description>
 *   <FormField.Error />
 * </FormField.Root>
 * ```
 *
 * @example With custom element (asChild)
 * ```tsx
 * <FormField.Description asChild>
 *   <Tooltip content="More info">
 *     <InfoIcon />
 *   </Tooltip>
 * </FormField.Description>
 * ```
 */
export const FormFieldDescription = forwardRef<HTMLParagraphElement, FormFieldDescriptionProps>(
  ({ asChild = false, children, ...props }, ref) => {
    const { ids } = useFormFieldContext();

    const Comp = asChild ? Slot : 'p';

    return (
      <Comp ref={ref} id={ids.descriptionId} {...props}>
        {children}
      </Comp>
    );
  }
);

FormFieldDescription.displayName = 'FormField.Description';
