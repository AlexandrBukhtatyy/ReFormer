import type { ReactNode } from 'react';
import { useFormNavigation } from './FormNavigationContext';

/**
 * Step definition for the indicator
 */
export interface FormNavigationIndicatorStep {
  /** Step number (1-based) */
  number: number;
  /** Step title/label */
  title: string;
  /** Optional icon */
  icon?: string;
}

/**
 * Enriched step with state information
 */
export interface FormNavigationIndicatorStepWithState extends FormNavigationIndicatorStep {
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
export interface FormNavigationIndicatorRenderProps {
  /** Steps with their current state */
  steps: FormNavigationIndicatorStepWithState[];
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
 * Props for FormNavigation.Indicator component
 */
export interface FormNavigationIndicatorProps {
  /** Step definitions */
  steps: FormNavigationIndicatorStep[];
  /** Render function for custom UI */
  children: (props: FormNavigationIndicatorRenderProps) => ReactNode;
}

/**
 * FormNavigation.Indicator - Headless component for step indicator
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
 * <FormNavigation.Indicator steps={STEPS}>
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
 * </FormNavigation.Indicator>
 * ```
 *
 * @example With progress line
 * ```tsx
 * <FormNavigation.Indicator steps={STEPS}>
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
 * </FormNavigation.Indicator>
 * ```
 */
export function FormNavigationIndicator({ steps, children }: FormNavigationIndicatorProps) {
  // Runtime check for headless API
  if (typeof children !== 'function') {
    throw new Error(
      'FormNavigation.Indicator requires children as a render function. ' +
        'Example: <FormNavigation.Indicator steps={STEPS}>{({ steps }) => <YourUI />}</FormNavigation.Indicator>'
    );
  }

  const { currentStep, totalSteps, completedSteps, goToStep } = useFormNavigation();

  const stepsWithState: FormNavigationIndicatorStepWithState[] = steps.map((step) => ({
    ...step,
    isCurrent: currentStep === step.number,
    isCompleted: completedSteps.includes(step.number),
    canNavigate: step.number === 1 || completedSteps.includes(step.number - 1),
  }));

  const renderProps: FormNavigationIndicatorRenderProps = {
    steps: stepsWithState,
    goToStep,
    currentStep,
    totalSteps,
    completedSteps,
  };

  return <>{children(renderProps)}</>;
}

FormNavigationIndicator.displayName = 'FormNavigation.Indicator';
