import type { ReactNode } from 'react';
import type { FormFlow, FormProxy } from '@reformer/core';

/**
 * Пропсы {@link FormWizard}.
 *
 * Состояние шагов — поток `FormFlow` ядра: проп `flow`, иначе поток сборки `createForm({ flow })`
 * из контекста (`FormBundleContext`), иначе позиционный поток без правил по числу
 * `FormWizard.Step`. Переходы и правила доступности шагов держит поток, визард их рисует.
 *
 * @example Форма и поток сборки
 * ```tsx
 * <FormWizard form={bundle.form} flow={bundle.flow}>
 *   <FormWizard.Step component={LoanStep} control={bundle.form} />
 *   <FormWizard.Step component={ConfirmStep} control={bundle.form} />
 * </FormWizard>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormWizardProps<T extends Record<string, any>> {
  /** Форма. Внутри сборки (`FormBundleContext`) необязательна — берётся из неё. */
  form?: FormProxy<T>;

  /** Поток шагов. По умолчанию — поток сборки из контекста, иначе позиционный без правил. */
  flow?: FormFlow;

  /** Children (Step components, Indicator, Actions, Progress, or any ReactNode) */
  children?: ReactNode;

  /** Колбэк смены шага: номер шага с единицы. */
  onStepChange?: (step: number) => void;

  /** Scroll to top on step change */
  scrollToTop?: boolean;
}
