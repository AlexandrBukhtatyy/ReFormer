/**
 * useStepForm - хук для управления multi-step формами
 *
 * Инкапсулирует логику:
 * - Навигации между шагами
 * - Валидации по шагам
 * - Отслеживания прогресса
 * - Отправки формы
 */

import type { GroupNodeWithControls, ValidationSchemaFn } from 'reformer';
import { validateForm } from 'reformer/validators';
import { useState, useCallback } from 'react';

/**
 * Конфигурация multi-step формы
 */
export interface StepFormConfig<T extends Record<string, any>> {
  /** Общее количество шагов */
  totalSteps: number;

  /** Схемы валидации для каждого шага */
  stepSchemas: Record<number, ValidationSchemaFn<T>>;

  /** Полная схема валидации (для submit) */
  fullSchema: ValidationSchemaFn<T>;
}

/**
 * Результат хука useStepForm
 */
export interface UseStepFormResult<T extends Record<string, any>> {
  /** Текущий шаг (1-based) */
  currentStep: number;

  /** Завершенные шаги */
  completedSteps: number[];

  /** Валидировать текущий шаг */
  validateCurrentStep: () => Promise<boolean>;

  /** Перейти на следующий шаг (с валидацией) */
  goToNextStep: () => Promise<boolean>;

  /** Перейти на предыдущий шаг */
  goToPreviousStep: () => void;

  /** Перейти на конкретный шаг */
  goToStep: (step: number) => boolean;

  /** Отправить форму (с полной валидацией) */
  submit: <R>(onSubmit: (values: T) => Promise<R> | R) => Promise<R | null>;

  /** Первый ли это шаг */
  isFirstStep: boolean;

  /** Последний ли это шаг */
  isLastStep: boolean;
}

/**
 * Хук для управления multi-step формами
 *
 * @param createForm - Функция создания формы
 * @param config - Конфигурация шагов и валидации
 * @returns Объект с методами управления формой
 *
 * @example
 * ```typescript
 * const {
 *   form,
 *   currentStep,
 *   completedSteps,
 *   goToNextStep,
 *   goToPreviousStep,
 *   submit,
 * } = useStepForm(createCreditApplicationForm, {
 *   totalSteps: 6,
 *   stepSchemas: {
 *     1: step1ValidationSchema,
 *     2: step2ValidationSchema,
 *     // ...
 *   },
 *   fullSchema: fullValidationSchema,
 * });
 *
 * // В компоненте
 * return (
 *   <div>
 *     {currentStep === 1 && <Step1Form control={form} />}
 *     <Button onClick={goToNextStep}>Далее</Button>
 *   </div>
 * );
 * ```
 */
export function useStepForm<T extends Record<string, any>>(
  form: GroupNodeWithControls<T>,
  config: StepFormConfig<T>
): UseStepFormResult<T> {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // ============================================================================
  // Валидация текущего шага
  // ============================================================================

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const schema = config.stepSchemas[currentStep];

    if (!schema) {
      console.warn(`No validation schema for step ${currentStep}`);
      return true;
    }

    return await validateForm(form, schema);
  }, [form, currentStep, config.stepSchemas]);

  // ============================================================================
  // Навигация между шагами
  // ============================================================================

  const goToNextStep = useCallback(async (): Promise<boolean> => {
    // Валидируем текущий шаг
    const isValid = await validateCurrentStep();

    if (!isValid) {
      form.markAsTouched();
      return false;
    }

    // Добавляем в завершенные шаги
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }

    // Переходим на следующий шаг
    if (currentStep < config.totalSteps) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return true;
  }, [validateCurrentStep, currentStep, completedSteps, config.totalSteps, form]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number): boolean => {
      // Можно перейти на шаг 1 или на шаг, если предыдущий завершен
      const canGoTo = step === 1 || completedSteps.includes(step - 1);

      if (canGoTo && step >= 1 && step <= config.totalSteps) {
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      }

      return false;
    },
    [completedSteps, config.totalSteps]
  );

  // ============================================================================
  // Отправка формы
  // ============================================================================

  const submit = useCallback(
    async <R>(onSubmit: (values: T) => Promise<R> | R): Promise<R | null> => {
      // Валидируем всю форму с полной схемой
      const isValid = await validateForm(form, config.fullSchema);

      if (!isValid) {
        form.markAsTouched();
        return null;
      }

      // Используем встроенный submit GroupNode
      return form.submit(onSubmit);
    },
    [form, config.fullSchema]
  );

  // ============================================================================
  // Вычисляемые свойства
  // ============================================================================

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === config.totalSteps;

  // ============================================================================
  // Возврат результата
  // ============================================================================

  return {
    currentStep,
    completedSteps,
    validateCurrentStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    submit,
    isFirstStep,
    isLastStep,
  };
}
