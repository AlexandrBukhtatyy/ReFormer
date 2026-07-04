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
 * Render-props state for the submit button (headless mode).
 * Renamed from `FormWizardSubmitProps` to avoid a name collision with the
 * `FormWizardSubmitProps` component props in FormWizardSubmit.tsx.
 */
export interface FormWizardSubmitRenderProps extends FormWizardButtonProps {
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
  submit: FormWizardSubmitRenderProps;
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
 * `FormWizard.Actions` — контейнер кнопок навигации мастера. Поддерживает два режима:
 * compound-children (`FormWizard.Prev`/`Next`/`Submit`) и render-props.
 *
 * Render-props получают: `prev`, `next`, `submit` (все с `onClick`/`disabled`),
 * `isFirstStep`, `isLastStep`, `isValidating`, `isSubmitting`.
 *
 * @example Compound mode
 * ```tsx
 * <FormWizard.Actions onSubmit={handleSubmit}>
 *   <FormWizard.Prev>Back</FormWizard.Prev>
 *   <FormWizard.Next>Next</FormWizard.Next>
 *   <FormWizard.Submit loadingText="Submitting...">Submit</FormWizard.Submit>
 * </FormWizard.Actions>
 * ```
 *
 * @example Render-props mode
 * ```tsx
 * <FormWizard.Actions onSubmit={handleSubmit}>
 *   {({ prev, next, submit, isFirstStep, isLastStep }) => (
 *     <div className="flex justify-between">
 *       {!isFirstStep && <button onClick={prev.onClick} disabled={prev.disabled}>Back</button>}
 *       {isLastStep
 *         ? <button onClick={submit.onClick} disabled={submit.disabled}>{submit.isSubmitting ? '…' : 'Submit'}</button>
 *         : <button onClick={next.onClick} disabled={next.disabled}>Next</button>}
 *     </div>
 *   )}
 * </FormWizard.Actions>
 * ```
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
