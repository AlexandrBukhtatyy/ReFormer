import type { ReactNode } from 'react';
import { useFormNavigation } from './FormNavigationContext';

/**
 * Props for a navigation button (prev/next)
 */
export interface FormNavigationButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Whether the button is disabled */
  disabled: boolean;
}

/**
 * Props for the submit button
 */
export interface FormNavigationSubmitProps extends FormNavigationButtonProps {
  /** Whether form is currently submitting */
  isSubmitting: boolean;
}

/**
 * Render props passed to children function
 */
export interface FormNavigationActionsRenderProps {
  /** Props for the "Previous" button */
  prev: FormNavigationButtonProps;
  /** Props for the "Next" button */
  next: FormNavigationButtonProps;
  /** Props for the "Submit" button */
  submit: FormNavigationSubmitProps;
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
 * Props for FormNavigation.Actions component
 */
export interface FormNavigationActionsProps {
  /** Submit handler (called on last step) */
  onSubmit?: () => void | Promise<void>;
  /** Render function for custom UI */
  children: (props: FormNavigationActionsRenderProps) => ReactNode;
}

/**
 * FormNavigation.Actions - Headless component for navigation buttons
 *
 * Provides all necessary props and state for building custom navigation UI.
 * No default UI - you build exactly what you need.
 *
 * ## Render Props
 * - `prev` - props for Previous button (`onClick`, `disabled`)
 * - `next` - props for Next button (`onClick`, `disabled`)
 * - `submit` - props for Submit button (`onClick`, `disabled`, `isSubmitting`)
 * - `isFirstStep` - hide prev button on first step
 * - `isLastStep` - show submit instead of next on last step
 * - `isValidating` - show loading state during validation
 * - `isSubmitting` - show loading state during submission
 *
 * @example Basic usage
 * ```tsx
 * <FormNavigation.Actions onSubmit={handleSubmit}>
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
 * </FormNavigation.Actions>
 * ```
 *
 * @example With custom button component
 * ```tsx
 * <FormNavigation.Actions onSubmit={handleSubmit}>
 *   {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
 *     <ActionBar>
 *       <ActionBar.Left>
 *         {!isFirstStep && <IconButton icon="arrow-left" {...prev} />}
 *       </ActionBar.Left>
 *       <ActionBar.Right>
 *         {isLastStep ? (
 *           <PrimaryButton {...submit} loading={submit.isSubmitting}>
 *             Submit Application
 *           </PrimaryButton>
 *         ) : (
 *           <PrimaryButton {...next} loading={isValidating}>
 *             Continue
 *           </PrimaryButton>
 *         )}
 *       </ActionBar.Right>
 *     </ActionBar>
 *   )}
 * </FormNavigation.Actions>
 * ```
 */
export function FormNavigationActions({ onSubmit, children }: FormNavigationActionsProps) {
  // Runtime check for headless API
  if (typeof children !== 'function') {
    throw new Error(
      'FormNavigation.Actions requires children as a render function. ' +
        'Example: <FormNavigation.Actions>{({ prev, next }) => <YourUI />}</FormNavigation.Actions>'
    );
  }

  const { isFirstStep, isLastStep, isValidating, isSubmitting, goToNextStep, goToPreviousStep } =
    useFormNavigation();

  const isDisabled = isValidating || isSubmitting;

  const renderProps: FormNavigationActionsRenderProps = {
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

FormNavigationActions.displayName = 'FormNavigation.Actions';
