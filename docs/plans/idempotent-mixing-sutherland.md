# Контракт ядра, второй проход: имена, ошибка без текста, компилятор схемы, поток шагов

## Context

Первый проход ([1-2-snazzy-rabbit.md](1-2-snazzy-rabbit.md), эпик `ReFormer-k152`) убрал второй контракт
валидации и разложил эталон по слоям. Из разбора «Анализ архитектуры библиотеки»
(`D:\Work\obsidian\PARA\0.Projects\ReFormer\ChatGPT - Reformer - Анализ архитектуры библиотеки.md`)
пользователь выбрал в работу оставшиеся пункты: §5, §7, §8, §13, §15–§22, §29, §30, §32, §34, §40, §47
и по эталону Э§1, Э§9, Э§20, Э§21. Что за ними стоит в коде:

- ошибка валидации несёт текст (`message`, `messageKey`), корневой экспорт `@reformer/core` тянет
  React, а типы схемы импортируют типы React;
- вид узла схемы независимо определяют три обходчика с разными правилами: ядро считает контейнером
  узел с `children`, рендерер — узел с `component`, конвертер JSON повторяет разбор сам;
- `form.submit()` правил не запускает, его единственный вызывающий — визард; `null` и `false` значат
  и «невалидно», и «отменено»; шаги визарда — состояние React, и поведение формы достаёт ref компонента;
- `set` и `patch` модели — одна функция; класс `GroupNode` называется одинаково в модели и в форме.

Итог плана: ядро без React в корне, ошибка из кода и параметров, один компилятор схемы для сборки и
рендереров, проверка и отправка на уровне формы с результатом-объектом, поток шагов без React.

## Принятые решения

| Тема | Решение |
| --- | --- |
| Совместимость | ломающие изменения под следующий major, без псевдонимов старых имён |
| Ошибка валидации | `ValidationIssue = { code, params?, severity? }`; `message` и `messageKey` удаляются из ядра и из опций валидаторов |
| Текст ошибки | даёт слой представления по `code`: словарь формы → словарь локали → встроенный английский → сам код |
| Имена нод формы | публичные интерфейсы `FormNode`, `FormControl`, `FormGroup`, `FormArray`; классы внутренние, с суффиксом `Node` |
| Узлы модели | фасады `FormModel` и `ModelArray` не меняются; внутренние классы — `ModelLeafNode`, `ModelGroupNode`, `ModelArrayNode` |
| Компонент массива | `FormArray` в cdk и ui-kit → семейство `FieldArray`; реестр JSON принимает старое имя как псевдоним |
| Схема | авторский формат не меняется (вид узла по ключам, ключ `selector`); ядро компилирует дерево в `CompiledSchema` |
| Идентификатор узла | уникален в пределах области (корень, строка массива, подформа); повтор `selector` — ошибка сборки |
| Компонент в схеме | `ComponentRef = string \| object`; типов React в слоях `model` и `form` нет |
| React | сабпат `@reformer/core/react`: хуки, связка поля, React-привязки i18n |
| Модель | `patch` — частичное обновление; `set` — полное: при нехватке ключей предупреждение в dev, значения не трогаются |
| Уровень формы | `bundle.validate()`, `bundle.validateStep(id)`, `bundle.submit(handler)` возвращают объект со статусом |
| Поток шагов | `FormFlow` в ядре на сигналах; шаги объявляются в `createForm({ flow })`; визард — адаптер |
| Старый путь сборки | `createReactForm`, `createJsonForm`, JSON формата 1 остаются и идут через тот же компилятор |
| Эталон | типы ввода и расчёта раздельно; режим «React руками» остаётся |
| Отладочные страницы | пять каталогов, сгенерированных MCP под старый контракт, удаляются |

Не входит: отказ от режима «React руками» (Э§12), слой вычисляемых значений в ядре, типизированные
`componentProps` и хелпер `field()`, отдельные npm-пакеты, `__path` как `Symbol`, явный API
`model.field()`, переименование ключа `selector`, перевод билдера на JSON формата 2, семантика
`reset` (`ReFormer-k152.14` остаётся отдельной задачей).

### Имена

| Было | Стало |
| --- | --- |
| `ValidationError` | `ValidationIssue` |
| `ValidationSchema`, `defineValidationSchema` | `ValidationDefinition`, `defineValidation` |
| `ValidateOptions` | `RuleOptions` |
| `resolveValidationError`, `useValidationMessage` | `resolveIssueMessage`, `useIssueMessage` |
| cdk `ValidationErrorResolver`, `useValidationErrorResolver` | `IssueMessageResolver`, `useIssueMessageResolver` |
| `errors`, `setErrors`, `clearErrors` (ноды, хуки, `ValidationResult`) | `issues`, `setIssues`, `clearIssues` |
| `FieldNode`, `GroupNode`, `ModelArrayNode`, `FormProxy` | `FormControl`, `FormGroup`, `FormArray`, `FormGroup` |
| `isFieldNode`, `isGroupNode`, `isArrayNode` | `isFormControl`, `isFormGroup`, `isFormArray` |
| `FormArray*`, `useFormArray`, сабпаты `/form-array` (cdk, ui-kit) | `FieldArray*`, `useFieldArray`, `/field-array` |
| `validation.schema`, `validation.steps` | `validation.rules`, `flow.steps[].rules` |
| `FormValue`, `FieldStatus`, `ErrorFilterOptions` | удалены |

## Целевые контракты

### Валидация и тексты

```ts
export interface ValidationIssue {
  readonly code: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly severity?: 'error' | 'warning';
}
export interface RuleOptions {
  /** Свой код вместо встроенного: required({ code: 'loanAmount.required' }). */
  code?: string;
  params?: Readonly<Record<string, unknown>>;
}
export type Rule<TField> = (value: TField) => ValidationIssue | null;
export type ValidationDefinition<T> = (scope: ValidationScope<T>) => void;
export function defineValidation<T>(definition: ValidationDefinition<T>): ValidationDefinition<T>;

// @reformer/core/i18n — без React
export type IssueMessage =
  | string // шаблон с параметрами: 'Не меньше {minLength} символов'
  | ((params: Readonly<Record<string, unknown>>, i18n: I18nHandle) => string);
export type IssueMessages = Readonly<Record<string, IssueMessage>>; // ключ — code
export function defineIssueMessages<const Messages extends IssueMessages>(messages: Messages): Messages;
export function resolveIssueMessage(
  issue: ValidationIssue,
  i18n: I18nHandle,
  messages?: IssueMessages
): string;
```

`ValidationMessagesProvider` в cdk принимает `messages` и накладывает их поверх родительского
провайдера и локали; `resolver` остаётся полным переопределением. Подготовку параметров (даты,
перечни, размеры файлов) даёт существующий `prepareParams` из `i18n/validation-message.ts`.

Правило переноса текста: общий текст — встроенный код и словарь локали; текст конкретного поля —
свой код вида `<поле>.<правило>` и запись в словаре формы; динамический текст — `params` и шаблон
либо функция (шаблон печатает число без разрядов, поэтому «50 000 ₽» — статический текст или функция).

### Скомпилированная схема

```ts
export type ComponentRef = string | object; // ядро не интерпретирует
export type SchemaNodeId = string & { readonly __nodeId: true }; // уникален в области
export type SchemaScopeId = string & { readonly __scopeId: true }; // '#', '#/address', '#/phones[<ключ строки>]'

interface CompiledNodeBase {
  readonly id: SchemaNodeId; // selector автора, иначе позиционный
  readonly selector: string | undefined;
  readonly scope: SchemaScopeId;
  readonly component: ComponentRef | undefined;
  readonly props: Readonly<Record<string, unknown>>;
}
// kind: 'field' | 'array' | 'part' | 'container' | 'text'
// field: binding.handle, disabled · array: binding.handle, row(rowModel) → CompiledSchema
// part: binding.handle, content: CompiledSchema · container: children

export interface CompiledSchema {
  readonly scope: SchemaScopeId;
  readonly root: CompiledNode;
  readonly nodes: ReadonlyMap<SchemaNodeId, CompiledNode>; // узлы этой области
  readonly fields: ReadonlyMap<object, CompiledFieldNode>; // по ручке модели, включая подформы
  readonly arrays: ReadonlyMap<object, CompiledArrayNode>;
}
export function compileSchema(tree: FormSchemaNode, model: FormModel<never>): CompiledSchema;
```

Привязки нормализуют существующие `arrayHandleOf` и `groupHandleOf` (`model/model-value-proxy.ts`).
Подформы компилируются сразу, строки массива — при первом построении строки через кэш
`form/schema-subtree.ts`. Область по-прежнему ищется по под-модели (`controller.scopeOf(subModel)`).

### Ноды формы

```ts
export interface FormNode<T> {
  readonly value: ReadonlySignal<T>;
  readonly valid: ReadonlySignal<boolean>;
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>;
  readonly disabled: ReadonlySignal<boolean>;
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly issues: ReadonlySignal<readonly ValidationIssue[]>;
  getValue(): T;
  setValue(value: T): void;
  reset(value?: T): void;
  markAsTouched(): void;
  markAsUntouched(): void;
  enable(): void;
  disable(): void;
  setIssues(issues: readonly ValidationIssue[]): void;
  clearIssues(): void;
}
export interface FormControl<T> extends FormNode<T> {
  readonly component: ComponentRef | undefined;
  readonly componentProps: ReadonlySignal<Readonly<Record<string, unknown>>>;
  readonly shouldShowError: ReadonlySignal<boolean>;
  updateComponentProps(patch: Record<string, unknown>): void;
}
export interface FormArray<T extends object> extends FormNode<T[]> {
  readonly length: number;
  at(index: number): FormGroup<T> | undefined;
  map<R>(callback: (row: FormGroup<T>, index: number) => R): R[];
  forEach(callback: (row: FormGroup<T>, index: number) => void): void;
  keyAt(index: number): string; // стабильный ключ строки вместо GroupNode.id
  push(item?: T): void;
  insert(index: number, item?: T): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
  swap(first: number, second: number): void;
  clear(): void;
}
export type FormGroup<T> = FormNode<T> &
  Omit<FormFields<T>, keyof FormNode<T>> & { readonly $: FormFields<T> };
```

С публичной поверхности уходят члены без вызовов вне ядра: `getErrors` с фильтром, `markAsDirty`,
`markAsPristine`, `patchValue`, `validate()` ноды, `status`, `fields`, `id`, `getProxy`, `items`,
`submit`, `submitting`. Поля данных с именами `id`, `status`, `fields`, `submit` перестают затеняться.

### Уровень формы и поток шагов

```ts
export type SubmitResult<TResult> =
  | { status: 'submitted'; result: TResult }
  | { status: 'invalid' | 'error' | 'cancelled'; validation: ValidationResult }
  | { status: 'failed'; error: unknown }; // обработчик отправки бросил исключение

export interface FormBundle<T> {
  readonly model: FormModel<T>;
  readonly form: FormGroup<T>;
  readonly render: FormRender; // tree: CompiledSchema | undefined
  readonly flow: FormFlow | undefined;
  readonly validating: ReadonlySignal<boolean>;
  readonly submitting: ReadonlySignal<boolean>;
  validate(): Promise<ValidationResult>;
  validateStep(stepId: string): Promise<ValidationResult>; // неизвестный шаг — исключение
  submit<TResult>(
    handler: (values: T) => TResult | Promise<TResult>
  ): Promise<SubmitResult<TResult>>; // один прогон правил; values = model.get()
}

export type FlowTransition =
  | { status: 'moved'; from: string; to: string }
  | {
      status: 'stayed';
      step: string;
      reason: 'invalid' | 'error' | 'cancelled' | 'edge' | 'locked';
      validation?: ValidationResult;
    };
export interface FormFlow {
  readonly steps: readonly string[];
  readonly current: ReadonlySignal<string>;
  readonly index: ReadonlySignal<number>; // с нуля
  readonly completed: ReadonlySignal<ReadonlySet<string>>;
  readonly isFirst: ReadonlySignal<boolean>;
  readonly isLast: ReadonlySignal<boolean>;
  readonly validating: ReadonlySignal<boolean>;
  canGoTo(stepId: string): boolean;
  next(): Promise<FlowTransition>; // проверяет правила текущего шага
  previous(): FlowTransition;
  goTo(stepId: string): FlowTransition;
  reset(): void;
}

createForm({
  model,
  schema,
  behavior,
  validation: { extras: crossStepRules },
  flow: { steps: creditApplicationFlow.map((step) => ({ id: step.selector, rules: step.rules })) },
});
```

Полный набор правил — `validation.rules ?? apply(...правила шагов, extras)`, как сейчас. Идентификатор
шага равен `selector` узла шага в схеме. Область поведения получает `flow`:
`defineFormBehavior(({ model, form, schema, flow }) => …)`. Правила доступности шагов переносятся из
`goToStep` и `pruneCompletedStepsOnBack` (`packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx`).

## Этапы

Этапы 1, 2, 3 и 5 независимы друг от друга. Этап 4 идёт после 3, этап 6 — после 5, этап 7 — после
2, 4 и 6, этап 8 — после 7, этап 9 — последним. Каждый этап оставляет зелёными все проверки раздела
«Проверка» и включает минимум по MCP: имена и пути импорта в генераторах, таблица решений, таблицы
`validate/code.ts`, корпус оценки, перегенерированные `llms.txt`. Замены токенов в документах идут
со своим этапом, тексты переписываются один раз на этапе 9.

### Этап 0. Подготовка

- `bd`: эпик `ReFormer-ykls`, задачи этапов 0–9 — `ReFormer-ykls.1`–`.10` (заведены, порядок этапов
  задан зависимостями). `ReFormer-k152.9`–`.11` связаны с этапом 9, `k152.12` — с этапом 7.
- Ветка `feature/core-contract-2` от `develop`. Коммиты и push — только по явной просьбе, по одному
  пакету на коммит.
- Удалить `projects/react-playground/src/pages/debug/mcp-credit-application-{core,renderer-react,renderer-json}-v20`,
  `new-mcp-test-v2`, `new-mcp-test-v2-react` и их маршруты в `projects/react-playground/src/App.tsx`.
- Базовая линия в `.tmp/core-contract-2/baseline/`: результаты всех проверок, список падений e2e
  (эталон в трёх вариантах и остальные проекты playground), размеры, покрытие, вывод `mcp:evaluate`,
  список форм с dev-предупреждением о повторе `selector`.
- Добавить `packages/reformer/tsconfig.tests.json` (`noEmit`, `src` и `tests`): каталог тестов ядра
  сейчас не проверяется компилятором, а переименования типов в нём молча проходят под vitest.

### Этап 1. Ядро: модель и значения

- `model/model-nodes.ts`: у узла-группы два метода — `patch(value)` пропускает отсутствующие ключи,
  вложенные группы сливает рекурсивно, массивы заменяет целиком; `set(value)` делает то же и в dev
  предупреждает списком недостающих ключей. `makeFormModel` (`model/model-value-proxy.ts:120-121`)
  связывает их раздельно. Тип — `patch(value: DeepPartial<T>)`.
- `src/signals.ts`: `isSignal(value)` по бренду `Symbol.for('preact-signals')`. Им заменяются четыре
  `instanceof Signal`: `i18n/resolve-localized.ts:23,36`, `model/model-value-proxy.ts:208`,
  `model/model-signals-proxy.ts:198`. Поведение предикатов не меняется.
- `FormValue` удаляется: `params` — `Record<string, unknown>`; ограничения `T extends FormValue`
  снимаются в хуках ядра и в `packages/reformer-cdk/src/components/form-field/*` (5 файлов, 3 теста).
- Тесты: `set` против `patch` (недостающие и лишние ключи, вычисляемые поля, вложенные группы);
  `isSignal` на объекте из чужой копии рантайма; `resolveLocalized` с `computed`.

### Этап 2. Компонент `FieldArray`

- cdk: каталог `src/components/form-array` → `field-array` (13 файлов), сабпат `./field-array`.
- ui-kit: `FieldArray` и `FieldArraySection`, `package.json`, `scripts/generate-catalog.ts`,
  перегенерированный `component-catalog.json`.
- renderer-json: `registry/component-registry.ts` разрешает старые имена `FormArray` и
  `FormArraySection` в новые компоненты с одноразовым предупреждением в dev; `validate.ts` считает их
  известными. Фикстура `__fixtures__/credit-application.v1.json` остаётся на старом имени.
- Билдер: `packages/reformer-builder-plugin-api/src/plugin/runtime-modules.ts`,
  `projects/reformer-builder/src/application/runtime/forms.ts`, плагин `reformer`
  (`core/form-model/node-ref.ts`, `core/catalog/synthetic-entries.ts`), снимок
  `core/kits/catalog-equivalence.test.ts` — обновлять после сверки, что изменились только две записи.
- Playground, JSON-вариант эталона (`form.schema.json`, `registry.ts`), затем
  `npm run gen:form-schema -w react-playground`.
- MCP: `generate/{builders,schema-emit,form-intent,cross-check,ui-kit-components}.ts`, шаблон
  `add-form-array`, корпус оценки.

### Этап 3. Ядро без React

- `packages/reformer/src/react.ts` — вход сабпата: состав `platforms/react/index.ts` и React-привязки
  i18n (`I18nProvider`, `useI18n`, `useMessages`, `useValidationMessage`, `I18N_CONTEXT_MARKER`).
  `src/index.ts:39` и `src/i18n.ts:55-65` их больше не отдают.
- `vite.config.ts` (вход `react`), `package.json` (`exports["./react"]`, `react` и `react-dom` —
  необязательные peer-зависимости, описание пакета), `knip.json`, `.size-limit.json`,
  `tests/core/utils/root-exports.test.ts`.
- `ComponentRef` в `form/types/schema-node.ts:28,82` и `form/types/field-config.ts:7,31`. В
  `eslint.config.js` у `NO_REACT_PATHS` — `allowTypeImports: false`; `src/index.ts` и `src/i18n.ts`
  не импортируют `./platforms/**`.
- Новая проверка в `scripts/check-exports-dist.mjs`: в статическом замыкании
  `dist/{index,model,behaviors,validation,validators,i18n,signals}.js` нет импорта `react`.
- Потребители: около 67 файлов меняют путь импорта (19 — чистая замена, в остальных импорт делится
  на два), ещё около 13 — привязки i18n. Реэкспорты в `packages/reformer-renderer-react/src/index.ts:89`
  и `packages/reformer-ui-kit/src/fields/*`. Сабпат добавляется в `runtime-modules.ts`, в `forms.ts`
  билдера и в `projects/react-playground/src/pages/debug/ui_builder/compile.ts`.
- MCP: `generate/builders.ts:174`, `decide/api-decision.ts`, шаблоны `add-wizard.md` и
  `create-form.md`, `tests/unified-contract.test.ts:328`. Сайт: `projects/reformer-doc/docusaurus.config.ts:97`.

### Этап 4. Валидация: ошибка без текста

- Ядро: `form/types/contracts.ts`, `form/types/validation-schema.ts`, все `form/validators/*.ts`,
  `form/validation/*`, ноды и `form/aggregate-signals.ts` (`issues`), `platforms/react/hooks/types.ts`,
  `i18n/validation-message.ts` (новый порядок поиска текста), привязка `useIssueMessage`.
- cdk: `validation/error-resolver.tsx` — провайдер со слоями; `createMessageResolver` и
  `defaultErrorResolver` удаляются; `form-field/useFormField.ts`; загрузка файлов (`FileError`,
  `makeFileError`). ui-kit: три варианта загрузки файлов.
- Формы: все страницы `projects/react-playground/src/pages/demo` (около 190 вызовов в 17 файлах).
  Эталон получает `validation/messages.ts` (147 текстов из 12 файлов правил, туда же
  `constants/file-upload-messages.ts`). Дальше — `projects/reformer-builder-host-example/src/forms/contact`,
  шаблоны `projects/reformer-builder-playground/forms/templates`, шаблоны генератора кода
  `validation.eta` и `step-validation.eta` с эталонными снимками, живые примеры в `projects/reformer-doc/src`.
- Тесты: набор валидаторов без `message`; порядок поиска текста, параметры и функция в словаре;
  слои провайдера в cdk; type-тесты, где `required({ message })` и литерал ошибки с `message` — ошибки
  компиляции.
- Тексты на экране обязаны совпасть один в один: их фиксируют визуальные снимки e2e.

### Этап 5. Схема: компилятор и конвейер сборки

- Ядро: новые `form/schema/{ids,compiled,compile}.ts`. `form/create-form.ts` — конвейер
  `compileSchema` → построение нод по `model.$` → реестр «ручка → нода» → подключение поведения;
  `harvestFieldConfig` удаляется. `form/schema-controller.ts` — хранилища области по `SchemaNodeId`,
  у области появляется `id`; `eachSchemaSelector`, `unknownSchemaSelectors` и эвристика
  `checkSelectors` (`form/form-bundle.ts:138-180`) заменяются индексом компиляции.
- Повтор `selector` в области — исключение при сборке с путями обоих узлов. Неизвестный ключ узла и
  нераспознанная привязка остаются предупреждениями в dev.
- renderer-react: `core/render-node.tsx:691-890` выбирает ветку по `kind`; из `core/utils.ts` уходят
  `fieldBindingOf`, `arrayControlOf`, `partModelOf`, `isContainerRenderNode`. Контейнер без
  `component` рисует своих детей (сейчас — ничего). Входы `createRenderSchema` и `createReactForm`
  компилируют дерево при первом рендере.
- renderer-json: `converter/json-to-render-schema.ts` отдаёт строгое авторское дерево — без
  `model: undefined` и привязок фасадом; `$nodeId` конвертер хранит у себя, ядро его не несёт.
- ui-kit: визард читает скомпилированные узлы шагов.
- Тесты: виды узлов, детерминированные идентификаторы, повтор в области и одинаковый `selector` в
  разных строках, устойчивость областей строк к `move` и `swap`; два изменения поведения рендерера;
  снимок HTML фикстуры формата 1 до и после.

### Этап 6. Уровень формы, поток шагов, визард

- Ядро: новый `form/flow/flow.ts` (`createFormFlow`); `form/form-bundle.ts` — методы и сигналы
  бандла; `form/validation/config.ts` сокращается до правил и контроллера живой валидации,
  `createStepController`, `stepSelectors`, `runAll`, `runStep`, `validateAll` удаляются.
  Удаляются `form/form-submitter.ts` и `submit`, `submitting`, `validate` у группы.
  `form/behaviors/types.ts` — `flow` в области поведения.
- `@reformer/core/react`: `useFormFlow(flow)` — снимок сигналов потока для рендера.
- cdk `form-wizard/*`: состояние берётся из `flow` (проп либо бандл из контекста); без `flow` визард
  собирает позиционный поток без правил. `FormWizardConfig`, `FormWizardHandle`, `defineSteps`,
  `useWizardStepValidation` удаляются. Контекст `useFormWizard()` остаётся и отдаёт `form` и `flow`.
  Номер шага в интерфейсе — `index + 1`, тестовые идентификаторы кнопок и индикатора не меняются.
- ui-kit `form-wizard/variants/base/form-wizard.tsx`, `packages/reformer-renderer-react/src/create-react-form.ts`,
  `packages/reformer-renderer-json/src/create-json-form.ts`,
  `packages/reformer-form-registry/src/react/mounted-form.tsx` — на общую сборку уровня формы.
- Потребители: четыре варианта эталона. `application/renderer.ts:71-74` становится эффектом
  `if (isMortgage(model.loanType)) flow.goTo('loan')`; `CreditApplicationForm.tsx` отправляет через
  `bundle.submit(sendCreditApplication)`; `validation/form.ts` оставляет `extras`, шаги уходят в
  `application/create.ts`. Дальше — пример визарда на сайте, шаблоны генератора кода `wizard.eta`,
  `validation.eta`, `render-behavior.eta` со снимками, шаблон `reformer-multi-step-form`.
- Тесты: поток (перенос случаев доступности шагов из cdk, неизвестный шаг); отправка — все статусы,
  значения из `model.get()`, ровно один прогон правил на отправку.

### Этап 7. Ноды формы: контракты и состав

- Ядро: `form/nodes/*` — классы `FormControlNode`, `FormGroupNode`, `FormArrayNode` из модулей
  состояния `form/nodes/state/*` (взаимодействие, ошибки, доступность, ожидание, состояние
  компонента); `form/status-machine.ts` удаляется, `createAggregateSignals` переиспользуется.
  `form/types/form-proxy.ts` → тип `FormGroup`. `form/type-guards.ts` различает ноды по символу-метке.
  `model/model-nodes.ts` — имена `ModelLeafNode`, `ModelGroupNode`, `ModelArrayNode`.
  Хуки `platforms/react/hooks/*` типизируются интерфейсами.
- Потребители: `FormProxy` → `FormGroup` (40 файлов в 8 пакетах), `FieldNode` → `FormControl`,
  `ModelArrayNode` → `FormArray`; cdk `useFieldArray.ts` и `list/useList.ts:51` берут ключ строки из
  `keyAt`. Плагин билдера `reformer/core/form-inspect` (`k152.12`) читает члены нод структурно —
  правится здесь. Шаблоны генератора кода `wizard.eta`, `render-behavior.eta`, `step-render.eta`.
- Тесты: модули состояния по отдельности; type-тесты доступа к полям `FormGroup` и сокращённого
  набора затеняемых имён.

### Этап 8. Эталон: типы ввода и расчёта

- `types/credit-application.ts`: `CreditApplication` (ввод) и `CreditApplicationDerived` (семь
  вычисляемых полей); `CreditApplicationForm` остаётся их пересечением, 54 импортирующих файла не
  меняются.
- Новый `application/payload.ts`: список вычисляемых ключей с проверкой
  `satisfies readonly (keyof CreditApplicationDerived)[]` и функция, оставляющая в значениях только
  ввод. `application/submit.ts` и `api/submit-credit-application.ts` принимают `CreditApplication`.

### Этап 9. Документация и MCP

- `packages/reformer/docs/llms`: тексты разделов о валидации, схеме, нодах, визарде и раскладке;
  новые страницы о словаре сообщений, скомпилированной схеме и потоке шагов; таблица удалённого API
  `17-nonexistent-api.md`.
- Документы зависимых пакетов и сайт `projects/reformer-doc` (`k152.10`; сайт в CI не собирается —
  собрать вручную).
- MCP: раскладка файлов формы с файлом сообщений и потоком (`k152.9`), подсказки и фикстуры
  (`k152.11`), `REMOVED_API` в `scripts/check-mcp-prompts.mjs`, базовая линия
  `docs/mcp-eval/baseline.json` перезаписывается один раз.
- `docs/iter-prompts/*` — отдельным коммитом: там устарели `createRenderSchema`, `<JsonFormRenderer>`
  и число spec-файлов.

## Проверка

После каждого этапа, в этом порядке:

1. Ядро: `cd packages/reformer && npx tsc -b && npx tsc -p tsconfig.tests.json && npm test`, затем из
   корня `npm run build -w @reformer/core` и `npm run coverage -w @reformer/core`. Из корня `tsc -b`
   не запускается.
2. Зависимые пакеты в порядке CI — cdk, renderer-react, ui-kit, renderer-json, form-registry:
   `npm run build -w <пакет> && npm run test -w <пакет>`; после ui-kit —
   `npm run check:subpaths -w @reformer/ui-kit`.
3. MCP: `npm run generate:llms`, `npm run build -w @reformer/mcp`, `npm run test -w @reformer/mcp`,
   `npm run check:mcp-prompts`, `npm run check:mcp-render`, `npm run mcp:evaluate`.
4. Билдер: сборка и тесты `@reformer/builder-plugin-api`, `@reformer/builder-toolkit`,
   `@reformer/builder-plugin-cli`, `@reformer/rjsf-kit-theme`, `@reformer/kit-hexa-ui`;
   `npm run plugins:build -w reformer-builder-playground`; тесты четырёх доменов-плагинов (`base`,
   `forms`, `reformer`, `rjsf`); сборка и полный `npm run test -w @reformer/builder`.
5. Корень: `npm run typecheck`, `lint`, `format:check`, `knip`, `size`, `check:exports-dist`,
   `check:dist-deps`, `check:i18n-singleton`, `check:no-node-globals`, `check:peer-ranges`.
   Перегенерированные `llms.txt` и `llms-index.json` входят в изменения этапа.
6. e2e: `cd projects/react-playground-e2e && npx playwright test --project=complex-multy-step-form
   --project=complex-multy-step-form-renderer --project=complex-multy-step-form-json`, затем остальные
   проекты playground — без новых падений относительно базовой линии.

Дополнительно по этапам:

- этап 2 — `arrays.spec.ts` и `reorder.spec.ts`, документ JSON со старым именем компонента проходит
  проверку и рендерится;
- этап 4 — `validation.spec.ts`, `visual.spec.ts`, `accessibility.spec.ts` и проекты `validation`,
  `registration-form-json`, `file-upload`;
- этап 5 — проекты `html-nodes`, `imperative-handles`, `form-registry-lab`;
- этапы 6 и 8 — дымовой проход четырёх вариантов эталона по шести шагам: загрузка, условные секции,
  массивы, ошибка шага, отправка; при ошибке поля обработчик отправки не вызывается. Скриншоты —
  `projects/react-playground-e2e/screenshots/core-contract-2/<вариант>/<шаг>.png`.

## Критичные файлы

- `packages/reformer/src/form/create-form.ts`, `form/form-bundle.ts`, `form/validation/config.ts`
- `packages/reformer/src/form/types/contracts.ts`, `form/types/schema-node.ts`, `form/nodes/*`
- `packages/reformer/src/i18n/validation-message.ts`, `src/index.ts`, `src/i18n.ts`
- `packages/reformer-renderer-react/src/core/render-node.tsx`
- `packages/reformer-renderer-json/src/converter/json-to-render-schema.ts`
- `packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx`, `src/validation/error-resolver.tsx`
- `projects/react-playground/src/pages/demo/complex-multy-step-form/application/*`, `flow/*`, `validation/*`

## Замечено по дороге, в план не входит

Завести отдельными задачами:

- `useFormBundle` не вызывает `dispose`: очистка поведения в React не выполняется никогда;
- у ноды массива `status` не бывает `disabled`, хотя `disabled` становится `true`;
- JSDoc `getValue()` обещает пропуск отключённых полей, код их включает;
- `patchProps` и `onComponentEvent` действуют только на контейнеры, для полей и массивов молча
  игнорируются.
