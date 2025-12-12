import {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useMemo,
  Children,
  isValidElement,
  cloneElement,
} from 'react';
import { validateForm } from '@reformer/core/validators';
import { FormNavigationContext } from './FormNavigationContext';
import { FormNavigationStep } from './FormNavigationStep';
import { FormNavigationIndicator } from './FormNavigationIndicator';
import { FormNavigationActions } from './FormNavigationActions';
import { FormNavigationProgress } from './FormNavigationProgress';
import type { FormNavigationHandle, FormNavigationProps } from './types';

/**
 * FormNavigation - Headless compound component for multi-step form navigation
 *
 * Uses Ref Handle Pattern to expose navigation methods via ref.
 * Encapsulates all validation and step transition logic.
 * All sub-components (Indicator, Actions, Progress) are headless with render props.
 *
 * @example Basic usage
 * ```tsx
 * const navRef = useRef<FormNavigationHandle<MyForm>>(null);
 *
 * <FormNavigation ref={navRef} form={form} config={config}>
 *   <FormNavigation.Step component={Step1} control={form} />
 *   <FormNavigation.Step component={Step2} control={form} />
 * </FormNavigation>
 * ```
 *
 * @example Full example with headless components
 * ```tsx
 * <FormNavigation ref={navRef} form={form} config={config}>
 *   <FormNavigation.Indicator steps={STEPS}>
 *     {({ steps, goToStep }) => (
 *       <nav className="stepper">
 *         {steps.map(step => (
 *           <button key={step.number} onClick={() => goToStep(step.number)}>
 *             {step.title}
 *           </button>
 *         ))}
 *       </nav>
 *     )}
 *   </FormNavigation.Indicator>
 *
 *   <FormNavigation.Step component={Step1} control={form} />
 *   <FormNavigation.Step component={Step2} control={form} />
 *
 *   <FormNavigation.Actions onSubmit={handleSubmit}>
 *     {({ prev, next, submit, isFirstStep, isLastStep }) => (
 *       <div className="actions">
 *         {!isFirstStep && <Button {...prev}>Back</Button>}
 *         {!isLastStep ? <Button {...next}>Next</Button> : <Button {...submit}>Submit</Button>}
 *       </div>
 *     )}
 *   </FormNavigation.Actions>
 *
 *   <FormNavigation.Progress>
 *     {({ current, total, percent }) => (
 *       <span>Step {current}/{total} ({percent}%)</span>
 *     )}
 *   </FormNavigation.Progress>
 * </FormNavigation>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormNavigationInner<T extends Record<string, any>>(
  { form, config, children, onStepChange, scrollToTop = true }: FormNavigationProps<T>,
  ref: React.ForwardedRef<FormNavigationHandle<T>>
) {
  // Recursively count Step children for totalSteps (supports Steps inside wrapper divs)
  const countSteps = (node: React.ReactNode): number => {
    let count = 0;
    Children.forEach(node, (child) => {
      if (isValidElement(child)) {
        if (child.type === FormNavigationStep) {
          count += 1;
        } else {
          const childProps = child.props as { children?: React.ReactNode };
          if (childProps.children) {
            count += countSteps(childProps.children);
          }
        }
      }
    });
    return count;
  };
  const totalSteps = countSteps(children);

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Track submitting state from form
  const isSubmitting = form.submitting.value;

  // ============================================================================
  // Validation
  // ============================================================================

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const schema = config.stepValidations[currentStep];

    if (!schema) {
      console.warn(`No validation schema for step ${currentStep}`);
      return true;
    }

    setIsValidating(true);
    try {
      return await validateForm(form, schema);
    } finally {
      setIsValidating(false);
    }
  }, [form, currentStep, config.stepValidations]);

  // ============================================================================
  // Navigation
  // ============================================================================

  const goToNextStep = useCallback(async (): Promise<boolean> => {
    const isValid = await validateCurrentStep();

    if (!isValid) {
      form.markAsTouched();
      return false;
    }

    // Add to completed steps
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }

    // Move to next step
    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);

      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    return true;
  }, [
    validateCurrentStep,
    currentStep,
    completedSteps,
    totalSteps,
    form,
    onStepChange,
    scrollToTop,
  ]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);

      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentStep, onStepChange, scrollToTop]);

  const goToStep = useCallback(
    (step: number): boolean => {
      // Can go to step 1 or to a step if the previous step is completed
      const canGoTo = step === 1 || completedSteps.includes(step - 1);

      if (canGoTo && step >= 1 && step <= totalSteps) {
        setCurrentStep(step);
        onStepChange?.(step);

        if (scrollToTop) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return true;
      }

      return false;
    },
    [completedSteps, totalSteps, onStepChange, scrollToTop]
  );

  // ============================================================================
  // Submit
  // ============================================================================

  const submit = useCallback(
    async <R,>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> => {
      setIsValidating(true);
      try {
        // Validate entire form with full schema
        const isValid = await validateForm(form, config.fullValidation);

        if (!isValid) {
          form.markAsTouched();
          return null;
        }

        // Use built-in submit of GroupNode
        return form.submit(onSubmit);
      } finally {
        setIsValidating(false);
      }
    },
    [form, config.fullValidation]
  );

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  // ============================================================================
  // Expose via ref
  // ============================================================================

  useImperativeHandle(
    ref,
    () => ({
      currentStep,
      completedSteps,
      validateCurrentStep,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
      isFirstStep,
      isLastStep,
      isValidating,
    }),
    [
      currentStep,
      completedSteps,
      validateCurrentStep,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
      isFirstStep,
      isLastStep,
      isValidating,
    ]
  );

  // ============================================================================
  // Context Value (includes navigation methods for child components)
  // ============================================================================

  const contextValue = useMemo(
    () => ({
      // State
      currentStep,
      totalSteps,
      completedSteps,
      isFirstStep,
      isLastStep,
      isValidating,
      isSubmitting,
      form,
      // Navigation methods
      goToNextStep,
      goToPreviousStep,
      goToStep,
    }),
    [
      currentStep,
      totalSteps,
      completedSteps,
      isFirstStep,
      isLastStep,
      isValidating,
      isSubmitting,
      form,
      goToNextStep,
      goToPreviousStep,
      goToStep,
    ]
  );

  // ============================================================================
  // Render children with step indices (recursively for nested Steps)
  // ============================================================================

  let stepIndexCounter = 0;

  const processChildren = (node: React.ReactNode): React.ReactNode => {
    return Children.map(node, (child) => {
      if (!isValidElement(child)) {
        return child;
      }

      const childProps = child.props as { children?: React.ReactNode };

      if (child.type === FormNavigationStep) {
        stepIndexCounter += 1;
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          ...childProps,
          _stepIndex: stepIndexCounter, // 1-based indexing
        });
      }

      // Skip processing for headless components with render props (children as function)
      // This preserves the render function for Indicator, Actions, Progress
      if (typeof childProps.children === 'function') {
        return child;
      }

      // Recursively process children of wrapper elements (like divs)
      if (childProps.children) {
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          ...childProps,
          children: processChildren(childProps.children),
        });
      }

      return child;
    });
  };

  const childrenWithIndices = processChildren(children);

  return (
    <FormNavigationContext.Provider value={contextValue}>
      {childrenWithIndices}
    </FormNavigationContext.Provider>
  );
}

// Typed forwardRef for generic component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormNavigationBase = forwardRef(FormNavigationInner) as <T extends Record<string, any>>(
  props: FormNavigationProps<T> & { ref?: React.ForwardedRef<FormNavigationHandle<T>> }
) => React.ReactElement;

// Create compound component with all sub-components attached
type FormNavigationComponent = typeof FormNavigationBase & {
  Step: typeof FormNavigationStep;
  Indicator: typeof FormNavigationIndicator;
  Actions: typeof FormNavigationActions;
  Progress: typeof FormNavigationProgress;
};

export const FormNavigation = FormNavigationBase as FormNavigationComponent;
FormNavigation.Step = FormNavigationStep;
FormNavigation.Indicator = FormNavigationIndicator;
FormNavigation.Actions = FormNavigationActions;
FormNavigation.Progress = FormNavigationProgress;
