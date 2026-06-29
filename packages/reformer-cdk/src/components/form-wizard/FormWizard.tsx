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
import { FormWizardContext } from './FormWizardContext';
import { FormWizardStep } from './FormWizardStep';
import { FormWizardIndicator } from './FormWizardIndicator';
import { FormWizardActions } from './FormWizardActions';
import { FormWizardProgress } from './FormWizardProgress';
import { FormWizardPrev } from './FormWizardPrev';
import { FormWizardNext } from './FormWizardNext';
import { FormWizardSubmit } from './FormWizardSubmit';
import type { FormWizardHandle, FormWizardProps } from './types';

/**
 * FormWizard - Headless compound component for multi-step form navigation
 *
 * Uses Ref Handle Pattern to expose navigation methods via ref.
 * Encapsulates all validation and step transition logic.
 * All sub-components (Indicator, Actions, Progress) are headless with render props.
 *
 * @example Basic usage
 * ```tsx
 * const navRef = useRef<FormWizardHandle<MyForm>>(null);
 *
 * <FormWizard ref={navRef} form={form} config={config}>
 *   <FormWizard.Step component={Step1} control={form} />
 *   <FormWizard.Step component={Step2} control={form} />
 * </FormWizard>
 * ```
 *
 * @example Full example with headless components
 * ```tsx
 * <FormWizard ref={navRef} form={form} config={config}>
 *   <FormWizard.Indicator steps={STEPS}>
 *     {({ steps, goToStep }) => (
 *       <nav className="stepper">
 *         {steps.map(step => (
 *           <button key={step.number} onClick={() => goToStep(step.number)}>
 *             {step.title}
 *           </button>
 *         ))}
 *       </nav>
 *     )}
 *   </FormWizard.Indicator>
 *
 *   <FormWizard.Step component={Step1} control={form} />
 *   <FormWizard.Step component={Step2} control={form} />
 *
 *   <FormWizard.Actions onSubmit={handleSubmit}>
 *     {({ prev, next, submit, isFirstStep, isLastStep }) => (
 *       <div className="actions">
 *         {!isFirstStep && <Button {...prev}>Back</Button>}
 *         {!isLastStep ? <Button {...next}>Next</Button> : <Button {...submit}>Submit</Button>}
 *       </div>
 *     )}
 *   </FormWizard.Actions>
 *
 *   <FormWizard.Progress>
 *     {({ current, total, percent }) => (
 *       <span>Step {current}/{total} ({percent}%)</span>
 *     )}
 *   </FormWizard.Progress>
 * </FormWizard>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormWizardInner<T extends Record<string, any>>(
  { form, config, children, onStepChange, scrollToTop = true }: FormWizardProps<T>,
  ref: React.ForwardedRef<FormWizardHandle<T>>
) {
  // Recursively count Step children for totalSteps (supports Steps inside wrapper divs)
  const countSteps = (node: React.ReactNode): number => {
    let count = 0;
    Children.forEach(node, (child) => {
      if (isValidElement(child)) {
        if (child.type === FormWizardStep) {
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
    // M1: колбэк-валидация (validateFormModel) имеет приоритет над legacy-схемами.
    if (config.validateStep) {
      setIsValidating(true);
      try {
        return await config.validateStep(currentStep);
      } finally {
        setIsValidating(false);
      }
    }

    const schema = config.stepValidations?.[currentStep];

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
  }, [form, currentStep, config]);

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
        // Validate entire form: M1 колбэк (validateFormModel) приоритетнее legacy-схемы.
        const isValid = config.validateAll
          ? await config.validateAll()
          : config.fullValidation
            ? await validateForm(form, config.fullValidation)
            : true;

        if (!isValid) {
          form.markAsTouched();
          return null;
        }

        // Use built-in submit of GroupNode
        return form.submit(onSubmit, { skipValidation: true });
      } finally {
        setIsValidating(false);
      }
    },
    [form, config]
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
      form,
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
      form,
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

      if (child.type === FormWizardStep) {
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
    <FormWizardContext.Provider value={contextValue}>
      {childrenWithIndices}
    </FormWizardContext.Provider>
  );
}

// Typed forwardRef for generic component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormWizardBase = forwardRef(FormWizardInner) as <T extends Record<string, any>>(
  props: FormWizardProps<T> & { ref?: React.ForwardedRef<FormWizardHandle<T>> }
) => React.ReactElement;

// Create compound component with all sub-components attached
type FormWizardComponent = typeof FormWizardBase & {
  Step: typeof FormWizardStep;
  Indicator: typeof FormWizardIndicator;
  Actions: typeof FormWizardActions;
  Progress: typeof FormWizardProgress;
  // Action button components
  Prev: typeof FormWizardPrev;
  Next: typeof FormWizardNext;
  Submit: typeof FormWizardSubmit;
};

/**
 * Headless multi-step wizard. Compound-компонент: `FormWizard` + `FormWizard.Step`,
 * `FormWizard.Actions`, `FormWizard.Indicator`, `FormWizard.Progress`,
 * `FormWizard.Prev`, `FormWizard.Next`, `FormWizard.Submit`.
 *
 * @example
 * ```tsx
 * import { FormWizard } from '@reformer/cdk/form-wizard';
 *
 * <FormWizard form={form} steps={[{ name: 'profile' }, { name: 'review' }]}>
 *   <FormWizard.Step name="profile"><ProfileFields /></FormWizard.Step>
 *   <FormWizard.Step name="review"><Review /></FormWizard.Step>
 *   <FormWizard.Actions>
 *     {({ prev, next, submit, isLastStep }) => (
 *       <div>
 *         <button {...prev}>Prev</button>
 *         {isLastStep ? <button {...submit}>Submit</button> : <button {...next}>Next</button>}
 *       </div>
 *     )}
 *   </FormWizard.Actions>
 * </FormWizard>
 * ```
 *
 * @see [docs/llms/03-form-navigation.md](../../../docs/llms/03-form-navigation.md)
 */
export const FormWizard = FormWizardBase as FormWizardComponent;
FormWizard.Step = FormWizardStep;
FormWizard.Indicator = FormWizardIndicator;
FormWizard.Actions = FormWizardActions;
FormWizard.Progress = FormWizardProgress;
// Action button components
FormWizard.Prev = FormWizardPrev;
FormWizard.Next = FormWizardNext;
FormWizard.Submit = FormWizardSubmit;
