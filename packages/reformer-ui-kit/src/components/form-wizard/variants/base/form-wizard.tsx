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
 * Полиморфное тело шага {@link FormWizardStep}. Один и тот же {@link FormWizard}
 * покрывает TS-flow, renderer-react и renderer-json за счёт трёх допустимых форм
 * `body`, дискриминация которых выполняется в рантайме по типу значения:
 *
 * - `ComponentType<{ control: FormProxy<T> }>` — React-компонент; получает
 *   `control={form}` (корневой {@link FormProxy}) и сам обращается к нужным полям.
 * - `ReactNode` — готовый JSX или статический контент шага (текст, число и т.п.).
 * - `RenderNode<T>` — RenderSchema-поддерево; рендерится через `RenderNodeComponent`
 *   для интеграции с `@reformer/renderer-react`.
 *
 * @typeParam T - Тип значения корневой формы (`FormProxy<T>`).
 *
 * @example Компонент шага получает control
 * ```tsx
 * function BasicInfoForm({ control }: { control: FormProxy<CreditApplication> }) {
 *   return <FormField control={control.loanAmount} testId="loanAmount" />;
 * }
 * const body: FormWizardStepBody<CreditApplication> = BasicInfoForm;
 * ```
 */
export type FormWizardStepBody<T> =
  | ComponentType<{ control: FormProxy<T> }>
  | ReactNode
  | RenderNode<T>;

/**
 * Описание одного шага {@link FormWizard}: порядковый номер, заголовок и иконка
 * для индикатора, плюс полиморфное тело {@link FormWizardStepBody}.
 *
 * Массив `FormWizardStep<T>[]` передаётся в проп `steps`. Порядок и `number`
 * задают последовательность навигации; `number` должен быть 1-based и уникальным.
 *
 * @typeParam T - Тип значения корневой формы (`FormProxy<T>`).
 *
 * @example Массив шагов кредитной заявки
 * ```tsx
 * const STEPS: FormWizardStep<CreditApplication>[] = [
 *   { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoForm },
 *   { number: 2, title: 'Данные', icon: '👤', body: PersonalInfoForm },
 *   { number: 3, title: 'Подтверждение', icon: '✓', body: ConfirmationForm },
 * ];
 * ```
 */
export interface FormWizardStep<T> {
  /** Порядковый номер шага (1-based). Уникальный, задаёт порядок навигации. */
  number: number;
  /** Заголовок шага, показывается в {@link StepIndicator}. */
  title: string;
  /** Иконка шага (эмодзи или строка). Передаётся в headless Indicator. */
  icon?: string;
  /** Тело шага — FC | ReactNode | RenderNode<T> (см. {@link FormWizardStepBody}). */
  body: FormWizardStepBody<T>;
}

/**
 * Пропсы {@link FormWizard}. Расширяют headless-пропсы из
 * `@reformer/cdk/form-wizard` (`form`, `config`, `onStepChange`, …), добавляя
 * декларативный `steps` и колбэк `onSubmit`.
 *
 * @typeParam T - Тип значения корневой формы. Ограничение `Record<string, any>`
 *   синхронизировано с headless-cdk и нужно только как bound для инференции
 *   generic'а T в JSX (в т.ч. при nullable-числах вида `number | null`).
 *
 * @see {@link FormWizardStep} — форма элемента `steps`.
 * @see FormWizardHandle — императивный handle через `ref` (submit/навигация).
 */
export interface FormWizardProps<
  // Constraint синхронизирован с headless cdk (`Record<string, any>`) — это
  // снимает блокер инференции generic'а T в JSX, когда T содержит nullable-
  // числа (`number | null`). Constraint используется только для bound, not
  // for direct value access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any>,
> extends FormWizardHeadlessProps<T> {
  /** Внешний CSS-класс корневого контейнера. */
  className?: string;
  /** Декларативный список шагов (см. {@link FormWizardStep}). Порядок = порядок навигации. */
  steps: FormWizardStep<T>[];
  /** Колбэк отправки формы на последнем шаге; вызывается после успешной валидации. */
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

      <div
        data-slot="form-wizard-body"
        className="bg-card text-card-foreground p-8 rounded-lg shadow-md border"
      >
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

/**
 * Готовая многошаговая форма (multi-step wizard) — стилизованная обёртка поверх
 * headless-compound `@reformer/cdk/form-wizard`. Собирает Indicator, тело шагов,
 * Actions (Назад / Далее / Отправить) и Progress в единый layout, работает с
 * одной {@link FormProxy} и декларативным списком {@link FormWizardStep}.
 *
 * Один компонент покрывает TS-flow, renderer-react и renderer-json за счёт
 * полиморфного {@link FormWizardStepBody}. Валидация по шагам и submit-валидация
 * задаются через `config` (`{ validateStep, validateAll }`, обычно обёртки над
 * `validateModel` из `@reformer/core/validation`). Императивный доступ (submit/навигация снаружи дерева) —
 * через `ref` типа `FormWizardHandle<T>`.
 *
 * Экспонирует compound-слоты `FormWizard.Indicator` / `.Step` / `.Actions` /
 * `.Progress` для кастомной раскладки.
 *
 * @typeParam T - Тип значения корневой формы (`FormProxy<T>`).
 *
 * @example Кредитная заявка с 3 шагами и внешним submit
 * ```tsx
 * import { useMemo, useRef } from 'react';
 * import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
 * import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
 *
 * const STEPS: FormWizardStep<CreditApplication>[] = [
 *   { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoForm },
 *   { number: 2, title: 'Данные', icon: '👤', body: PersonalInfoForm },
 *   { number: 3, title: 'Подтверждение', icon: '✓', body: ConfirmationForm },
 * ];
 *
 * function CreditForm() {
 *   const navRef = useRef<FormWizardHandle<CreditApplication>>(null);
 *   const { form, model } = useMemo(() => createCreditForm(), []);
 *   const config = useMemo(() => makeValidationConfig(model), [model]);
 *
 *   const onSubmit = () =>
 *     navRef.current?.submit((values) => api.submit(values));
 *
 *   return (
 *     <FormWizard
 *       ref={navRef}
 *       form={form}
 *       config={config}
 *       steps={STEPS}
 *       onSubmit={onSubmit}
 *     />
 *   );
 * }
 * ```
 *
 * @see {@link FormWizardStep} — форма элемента `steps`.
 * @see {@link StepIndicator}, {@link FormWizardActions}, {@link FormWizardProgress} — слоты layout'а.
 */
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
