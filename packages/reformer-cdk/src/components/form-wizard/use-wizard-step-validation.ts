import { useEffect } from 'react';
import type { FormValidationController } from '@reformer/core/validation';
import { useFormWizard } from './FormWizardContext';

/** Минимум от {@link WizardStepsConfig}, нужный хуку: фабрика контроллера live-стратегии шага. */
export interface StepValidationConfig {
  createStepController: (step: number) => FormValidationController | null;
}

/**
 * Армирует live-стратегию валидации (`strategy` из {@link defineSteps}) для ТЕКУЩЕГО шага мастера.
 * Читает `currentStep` из контекста {@link FormWizard}, собирает контроллер под под-схему шага и
 * снимает его при смене шага / размонтировании. Per-step gate («Далее») и submit (`validateAll`) не
 * затрагиваются — это отдельный, живой слой поверх них.
 *
 * No-op, если в `defineSteps` не задана `strategy` (или `'submit'`) либо у шага нет правил.
 *
 * @example
 * ```tsx
 * const config = defineSteps<'loan' | 'confirm', Root>(model, {
 *   steps: { loan: step1, confirm: null },
 *   strategy: 'blur',
 * });
 *
 * function LoanStepBody() {
 *   useWizardStepValidation(config); // живая валидация полей шага при blur
 *   return <>{/* поля шага *\/}</>;
 * }
 * ```
 */
export function useWizardStepValidation(config: StepValidationConfig): void {
  const { currentStep } = useFormWizard();

  useEffect(() => {
    const controller = config.createStepController(currentStep);
    if (!controller) return;
    return controller.start(); // dispose при смене шага / размонтировании
  }, [config, currentStep]);
}
