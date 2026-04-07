import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot } from './Slot';
import { useFormWizard } from './FormWizardContext';

/**
 * Props for FormWizard.Prev component
 */
export interface FormWizardPrevProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Button content */
  children: ReactNode;
  /** Render as child element (merge props into child) */
  asChild?: boolean;
  /** Additional disabled state (merged with automatic via OR) */
  disabled?: boolean;
}

/**
 * FormWizard.Prev - Previous step button component
 *
 * Renders a button that navigates to the previous step.
 * Automatically disabled on the first step, during validation, or during submission.
 *
 * @example Basic usage
 * ```tsx
 * <FormWizard.Actions>
 *   <FormWizard.Prev>Back</FormWizard.Prev>
 * </FormWizard.Actions>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormWizard.Prev asChild>
 *   <MyButton variant="ghost">
 *     <ArrowLeft /> Back
 *   </MyButton>
 * </FormWizard.Prev>
 * ```
 */
export const FormWizardPrev = forwardRef<HTMLButtonElement, FormWizardPrevProps>(
  ({ children, asChild = false, disabled: disabledProp, ...props }, ref) => {
    const { goToPreviousStep, isFirstStep, isValidating, isSubmitting } = useFormWizard();

    // Merge disabled states (OR logic)
    const isAutoDisabled = isFirstStep || isValidating || isSubmitting;
    const disabled = disabledProp || isAutoDisabled;

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        onClick={goToPreviousStep}
        disabled={disabled}
        data-first-step={isFirstStep || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

FormWizardPrev.displayName = 'FormWizard.Prev';
