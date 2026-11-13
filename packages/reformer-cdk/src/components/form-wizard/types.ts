import type { ReactNode } from 'react';
import type { FormFlow, FormGroup } from '@reformer/core';

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
  form?: FormGroup<T>;

  /** Поток шагов. По умолчанию — поток сборки из контекста, иначе позиционный без правил. */
  flow?: FormFlow;

  /** Children (Step components, Indicator, Actions, Progress, or any ReactNode) */
  children?: ReactNode;

  /**
   * Колбэк смены шага: номер нового шага с единицы.
   *
   * Зовётся на любую смену текущего шага потока (`flow.current`), кто бы ни перевёл поток: кнопки
   * и индикатор визарда, `useFormWizard()`, `flow.next()` / `previous()` / `goTo(id)` / `reset()`
   * снаружи или из поведения формы, отказ отправки с `flow.onInvalidSubmit: 'firstInvalidStep'`.
   * Один раз на смену и после того, как новый шаг нарисован, — в колбэке в него можно перевести
   * фокус. Первая отрисовка визарда и замена самого потока (другой проп `flow`) сменой шага не
   * считаются.
   */
  onStepChange?: (step: number) => void;

  /**
   * Прокручивать окно к началу (`window.scrollTo({ top: 0, behavior: 'smooth' })`) при смене шага —
   * в тех же случаях, что и {@link FormWizardProps.onStepChange}. По умолчанию `true`; выключите,
   * если визард стоит не в начале страницы.
   */
  scrollToTop?: boolean;
}
