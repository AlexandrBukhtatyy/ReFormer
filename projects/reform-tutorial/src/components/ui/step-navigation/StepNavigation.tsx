import { forwardRef, useImperativeHandle, useState, useCallback, useMemo } from 'react';
import { validateForm } from 'reformer/validators';
import type { FormValue } from 'reformer';
import type {
  StepNavigationHandle,
  StepNavigationProps,
  StepNavigationRenderState,
} from './types';

/**
 * StepNavigation - компонент навигации по шагам с валидацией
 *
 * Использует Ref Handle Pattern для предоставления методов навигации
 * через ref. Инкапсулирует всю логику валидации и переходов между шагами.
 *
 * @example
 * ```tsx
 * const navRef = useRef<StepNavigationHandle<MyForm>>(null);
 *
 * <StepNavigation ref={navRef} form={form} config={config}>
 *   {(currentStep) => (
 *     <>
 *       {currentStep === 1 && <Step1 control={form} />}
 *       {currentStep === 2 && <Step2 control={form} />}
 *     </>
 *   )}
 * </StepNavigation>
 *
 * // Внешний доступ
 * navRef.current?.goToNextStep();
 * ```
 */
function StepNavigationInner<T extends Record<string, FormValue>>(
  { form, config, children, onStepChange, scrollToTop = true }: StepNavigationProps<T>,
  ref: React.ForwardedRef<StepNavigationHandle<T>>
) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // ============================================================================
  // Валидация текущего шага
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
  // Навигация между шагами
  // ============================================================================

  const goToNextStep = useCallback(async (): Promise<boolean> => {
    const isValid = await validateCurrentStep();

    if (!isValid) {
      form.markAsTouched();
      return false;
    }

    // Добавляем в завершенные шаги
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }

    // Переходим на следующий шаг
    if (currentStep < config.totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);

      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    return true;
  }, [validateCurrentStep, currentStep, completedSteps, config.totalSteps, form, onStepChange, scrollToTop]);

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
      // Можно перейти на шаг 1 или на шаг, если предыдущий завершен
      const canGoTo = step === 1 || completedSteps.includes(step - 1);

      if (canGoTo && step >= 1 && step <= config.totalSteps) {
        setCurrentStep(step);
        onStepChange?.(step);

        if (scrollToTop) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return true;
      }

      return false;
    },
    [completedSteps, config.totalSteps, onStepChange, scrollToTop]
  );

  // ============================================================================
  // Отправка формы
  // ============================================================================

  const submit = useCallback(
    async <R,>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> => {
      setIsValidating(true);
      try {
        // Валидируем всю форму с полной схемой
        const isValid = await validateForm(form, config.fullValidation);

        if (!isValid) {
          form.markAsTouched();
          return null;
        }

        // Используем встроенный submit GroupNode
        return form.submit(onSubmit);
      } finally {
        setIsValidating(false);
      }
    },
    [form, config.fullValidation]
  );

  // ============================================================================
  // Вычисляемые свойства
  // ============================================================================

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === config.totalSteps;

  // ============================================================================
  // Expose через ref
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
  // Render State для children
  // ============================================================================

  const renderState: StepNavigationRenderState = useMemo(
    () => ({
      currentStep,
      completedSteps,
      isFirstStep,
      isLastStep,
      isValidating,
    }),
    [currentStep, completedSteps, isFirstStep, isLastStep, isValidating]
  );

  // ============================================================================
  // Рендеринг
  // ============================================================================

  return <>{children(renderState)}</>;
}

// Типизированный forwardRef для generic компонента
export const StepNavigation = forwardRef(StepNavigationInner) as <
  T extends Record<string, FormValue>
>(
  props: StepNavigationProps<T> & { ref?: React.ForwardedRef<StepNavigationHandle<T>> }
) => React.ReactElement;
