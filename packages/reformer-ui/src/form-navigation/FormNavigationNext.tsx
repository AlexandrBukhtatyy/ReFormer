import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot } from './Slot';
import { useFormNavigation } from './FormNavigationContext';

/**
 * Props for FormNavigation.Next component
 */
export interface FormNavigationNextProps extends Omit<
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
 * FormNavigation.Next - Next step button component
 *
 * Renders a button that validates current step and navigates to the next.
 * Automatically disabled on the last step, during validation, or during submission.
 *
 * @example Basic usage
 * ```tsx
 * <FormNavigation.Actions>
 *   <FormNavigation.Next>Continue</FormNavigation.Next>
 * </FormNavigation.Actions>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormNavigation.Next asChild>
 *   <MyButton variant="primary">
 *     Next <ArrowRight />
 *   </MyButton>
 * </FormNavigation.Next>
 * ```
 */
export const FormNavigationNext = forwardRef<HTMLButtonElement, FormNavigationNextProps>(
  ({ children, asChild = false, disabled: disabledProp, ...props }, ref) => {
    const { goToNextStep, isLastStep, isValidating, isSubmitting } = useFormNavigation();

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

FormNavigationNext.displayName = 'FormNavigation.Next';
