/**
 * FormWizard — унифицированный multi-step wrapper поверх
 * `@reformer/cdk/form-wizard` headless compound. Один компонент покрывает
 * TS-flow, renderer-react flow и renderer-json flow за счёт полиморфного
 * `step.body`:
 *
 * - `ComponentType<{ control: FormGroup<T> }>` — FC получает `control={form}`.
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
 * отрисовки (`renderNode`), а форму и поток шагов визард берёт из контекста сборки
 * `createForm`. Шаг схемы связан с шагом потока по `selector`.
 */

import {
  isValidElement,
  useEffect,
  useMemo,
  type ComponentType,
  type Key,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  FormWizard as FormWizardHeadless,
  type FormWizardProps as FormWizardHeadlessProps,
} from '@reformer/cdk/form-wizard';
import { type FormFlow, type FormGroup } from '@reformer/core';
import { useFormBundleContext } from '@reformer/core/react';
import { FormWizardActions } from './form-wizard-actions';
import { FormWizardProgress } from './form-wizard-progress';
import { StepIndicator } from './step-indicator';
import { cn } from '@/lib/utils';

/**
 * Полиморфное тело шага {@link FormWizardStep}. Один и тот же {@link FormWizard}
 * покрывает TS-flow, renderer-react и renderer-json за счёт трёх допустимых форм
 * `body`, дискриминация которых выполняется в рантайме по типу значения:
 *
 * - `ComponentType<{ control: FormGroup<T> }>` — React-компонент; получает
 *   `control={form}` (корневой {@link FormGroup}) и сам обращается к нужным полям.
 * - `ReactNode` — готовый JSX или статический контент шага (текст, число и т.п.).
 * - `TBody` — расширение под внешний рендерер (например `RenderNode<T>` из
 *   `@reformer/renderer-react`); отрисовывается стратегией {@link FormWizardProps.renderStepBody}.
 *
 * @typeParam T - Тип значения корневой формы (`FormGroup<T>`).
 * @typeParam TBody - Дополнительная форма тела шага. По умолчанию `never` —
 *   ui-kit «из коробки» знает только про ReactNode и ComponentType.
 *
 * @example Компонент шага получает control
 * ```tsx
 * function BasicInfoForm({ control }: { control: FormGroup<CreditApplication> }) {
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
  | ComponentType<{ control: FormGroup<T> }>
  | ReactNode
  | TBody;

/**
 * Описание одного шага {@link FormWizard}: порядковый номер, заголовок и иконка
 * для индикатора, плюс полиморфное тело {@link FormWizardStepBody}.
 *
 * Массив `FormWizardStep<T>[]` передаётся в проп `steps`. Порядок и `number`
 * задают последовательность навигации; `number` должен быть 1-based и уникальным.
 *
 * @typeParam T - Тип значения корневой формы (`FormGroup<T>`).
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
 * Узел шага, который рендерер передаёт визарду в `children`, — узел скомпилированной схемы
 * (`CompiledNode` из `@reformer/core`). В схеме формы шаг пишется так:
 * `{ selector, component: Step, componentProps: { title, icon }, children: [...] }`, а после
 * компиляции его пропсы лежат в `props`.
 *
 * `selector` связывает узел с шагом потока сборки (`createForm({ flow: { steps: [{ id }] } })`):
 * это идентификатор шага. `title` и `icon` уходят в индикатор шагов; сам узел рисует рендерер
 * (проп {@link FormWizardProps.renderNode}).
 */
export interface FormWizardStepNode {
  /** Идентификатор шага — `id` шага в потоке сборки. */
  readonly selector?: string;
  /** Пропсы компонента шага (`componentProps` автора); `title` и `icon` читает индикатор. */
  readonly props?: {
    readonly title?: string;
    readonly icon?: string;
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

/**
 * Пропсы {@link FormWizard}. Расширяют headless-пропсы из
 * `@reformer/cdk/form-wizard` (`onStepChange`, `scrollToTop`), добавляя шаги и колбэк `onSubmit`.
 *
 * Два способа подключения:
 *
 * - **в схеме формы** — узел `{ selector: 'wizard', component: FormWizard, children: [шаги] }`.
 *   Рендерер передаёт узлы шагов и функцию их отрисовки, а форму и поток шагов визард берёт из
 *   контекста сборки `createForm`. Ни `form`, ни `flow`, ни `steps` задавать не нужно;
 * - **в JSX** — `form`, `flow` (`bundle.flow`) и `steps` пропсами.
 *
 * @typeParam T - Тип значения корневой формы. Ограничение `Record<string, any>`
 *   синхронизировано с headless-cdk и нужно только как bound для инференции
 *   generic'а T в JSX (в т.ч. при nullable-числах вида `number | null`).
 *
 * @see {@link FormWizardStep} — форма элемента `steps`.
 * @see {@link FormWizardStepNode} — узел шага в схеме.
 * @see FormFlow — поток шагов ядра: навигация снаружи визарда (`bundle.flow.goTo('loan')`).
 */
export interface FormWizardProps<
  // Constraint синхронизирован с headless cdk (`Record<string, any>`) — это
  // снимает блокер инференции generic'а T в JSX, когда T содержит nullable-
  // числа (`number | null`). Constraint используется только для bound, not
  // for direct value access.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any>,
  TBody = never,
> extends Omit<FormWizardHeadlessProps<T>, 'form' | 'flow' | 'children'> {
  /** Форма. Внутри рендерера необязательна — берётся из контекста сборки `createForm`. */
  form?: FormGroup<T>;
  /**
   * Поток шагов (`bundle.flow`). Внутри рендерера необязателен — берётся из сборки; без потока
   * визард строит позиционный поток без правил.
   */
  flow?: FormFlow;
  /**
   * CSS-класс карточки шагов (тела визарда): сливается с классами по умолчанию через `cn`, поэтому
   * `bg-white` или `p-6` заменяют фон и отступы карточки, а не добавляются к ним.
   */
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
   * Колбэк кнопки отправки на последнем шаге; получает значения формы. Внутри сборки
   * (`createForm` в контексте) зовётся через `bundle.submission` — только после успешной проверки всей
   * формы, а при замечаниях поля помечаются `touched`. Без сборки зовётся по нажатию: проверку
   * делает приложение — `bundle.submission.submit(handler)`.
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
  renderStepBody?: (body: TBody, form: FormGroup<T>) => ReactNode;
}

/**
 * React FC reference: либо plain function component, либо `React.memo(fn)` /
 * `React.forwardRef(fn)` обёртка. memo/forwardRef возвращают object вида
 * `{ $$typeof, type, compare? }` — `typeof === 'object'`, не 'function'.
 * Этот check покрывает оба случая.
 */
function isComponentType<T>(value: unknown): value is ComponentType<{ control: FormGroup<T> }> {
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
  form: FormGroup<T>,
  custom?: (body: TBody, form: FormGroup<T>) => ReactNode
): ReactNode {
  // React element (уже-отрендеренный JSX) — отдаём как ReactNode.
  if (isValidElement(body as ReactElement)) return body as ReactNode;
  // Component reference (FC | memo'd FC | forwardRef'd FC) — рендерим с control={form}.
  if (isComponentType<T>(body)) {
    const Comp = body as ComponentType<{ control: FormGroup<T> }>;
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

/** Расхождение шагов схемы с шагами потока — см. {@link flowStepsMismatch}. */
export interface FlowStepsMismatch {
  /** Шаги потока, для которых в схеме нет узла с таким `selector`. */
  withoutNode: string[];
  /** Узлы шагов с `selector`, которого нет в потоке. */
  withoutFlowStep: string[];
}

/**
 * Сверка шагов схемы с шагами потока — в обе стороны. Визард рисует шаги в порядке потока и
 * связывает их с узлами по `selector`: опечатка в селекторе оставила бы шаг потока без разметки.
 *
 * Экспортируется для модульных тестов; в публичный API (`index.ts`) НЕ выведено.
 *
 * @internal
 * @returns Расхождение либо `null`, если шаги сходятся.
 */
export function flowStepsMismatch(
  flowSteps: readonly string[],
  stepSelectors: ReadonlyArray<string | undefined>
): FlowStepsMismatch | null {
  const withoutNode = flowSteps.filter((step) => !stepSelectors.includes(step));
  const withoutFlowStep = stepSelectors.filter(
    (selector): selector is string => selector !== undefined && !flowSteps.includes(selector)
  );
  return withoutNode.length === 0 && withoutFlowStep.length === 0
    ? null
    : { withoutNode, withoutFlowStep };
}

/** Список имён для сообщения: `"loan", "contacts"`. */
const quoted = (items: readonly string[]): string => items.map((item) => `"${item}"`).join(', ');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FormWizardBase<T extends Record<string, any>, TBody = never>(
  props: FormWizardProps<T, TBody>
) {
  // Сборка `createForm`, внутри которой визард отрисован рендерером; в JSX её нет.
  const bundle = useFormBundleContext<T>();
  const form = props.form ?? (bundle?.form as FormGroup<T> | undefined);
  if (!form) {
    throw new Error(
      '[ui-kit] FormWizard: нет формы. В JSX передайте `form` (и `flow`, `steps`); в схеме ' +
        'формы визард берёт её из сборки — рисуйте схему через `<FormRenderer form={bundle} />` ' +
        'с бандлом `createForm`.'
    );
  }

  const stepNodes = props.steps ? undefined : props.children;
  const { renderNode, renderStepBody } = props;
  const flow = props.flow ?? bundle?.flow;

  // Узлы шагов в порядке потока: шаг потока ↔ узел по `selector`. Если хоть одному шагу узла
  // не нашлось — порядок узлов как есть (о расхождении предупредит эффект ниже).
  const orderedNodes = useMemo(() => {
    if (!stepNodes || !flow) return stepNodes;
    const bySelector = flow.steps.map((step) => stepNodes.find((node) => node.selector === step));
    return bySelector.every((node) => node !== undefined) && bySelector.length === stepNodes.length
      ? (bySelector as FormWizardStepNode[])
      : stepNodes;
  }, [stepNodes, flow]);

  // Шаги: явный список (JSX) либо узлы-дети из схемы — заголовок и иконка из пропсов узла шага,
  // тело рисует рендерер.
  const steps = useMemo<FormWizardStep<T, TBody>[]>(
    () =>
      props.steps ??
      (orderedNodes ?? []).map((node, index) => ({
        number: index + 1,
        title: node.props?.title ?? '',
        icon: node.props?.icon,
        body: node as unknown as TBody,
      })),
    [props.steps, orderedNodes]
  );

  // Селекторы шагов одной строкой: зависимость эффекта устойчива к пересозданию массива детей.
  const selectorKey = (stepNodes ?? []).map((node) => node.selector ?? '').join('\n');
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!flow || stepNodes === undefined) return;
    const selectors = selectorKey.split('\n').map((selector) => selector || undefined);
    const mismatch = flowStepsMismatch(flow.steps, selectors);
    if (!mismatch) return;
    const { withoutNode, withoutFlowStep } = mismatch;
    console.warn(
      '[ui-kit] FormWizard: шаги схемы и шаги потока расходятся.' +
        (withoutNode.length > 0
          ? ` Шаги потока без узла: ${quoted(withoutNode)} — визард не свяжет их с разметкой.`
          : '') +
        (withoutFlowStep.length > 0
          ? ` Узлы без шага потока: ${quoted(withoutFlowStep)} — проверьте \`selector\` шага и ` +
            '`flow.steps` сборки.'
          : '')
    );
  }, [flow, stepNodes, selectorKey]);

  // Узел схемы рисует рендерер (`renderNode`); явная стратегия `renderStepBody` главнее.
  const renderBody = useMemo(
    () =>
      renderStepBody ??
      (renderNode ? (body: TBody) => renderNode(body as unknown as FormWizardStepNode) : undefined),
    [renderStepBody, renderNode]
  );

  const { onSubmit } = props;
  // Кнопка отправки: внутри сборки колбэк зовётся после успешной проверки — отдаём ему значения.
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
      form={form}
      {...(flow !== undefined ? { flow } : {})}
      onStepChange={props.onStepChange}
      scrollToTop={props.scrollToTop}
    >
      <FormWizardHeadless.Indicator steps={indicatorSteps}>
        {(indicatorProps) => <StepIndicator {...indicatorProps} className="mb-8" />}
      </FormWizardHeadless.Indicator>

      <div
        data-slot="form-wizard-body"
        className={cn(
          'bg-card text-card-foreground p-8 rounded-lg shadow-md border',
          props.className
        )}
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

// Compound API: re-export headless slots для consumer-ов, которым нужен
// custom layout (например, расположить Indicator поверх кастомного header'а).
type FormWizardCompound = typeof FormWizardBase & {
  Indicator: typeof FormWizardHeadless.Indicator;
  Step: typeof FormWizardHeadless.Step;
  Actions: typeof FormWizardHeadless.Actions;
  Progress: typeof FormWizardHeadless.Progress;
};

/**
 * Готовая многошаговая форма (multi-step wizard) — стилизованная обёртка поверх
 * headless-compound `@reformer/cdk/form-wizard`. Собирает Indicator, тело шагов,
 * Actions (Назад / Далее / Отправить) и Progress в единый layout, работает с
 * одной {@link FormGroup} и декларативным списком {@link FormWizardStep}.
 *
 * Один компонент покрывает TS-flow, renderer-react и renderer-json за счёт
 * полиморфного {@link FormWizardStepBody}. Шаги и их проверку держит поток `FormFlow` сборки
 * (`createForm({ flow })`): проп `flow` либо сборка из контекста. Навигация снаружи дерева — через
 * сам поток (`bundle.flow.goTo('loan')`), отправка — `bundle.submission.submit(handler)`.
 *
 * Экспонирует compound-слоты `FormWizard.Indicator` / `.Step` / `.Actions` /
 * `.Progress` для кастомной раскладки.
 *
 * @typeParam T - Тип значения корневой формы (`FormGroup<T>`).
 *
 * @example Кредитная заявка с 3 шагами: разметка в JSX, отправка через сборку
 * ```tsx
 * import { useFormBundle } from '@reformer/core/react';
 * import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
 *
 * const STEPS: FormWizardStep<CreditApplication>[] = [
 *   { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoForm },
 *   { number: 2, title: 'Данные', icon: '👤', body: PersonalInfoForm },
 *   { number: 3, title: 'Подтверждение', icon: '✓', body: ConfirmationForm },
 * ];
 *
 * function CreditForm() {
 *   const credit = useFormBundle(() => createCreditForm()); // createForm({ …, flow })
 *
 *   const onSubmit = async () => {
 *     const result = await credit.submission.submit((values) => api.submit(values));
 *     if (result.status === 'invalid') showHint('Проверьте заполнение формы');
 *   };
 *
 *   return (
 *     <FormWizard form={credit.form} flow={credit.flow} steps={STEPS} onSubmit={onSubmit} />
 *   );
 * }
 * ```
 *
 * @example В схеме формы: шаги — дочерние узлы, форма и правила — из сборки
 * ```tsx
 * import { createForm, type FormModel } from '@reformer/core';
 * import { useFormBundle } from '@reformer/core/react';
 * import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
 * import { FormRenderer } from '@reformer/renderer-react';
 * import { Step } from '@reformer/cdk/form-wizard';
 *
 * const creditSchema = (model: FormModel<CreditApplication>) => ({
 *   selector: 'wizard',
 *   component: FormWizard,
 *   children: [
 *     {
 *       selector: 'loan', // идентификатор шага в потоке сборки
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
 *     flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
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
 *   form={bundle.form}
 *   flow={bundle.flow}
 *   steps={[{ number: 1, title: 'Данные', body: stepNode }]}
 *   renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />}
 * />
 * ```
 *
 * @see {@link FormWizardStep} — форма элемента `steps`.
 * @see {@link FormWizardStepNode} — узел шага в схеме формы.
 * @see {@link StepIndicator}, {@link FormWizardActions}, {@link FormWizardProgress} — слоты layout'а.
 */
const FormWizard = Object.assign(FormWizardBase, {
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
