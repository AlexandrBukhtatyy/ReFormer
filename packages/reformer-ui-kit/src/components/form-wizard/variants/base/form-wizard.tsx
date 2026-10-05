/**
 * FormWizard — унифицированный multi-step wrapper поверх
 * `@reformer/cdk/form-wizard` headless compound. Один компонент покрывает
 * TS-flow, renderer-react flow и renderer-json flow за счёт полиморфного
 * `step.body`:
 *
 * - `ComponentType<{ control: FormProxy<T> }>` — FC получает `control={form}`.
 * - `ReactNode` — готовый JSX (статический контент шага).
 * - `TBody` — что угодно ещё (например узел RenderSchema); отрисовывается
 *   стратегией из пропа `renderStepBody`.
 *
 * Дискриминация делается в `resolveStepBody` по типу значения runtime,
 * без discriminated-union-полей. Про рендерер компонент НЕ знает: всё, что не
 * ReactNode и не ComponentType, уходит в `renderStepBody` — так ui-kit остаётся
 * независимым от `@reformer/renderer-react` (инъекция стратегии вместо импорта).
 *
 * В схеме формы визард — обычный узел: `{ component: FormWizard, children: [шаги] }`. Маркер
 * `__selfManagedChildren = true` просит рендерер отдать узлы шагов данными вместе с функцией их
 * отрисовки (`renderNode`), а форму и валидацию визард берёт из контекста сборки `createForm`.
 * Прикладная обёртка, которая подставляла `form`, `config` и `steps`, больше не нужна.
 */

import {
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentType,
  type ForwardedRef,
  type Key,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  FormWizard as FormWizardHeadless,
  type FormWizardConfig,
  type FormWizardHandle,
  type FormWizardProps as FormWizardHeadlessProps,
} from '@reformer/cdk/form-wizard';
import { useFormBundleContext, type FormProxy } from '@reformer/core';
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
 * - `TBody` — расширение под внешний рендерер (например `RenderNode<T>` из
 *   `@reformer/renderer-react`); отрисовывается стратегией {@link FormWizardProps.renderStepBody}.
 *
 * @typeParam T - Тип значения корневой формы (`FormProxy<T>`).
 * @typeParam TBody - Дополнительная форма тела шага. По умолчанию `never` —
 *   ui-kit «из коробки» знает только про ReactNode и ComponentType.
 *
 * @example Компонент шага получает control
 * ```tsx
 * function BasicInfoForm({ control }: { control: FormProxy<CreditApplication> }) {
 *   return <FormField control={control.loanAmount} testId="loanAmount" />;
 * }
 * const body: FormWizardStepBody<CreditApplication> = BasicInfoForm;
 * ```
 *
 * @example Тело шага — узел RenderSchema (тип расширяется, отрисовка приходит пропом)
 * ```tsx
 * <FormWizard<CreditApplication, RenderNode<CreditApplication>>
 *   steps={steps}
 *   renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />}
 * />
 * ```
 */
export type FormWizardStepBody<T, TBody = never> =
  | ComponentType<{ control: FormProxy<T> }>
  | ReactNode
  | TBody;

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
export interface FormWizardStep<T, TBody = never> {
  /** Порядковый номер шага (1-based). Уникальный, задаёт порядок навигации. */
  number: number;
  /** Заголовок шага, показывается в {@link StepIndicator}. */
  title: string;
  /** Иконка шага (эмодзи или строка). Передаётся в headless Indicator. */
  icon?: string;
  /** Тело шага — FC | ReactNode | TBody (см. {@link FormWizardStepBody}). */
  body: FormWizardStepBody<T, TBody>;
}

/**
 * Узел шага в схеме формы — то, что рендерер передаёт визарду в `children`:
 * `{ selector, component: Step, componentProps: { title, icon }, children: [...] }`.
 *
 * `selector` связывает шаг с его правилами: это ключ в `validation.steps` сборки. `title` и
 * `icon` уходят в индикатор шагов; сам узел рисует рендерер (проп {@link FormWizardProps.renderNode}).
 */
export interface FormWizardStepNode {
  /** Идентификатор шага — ключ его правил в `validation.steps`. */
  selector?: string;
  /** Пропсы компонента шага; `title` и `icon` читает индикатор. */
  componentProps?: { title?: string; icon?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Пропсы {@link FormWizard}. Расширяют headless-пропсы из
 * `@reformer/cdk/form-wizard` (`onStepChange`, `scrollToTop`), добавляя шаги и колбэк `onSubmit`.
 *
 * Два способа подключения:
 *
 * - **в схеме формы** — узел `{ selector: 'wizard', component: FormWizard, children: [шаги] }`.
 *   Рендерер передаёт узлы шагов и функцию их отрисовки, а форму и валидацию визард берёт из
 *   контекста сборки `createForm`. Ни `form`, ни `config`, ни `steps` задавать не нужно;
 * - **в JSX** — `form`, `config` и `steps` пропсами, как раньше.
 *
 * @typeParam T - Тип значения корневой формы. Ограничение `Record<string, any>`
 *   синхронизировано с headless-cdk и нужно только как bound для инференции
 *   generic'а T в JSX (в т.ч. при nullable-числах вида `number | null`).
 *
 * @see {@link FormWizardStep} — форма элемента `steps`.
 * @see {@link FormWizardStepNode} — узел шага в схеме.
 * @see FormWizardHandle — императивный handle через `ref` (submit/навигация).
 */
export interface FormWizardProps<
  // Constraint синхронизирован с headless cdk (`Record<string, any>`) — это
  // снимает блокер инференции generic'а T в JSX, когда T содержит nullable-
  // числа (`number | null`). Constraint используется только для bound, not
  // for direct value access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any>,
  TBody = never,
> extends Omit<FormWizardHeadlessProps<T>, 'form' | 'config' | 'children'> {
  /** Форма. Внутри рендерера необязательна — берётся из контекста сборки `createForm`. */
  form?: FormProxy<T>;
  /**
   * Колбэки валидации шага и всей формы. Внутри рендерера необязателен — собирается из
   * валидации сборки: шаг проверяется правилами `validation.steps[selector шага]`.
   */
  config?: FormWizardConfig;
  /** Внешний CSS-класс корневого контейнера. */
  className?: string;
  /**
   * Декларативный список шагов (см. {@link FormWizardStep}) — для разметки в JSX. Порядок =
   * порядок навигации. В схеме формы шаги задаются дочерними узлами визарда.
   */
  steps?: FormWizardStep<T, TBody>[];
  /**
   * Узлы шагов из схемы формы ({@link FormWizardStepNode}). Передаёт рендерер: визард объявляет
   * `__selfManagedChildren` и получает детей данными, а не отрисованными элементами.
   */
  children?: readonly FormWizardStepNode[];
  /** Отрисовка узла схемы. Передаёт рендерер вместе с `children`. */
  renderNode?: (node: FormWizardStepNode, key?: Key) => ReactNode;
  /**
   * Колбэк отправки формы на последнем шаге; получает значения формы. Вызывается только после
   * успешной валидации всей формы; при провале не вызывается, а поля помечаются `touched`,
   * чтобы ошибки стали видны. Без правил валидации отправка не блокируется.
   */
  onSubmit?: (values: T) => void | Promise<void>;
  /**
   * Подпись кнопки отправки на последнем шаге. По умолчанию — из словаря локали.
   * @defaultMessage kit.formWizard.submit
   */
  submitLabel?: string;
  /**
   * Стратегия отрисовки нестандартного `body`. Сам ui-kit умеет только ReactNode и
   * ComponentType; всё остальное (например узел RenderSchema) отдаётся сюда — так компонент
   * не импортирует рендерер, а получает его как зависимость.
   *
   * @example
   * ```tsx
   * renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />}
   * ```
   */
  renderStepBody?: (body: TBody, form: FormProxy<T>) => ReactNode;
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

/**
 * Тело шага можно отрисовать не зная, что это. Порядок дискриминации: готовый element →
 * component reference → пользовательская стратегия (`custom`) → ReactNode-фолбэк.
 *
 * Ветка `custom` — единственное место, куда попадает всё «чужое» (узел RenderSchema, массив
 * таких узлов и т.п.). Без стратегии чужое тело — адресная ошибка: отданный React'у плоский
 * объект уронил бы рендер невнятным «Objects are not valid as a React child», а error boundary
 * ни ui-kit, ни рендерер не ставят — гас бы весь корень приложения.
 */
function resolveStepBody<T, TBody>(
  body: FormWizardStepBody<T, TBody>,
  form: FormProxy<T>,
  custom?: (body: TBody, form: FormProxy<T>) => ReactNode
): ReactNode {
  // React element (уже-отрендеренный JSX) — отдаём как ReactNode.
  if (isValidElement(body as ReactElement)) return body as ReactNode;
  // Component reference (FC | memo'd FC | forwardRef'd FC) — рендерим с control={form}.
  if (isComponentType<T>(body)) {
    const Comp = body as ComponentType<{ control: FormProxy<T> }>;
    return <Comp control={form} />;
  }
  // Всё остальное «чужое» — во внешнюю стратегию (например RenderNode → RenderNodeComponent).
  // Массив React-узлов — валидный ReactNode (список элементов), чужим не считается.
  if (isForeignBody(body)) {
    if (custom) return custom(body as TBody, form);
    throw new Error(
      '[ui-kit] FormWizard: step.body — не ReactNode и не ComponentType (похоже на RenderNode). ' +
        'Передайте renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />} ' +
        '— ui-kit не зависит от рендерера и обернуть узел сам не может.'
    );
  }
  // Fallback ReactNode (текст, число, null, и т.д.)
  return body as ReactNode;
}

/** Объект, который React не отрисует сам: не element и не массив React-узлов. */
function isForeignBody(body: unknown): boolean {
  if (body === null || typeof body !== 'object') return false;
  if (Array.isArray(body)) return body.some(isForeignBody);
  return !isValidElement(body as ReactElement);
}

/** Валидация сборки `createForm` в том объёме, который нужен визарду. */
export interface WizardBundleValidation {
  readonly stepSelectors: readonly string[];
  validateStep(step: number | string): Promise<boolean>;
  validateAll(): Promise<boolean>;
}

/**
 * Колбэки валидации визарда из валидации сборки. Шаг ↔ правила — по `selector` узла шага; у шага
 * без селектора — по порядковому номеру (так же, как раньше, когда связи по селектору не было).
 *
 * Экспортируется для модульных тестов; в публичный API (`index.ts`) НЕ выведено.
 *
 * @internal
 */
export function wizardConfigFromValidation(
  validation: WizardBundleValidation | undefined,
  stepSelectors: ReadonlyArray<string | undefined>
): FormWizardConfig {
  if (!validation) return {};
  return {
    validateStep: (step) => validation.validateStep(stepSelectors[step - 1] ?? step),
    validateAll: () => validation.validateAll(),
  };
}

/** Расхождение шагов схемы с ключами `validation.steps` — см. {@link stepRulesMismatch}. */
export interface StepRulesMismatch {
  /** Ключи правил, которым не нашлось шага: проверяются только при отправке. */
  withoutStep: string[];
  /** Шаги с `selector`, которого нет в `validation.steps`: переход с них ничего не проверяет. */
  withoutRules: string[];
}

/**
 * Сверка шагов схемы с ключами `validation.steps` — в обе стороны. Нужна потому, что прогон по
 * неизвестному ключу берёт пустой набор правил и отвечает «валидно»: опечатка в селекторе шага
 * молча пропускала бы незаполненные обязательные поля.
 *
 * Шаг без селектора связан с правилами по номеру — он занимает ключ на своей позиции.
 *
 * Экспортируется для модульных тестов; в публичный API (`index.ts`) НЕ выведено.
 *
 * @internal
 * @returns Расхождение либо `null`, если шаги и ключи сходятся.
 */
export function stepRulesMismatch(
  ruleKeys: readonly string[],
  stepSelectors: ReadonlyArray<string | undefined>
): StepRulesMismatch | null {
  if (ruleKeys.length === 0) return null; // правила не разбиты по шагам — сверять нечего
  const usedKeys = stepSelectors.map((selector, index) => selector ?? ruleKeys[index]);
  const withoutStep = ruleKeys.filter((key) => !usedKeys.includes(key));
  const withoutRules = stepSelectors.filter(
    (selector): selector is string => selector !== undefined && !ruleKeys.includes(selector)
  );
  return withoutStep.length === 0 && withoutRules.length === 0
    ? null
    : { withoutStep, withoutRules };
}

/** Список имён для сообщения: `"loan", "contacts"`. */
const quoted = (items: readonly string[]): string => items.map((item) => `"${item}"`).join(', ');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormWizardInner<T extends Record<string, any>, TBody = never>(
  props: FormWizardProps<T, TBody>,
  ref: ForwardedRef<FormWizardHandle<T>>
) {
  const formWizardRef = useRef<FormWizardHandle<T>>(null);
  useImperativeHandle(ref, () => formWizardRef.current as FormWizardHandle<T>);

  // Сборка `createForm`, внутри которой визард отрисован рендерером; в JSX её нет.
  const bundle = useFormBundleContext<T>();
  const form = props.form ?? (bundle?.form as FormProxy<T> | undefined);
  if (!form) {
    throw new Error(
      '[ui-kit] FormWizard: нет формы. В JSX передайте `form` (и `config`, `steps`); в схеме ' +
        'формы визард берёт её из сборки — рисуйте схему через `<FormRenderer form={bundle} />` ' +
        'с бандлом `createForm`.'
    );
  }

  const stepNodes = props.steps ? undefined : props.children;
  const { renderNode, renderStepBody } = props;

  // Шаги: явный список (JSX) либо узлы-дети из схемы — заголовок и иконка из пропсов узла шага,
  // тело рисует рендерер.
  const steps = useMemo<FormWizardStep<T, TBody>[]>(
    () =>
      props.steps ??
      (stepNodes ?? []).map((node, index) => ({
        number: index + 1,
        title: node.componentProps?.title ?? '',
        icon: node.componentProps?.icon,
        body: node as unknown as TBody,
      })),
    [props.steps, stepNodes]
  );

  const validation = bundle?.validation as WizardBundleValidation | undefined;
  // Селекторы шагов одной строкой: зависимость хуков устойчива к пересозданию массива детей.
  const selectorKey = (stepNodes ?? []).map((node) => node.selector ?? '').join('\n');
  const stepSelectors = useMemo(
    () => selectorKey.split('\n').map((selector) => selector || undefined),
    [selectorKey]
  );
  const explicitConfig = props.config;
  const config = useMemo<FormWizardConfig>(
    () => explicitConfig ?? wizardConfigFromValidation(validation, stepSelectors),
    [explicitConfig, validation, stepSelectors]
  );

  const fromSchema = stepNodes !== undefined;
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (explicitConfig || !validation || !fromSchema) return;
    const mismatch = stepRulesMismatch(validation.stepSelectors, stepSelectors);
    if (!mismatch) return;
    const { withoutStep, withoutRules } = mismatch;
    console.warn(
      '[ui-kit] FormWizard: шаги схемы и ключи `validation.steps` расходятся.' +
        (withoutStep.length > 0
          ? ` Ключи без шага: ${quoted(withoutStep)} — их правила проверяются только при отправке.`
          : '') +
        (withoutRules.length > 0
          ? ` Шаги без ключа: ${quoted(withoutRules)} — переход с них ничего не проверяет; ` +
            'шаг без правил объявляется явно: `ключ: null`.'
          : '')
    );
  }, [explicitConfig, validation, fromSchema, stepSelectors]);

  // Узел схемы рисует рендерер (`renderNode`); явная стратегия `renderStepBody` главнее.
  const renderBody = useMemo(
    () =>
      renderStepBody ??
      (renderNode ? (body: TBody) => renderNode(body as unknown as FormWizardStepNode) : undefined),
    [renderStepBody, renderNode]
  );

  const { onSubmit } = props;
  // Кнопка отправки зовёт колбэк после успешной валидации всей формы — отдаём ему значения.
  const handleSubmit = useMemo(
    () => (onSubmit ? () => onSubmit(form.getValue() as T) : undefined),
    [onSubmit, form]
  );

  // Headless Indicator принимает steps без body — только number/title/icon.
  const indicatorSteps = steps.map(({ number, title, icon }) => ({
    number,
    title,
    icon,
  }));

  return (
    <FormWizardHeadless
      ref={formWizardRef}
      form={form}
      config={config}
      onStepChange={props.onStepChange}
      scrollToTop={props.scrollToTop}
    >
      <FormWizardHeadless.Indicator steps={indicatorSteps}>
        {(indicatorProps) => <StepIndicator {...indicatorProps} className="mb-8" />}
      </FormWizardHeadless.Indicator>

      <div
        data-slot="form-wizard-body"
        className="bg-card text-card-foreground p-8 rounded-lg shadow-md border"
      >
        {steps.map((step) => (
          <FormWizardHeadless.Step key={step.number}>
            {resolveStepBody(step.body, form, renderBody)}
          </FormWizardHeadless.Step>
        ))}
      </div>

      <FormWizardHeadless.Actions onSubmit={handleSubmit}>
        {(actionsProps) => (
          <FormWizardActions {...actionsProps} submitLabel={props.submitLabel} className="mt-8" />
        )}
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
  TBody = never,
>(
  props: FormWizardProps<T, TBody> & { ref?: React.Ref<FormWizardHandle<T>> }
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
 * @example В схеме формы: шаги — дочерние узлы, форма и правила — из сборки
 * ```tsx
 * import { createForm, useFormBundle, type FormModel } from '@reformer/core';
 * import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
 * import { FormRenderer } from '@reformer/renderer-react';
 * import { Step } from '@reformer/cdk/form-wizard';
 *
 * const creditSchema = (model: FormModel<CreditApplication>) => ({
 *   selector: 'wizard',
 *   component: FormWizard,
 *   children: [
 *     {
 *       selector: 'loan', // ключ правил шага в validation.steps
 *       component: Step,
 *       componentProps: { title: 'Кредит', icon: '💰' },
 *       children: [{ model: model.$.loanAmount, component: InputNumber }],
 *     },
 *     { selector: 'confirm', component: Step, componentProps: { title: 'Подтверждение' } },
 *   ],
 * });
 *
 * const creditBehavior = defineFormBehavior<CreditApplication>(({ model, schema }) => {
 *   onComponentEvent(schema.node('wizard'), 'onSubmit', () => api.submit(model.get()));
 * });
 *
 * const credit = useFormBundle(() =>
 *   createForm<CreditApplication>({
 *     model: createCreditModel(),
 *     schema: creditSchema,
 *     behavior: creditBehavior,
 *     validation: { steps: { loan: loanRules, confirm: null } },
 *   })
 * );
 * return <FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />;
 * ```
 *
 * @example Тело шага — узел схемы при разметке в JSX: стратегия отрисовки обязательна
 * ```tsx
 * import { RenderNodeComponent } from '@reformer/renderer-react';
 *
 * // Без renderStepBody такое тело — ошибка с подсказкой: ui-kit не зависит от рендерера.
 * <FormWizard
 *   form={form}
 *   config={bundle.validation}
 *   steps={[{ number: 1, title: 'Данные', body: stepNode }]}
 *   renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />}
 * />
 * ```
 *
 * @see {@link FormWizardStep} — форма элемента `steps`.
 * @see {@link FormWizardStepNode} — узел шага в схеме формы.
 * @see {@link StepIndicator}, {@link FormWizardActions}, {@link FormWizardProgress} — слоты layout'а.
 */
const FormWizard = Object.assign(FormWizardForwarded, {
  Indicator: FormWizardHeadless.Indicator,
  Step: FormWizardHeadless.Step,
  Actions: FormWizardHeadless.Actions,
  Progress: FormWizardHeadless.Progress,
}) as FormWizardCompound;

// Маркер для интеграции с рендерером: визард в схеме формы получает узлы шагов данными
// (`children`) и функцию их отрисовки (`renderNode`) — без рекурсивного обхода детей рендерером.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(FormWizard as any).__selfManagedChildren = true;

export { FormWizard };
