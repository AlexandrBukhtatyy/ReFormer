/**
 * React-оболочка заявки на кредит — сборка ядра в React на заглушках, без настоящего рендерера.
 *
 * Оболочка рисует текущий шаг визарда по скомпилированной схеме заявки теми же средствами, что
 * рендерер (`@reformer/renderer-react`), и ровно настолько, насколько это нужно сценарию
 * React-сборки (`react-assembly.dom.test.tsx`):
 * - бандл — `useFormBundle` (фабрика, обычно `createLoanForm`) и `FormBundleContext`;
 * - шаг и кнопки — `useFormFlow`; подписи кнопок — `useMessages` со встроенной таблицей;
 * - поле — нода по ручке (`getNodeForSignal`), `useFormControl`, диалект контрола —
 *   `getFieldAdapter` / `bindFieldProps`, императивный handle — `useFieldHandleRef` на ref узла в
 *   области его под-модели (`render.controller.scopeOf(…).node(id).getRef()`);
 * - строки массива — `useArrayLength`, ключ строки — `keyAt`, область строки — `scopeOf(строка)`;
 * - видимость и подмешанные пропсы узла — хранилище области: `hideWhen`, `setHidden`, `patchProps`;
 * - производное поле без компонента (платёж) — `useFormControlValue`;
 * - тексты замечаний — `useIssueMessage` под `I18nProvider`, описатель `msg` в заголовке —
 *   `resolveLocalized` с ручкой `useI18n`.
 *
 * Хуки жизненного цикла узлов (`onMount`), эффекты (`renderEffect`) и обработчики событий
 * (`onComponentEvent`) оболочка не исполняет — их проверяет `bundle-assembly`. Каждый компонент
 * сообщает о своём рендере ключом (`onRender`): по счётчикам сценарий видит, кого перерисовала
 * правка.
 */

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  getNodeForSignal,
  type CompiledArrayNode,
  type CompiledChild,
  type CompiledContainerNode,
  type CompiledFieldNode,
  type CompiledNode,
  type CompiledPartNode,
  type CompiledSchema,
  type CompiledTextNode,
  type FormArray,
  type FormBundle,
  type FormControl,
  type SchemaNodeId,
  type SchemaScope,
  type ValidationIssue,
} from '../../../../src/index';
import {
  resolveLocalized,
  type FormLocale,
  type IssueMessages,
  type LocaleLoad,
} from '../../../../src/i18n';
import {
  FormBundleContext,
  I18nProvider,
  bindFieldProps,
  getFieldAdapter,
  useArrayLength,
  useFieldHandleRef,
  useFormBundle,
  useFormBundleContext,
  useFormControl,
  useFormControlValue,
  useFormFlow,
  useI18n,
  useIssueMessage,
  useMessages,
  type FieldAdapter,
  type FieldHandle,
} from '../../../../src/react';
import { effect } from '../../../../src/signals';
import { Checkbox, FileUpload, MultiSelect, NumberInput } from './components';
import type { LoanApplication } from './model';

// ─── Контекст оболочки ─────────────────────────────────────────────────────────────────────

/** Что оболочка раздаёт своим компонентам помимо бандла. */
interface LoanViewSettings {
  /** Компонент сообщает ключ при каждом рендере. */
  readonly probe: (key: string) => void;
  /** Словарь формы для текстов замечаний. */
  readonly issueMessages: IssueMessages | undefined;
}

const LoanViewContext = createContext<LoanViewSettings>({
  probe: () => {},
  issueMessages: undefined,
});

/** Бандл заявки из контекста сборки; вне оболочки — ошибка. */
function useLoanBundle(): FormBundle<LoanApplication> {
  const bundle = useFormBundleContext<LoanApplication>();
  if (bundle === null) throw new Error('[loan-react] компонент заявки стоит вне LoanApp');
  return bundle;
}

/**
 * Значение, вычисленное из сигналов: компонент перерисовывается, только когда оно изменилось.
 * Значение — примитив: снимок `useSyncExternalStore` сравнивается по `Object.is`.
 */
function useSignalRead<T extends string | number | boolean | undefined>(read: () => T): T {
  const readRef = useRef(read);
  readRef.current = read;
  const subscribe = useCallback((onChange: () => void) => {
    let first = true;
    return effect(() => {
      readRef.current(); // зависимости эффекта — сигналы, прочитанные вычислением
      if (first) {
        first = false;
        return;
      }
      onChange();
    });
  }, []);
  return useSyncExternalStore(subscribe, read, read);
}

// ─── Хранилище области: видимость и пропсы узла ────────────────────────────────────────────

/** Скрыт ли узел области: `setHidden` главнее условия `hideWhen`, без обоих узел виден. */
function isHidden(scope: SchemaScope, selector: string): boolean {
  const maps = scope.__overrideMaps;
  void maps.versionFor(selector).value; // подписка на setHidden / resetHidden этого узла
  const forced = maps.hiddenOverrides.get(selector) ?? null;
  if (forced !== null) return forced;
  return maps.conditionRegistry.get(selector)?.() ?? false;
}

/** Подмешанный проп узла (`patchProps`); подписка — на версию своего селектора. */
function patchedProp(scope: SchemaScope, selector: string, key: string): unknown {
  const maps = scope.__overrideMaps;
  void maps.versionFor(selector).value;
  return maps.propsOverrides.get(selector)?.[key];
}

/**
 * Ref поля для `getRef()`: идентификатор узла (`selector`, а без него — место в дереве) в области
 * своей под-модели — `render.controller.scopeOf(строка).node(id).getRef()`. Путь модели для
 * ключа не годится: у поля строки он меняется при удалении и перестановке соседних строк, а
 * компонент поля об этом не узнаёт — handle остался бы под прежним путём.
 */
function fieldRef(node: CompiledFieldNode, scope: SchemaScope): { current: FieldHandle | null } {
  return scope.node(node.id).getRef<FieldHandle>();
}

/** Поля узла в порядке схемы — каждое со своей областью: строки и подформы раскрыты. */
function* fieldsOf(
  bundle: FormBundle<LoanApplication>,
  node: CompiledNode,
  scope: SchemaScope
): Generator<[CompiledFieldNode, SchemaScope]> {
  const { controller } = bundle.render;
  if (node.kind === 'field') {
    yield [node, scope];
  } else if (node.kind === 'part') {
    yield* fieldsOf(bundle, node.content.root, controller.scopeOf(node.model));
  } else if (node.kind === 'array') {
    for (let index = 0; index < node.control.length; index++) {
      const row = node.control.at(index) as object;
      yield* fieldsOf(bundle, node.row(row).root, controller.scopeOf(row));
    }
  } else {
    for (const child of node.children) {
      if (child.kind !== 'text') yield* fieldsOf(bundle, child, scope);
    }
  }
}

/**
 * Фокус на первое поле шага с ошибкой — в порядке схемы. Поле, которое не нарисовано (скрытая
 * секция, размонтированная оболочка), пропускается: его handle пуст.
 */
function focusFirstError(bundle: FormBundle<LoanApplication>, stepId: string): void {
  const step = bundle.render.tree?.nodes.get(stepId as SchemaNodeId);
  if (step === undefined) return;
  const root = bundle.render.controller.scopeOf(bundle.model);
  for (const [field, scope] of fieldsOf(bundle, step, root)) {
    const control = getNodeForSignal(field.handle) as FormControl<unknown> | undefined;
    const handle = fieldRef(field, scope).current;
    if (control?.invalid.value !== true || handle === null) continue;
    handle.focus();
    return;
  }
}

// ─── Поле ──────────────────────────────────────────────────────────────────────────────────

const targetOf = (event: unknown): HTMLInputElement =>
  (event as ChangeEvent<HTMLInputElement>).target;

/** Нативное текстовое поле: значение — из события DOM, `null` показывается пустой строкой. */
const TEXT_INPUT: FieldAdapter = {
  fromEmit: (event) => targetOf(event).value,
  toValue: (value) => value ?? '',
};

/** Диалекты заглушек, у которых значение не строка: число (пусто — `null`) и флажок. */
const INPUT_DIALECTS = new Map<unknown, FieldAdapter>([
  [
    NumberInput,
    {
      fromEmit: (event) => (targetOf(event).value === '' ? null : Number(targetOf(event).value)),
      toValue: (value) => value ?? '',
    },
  ],
  [
    Checkbox,
    {
      valueProp: 'checked',
      fromEmit: (event) => targetOf(event).checked,
      toValue: (value) => value === true,
    },
  ],
]);

/** Текст замечания поля: единственный потребитель языка в поле — смена языка рисует только его. */
const IssueText = memo(function IssueText({
  issue,
  path,
}: {
  issue: ValidationIssue;
  path: string;
}): ReactNode {
  const { probe, issueMessages } = useContext(LoanViewContext);
  probe(`issue:${path}`);
  const message = useIssueMessage(issueMessages);
  return (
    <span role="alert" data-testid={`issue:${path}`}>
      {message(issue)}
    </span>
  );
});

/** Поле заявки: снимок ноды, контрол под адаптер, handle — на ref узла схемы. */
const FieldView = memo(function FieldView({
  node,
  scope,
}: {
  node: CompiledFieldNode;
  scope: SchemaScope;
}): ReactNode {
  const { probe } = useContext(LoanViewContext);
  // Путь — на момент рендера: после сдвига строк массива он устаревает до следующего рендера.
  const path = node.handle.__path;
  probe(`field:${path}`);
  const control = getNodeForSignal(node.handle) as FormControl<unknown>;
  const { value, disabled, issues, shouldShowError, shouldShowIssues, componentProps } =
    useFormControl(control);
  const handleRef = useFieldHandleRef(fieldRef(node, scope));
  // Текст — по «есть что показать» (и предупреждение тоже), состояние ошибки — по shouldShowError.
  const issue = shouldShowIssues ? issues[0] : undefined;

  let input: ReactNode;
  if (node.component === FileUpload || node.component === MultiSelect) {
    // Файлы и мультивыбор — значение-массив целиком: оболочке хватает числа элементов.
    input = (
      <output data-testid={path} ref={handleRef as RefObject<HTMLOutputElement>}>
        {Array.isArray(value) ? value.length : 0}
      </output>
    );
  } else {
    const adapter =
      getFieldAdapter(node.component) ?? INPUT_DIALECTS.get(node.component) ?? TEXT_INPUT;
    const bound = bindFieldProps(adapter, {
      value,
      onChange: (next) => control.setValue(next),
      onBlur: () => control.markAsTouched(),
    });
    input = (
      <input
        {...bound}
        type={node.component === Checkbox ? 'checkbox' : 'text'}
        data-testid={path}
        disabled={disabled}
        aria-invalid={shouldShowError}
        ref={handleRef as RefObject<HTMLInputElement>}
      />
    );
  }
  return (
    <label>
      {String(componentProps.label ?? '')}
      {input}
      {issue !== undefined && <IssueText issue={issue} path={path} />}
    </label>
  );
});

// ─── Узлы схемы ────────────────────────────────────────────────────────────────────────────

/** Текст схемы: литералы и сигналы; перерисовка — когда изменилась собранная строка. */
const TextView = memo(function TextView({
  node,
  owner,
}: {
  node: CompiledTextNode;
  owner: string;
}): ReactNode {
  const { probe } = useContext(LoanViewContext);
  probe(`text:${owner}`);
  const text = useSignalRead(() =>
    node.parts
      .map((part) => String((typeof part === 'object' ? (part.value as unknown) : part) ?? ''))
      .join('')
  );
  return <span data-testid={`text:${owner}`}>{text}</span>;
});

/** Строка массива: своё поддерево и своя область — соседние строки её правила не видят. */
const RowView = memo(function RowView({
  rowKey,
  schema,
  scope,
}: {
  rowKey: string;
  schema: CompiledSchema;
  scope: SchemaScope;
}): ReactNode {
  const { probe } = useContext(LoanViewContext);
  probe(`row:${rowKey}`);
  return <NodeView node={schema.root} scope={scope} owner={schema.scope} />;
});

/**
 * Массив под-форм: список подписан только на число строк (`useArrayLength`) — добавление и
 * удаление рисуют список, а правка строки его не трогает. Перестановку строк такая подписка не
 * видит: оболочка строки не переставляет.
 */
const ArrayView = memo(function ArrayView({ node }: { node: CompiledArrayNode }): ReactNode {
  const bundle = useLoanBundle();
  const { probe } = useContext(LoanViewContext);
  const path = node.handle.__path;
  probe(`list:${path}`);
  const rows = getNodeForSignal(node.handle) as FormArray<object>;
  const length = useArrayLength(rows);
  return (
    <fieldset data-testid={`list:${path}`}>
      {Array.from({ length }, (_, index) => {
        const row = node.control.at(index) as object;
        const rowKey = rows.keyAt(index);
        return (
          <RowView
            key={rowKey}
            rowKey={rowKey}
            schema={node.row(row)}
            scope={bundle.render.controller.scopeOf(row)}
          />
        );
      })}
      <button type="button" onClick={() => rows.push()}>
        {String(node.props.addLabel ?? 'Добавить')}
      </button>
    </fieldset>
  );
});

/** Подформа: содержимое — в области своей группы. */
const PartView = memo(function PartView({ node }: { node: CompiledPartNode }): ReactNode {
  const bundle = useLoanBundle();
  const scope = bundle.render.controller.scopeOf(node.model);
  return <NodeView node={node.content.root} scope={scope} owner={node.content.scope} />;
});

const ContainerView = memo(function ContainerView({
  node,
  scope,
}: {
  node: CompiledContainerNode;
  scope: SchemaScope;
}): ReactNode {
  const owner = node.selector ?? node.id;
  return (
    <div data-testid={node.selector === undefined ? undefined : `node:${node.selector}`}>
      {node.children.map((child) => (
        <NodeView key={child.id} node={child} scope={scope} owner={owner} />
      ))}
    </div>
  );
});

function NodeBody({ node, scope }: { node: CompiledNode; scope: SchemaScope }): ReactNode {
  if (node.kind === 'field') return <FieldView node={node} scope={scope} />;
  if (node.kind === 'array') return <ArrayView node={node} />;
  if (node.kind === 'part') return <PartView node={node} />;
  return <ContainerView node={node} scope={scope} />;
}

/** Узел с `selector`: его видимостью управляют поведение (`hideWhen`) и `render.node(…)`. */
const SelectableNode = memo(function SelectableNode({
  node,
  selector,
  scope,
}: {
  node: CompiledNode;
  selector: string;
  scope: SchemaScope;
}): ReactNode {
  const { probe } = useContext(LoanViewContext);
  probe(`node:${node.scope}/${selector}`);
  const hidden = useSignalRead(() => isHidden(scope, selector));
  return hidden ? null : <NodeBody node={node} scope={scope} />;
});

/** Ребёнок узла: текст, либо узел — с `selector` он может быть скрыт. */
function NodeView({
  node,
  scope,
  owner,
}: {
  node: CompiledChild;
  scope: SchemaScope;
  /** Чей это ребёнок — для ключа текста в счётчике рендеров. */
  owner: string;
}): ReactNode {
  if (node.kind === 'text') return <TextView node={node} owner={owner} />;
  if (node.selector !== undefined) {
    return <SelectableNode node={node} selector={node.selector} scope={scope} />;
  }
  return <NodeBody node={node} scope={scope} />;
}

// ─── Визард ────────────────────────────────────────────────────────────────────────────────

/** Подписи кнопок визарда — встроенная английская таблица оболочки, как у пакета компонентов. */
const WIZARD_TEXTS = { 'loan.wizard.back': 'Back', 'loan.wizard.next': 'Next' } as const;

/** Заголовок и заполненность — пропсы, которые поведение подмешивает узлу визарда. */
const WizardHeader = memo(function WizardHeader({ scope }: { scope: SchemaScope }): ReactNode {
  const { probe } = useContext(LoanViewContext);
  probe('wizard-header');
  const i18n = useI18n();
  // Заголовок может быть описателем `msg` — он раскрывается по активному языку.
  const title = useSignalRead(() => {
    const resolved = resolveLocalized(patchedProp(scope, 'wizard', 'title'), i18n);
    return typeof resolved === 'string' ? resolved : '';
  });
  const progress = useSignalRead(() => {
    const value = patchedProp(scope, 'wizard', 'progress');
    return typeof value === 'number' ? value : undefined;
  });
  return (
    <header>
      <h1 data-testid="wizard-title">{title}</h1>
      <output data-testid="wizard-progress">{progress === undefined ? '' : `${progress} %`}</output>
    </header>
  );
});

/** Платёж — производное поле без компонента в схеме: подписка только на его значение. */
const PaymentBadge = memo(function PaymentBadge(): ReactNode {
  const bundle = useLoanBundle();
  const { probe } = useContext(LoanViewContext);
  probe('payment');
  const payment = useFormControlValue(bundle.form.loan.monthlyPayment);
  return <output data-testid="payment">{payment}</output>;
});

/** Кнопки шага: «Далее» проверяет шаг, а при отказе ставит фокус на первое поле с ошибкой. */
const WizardNavigation = memo(function WizardNavigation(): ReactNode {
  const bundle = useLoanBundle();
  const { probe } = useContext(LoanViewContext);
  probe('wizard-navigation');
  const flow = bundle.flow!;
  const { isFirst, isLast, validating } = useFormFlow(flow);
  const text = useMessages(WIZARD_TEXTS);
  const next = async (): Promise<void> => {
    const transition = await flow.next();
    if (transition.status === 'stayed' && transition.reason === 'invalid') {
      focusFirstError(bundle, transition.step);
    }
  };
  return (
    <nav>
      <button type="button" disabled={isFirst} onClick={() => void flow.previous()}>
        {text('loan.wizard.back')}
      </button>
      <button type="button" disabled={isLast || validating} onClick={() => void next()}>
        {text('loan.wizard.next')}
      </button>
    </nav>
  );
});

/** Визард: рисует узел текущего шага; шаг меняется — прежний размонтируется. */
const LoanWizard = memo(function LoanWizard(): ReactNode {
  const bundle = useLoanBundle();
  const { probe } = useContext(LoanViewContext);
  probe('wizard');
  const { current } = useFormFlow(bundle.flow!);
  const root = bundle.render.controller.scopeOf(bundle.model);
  const step = bundle.render.tree?.nodes.get(current as SchemaNodeId);
  return (
    <section data-testid="loan-wizard" data-step={current}>
      <WizardHeader scope={root} />
      <PaymentBadge />
      {step !== undefined && <NodeView key={current} node={step} scope={root} owner={current} />}
      <WizardNavigation />
    </section>
  );
});

// ─── Оболочка ──────────────────────────────────────────────────────────────────────────────

interface LoanAppBaseProps {
  /** Фабрика бандла: `useFormBundle` зовёт её один раз на монтирование. */
  readonly factory: () => FormBundle<LoanApplication>;
  /** Словарь формы для текстов замечаний; без него тексты даёт локаль. */
  readonly issueMessages?: IssueMessages;
  /** Счётчик рендеров: каждый компонент оболочки сообщает свой ключ. */
  readonly onRender?: (key: string) => void;
  /** Своё содержимое внутри контекстов сборки и языка — панели сценария. */
  readonly children?: ReactNode;
}

/** Пропсы оболочки: готовая локаль либо язык и загрузчик — два режима `I18nProvider`. */
export type LoanAppProps = LoanAppBaseProps &
  ({ readonly locale: FormLocale } | { readonly lang: string; readonly load: LocaleLoad });

/**
 * Заявка на кредит в React: сборка, контекст сборки, язык и визард.
 *
 * @example
 * ```tsx
 * render(<LoanApp factory={() => createLoanForm().bundle} locale={loanLocales.ru} />);
 * ```
 */
export function LoanApp(props: LoanAppProps): ReactNode {
  const { factory, issueMessages, onRender, children } = props;
  const bundle = useFormBundle(factory);
  // Счётчик читается через ref: контекст оболочки остаётся стабильным и сам никого не рисует.
  const onRenderRef = useRef(onRender);
  onRenderRef.current = onRender;
  const probe = useCallback((key: string) => onRenderRef.current?.(key), []);
  const settings = useMemo(() => ({ probe, issueMessages }), [probe, issueMessages]);
  const content = (
    <FormBundleContext.Provider value={bundle}>
      <LoanViewContext.Provider value={settings}>
        <LoanWizard />
        {children}
      </LoanViewContext.Provider>
    </FormBundleContext.Provider>
  );
  return 'locale' in props ? (
    <I18nProvider locale={props.locale}>{content}</I18nProvider>
  ) : (
    <I18nProvider lang={props.lang} load={props.load}>
      {content}
    </I18nProvider>
  );
}
