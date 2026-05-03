import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot } from './Slot';
import { useFormWizard } from './FormWizardContext';

/**
 * Props for FormWizard.Next component
 */
export interface FormWizardNextProps extends Omit<
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
 * FormWizard.Next - Next step button component
 *
 * Renders a button that validates current step and navigates to the next.
 * Automatically disabled on the last step, during validation, or during submission.
 *
 * @example Basic usage
 * ```tsx
 * <FormWizard.Actions>
 *   <FormWizard.Next>Continue</FormWizard.Next>
 * </FormWizard.Actions>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormWizard.Next asChild>
 *   <MyButton variant="primary">
 *     Next <ArrowRight />
 *   </MyButton>
 * </FormWizard.Next>
 * ```
 */
export const FormWizardNext = forwardRef<HTMLButtonElement, FormWizardNextProps>(
  ({ children, asChild = false, disabled: disabledProp, ...props }, ref) => {
    const { goToNextStep, isLastStep, isValidating, isSubmitting } = useFormWizard();

    // Merge disabled states (OR logic)
    const isAutoDisabled = isLastStep || isValidating || isSubmitting;
    const disabled = disabledProp || isAutoDisabled;

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        onClick={() => goToNextStep()}
        disabled={disabled}
        data-last-step={isLastStep || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

FormWizardNext.displayName = 'FormWizard.Next';
