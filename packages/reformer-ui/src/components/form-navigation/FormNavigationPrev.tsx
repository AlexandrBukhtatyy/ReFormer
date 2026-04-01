import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot } from './Slot';
import { useFormNavigation } from './FormNavigationContext';

/**
 * Props for FormNavigation.Prev component
 */
export interface FormNavigationPrevProps extends Omit<
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
 * FormNavigation.Prev - Previous step button component
 *
 * Renders a button that navigates to the previous step.
 * Automatically disabled on the first step, during validation, or during submission.
 *
 * @example Basic usage
 * ```tsx
 * <FormNavigation.Actions>
 *   <FormNavigation.Prev>Back</FormNavigation.Prev>
 * </FormNavigation.Actions>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormNavigation.Prev asChild>
 *   <MyButton variant="ghost">
 *     <ArrowLeft /> Back
 *   </MyButton>
 * </FormNavigation.Prev>
 * ```
 */
export const FormNavigationPrev = forwardRef<HTMLButtonElement, FormNavigationPrevProps>(
  ({ children, asChild = false, disabled: disabledProp, ...props }, ref) => {
    const { goToPreviousStep, isFirstStep, isValidating, isSubmitting } = useFormNavigation();

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

FormNavigationPrev.displayName = 'FormNavigation.Prev';
