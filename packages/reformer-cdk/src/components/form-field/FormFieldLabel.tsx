import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import type { FormFieldLabelProps } from './types';

/**
 * FormField.Label - Accessible label for the form field.
 *
 * Automatically wires `htmlFor` to the control ID and `id` to the label ID
 * so that `aria-labelledby` on FormField.Control works correctly.
 *
 * The label text defaults to `componentProps.label` from the field config.
 * Pass `children` to override or enrich the label content.
 *
 * A required indicator `*` is appended automatically when `componentProps.required` is set.
 *
 * @example Auto label from field config
 * ```tsx
 * <FormField.Root control={control.email}>
 *   <FormField.Label />  {/* renders componentProps.label *\/}
 *   <FormField.Control />
 * </FormField.Root>
 * ```
 *
 * @example Custom label content
 * ```tsx
 * <FormField.Label className="font-semibold">
 *   Email Address <span className="text-gray-400">(optional)</span>
 * </FormField.Label>
 * ```
 *
 * @example With custom element (asChild)
 * ```tsx
 * <FormField.Label asChild>
 *   <Typography variant="label">{label}</Typography>
 * </FormField.Label>
 * ```
 */
export const FormFieldLabel = forwardRef<HTMLLabelElement, FormFieldLabelProps>(
  ({ asChild = false, children, forceRender = false, ...props }, ref) => {
    const { label, required, ids } = useFormFieldContext();

    const labelText = children ?? label;
    if (!labelText && !forceRender) return null;

    const Comp = asChild ? Slot : 'label';

    return (
      <Comp ref={ref} id={ids.labelId} htmlFor={asChild ? undefined : ids.controlId} {...props}>
        {labelText}
        {required && <span aria-hidden="true"> *</span>}
      </Comp>
    );
  }
);

FormFieldLabel.displayName = 'FormField.Label';
