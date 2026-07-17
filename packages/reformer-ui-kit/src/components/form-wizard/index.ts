// ReFormer-специфичный (не shadcn) multi-step wizard: стилизованная обёртка
// поверх headless-compound `@reformer/cdk/form-wizard` + презентационные слоты
// (StepIndicator / FormWizardActions / FormWizardProgress).
export { FormWizard } from './variants/base/form-wizard';
export type {
  FormWizardProps,
  FormWizardStep,
  FormWizardStepBody,
} from './variants/base/form-wizard';
export { StepIndicator } from './variants/base/step-indicator';
export type { StepIndicatorProps } from './variants/base/step-indicator';
export { FormWizardActions } from './variants/base/form-wizard-actions';
export type { FormWizardActionsProps } from './variants/base/form-wizard-actions';
export { FormWizardProgress } from './variants/base/form-wizard-progress';
export type { FormWizardProgressProps } from './variants/base/form-wizard-progress';
