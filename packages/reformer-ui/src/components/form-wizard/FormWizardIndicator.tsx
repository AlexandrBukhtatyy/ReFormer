import type { ComponentType, ReactNode } from 'react';
import { useFormWizard } from './FormWizardContext';
import type { FormProxy } from '@reformer/core';

/**
 * Step definition for the indicator
 */
export interface FormWizardIndicatorStep {
  /** Step number (1-based) */
  number: number;
  /** Step title/label */
  title: string;
  /** Optional icon */
  icon?: string;
  /** Component to render for this step (legacy API) */
  component?: ComponentType<
    {
      control: FormProxy<unknown>;
    } & Record<string, unknown>
  >;
}

/**
 * Enriched step with state information
 */
export interface FormWizardIndicatorStepWithState extends FormWizardIndicatorStep {
  /** Whether this is the current step */
  isCurrent: boolean;
  /** Whether this step is completed */
  isCompleted: boolean;
  /** Whether user can navigate to this step */
  canNavigate: boolean;
}

/**
 * Render props passed to children function
 */
export interface FormWizardIndicatorRenderProps {
  /** Steps with their current state */
  steps: FormWizardIndicatorStepWithState[];
  /** Navigate to a specific step */
  goToStep: (step: number) => boolean;
  /** Current step number */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Completed step numbers */
  completedSteps: number[];
}

/**
 * Props for FormWizard.Indicator component
 */
export interface FormWizardIndicatorProps {
  /** Step definitions */
  steps: FormWizardIndicatorStep[];
  /** Render function for custom UI */
  children: (props: FormWizardIndicatorRenderProps) => ReactNode;
}

/**
 * FormWizard.Indicator - Headless component for step indicator
 *
 * Provides step data with state for building custom step indicators.
 * No default UI - you build exactly what you need.
 *
 * ## Render Props
 * - `steps` - array of steps with state (`isCurrent`, `isCompleted`, `canNavigate`)
 * - `goToStep` - function to navigate to a step
 * - `currentStep` - current step number
 * - `totalSteps` - total number of steps
 * - `completedSteps` - array of completed step numbers
 *
 * @example Basic stepper
 * ```tsx
 * <FormWizard.Indicator steps={STEPS}>
 *   {({ steps, goToStep }) => (
 *     <nav className="flex gap-2">
 *       {steps.map((step) => (
 *         <button
 *           key={step.number}
 *           onClick={() => goToStep(step.number)}
 *           disabled={!step.canNavigate}
 *           className={cn(
 *             'px-4 py-2 rounded',
 *             step.isCurrent && 'bg-blue-500 text-white',
 *             step.isCompleted && 'bg-green-100',
 *             !step.canNavigate && 'opacity-50 cursor-not-allowed'
 *           )}
 *         >
 *           {step.icon} {step.title}
 *         </button>
 *       ))}
 *     </nav>
 *   )}
 * </FormWizard.Indicator>
 * ```
 *
 * @example With progress line
 * ```tsx
 * <FormWizard.Indicator steps={STEPS}>
 *   {({ steps, goToStep }) => (
 *     <div className="flex items-center">
 *       {steps.map((step, index) => (
 *         <Fragment key={step.number}>
 *           <StepCircle
 *             active={step.isCurrent}
 *             completed={step.isCompleted}
 *             onClick={() => step.canNavigate && goToStep(step.number)}
 *           >
 *             {step.isCompleted ? '✓' : step.number}
 *           </StepCircle>
 *           {index < steps.length - 1 && (
 *             <StepLine completed={step.isCompleted} />
 *           )}
 *         </Fragment>
 *       ))}
 *     </div>
 *   )}
 * </FormWizard.Indicator>
 * ```
 */
export function FormWizardIndicator({ steps, children }: FormWizardIndicatorProps) {
  // Runtime check for headless API
  if (typeof children !== 'function') {
    throw new Error(
      'FormWizard.Indicator requires children as a render function. ' +
        'Example: <FormWizard.Indicator steps={STEPS}>{({ steps }) => <YourUI />}</FormWizard.Indicator>'
    );
  }

  const { currentStep, totalSteps, completedSteps, goToStep } = useFormWizard();

  const stepsWithState: FormWizardIndicatorStepWithState[] = steps.map((step) => ({
    ...step,
    isCurrent: currentStep === step.number,
    isCompleted: completedSteps.includes(step.number),
    canNavigate: step.number === 1 || completedSteps.includes(step.number - 1),
  }));

  const renderProps: FormWizardIndicatorRenderProps = {
    steps: stepsWithState,
    goToStep,
    currentStep,
    totalSteps,
    completedSteps,
  };

  return <>{children(renderProps)}</>;
}

FormWizardIndicator.displayName = 'FormWizard.Indicator';
