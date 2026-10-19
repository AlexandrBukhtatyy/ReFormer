/**
 * Визард кита — HexaUI `Wizard` по протоколу визарда каталога `3.0` (`KitWizardProtocol` SDK).
 *
 * В схеме формы визард — обычный узел: `{ selector: 'wizard', component: FormWizard, children:
 * [шаги] }`, шаг — `{ selector: 'loan', component: Step, componentProps: { title } }` со `Step` из
 * `@reformer/cdk/form-wizard`. Протокол:
 *
 * 1. статика `__selfManagedChildren = true` — рендерер отдаёт шаги ДАННЫМИ (узлы схемы) вместе с
 *    функцией их отрисовки `renderNode`;
 * 2. форма, поток шагов и отправка — из контекста сборки `createForm` (`useFormBundleContext()`):
 *    `bundle.form`, `bundle.flow`, `bundle.submission`. Без потока сборки визард строит
 *    позиционный — без правил;
 * 3. шаг схемы связан с шагом потока по `selector` узла (`./wizard-steps`).
 *
 * ## Шаг меняет поток, а не HexaUI
 *
 * HexaUI `Wizard` здесь управляемый: `activeStep` — номер шага потока. Кнопка «Далее» — `onNext`
 * шага, который всегда отвечает `false` и сам зовёт `flow.next()` (проверка правил шага и переход)
 * либо на последнем шаге — `bundle.submission.submit(onSubmit)` (проверка всей формы). Ответь он
 * `true`, HexaUI сделал бы свой переход поверх перехода потока — двойной шаг. «Назад» и щелчок по
 * шагу приходят в `onStepChange` и становятся `flow.goTo`: на непройденный шаг поток не пустит.
 *
 * Подписи кнопок — пропсами (`nextLabel`, `backLabel`, `submitLabel`); без них — словарь HexaUI
 * той локали, что задана провайдеру кита.
 *
 * @module reformer/kit-hexa-ui/wizard
 */

import { useEffect, useMemo, useRef, type Key, type ReactNode } from 'react';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `./palette`).
import { Wizard } from '@kaspersky/hexa-ui/wizard';
import { createFormFlow, createSubmission, type FormFlow, type FormGroup } from '@reformer/core';
import { useFormBundleContext, useFormFlow } from '@reformer/core/react';
import {
  advance,
  clampStep,
  flowStepsMismatch,
  goToIndex,
  mismatchMessage,
  orderedNodes,
  positionalSteps,
  type WizardStepNode,
} from './wizard-steps';

export type { WizardStepNode } from './wizard-steps';

/** Пропсы {@link FormWizard}. В схеме формы `children` и `renderNode` передаёт рендерер. */
export interface FormWizardProps<T = Record<string, unknown>> {
  /** Узлы шагов из схемы формы — данными, а не отрисованными элементами. */
  children?: readonly WizardStepNode[];
  /** Отрисовка узла схемы. Передаёт рендерер вместе с `children`. */
  renderNode?: (node: WizardStepNode, key?: Key) => ReactNode;
  /** Форма. В схеме необязательна — берётся из сборки `createForm`. */
  form?: FormGroup<T>;
  /** Поток шагов. В схеме необязателен — берётся из сборки; без него поток позиционный. */
  flow?: FormFlow;
  /**
   * Отправка на последнем шаге: получает значения формы. Внутри сборки зовётся через
   * `bundle.submission` — только после успешной проверки всей формы.
   */
  onSubmit?: (values: T) => void | Promise<void>;
  /** Шаг сменился: номер нового шага с единицы. */
  onStepChange?: (step: number) => void;
  /** Подпись кнопки отправки на последнем шаге. По умолчанию — словарь HexaUI. */
  submitLabel?: string;
  /** Подпись кнопки «Далее». По умолчанию — словарь HexaUI. */
  nextLabel?: string;
  /** Подпись кнопки «Назад». По умолчанию — словарь HexaUI. */
  backLabel?: string;
  /** Шаги слева столбцом, а не строкой сверху. */
  isVertical?: boolean;
  className?: string;
  testId?: string;
}

/** Подпись шага из пропсов узла: строка либо ничего. */
const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Пошаговая форма на HexaUI `Wizard` (`view="page"`). Шаги — узлы-дети схемы, форма и поток —
 * из сборки `createForm`.
 */
export function FormWizard<T = Record<string, unknown>>({
  children,
  renderNode,
  form: formProp,
  flow: flowProp,
  onSubmit,
  onStepChange,
  submitLabel,
  nextLabel,
  backLabel,
  isVertical,
  className,
  testId,
}: FormWizardProps<T>) {
  const bundle = useFormBundleContext<T>();
  const form = formProp ?? bundle?.form;
  if (!form) {
    throw new Error(
      '[kit-hexa-ui] FormWizard: нет формы. В схеме визард берёт её из сборки — рисуйте схему ' +
        'через `<FormRenderer form={bundle} />` с бандлом `createForm`; в JSX передайте `form`.'
    );
  }

  const nodes = useMemo(() => children ?? [], [children]);
  const givenFlow = flowProp ?? bundle?.flow;
  const positional = useMemo(
    () => (givenFlow ? undefined : createFormFlow({ steps: positionalSteps(nodes.length) })),
    [givenFlow, nodes.length]
  );
  const flow = (givenFlow ?? positional) as FormFlow;
  const state = useFormFlow(flow);

  // Шаги схемы в порядке потока сборки; позиционный поток порядка не задаёт.
  const ordered = useMemo(
    () => orderedNodes(nodes, givenFlow === undefined ? undefined : givenFlow.steps),
    [nodes, givenFlow]
  );

  // Селекторы шагов одной строкой: зависимость эффекта устойчива к пересозданию массива детей.
  const selectorKey = nodes.map((node) => node.selector ?? '').join('\n');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || givenFlow === undefined) return;
    const selectors = selectorKey.split('\n').map((selector) => selector || undefined);
    const mismatch = flowStepsMismatch(givenFlow.steps, selectors);
    if (mismatch) console.warn(mismatchMessage(mismatch));
  }, [givenFlow, selectorKey]);

  // Отправка сборки; без сборки — своя, без проверки: значения формы как есть.
  const submission = useMemo(
    () =>
      bundle?.submission ??
      createSubmission<T>({ check: undefined, values: () => form.getValue() as T }),
    [bundle, form]
  );

  // Смена шага — наружу, номером с единицы; первая отрисовка сменой не считается.
  const shown = useRef(state.index);
  useEffect(() => {
    if (shown.current === state.index) return;
    shown.current = state.index;
    onStepChange?.(state.index + 1);
  }, [state.index, onStepChange]);

  if (ordered.length === 0) return null;

  const steps = ordered.map((node, index) => ({
    name: text(node.props?.title) ?? '',
    description: text(node.props?.description),
    icon: text(node.props?.icon),
    render: () => renderNode?.(node, node.selector ?? index) ?? null,
    onNext: () => advance(flow, () => submission.submit((values) => onSubmit?.(values))),
  }));

  return (
    <Wizard
      view="page"
      steps={steps}
      activeStep={clampStep(state.index, steps.length)}
      onStepChange={(index) => {
        goToIndex(flow, index);
      }}
      nextButtonText={nextLabel}
      backButtonText={backLabel}
      finishButtonText={submitLabel}
      isVertical={isVertical}
      className={className}
      testId={testId}
    />
  );
}

// Протокол визарда (контракт каталога `3.0`): рендерер отдаёт шаги данными вместе с `renderNode`.
FormWizard.__selfManagedChildren = true as const;
