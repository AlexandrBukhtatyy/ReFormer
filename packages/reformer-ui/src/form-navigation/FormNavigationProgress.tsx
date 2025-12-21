import type { ReactNode } from 'react';
import { useFormNavigation } from './FormNavigationContext';

/**
 * Render props passed to children function
 */
export interface FormNavigationProgressRenderProps {
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
 * Props for FormNavigation.Progress component
 */
export interface FormNavigationProgressProps {
  /** Render function for custom UI */
  children: (props: FormNavigationProgressRenderProps) => ReactNode;
}

/**
 * FormNavigation.Progress - Headless component for progress display
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
 * <FormNavigation.Progress>
 *   {({ current, total, percent }) => (
 *     <div className="text-sm text-gray-600">
 *       Step {current} of {total} ({percent}% complete)
 *     </div>
 *   )}
 * </FormNavigation.Progress>
 * ```
 *
 * @example Progress bar
 * ```tsx
 * <FormNavigation.Progress>
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
 * </FormNavigation.Progress>
 * ```
 *
 * @example Circular progress
 * ```tsx
 * <FormNavigation.Progress>
 *   {({ percent }) => (
 *     <CircularProgress value={percent} />
 *   )}
 * </FormNavigation.Progress>
 * ```
 */
export function FormNavigationProgress({ children }: FormNavigationProgressProps) {
  // Runtime check for headless API
  if (typeof children !== 'function') {
    throw new Error(
      'FormNavigation.Progress requires children as a render function. ' +
        'Example: <FormNavigation.Progress>{({ current, total }) => <YourUI />}</FormNavigation.Progress>'
    );
  }

  const { currentStep, totalSteps, completedSteps, isFirstStep, isLastStep } = useFormNavigation();

  const renderProps: FormNavigationProgressRenderProps = {
    current: currentStep,
    total: totalSteps,
    percent: Math.round((currentStep / totalSteps) * 100),
    completedCount: completedSteps.length,
    isFirstStep,
    isLastStep,
  };

  return <>{children(renderProps)}</>;
}

FormNavigationProgress.displayName = 'FormNavigation.Progress';
