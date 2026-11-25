import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  Children,
  isValidElement,
  cloneElement,
} from 'react';
import {
  createFormFlow,
  createSubmission,
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
 * Условный шаг: шаг, который поток сейчас пропускает (`flow.activeSteps` — в сборке это скрытый
 * узел шага), визард не рисует и не считает. Номер шага, число шагов и пройденные шаги — по
 * участвующим шагам; `FormWizard.Step` связан с шагом потока по месту среди всех шагов.
 *
 * Смена шага: `onStepChange` и прокрутка к началу (`scrollToTop`) идут от потока — на любую смену
 * `flow.current`, кто бы ни перевёл поток: кнопки визарда, `flow.goTo` снаружи или из поведения,
 * отказ отправки с `onInvalidSubmit: 'firstInvalidStep'`, `flow.reset()`. Один раз на смену, после
 * отрисовки нового шага.
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

  const stepCount = countSteps(children);
  const givenFlow = flowProp ?? bundle?.flow;
  const positional = useMemo(
    () => (givenFlow ? undefined : createFormFlow({ steps: positionalSteps(stepCount) })),
    [givenFlow, stepCount]
  );
  const flow = (givenFlow ?? positional) as FormFlow;
  const state = useFormFlow(flow);
  // Идентификатор текущего шага и участвующие шаги — отдельными значениями: зависимости хуков.
  const { current: currentStepId, activeSteps: activeStepIds } = state;

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

  // Смена шага — колбэк и прокрутка к началу. Источник смены — сам поток, а не кнопки визарда:
  // так их получают и переходы снаружи (`flow.goTo` из кода или поведения, переход отказа отправки
  // `onInvalidSubmit: 'firstInvalidStep'`, `flow.reset()`). Эффект идёт после фиксации, когда новый
  // шаг уже нарисован: в колбэке в него можно перевести фокус. Первая отрисовка — точка отсчёта,
  // не смена; смена самого потока (другой проп `flow`, пересобранный позиционный) — тоже. Смена —
  // это другой шаг, а не другой номер: шаг перед текущим скрылся — номер стал меньше, шаг тот же.
  const shown = useRef<{ flow: FormFlow; step: string } | null>(null);
  useEffect(() => {
    const last = shown.current;
    shown.current = { flow, step: currentStepId };
    if (last === null || last.flow !== flow || last.step === currentStepId) return;
    onStepChange?.(state.index + 1);
    if (scrollToTop && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [flow, currentStepId, state.index, onStepChange, scrollToTop]);

  const goToNextStep = useCallback(async (): Promise<boolean> => {
    const transition = await flow.next();
    if (transition.status === 'stayed' && transition.reason !== 'edge') {
      // Шаг не прошёл проверку. Замечания уже видны: проверка шага трогает именно проверенные
      // поля (`validateStep` → `touch`), а поля следующих шагов остаются нетронутыми.
      return false;
    }
    return true;
  }, [flow]);

  const goToPreviousStep = useCallback(() => {
    flow.previous();
  }, [flow]);

  const goToStep = useCallback(
    (step: number): boolean => {
      // Номер шага — среди участвующих шагов, как в индикаторе.
      const stepId = flow.activeSteps.peek()[step - 1];
      return stepId !== undefined && flow.goTo(stepId).status === 'moved';
    },
    [flow]
  );

  const submit = useCallback(
    <R,>(handler: (values: T) => Promise<R> | R) => submission.submit(handler),
    [submission]
  );

  const currentStep = state.index + 1;
  const t = useCdkMessages();
  const totalSteps = activeStepIds.length;
  const completedSteps = useMemo(
    () => activeStepIds.flatMap((step, index) => (state.completed.has(step) ? [index + 1] : [])),
    [activeStepIds, state.completed]
  );

  const contextValue = useMemo<FormWizardContextValue<T>>(
    () => ({
      form,
      flow,
      currentStep,
      currentStepId,
      activeStepIds,
      totalSteps,
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
      currentStepId,
      activeStepIds,
      totalSteps,
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
        {t('cdk.formWizard.stepStatus', { current: currentStep, total: totalSteps })}
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
