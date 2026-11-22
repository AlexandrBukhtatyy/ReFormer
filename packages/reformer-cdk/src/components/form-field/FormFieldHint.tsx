import { forwardRef } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFormFieldContext } from './FormFieldContext';
import type { FormFieldHintProps } from './types';

/**
 * FormField.Hint - Auxiliary description of the field that is NOT the helper text under it:
 * typically the text of an info tooltip shown next to the label.
 *
 * Renders with a stable `id` (hintId). To add it to `aria-describedby` of the control,
 * pass `hasHint` to the parent `FormField.Root`. The element may be `hidden`: an element
 * referenced by `aria-describedby` still contributes to the accessible description,
 * but is not announced twice and does not affect layout.
 *
 * @example Hidden text of an info tooltip
 * ```tsx
 * <FormField.Root control={control.email} hasHint>
 *   <FormField.Label />
 *   <InfoTooltip text="We only use it for receipts" />
 *   <FormField.Hint hidden>We only use it for receipts</FormField.Hint>
 *   <FormField.Control />
 * </FormField.Root>
 * ```
 */
export const FormFieldHint = forwardRef<HTMLSpanElement, FormFieldHintProps>(
  ({ asChild = false, children, ...props }, ref) => {
    const { ids } = useFormFieldContext();

    const Comp = asChild ? Slot : 'span';

    return (
      <Comp ref={ref} id={ids.hintId} {...props}>
        {children}
      </Comp>
    );
  }
);

FormFieldHint.displayName = 'FormField.Hint';
