import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useFormWizard } from './FormWizardContext';

/**
 * Props for a navigation button (prev/next)
 */
export interface FormWizardButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled: boolean;
}

/**
 * Props for the submit button
 */
export interface FormWizardSubmitProps extends FormWizardButtonProps {
  /** Whether form is currently submitting */
  isSubmitting: boolean;
}

/**
 * Render props passed to children function
 */
export interface FormWizardActionsRenderProps {
  /** Props for the "Previous" button */
  prev: FormWizardButtonProps;
  /** Props for the "Next" button */
  next: FormWizardButtonProps;
  /** Props for the "Submit" button */
  submit: FormWizardSubmitProps;
  /** Whether current step is the first step */
  isFirstStep: boolean;
  /** Whether current step is the last step */
  isLastStep: boolean;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Whether form is submitting */
  isSubmitting: boolean;
}

/**
 * Render function type for headless mode
 */
type RenderFunction = (props: FormWizardActionsRenderProps) => ReactNode;

/**
 * Props for FormWizard.Actions component
 */
export interface FormWizardActionsProps {
  /** Submit handler (called on last step) */
  onSubmit?: () => void | Promise<void>;
  /** Children: render function (headless) or ReactNode (compound components) */
  children: ReactNode | RenderFunction;
  /** Optional className for wrapper (compound mode only) */
  className?: string;
  /** Optional style for wrapper (compound mode only) */
  style?: CSSProperties;
}

// ============================================================================
// Actions Context (for compound components mode)
// ============================================================================

interface FormWizardActionsContextValue {
  onSubmit?: () => void | Promise<void>;
}

const FormWizardActionsContext = createContext<FormWizardActionsContextValue | null>(null);

/**
 * Hook to access Actions context (onSubmit handler)
 *
 * Must be used within FormWizard.Actions component.
 * Used internally by FormWizard.Submit.
 */
export function useFormWizardActions(): FormWizardActionsContextValue {
  const context = useContext(FormWizardActionsContext);
  if (!context) {
    throw new Error(
      'FormWizard.Prev/Next/Submit must be used within FormWizard.Actions. ' +
        'Wrap your navigation buttons with <FormWizard.Actions>.'
    );
  }
  return context;
}

// ============================================================================
// Type Guard
// ============================================================================

function isRenderFunction(children: ReactNode | RenderFunction): children is RenderFunction {
  return typeof children === 'function';
}

/**
 * FormWizard.Actions - Container for navigation buttons
 *
 * Supports two modes:
 *
 * ## 1. Compound Components Mode (recommended for simple cases)
 * ```tsx
 * <FormWizard.Actions onSubmit={handleSubmit}>
 *   <FormWizard.Prev>Back</FormWizard.Prev>
 *   <FormWizard.Next>Next</FormWizard.Next>
 *   <FormWizard.Submit loadingText="Submitting...">Submit</FormWizard.Submit>
 * </FormWizard.Actions>
 * ```
 *
 * ## 2. Render Props Mode (for complex/custom layouts)
 * ```tsx
 * <FormWizard.Actions onSubmit={handleSubmit}>
 *   {({ prev, next, submit, isFirstStep, isLastStep }) => (
 *     <div className="flex justify-between">
 *       {!isFirstStep && (
 *         <Button onClick={prev.onClick} disabled={prev.disabled}>
 *           Back
 *         </Button>
 *       )}
 *       <div className="flex-1" />
 *       {!isLastStep ? (
 *         <Button onClick={next.onClick} disabled={next.disabled}>
 *           Next
 *         </Button>
 *       ) : (
 *         <Button onClick={submit.onClick} disabled={submit.disabled}>
 *           {submit.isSubmitting ? 'Submitting...' : 'Submit'}
 *         </Button>
 *       )}
 *     </div>
 *   )}
 * </FormWizard.Actions>
 * ```
 *
 * ## Render Props (headless mode)
 * - `prev` - props for Previous button (`onClick`, `disabled`)
 * - `next` - props for Next button (`onClick`, `disabled`)
 * - `submit` - props for Submit button (`onClick`, `disabled`, `isSubmitting`)
 * - `isFirstStep` - hide prev button on first step
 * - `isLastStep` - show submit instead of next on last step
 * - `isValidating` - show loading state during validation
 * - `isSubmitting` - show loading state during submission
 */
export function FormWizardActions({
  onSubmit,
  children,
  className,
  style,
}: FormWizardActionsProps) {
  const { isFirstStep, isLastStep, isValidating, isSubmitting, goToNextStep, goToPreviousStep } =
    useFormWizard();

  // Always create context value (hooks must be called unconditionally)
  const actionsContextValue = useMemo(() => ({ onSubmit }), [onSubmit]);

  // Render props mode (backward compatible)
  if (isRenderFunction(children)) {
    const isDisabled = isValidating || isSubmitting;

    const renderProps: FormWizardActionsRenderProps = {
      prev: {
        onClick: goToPreviousStep,
        disabled: isDisabled,
      },
      next: {
        onClick: () => goToNextStep(),
        disabled: isDisabled,
      },
      submit: {
        onClick: () => onSubmit?.(),
        disabled: isDisabled,
        isSubmitting,
      },
      isFirstStep,
      isLastStep,
      isValidating,
      isSubmitting,
    };

    return <>{children(renderProps)}</>;
  }

  // Compound components mode
  return (
    <FormWizardActionsContext.Provider value={actionsContextValue}>
      {className || style ? (
        <div className={className} style={style}>
          {children}
        </div>
      ) : (
        <>{children}</>
      )}
    </FormWizardActionsContext.Provider>
  );
}

FormWizardActions.displayName = 'FormWizard.Actions';
