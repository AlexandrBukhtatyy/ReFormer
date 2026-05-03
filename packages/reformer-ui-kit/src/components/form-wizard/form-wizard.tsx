/**
 * FormWizard — унифицированный multi-step wrapper поверх
 * `@reformer/cdk/form-wizard` headless compound. Один компонент покрывает
 * TS-flow, renderer-react flow и renderer-json flow за счёт полиморфного
 * `step.body`:
 *
 * - `ComponentType<{ control: FormProxy<T> }>` — FC получает `control={form}`.
 * - `ReactNode` — готовый JSX (статический контент шага).
 * - `RenderNode<T>` — RenderSchema-поддерево; внутри обёрнуто в
 *   `<RenderNodeComponent>` для интеграции с `@reformer/renderer-react`.
 *
 * Дискриминация делается в `renderStepBody` по типу значения runtime,
 * без discriminated-union-полей.
 *
 * Маркер `__selfManagedChildren = true` гарантирует, что при использовании
 * внутри RenderSchema родительский renderer пробрасывает `form` как prop
 * без рекурсивного обхода children.
 */

import {
  forwardRef,
  isValidElement,
  useImperativeHandle,
  useRef,
  type ComponentType,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  FormWizard as FormWizardHeadless,
  type FormWizardActionsProps as HeadlessFormWizardActionsProps,
  type FormWizardHandle,
  type FormWizardProps as FormWizardHeadlessProps,
} from '@reformer/cdk/form-wizard';
import type { FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import { FormWizardActions } from './form-wizard-actions';
import { FormWizardProgress } from './form-wizard-progress';
import { StepIndicator } from './step-indicator';

/**
 * Полиморфное тело шага.
 *
 * - FC получает `control={form}`.
 * - ReactNode рендерится напрямую (статический JSX).
 * - RenderNode<T> рендерится через `<RenderNodeComponent>`.
 */
export type FormWizardStepBody<T> =
  | ComponentType<{ control: FormProxy<T> }>
  | ReactNode
  | RenderNode<T>;

export interface FormWizardStep<T> {
  /** Step number (1-based). */
  number: number;
  /** Step title shown in indicator. */
  title: string;
  /** Optional icon (string или ReactNode). Передаётся в headless Indicator. */
  icon?: string;
  /** Body — FC | ReactNode | RenderNode<T>. */
  body: FormWizardStepBody<T>;
}

export interface FormWizardProps<
  // Constraint синхронизирован с headless cdk (`Record<string, any>`) — это
  // снимает блокер инференции generic'а T в JSX, когда T содержит nullable-
  // числа (`number | null`). Constraint используется только для bound, not
  // for direct value access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any>,
> extends FormWizardHeadlessProps<T> {
  className?: string;
  steps: FormWizardStep<T>[];
  onSubmit: HeadlessFormWizardActionsProps['onSubmit'];
}

function isRenderNode<T>(value: unknown): value is RenderNode<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !isValidElement(value as ReactElement) &&
    'component' in (value as object) &&
    // RenderNode-shape, НЕ React component reference (memo/forwardRef имеют $$typeof).
    !('$$typeof' in (value as object))
  );
}

/**
 * React FC reference: либо plain function component, либо `React.memo(fn)` /
 * `React.forwardRef(fn)` обёртка. memo/forwardRef возвращают object вида
 * `{ $$typeof, type, compare? }` — `typeof === 'object'`, не 'function'.
 * Этот check покрывает оба случая.
 */
function isComponentType<T>(value: unknown): value is ComponentType<{ control: FormProxy<T> }> {
  if (typeof value === 'function') return true;
  if (value !== null && typeof value === 'object' && '$$typeof' in (value as object)) {
    // Это либо memo/forwardRef-обёртка, либо React element. Различаем через isValidElement —
    // у element есть `props`/`type` shape, у component-reference нет .props в верхнем уровне.
    return !isValidElement(value as ReactElement);
  }
  return false;
}

function renderStepBody<T>(body: FormWizardStepBody<T>, form: FormProxy<T>): ReactNode {
  // React element (уже-отрендеренный JSX) — отдаём как ReactNode.
  if (isValidElement(body as ReactElement)) return body as ReactNode;
  // Component reference (FC | memo'd FC | forwardRef'd FC) — рендерим с control={form}.
  if (isComponentType<T>(body)) {
    const Comp = body as ComponentType<{ control: FormProxy<T> }>;
    return <Comp control={form} />;
  }
  // RenderNode — plain object с `.component` без `$$typeof` маркера.
  if (isRenderNode<T>(body)) {
    return <RenderNodeComponent node={body} form={form} />;
  }
  // Fallback ReactNode (текст, число, null, и т.д.)
  return body as ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormWizardInner<T extends Record<string, any>>(
  props: FormWizardProps<T>,
  ref: ForwardedRef<FormWizardHandle<T>>
) {
  const formWizardRef = useRef<FormWizardHandle<T>>(null);
  useImperativeHandle(ref, () => formWizardRef.current as FormWizardHandle<T>);

  // Headless Indicator принимает steps без body — только number/title/icon.
  const indicatorSteps = props.steps.map(({ number, title, icon }) => ({
    number,
    title,
    icon,
  }));

  return (
    <FormWizardHeadless ref={formWizardRef} form={props.form} config={props.config}>
      <FormWizardHeadless.Indicator steps={indicatorSteps}>
        {(indicatorProps) => <StepIndicator {...indicatorProps} className="mb-8" />}
      </FormWizardHeadless.Indicator>

      <div className="bg-white p-8 rounded-lg shadow-md">
        {props.steps.map((step) => (
          <FormWizardHeadless.Step key={step.number}>
            {renderStepBody(step.body, props.form)}
          </FormWizardHeadless.Step>
        ))}
      </div>

      <FormWizardHeadless.Actions onSubmit={props.onSubmit}>
        {(actionsProps) => <FormWizardActions {...actionsProps} className="mt-8" />}
      </FormWizardHeadless.Actions>

      <FormWizardHeadless.Progress>
        {(progressProps) => <FormWizardProgress {...progressProps} className="mt-4" />}
      </FormWizardHeadless.Progress>
    </FormWizardHeadless>
  );
}

const FormWizardForwarded = forwardRef(FormWizardInner) as <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any>,
>(
  props: FormWizardProps<T> & { ref?: React.Ref<FormWizardHandle<T>> }
) => ReactElement | null;

// Compound API: re-export headless slots для consumer-ов, которым нужен
// custom layout (например, расположить Indicator поверх кастомного header'а).
type FormWizardCompound = typeof FormWizardForwarded & {
  Indicator: typeof FormWizardHeadless.Indicator;
  Step: typeof FormWizardHeadless.Step;
  Actions: typeof FormWizardHeadless.Actions;
  Progress: typeof FormWizardHeadless.Progress;
};

const FormWizard = Object.assign(FormWizardForwarded, {
  Indicator: FormWizardHeadless.Indicator,
  Step: FormWizardHeadless.Step,
  Actions: FormWizardHeadless.Actions,
  Progress: FormWizardHeadless.Progress,
}) as FormWizardCompound;

// Маркер для интеграции с RenderNodeComponent: при использовании FormWizard
// внутри RenderSchema родитель пробрасывает `form` prop напрямую, без обхода
// `children` через рекурсивный рендерер.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(FormWizard as any).__selfManagedChildren = true;

export { FormWizard };
