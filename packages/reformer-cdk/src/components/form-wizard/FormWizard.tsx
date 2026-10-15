import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  Children,
  isValidElement,
  cloneElement,
} from 'react';
import {
  createFormFlow,
  createSubmission,
  type FlowTransition,
  type FormFlow,
  type FormSubmission,
} from '@reformer/core';
import { useFormBundleContext, useFormFlow } from '@reformer/core/react';
import { FormWizardContext, type FormWizardContextValue } from './FormWizardContext';
import { FormWizardStep } from './FormWizardStep';
import { FormWizardIndicator } from './FormWizardIndicator';
import { FormWizardActions } from './FormWizardActions';
import { FormWizardProgress } from './FormWizardProgress';
import { FormWizardPrev } from './FormWizardPrev';
import { FormWizardNext } from './FormWizardNext';
import { FormWizardSubmit } from './FormWizardSubmit';
import type { FormWizardProps } from './types';
import { useCdkMessages } from '../../i18n/messages';

/**
 * Инлайновые sr-only стили для live-региона объявления смены шага: элемент есть в DOM
 * и доступен скринридерам, но не влияет на раскладку (headless-компонент не навязывает
 * визуальных стилей потребителю).
 */
const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** Число шагов `FormWizard.Step` в детях — в том числе внутри обёрток. */
function countSteps(node: React.ReactNode): number {
  let count = 0;
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === FormWizardStep) {
      count += 1;
      return;
    }
    const childProps = child.props as { children?: React.ReactNode };
    if (childProps.children) count += countSteps(childProps.children);
  });
  return count;
}

/**
 * Пронумеровать `FormWizard.Step` с единицы — в том числе внутри обёрток: по номеру шаг понимает,
 * текущий ли он. Render-props (функция в `children`) не трогаются.
 */
function numberSteps(children: React.ReactNode): React.ReactNode {
  let counter = 0;
  const visit = (node: React.ReactNode): React.ReactNode =>
    Children.map(node, (child) => {
      if (!isValidElement(child)) return child;
      const childProps = child.props as { children?: React.ReactNode };
      if (child.type === FormWizardStep) {
        counter += 1;
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          ...childProps,
          _stepIndex: counter,
        });
      }
      if (typeof childProps.children === 'function') return child;
      if (childProps.children) {
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          ...childProps,
          children: visit(childProps.children),
        });
      }
      return child;
    });
  return visit(children);
}

/** Шаги позиционного потока: `'1'`, `'2'`, … */
const positionalSteps = (total: number): string[] =>
  Array.from({ length: Math.max(total, 1) }, (_, index) => String(index + 1));

/**
 * FormWizard — headless compound для многошаговой формы.
 *
 * Состояние шагов — поток `FormFlow` ядра: проп `flow`, иначе поток сборки `createForm({ flow })`
 * из контекста, иначе позиционный поток без правил по числу `FormWizard.Step`. Визард рисует
 * поток и зовёт его переходы; правила доступности шагов и проверку шага держит поток.
 *
 * Отправка: внутри сборки (контекст `FormBundleContext`) обработчик зовётся через
 * `bundle.submission` — только после успешной проверки всей формы. Без сборки визард строит свою
 * отправку без проверки (`createSubmission`): обработчик зовётся по нажатию, `isSubmitting` истинен,
 * пока он работает, а проверку делает приложение.
 *
 * @example Поток сборки
 * ```tsx
 * const bundle = useFormBundle(() =>
 *   createForm<MyForm>({
 *     model,
 *     flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
 *   })
 * );
 *
 * <FormWizard form={bundle.form} flow={bundle.flow}>
 *   <FormWizard.Step component={LoanStep} control={bundle.form} />
 *   <FormWizard.Step component={ConfirmStep} control={bundle.form} />
 *   <FormWizard.Actions onSubmit={() => void bundle.submission.submit(api.save)}>
 *     {({ prev, next, submit, isFirstStep, isLastStep }) => (
 *       <div className="actions">
 *         {!isFirstStep && <Button {...prev}>Назад</Button>}
 *         {!isLastStep ? <Button {...next}>Далее</Button> : <Button {...submit}>Отправить</Button>}
 *       </div>
 *     )}
 *   </FormWizard.Actions>
 * </FormWizard>
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormWizardBase<T extends Record<string, any>>({
  form: formProp,
  flow: flowProp,
  children,
  onStepChange,
  scrollToTop = true,
}: FormWizardProps<T>) {
  const bundle = useFormBundleContext<T>();
  const form = formProp ?? bundle?.form;
  if (!form) {
    throw new Error(
      '[@reformer/cdk] FormWizard: no form. Pass `form` or render the wizard inside a ' +
        '`createForm` bundle (FormRenderer puts it into context).'
    );
  }

  const totalSteps = countSteps(children);
  const givenFlow = flowProp ?? bundle?.flow;
  const positional = useMemo(
    () => (givenFlow ? undefined : createFormFlow({ steps: positionalSteps(totalSteps) })),
    [givenFlow, totalSteps]
  );
  const flow = (givenFlow ?? positional) as FormFlow;
  const state = useFormFlow(flow);

  // Отправка сборки; без сборки — своя, без проверки: значения формы как есть.
  const submission = useMemo<FormSubmission<T>>(
    () =>
      bundle?.submission ??
      createSubmission<T>({ check: undefined, values: () => form.getValue() as T }),
    [bundle, form]
  );
  const isSubmitting = useSyncExternalStore(
    useCallback((onChange) => submission.submitting.subscribe(() => onChange()), [submission]),
    () => submission.submitting.peek(),
    () => false
  );

  /** После перехода: колбэк смены шага и прокрутка к началу. */
  const settle = useCallback(
    (transition: FlowTransition): boolean => {
      if (transition.status !== 'moved') return false;
      onStepChange?.(flow.steps.indexOf(transition.to) + 1);
      if (scrollToTop && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return true;
    },
    [flow, onStepChange, scrollToTop]
  );

  const goToNextStep = useCallback(async (): Promise<boolean> => {
    const transition = await flow.next();
    if (transition.status === 'stayed' && transition.reason !== 'edge') {
      // Шаг не прошёл проверку. Замечания уже видны: проверка шага трогает именно проверенные
      // поля (`validateStep` → `touch`), а поля следующих шагов остаются нетронутыми.
      return false;
    }
    settle(transition);
    return true;
  }, [flow, settle]);

  const goToPreviousStep = useCallback(() => {
    settle(flow.previous());
  }, [flow, settle]);

  const goToStep = useCallback(
    (step: number): boolean => {
      const stepId = flow.steps[step - 1];
      return stepId !== undefined && settle(flow.goTo(stepId));
    },
    [flow, settle]
  );

  const submit = useCallback(
    <R,>(handler: (values: T) => Promise<R> | R) => submission.submit(handler),
    [submission]
  );

  const currentStep = state.index + 1;
  const t = useCdkMessages();
  const completedSteps = useMemo(
    () => flow.steps.flatMap((step, index) => (state.completed.has(step) ? [index + 1] : [])),
    [flow, state.completed]
  );

  const contextValue = useMemo<FormWizardContextValue<T>>(
    () => ({
      form,
      flow,
      currentStep,
      totalSteps: flow.steps.length,
      completedSteps,
      isFirstStep: state.isFirst,
      isLastStep: state.isLast,
      isValidating: state.validating,
      isSubmitting,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
    }),
    [
      form,
      flow,
      currentStep,
      completedSteps,
      state.isFirst,
      state.isLast,
      state.validating,
      isSubmitting,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      submit,
    ]
  );

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <FormWizardContext.Provider value={contextValue as FormWizardContextValue<any>}>
      {/*
       * Polite live-region: озвучивает смену шага скринридерам («Step N of M» — текст из словаря
       * cdk, ключ `cdk.formWizard.stepStatus`, по локали `I18nProvider`). Управление
       * фокусом остаётся за потребителем через onStepChange.
       */}
      <div role="status" aria-live="polite" aria-atomic="true" style={srOnlyStyle}>
        {t('cdk.formWizard.stepStatus', { current: currentStep, total: flow.steps.length })}
      </div>
      {numberSteps(children)}
    </FormWizardContext.Provider>
  );
}

type FormWizardComponent = typeof FormWizardBase & {
  Step: typeof FormWizardStep;
  Indicator: typeof FormWizardIndicator;
  Actions: typeof FormWizardActions;
  Progress: typeof FormWizardProgress;
  Prev: typeof FormWizardPrev;
  Next: typeof FormWizardNext;
  Submit: typeof FormWizardSubmit;
};

export const FormWizard = FormWizardBase as FormWizardComponent;
FormWizard.Step = FormWizardStep;
FormWizard.Indicator = FormWizardIndicator;
FormWizard.Actions = FormWizardActions;
FormWizard.Progress = FormWizardProgress;
FormWizard.Prev = FormWizardPrev;
FormWizard.Next = FormWizardNext;
FormWizard.Submit = FormWizardSubmit;
