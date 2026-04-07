import {
  forwardRef,
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ReactElement,
} from 'react';
import { Slot } from './Slot';
import { useFormWizard } from './FormWizardContext';
import { useFormWizardActions } from './FormWizardActions';

/**
 * Props for FormWizard.Submit component
 */
export interface FormWizardSubmitProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /** Button content */
  children: ReactNode;
  /** Render as child element (merge props into child) */
  asChild?: boolean;
  /** Additional disabled state (merged with automatic via OR) */
  disabled?: boolean;
  /** Content to show during submission (replaces children) */
  loadingText?: ReactNode;
}

/**
 * FormWizard.Submit - Form submission button component
 *
 * Renders a button that submits the form on the last step.
 * Automatically disabled when not on the last step, during validation, or during submission.
 * Shows `loadingText` content during submission if provided.
 *
 * @example Basic usage
 * ```tsx
 * <FormWizard.Actions onSubmit={handleSubmit}>
 *   <FormWizard.Submit>Submit</FormWizard.Submit>
 * </FormWizard.Actions>
 * ```
 *
 * @example With loading text
 * ```tsx
 * <FormWizard.Submit loadingText="Submitting...">
 *   Submit Application
 * </FormWizard.Submit>
 * ```
 *
 * @example With custom button (asChild)
 * ```tsx
 * <FormWizard.Submit asChild loadingText={<Spinner />}>
 *   <MyButton variant="success">Complete</MyButton>
 * </FormWizard.Submit>
 * ```
 */
export const FormWizardSubmit = forwardRef<HTMLButtonElement, FormWizardSubmitProps>(
  ({ children, asChild = false, disabled: disabledProp, loadingText, ...props }, ref) => {
    const { isLastStep, isValidating, isSubmitting } = useFormWizard();
    const { onSubmit } = useFormWizardActions();

    // Merge disabled states (OR logic)
    const isAutoDisabled = !isLastStep || isValidating || isSubmitting;
    const disabled = disabledProp || isAutoDisabled;

    const Comp = asChild ? Slot : 'button';

    // Determine what content to show
    const showLoading = isSubmitting && loadingText;

    // For asChild mode with loadingText: clone the child element with new content
    // The Slot expects a single React element, not a string
    let slotChildren = children;
    if (asChild && showLoading && isValidElement(children)) {
      slotChildren = cloneElement(children as ReactElement, {}, loadingText);
    }

    // For non-asChild mode, just swap the content
    const content = asChild ? slotChildren : showLoading ? loadingText : children;

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'submit'}
        onClick={() => onSubmit?.()}
        disabled={disabled}
        data-submitting={isSubmitting || undefined}
        data-not-last-step={!isLastStep || undefined}
        {...props}
      >
        {content}
      </Comp>
    );
  }
);

FormWizardSubmit.displayName = 'FormWizard.Submit';
