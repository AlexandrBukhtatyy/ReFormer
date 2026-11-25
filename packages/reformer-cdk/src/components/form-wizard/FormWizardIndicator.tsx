import type { ComponentType, ReactNode } from 'react';
import { useFormWizard } from './FormWizardContext';
import type { FormGroup } from '@reformer/core';

/**
 * Step definition for the indicator
 */
export interface FormWizardIndicatorStep {
  /** Место шага среди всех шагов потока (с единицы): по нему шаг связан с шагом потока. */
  number: number;
  /** Step title/label */
  title: string;
  /** Optional icon */
  icon?: string;
  /** Component to render for this step, or a ReactNode (pre-rendered element) */
  component?:
    | ComponentType<
        {
          control: FormGroup<unknown>;
        } & Record<string, unknown>
      >
    | ReactNode;
}

/**
 * Enriched step with state information.
 *
 * `number` здесь — номер среди шагов, которые участвуют в потоке сейчас: условный шаг, который
 * поток пропускает, в список не попадает, остальные нумеруются подряд. Этот номер принимает
 * `goToStep`.
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
  /** Перейти на шаг по его номеру из `steps` (среди участвующих шагов). */
  goToStep: (step: number) => boolean;
  /** Номер текущего шага — среди участвующих. */
  currentStep: number;
  /** Число участвующих шагов. */
  totalSteps: number;
  /** Номера пройденных шагов — среди участвующих. */
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
 * Условный шаг: шаг, который поток сейчас пропускает (`flow.activeSteps`), в `steps` render-props
 * не попадает, остальные нумеруются подряд.
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

  const { flow, activeStepIds, currentStep, totalSteps, completedSteps, goToStep } =
    useFormWizard();

  // Шаг индикатора ↔ шаг потока по месту среди всех шагов. Шаг, который поток пропускает, не
  // рисуется; остальные получают номер среди участвующих. Шаг без шага потока остаётся как есть.
  const stepsWithState: FormWizardIndicatorStepWithState[] = steps.flatMap((step) => {
    const stepId = flow.steps[step.number - 1];
    const at = stepId === undefined ? -1 : activeStepIds.indexOf(stepId);
    if (stepId !== undefined && at < 0) return [];
    const number = at < 0 ? step.number : at + 1;
    return [
      {
        ...step,
        number,
        isCurrent: currentStep === number,
        isCompleted: completedSteps.includes(number),
        canNavigate: number === 1 || completedSteps.includes(number - 1),
      },
    ];
  });

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
