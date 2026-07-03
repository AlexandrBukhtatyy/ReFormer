import type { ReactNode } from 'react';
import { useFormWizard } from './FormWizardContext';

/**
 * Render props passed to children function
 */
export interface FormWizardProgressRenderProps {
  /** Current step number (1-based) */
  current: number;
  /** Total number of steps */
  total: number;
  /** Completion percentage (0-100) */
  percent: number;
  /** Number of completed steps */
  completedCount: number;
  /** Whether on first step */
  isFirstStep: boolean;
  /** Whether on last step */
  isLastStep: boolean;
}

/**
 * Props for FormWizard.Progress component
 */
export interface FormWizardProgressProps {
  /** Render function for custom UI */
  children: (props: FormWizardProgressRenderProps) => ReactNode;
}

/**
 * FormWizard.Progress - Headless component for progress display
 *
 * Provides progress data for building custom progress indicators.
 * No default UI - you build exactly what you need.
 *
 * ## Render Props
 * - `current` - current step number
 * - `total` - total number of steps
 * - `percent` - completion percentage (0-100)
 * - `completedCount` - number of completed steps
 * - `isFirstStep` - whether on first step
 * - `isLastStep` - whether on last step
 *
 * @example Simple text progress
 * ```tsx
 * <FormWizard.Progress>
 *   {({ current, total, percent }) => (
 *     <div className="text-sm text-gray-600">
 *       Step {current} of {total} ({percent}% complete)
 *     </div>
 *   )}
 * </FormWizard.Progress>
 * ```
 *
 * @example Progress bar
 * ```tsx
 * <FormWizard.Progress>
 *   {({ percent, current, total }) => (
 *     <div className="space-y-2">
 *       <div className="flex justify-between text-sm">
 *         <span>Step {current}/{total}</span>
 *         <span>{percent}%</span>
 *       </div>
 *       <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
 *         <div
 *           className="h-full bg-blue-500 transition-all"
 *           style={{ width: `${percent}%` }}
 *         />
 *       </div>
 *     </div>
 *   )}
 * </FormWizard.Progress>
 * ```
 *
 * @example Circular progress
 * ```tsx
 * <FormWizard.Progress>
 *   {({ percent }) => (
 *     <CircularProgress value={percent} />
 *   )}
 * </FormWizard.Progress>
 * ```
 */
export function FormWizardProgress({ children }: FormWizardProgressProps) {
  // Runtime check for headless API
  if (typeof children !== 'function') {
    throw new Error(
      'FormWizard.Progress requires children as a render function. ' +
        'Example: <FormWizard.Progress>{({ current, total }) => <YourUI />}</FormWizard.Progress>'
    );
  }

  const { currentStep, totalSteps, completedSteps, isFirstStep, isLastStep } = useFormWizard();

  const renderProps: FormWizardProgressRenderProps = {
    current: currentStep,
    total: totalSteps,
    percent: totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0,
    completedCount: completedSteps.length,
    isFirstStep,
    isLastStep,
  };

  return <>{children(renderProps)}</>;
}

FormWizardProgress.displayName = 'FormWizard.Progress';
