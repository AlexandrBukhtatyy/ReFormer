## 2. API SIGNATURES

### Model & Form

```typescript
// Модель данных (источник истины значений)
createModel<T extends object>(initial: T): FormModel<T>
// model.get() / model.set(full) / model.patch(partial) / model.isDirty()
// model.reset() / model.captureInitial() / model.signalAt(path)
// model.$.field            → PathAwareSignal<FieldType>  (ручка: привязка в схеме, правиле, операторе)
// model.$.group.value      → снимок группы/массива; в dev заморожен — правка на месте бросает
// model.arrayField         → ModelArray<Item>            (push/insertAt/removeAt/move/swap/clear/at/map/length)
//   итерируем (for…of, spread); Object.keys — индексы; insertAt/move за концом — RangeError

// Сборка одним вызовом: модель, форма, уровень формы и дерево для рендера
createForm<T extends object>({
  initial | model,
  schema?: (model) => tree,          // билдер; JSON — документ + registry
  behavior?,                         // defineFormBehavior(...)
  validation?,                       // ValidationDefinition<T> | { rules?, extras?, strategy?, debounce? }
  flow?,                             // { steps: [{ id, rules? }] } — id = selector узла шага
  seed?, setup?,
}): FormBundle<T>
// bundle = { model, form, render, flow, validating, submission, validate, validateStep, dispose }
//   (+ служебное validation: { rules, controller } | undefined — его армирует useFormBundle)
// await bundle.validate()           → ValidationResult (вся форма; замечания показываются)
// await bundle.validateStep('loan') → ValidationResult (правила шага; неизвестный шаг — исключение)
// await bundle.submission.submit(handler) → SubmitResult<R> (один прогон; обработчик — только при valid)
// bundle.submission.submitting      → ReadonlySignal<boolean> (работает обработчик)
// bundle.flow?.next() / previous() / goTo(id) → FlowTransition
// bundle.render.tree                → CompiledSchema (см. 37-compiled-schema.md)
// bundle.dispose()                  → снять сборку: поведение, подписки нод, живую проверку;
//                                     идущие проверки — cancelled; модель остаётся; идемпотентно
// useFormBundle(() => createForm(…)) снимает сборку сам — при размонтировании компонента

// Отправка — отдельный объект сборки (`bundle.submission`)
interface FormSubmission<T> {
  readonly submitting: ReadonlySignal<boolean>; // работает обработчик; пока идёт проверка — false
  submit<R>(handler: (values: T) => R | Promise<R>): Promise<SubmitResult<R>>;
}
// Без сборки (визард в разметке без createForm): check: undefined — отправка без проверки
createSubmission<T>(dependencies: {
  check: (() => Promise<ActionCheck<T>>) | undefined; // ActionCheck = { result, values, stale }
  values: () => T;
}): FormSubmission<T>

// Низкоуровневая фабрика: форма из готовых модели и дерева, без уровня формы
createFormFromModel<T>({ model, schema?, behavior? }): FormGroup<T>
disposeForm<T>(form: FormGroup<T>): void // снять такую форму: поведение и подписки нод; модель остаётся
```

### Form nodes

Ноды строит сборка; прикладной код работает с ними через интерфейсы. Классов нод в публичном
API нет — вид ноды узнают гардами `isFormControl` / `isFormGroup` / `isFormArray`.

```typescript
interface FormNode<T> {
  readonly value: ReadonlySignal<T>;
  readonly valid: ReadonlySignal<boolean>;   // нет блокирующих замечаний, не disabled, не pending (у поля, группы и массива одинаково)
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>; // идёт async-правило
  readonly disabled: ReadonlySignal<boolean>;
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly issues: ReadonlySignal<readonly ValidationIssue[]>; // у группы и массива — свои и детей
  readonly ownIssues: ReadonlySignal<readonly ValidationIssue[]>; // только свои: правила на ручке группы/массива
  getValue(): T;
  setValue(value: T): void;                 // пишет в модель
  reset(value?: T): void;                   // значение и состояние — к начальным
  markAsTouched(): void;                    // у группы — каскадно
  markAsUntouched(): void;
  enable(): void;
  disable(): void;
  setIssues(issues: readonly ValidationIssue[]): void; // ответ сервера, своя проверка
  clearIssues(): void;
}

interface FormControl<T> extends FormNode<T> {
  readonly component: ComponentRef | undefined;
  readonly componentProps: ReadonlySignal<Readonly<Record<string, unknown>>>;
  // invalid && (touched || dirty) — состояние ошибки: aria-invalid, рамка
  readonly shouldShowError: ReadonlySignal<boolean>;
  // есть замечания (ошибки ИЛИ предупреждения) && (touched || dirty) — показ текстов замечаний
  readonly shouldShowIssues: ReadonlySignal<boolean>;
  updateComponentProps(patch: Record<string, unknown>): void;
}

interface FormArray<T extends object> extends FormNode<T[]> {
  readonly length: number;                  // число; чтение в эффекте/computed подписывает
  at(index: number): FormGroup<T> | undefined;
  map<R>(fn: (row: FormGroup<T>, index: number) => R): R[];
  forEach(fn: (row: FormGroup<T>, index: number) => void): void;
  keyAt(index: number): string;             // стабильный ключ строки — React `key`
  push(item?: T): void;                     // без значения — по шаблону arrayOf(blank)
  insert(index: number, item?: T): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
  swap(first: number, second: number): void;
  clear(): void;
}

// Группа: члены FormNode + ноды полей по именам + пространство `$` со всеми полями
type FormGroup<T> = FormNode<T> & /* поля по именам */ & { readonly $: FormFields<T> };
// form.email                — FormControl<string>
// form.address.city         — FormControl<string> (вложенная группа — FormGroup)
// form.items                — FormArray<Item> (массив объектов); form.tags — FormControl<string[]>
// form.$.value              — поле, затенённое членом FormNode (value, issues, reset, …)
```

Поле затеняют только члены `FormNode`: поле данных `value` берётся через `form.$.value`. Имена
`id`, `status`, `fields`, `submit` — обычные поля (`form.status`).

### Validators

Валидаторы — **чистые фабрики** из `@reformer/core/validators`: возвращают правило `Rule<T>` =
`(value: T) => ValidationIssue | null`. Передаются оператору `validate(sig, [required(), min(50000)])`
внутри схемы валидации, а **не** в схему формы.

```typescript
required(options?: RuleOptions)                       // Rule<unknown>
min(value: number, options?: RuleOptions)             // Rule<number | null | undefined>
max(value: number, options?: RuleOptions)
minLength(length: number, options?: RuleOptions)      // Rule<unknown>: строка либо массив
maxLength(length: number, options?: RuleOptions)
email(options?: RuleOptions)                          // Rule<string | null | undefined>
pattern(regex: RegExp, options?: RuleOptions)
url(options?: RuleOptions & { requireProtocol?: boolean; allowedProtocols?: string[] })
phone(options?: RuleOptions & { format?: PhoneFormat })
// Number validator factories — Rule<number | null | undefined>
isNumber(options?: RuleOptions)
integer(options?: RuleOptions)
multipleOf(divisor: number, options?: RuleOptions)
nonNegative(options?: RuleOptions)       // value >= 0
nonZero(options?: RuleOptions)            // value !== 0
// Date validator factories — Rule<string | Date | null | undefined>
isDate(options?: RuleOptions)
minDate(date: Date, options?: RuleOptions)
maxDate(date: Date, options?: RuleOptions)
pastDate(options?: RuleOptions)
futureDate(options?: RuleOptions)
minAge(years: number, options?: RuleOptions)
maxAge(years: number, options?: RuleOptions)
// File validator factories — Rule<unknown>: файл либо массив файлов
fileType(accept: string, options?: RuleOptions)
maxFileSize(bytes: number, options?: RuleOptions)
minFileSize(bytes: number, options?: RuleOptions)
maxFiles(count: number, options?: RuleOptions)
minFiles(count: number, options?: RuleOptions)
maxTotalFileSize(bytes: number, options?: RuleOptions)
```

Тип значения правила сверяется с типом поля: `validate(model.$.age, [email()])` для числового поля
не компилируется. Набор правил для поля объявляют типом поля — `Rule<LoanType>[]`,
`Rule<number | null>[]`: фабрики с более широким типом значения в него присваиваются.

`RuleOptions` — `{ code?: string; params?: Record<string, unknown> }`. Текста у правила нет:
замечание несёт только код и параметры (`ValidationIssue = { code, params?, severity? }`), а строку
по коду при отображении даёт словарь — словарь формы (`defineIssueMessages`), затем словарь локали
(`validation.<code>`): «Обязательное поле» под русской локалью, английская фраза без провайдера.
Текст конкретного поля — свой код (`required({ code: 'phone.required' })`) и запись в словаре
формы. Подробно — [36-issue-messages.md](./36-issue-messages.md).

Использование: схема формы привязывает поля к ручкам модели, правила живут отдельной
`ValidationDefinition` и уходят в сборку полем `validation`.

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, min, max, email } from '@reformer/core/validators';

interface Loan {
  email: string;
  age: number | null;
  amount: number | null;
}

// схема формы правил не несёт — только привязка поля к ручке модели + компонент
const loanSchema = (model: FormModel<Loan>): FormSchemaNode => ({
  children: [
    { model: model.$.email, component: Input },
    { model: model.$.age, component: InputNumber },
    { model: model.$.amount, component: InputNumber },
  ],
});

// правила — в ОТДЕЛЬНОЙ схеме валидации
const loanValidation = defineValidation<Loan>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.age, [required(), min(18)]);
  validate(model.$.amount, [min(0), max(1000)]);
});

const loan = createForm<Loan>({
  initial: { email: '', age: null, amount: null },
  schema: loanSchema,
  validation: loanValidation,
});

const result = await loan.validate(); // ValidationResult; замечания сами доедут до loan.form.<field>.issues
if (result.status === 'valid') send(loan.model.get());
```

### Custom & cross-field validators

Контракт валидации — `@reformer/core/validation`. Схема (`ValidationDefinition<T>`) — обычная функция
над (под)моделью; внутри вызываются операторы, которые сами пишут замечания в сток текущего прогона —
автор коллектора не видит.

```typescript
type Rule<T>      = (value: T) => ValidationIssue | null;
type AsyncRule<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<ValidationIssue | null>;

interface ValidationScope<T> {
  readonly model: FormModel<T>;
  // правило над несколькими полями: check получает снимок модели области
  cross(handle: PathAwareSignal<unknown>, check: (snapshot: T) => ValidationIssue | null): void;
}
type ValidationDefinition<T> = (scope: ValidationScope<T>) => void;
```

Операторы (валидны только внутри прогона схемы):

| Оператор | Назначение |
|---|---|
| `validate(sig, rules: Rule<T>[])` | синхронные правила поля |
| `validateAsync(sig, rules: AsyncRule<T>[])` | асинхронные правила (раннер дожидается, прокидывает `AbortSignal`) |
| `validateWhen(cond: () => boolean, cb: () => void)` | условная ветка: правила внутри активны/гасятся по `cond` (не трогает enable — это поведение) |
| `cross(sig, check)` из аргумента схемы | правило над несколькими полями; `check` получает снимок модели области, тип снимка выведен |
| `apply(model.$.group, schema)` | правила подформы: схема над типом группы подключается к ручке группы |
| `applyEach(model.$.items, schema)` | правила строк массива: схема над типом строки |
| `apply(...schemas: ValidationDefinition<T>[])` | композиция схем над той же моделью |
| `defineValidation<T>(fn): ValidationDefinition<T>` | тонкая identity-обёртка (типизация/discoverability) |

Прогон. В сборке — уровень формы (`bundle.validate()`, `bundle.validateStep(id)`,
`bundle.submission.submit(handler)`, см. [38-form-flow.md](./38-form-flow.md)). Без сборки — раннер
либо контроллер стратегии:

| Функция                                         | Что делает                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `validateModel(model, schema, { touch }?)`      | сбор + разнос; `true` только при статусе `valid`                                                                                           |
| `runValidation(model, schema)`                  | только сбор: `Promise<ValidationResult>`, ноды не трогает                                                                                  |
| `applyValidationResult(result, { touch }?)`     | разнос собранного результата по нодам формы                                                                                                |
| `createFormValidation(model, schema, options?)` | контроллер стратегии: `validate()`, `run(options?)`, `start()`, `dispose()` — см. [33-validation-strategy.md](./33-validation-strategy.md) |

```typescript
// Контроллер стратегии (@reformer/core/validation)
controller.validate(): Promise<boolean>; // нейтральная проверка: проверенные поля touched, фаза не меняется
controller.run(options?: FormValidationRunOptions): Promise<ValidationResult>;
interface FormValidationRunOptions {
  touch?: true | 'all'; // 'all' — при отказе (invalid, error) тронуть всю форму
  submit?: boolean;     // попытка отправки: переводит afterFirstSubmit в живую фазу
}

// Хук без сборки (@reformer/core/react)
useFormValidation({ model, schema, strategy?, debounce?, liveAfterSubmit? }): {
  submit: () => Promise<boolean>;   // попытка отправки: при отказе раскрыта вся форма
  validate: () => Promise<boolean>; // проверка без отправки: фаза afterFirstSubmit не меняется
  isValidating: boolean;
}
```

```typescript
type ValidationStatus = 'valid' | 'invalid' | 'cancelled' | 'error';

interface ValidationResult {
  readonly status: ValidationStatus;
  /** Замечания по ручке поля `model.$.…`; путь — `handle.__path`. */
  readonly issues: ReadonlyMap<PathAwareSignal<unknown>, readonly ValidationIssue[]>;
  /** Правила, которые не вернули результат (сеть, исключение). */
  readonly failures: readonly { handle: PathAwareSignal<unknown>; error: unknown }[];
}
```

- `valid` — блокирующих замечаний нет (`severity: 'warning'` не блокирует);
- `invalid` — есть блокирующие замечания;
- `error` — async-правило не вернуло результат: сбой **блокирует**, на поле ставится замечание
  `{ code: 'ruleFailed' }` («Не удалось проверить поле. Повторите попытку»), причина — в `failures`;
- `cancelled` — прогон вытеснен более новым по той же паре (модель, схема); такой результат не
  разносится.

`validateModel` отвечает `false` на всё, кроме `valid`. Различить замечания, сбой и отмену —
`bundle.validate()` сборки либо `runValidation`:

```typescript
const result = await bundle.validate();
if (result.status === 'error') showToast('Не удалось проверить форму, повторите попытку');
```

Пока идут async-правила поля, его нода в состоянии `pending` (`form.email.pending.value`).

Кастомные правила, cross-field и async — в схеме:

```typescript
import { type ValidationIssue } from '@reformer/core';
import {
  defineValidation, validate, validateAsync,
  type Rule, type AsyncRule,
} from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

interface Signup {
  password: string;
  confirm: string;
  email: string;
}

// Правило значения (Rule<T>)
const strongPassword: Rule<string> = (value) =>
  value.length < 8 ? { code: 'password.weak', params: { minLength: 8 } } : null;

// Правило над несколькими полями: обычная функция над снимком модели
const passwordsMatch = (signup: Signup): ValidationIssue | null =>
  signup.confirm && signup.password && signup.confirm !== signup.password
    ? { code: 'confirm.mismatch' }
    : null;

// Async (AsyncRule<T>): получает { signal }. Отклонённый промис — сбой правила: прогон получает
// статус `error`, поле — замечание `ruleFailed`. Если сетевой сбой не должен блокировать отправку,
// перехвати его в правиле и верни `null`.
const emailUnique: AsyncRule<string> = async (value, { signal }) => {
  if (!value) return null;
  const response = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`, { signal });
  return (await response.json()).available
    ? null
    : { code: 'email.taken' };
};

const signupValidation = defineValidation<Signup>(({ model, cross }) => {
  validate(model.$.password, [required(), strongPassword]);
  validate(model.$.confirm, [required()]);
  cross(model.$.confirm, passwordsMatch); // замечание вешается на confirm
  validateAsync(model.$.email, [emailUnique]);
});
// Тексты кодов 'password.weak', 'confirm.mismatch', 'email.taken' — в словаре формы
// (defineIssueMessages), см. 36-issue-messages.md
```

> `cross` берётся только из аргумента схемы: из `@reformer/core/validation` он не импортируется.

### Conditional & array validation

Условные ветки, подформы и массивы — операторы внутри схемы (не узлы дерева):

- **условная ветка** `validateWhen(() => cond, () => { validate(...) })` — правила внутри активны только
  при истинном условии; при ложном замечания полей ветки гасятся. Enable/сброс поля — дело поведения;
- **подформа** `apply(model.$.group, groupRules)` — схема над типом группы; принимает и массив ручек;
- **массив** `applyEach(model.$.items, rowRules)` — схема над типом строки применяется к каждой строке;
- **композиция** `apply(...schemas)` — объединяет схемы над той же моделью.

У схемы, подключённой через `apply(ручка, схема)` / `applyEach`, своя область: `model` — под-модель,
`cross` получает её снимок.

```typescript
import {
  apply, applyEach, defineValidation, validate, validateWhen,
} from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

// Условная валидация — ипотечная ветка активна только при loanType === 'mortgage'
const loanRules = defineValidation<LoanForm>(({ model }) => {
  validate(model.$.loanType, [required()]);
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [required(), min(1_000_000)]);
      validate(model.$.initialPayment, [required()]);
    },
  );
});

// Правила строки массива — отдельная схема над типом строки
const coBorrowerRules = defineValidation<CoBorrower>(({ model, cross }) => {
  validate(model.$.income, [required(), min(10_000)]);
  cross(model.$.income, (coBorrower) =>
    coBorrower.income < coBorrower.loanShare ? { code: 'income.tooLow' } : null);
});

const additionalRules = defineValidation<LoanForm>(({ model }) => {
  applyEach(model.$.coBorrowers, coBorrowerRules);
});
```

Пошаговая и полная валидация — поток шагов сборки: `flow.steps[].id` — `selector` шага в схеме,
`validation.extras` — правила вне шагов.

```typescript
const loan = createForm<LoanForm>({
  initial,
  schema: loanSchema,
  validation: { extras: crossStepRules }, // правила всей формы — проверяются только целиком
  flow: {
    steps: [
      { id: 'loan', rules: loanRules }, // id = selector узла шага
      { id: 'additional', rules: additionalRules },
    ],
  },
});

await loan.validateStep('loan'); // правила одного шага → ValidationResult
await loan.validate(); // все шаги + extras → ValidationResult
await loan.flow?.next(); // проверить текущий шаг и перейти → FlowTransition
loan.validating.value; // идёт ли проверка — полная либо шага
```

Подробно — [13-multi-step.md](./13-multi-step.md) и [38-form-flow.md](./38-form-flow.md).

### Behaviors

**Поведение формы — декларативный DSL из `@reformer/core/behaviors`** (регистрирует cleanup сам,
передаётся в `createForm({ behavior })`):

```typescript
import { defineFormBehavior, compute, enableWhen, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model, form }) => {
  compute(model.$.total, () => model.price * model.quantity);
  enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true });
  onChange(model.$.country, async (country) => {
    form.city.updateComponentProps({ options: await loadCities(country) });
  });
});

const { form } = createForm<MyForm>({ initial, schema, behavior });
```

Область поведения — `{ model, form, schema, flow }`: `schema` адресует узлы своей области
(`schema.node(selector)`), `flow` — поток шагов сборки (без `flow` в конфиге — `undefined`).

DSL-операторы: `compute` (auto-tracking, без явного списка источников), `computeFrom`, `copyFrom`,
`onChange` (реакция на изменение; `{ debounce, immediate }`, 2-й аргумент колбэка — `{ signal }` AbortSignal),
`enableWhen`/`disableWhen`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`,
`apply` (поведение подформы), `applyEach` (поведение строки массива), `exclusiveFlag`, `aggregateInto`;
операторы узлов схемы — `hideWhen`, `onComponentEvent`, `onMount`, `onUnmount`, `onInit`, `renderEffect`.
См. `20-compute-vs-watch.md`.

- `copyFrom` групп разной формы — как `set` группы модели: поля цели, которых нет в значении
  источника, остаются прежними; в dev — одно предупреждение на оператор. Значение цели целиком
  собирает `transform`.
- `exclusiveFlag`: выбор строки (флаг стал `true`) снимает флаг у остальных. Строка, пришедшая с
  `true` (начальные данные, добавленная), прежний выбор не снимает — флаг сбрасывается у неё; из
  нескольких пришедших сразу остаётся первая.
- Ручка не того вида — в dev ошибка с путём: `applyEach` / `exclusiveFlag` / `aggregateInto` ждут
  массив, `apply` — группу. `enableWhen` / `disableWhen` на поле без ноды формы ничего не делают;
  в dev — предупреждение.

**Примитивы над сигналами — `@reformer/core/model`** (принимают сигналы, возвращают cleanup; в корне
`@reformer/core` их нет). Нужны вне формы — там, где нет области поведения:

```typescript
computeFrom(sources: ReadonlySignal[], target: Signal, fn: (...vals) => R, options?: { when?: (...vals) => boolean }): () => void
copyFrom(source: ReadonlySignal, target: Signal, options?: { when?: () => boolean; transform?: (v) => v }): () => void
watchField(source: ReadonlySignal, cb: (value) => void, options?: { immediate?: boolean }): () => void
transformValue(target: Signal, transformer: (value) => value): () => void
resetWhen(target: Signal, condition: () => boolean, options?: { resetValue?: T }): () => void
syncFields(a: Signal, b: Signal, options?: { transform?: (v) => v }): () => void
revalidateWhen(deps: ReadonlySignal[], revalidate: () => void): () => void
```

Утилиты значений там же, в `@reformer/core/model`:

```typescript
// сравнение значений модели: объекты и массивы — по содержимому, даты — по времени, NaN равен себе;
// на нём стоят isDirty и сверка «модель изменилась, пока шла проверка» при отправке и переходе шага
deepEqual(first: unknown, second: unknown): boolean
// дождаться отложенных записей поведения текущего тика (onChange, resetOnDisable);
// undefined — ждать нечего
deferredWritesSettled(): Promise<void> | undefined
```

```typescript
import { computeFrom, copyFrom } from '@reformer/core/model';

const cleanups = [
  computeFrom([model.$.price, model.$.quantity], model.$.total, (price, quantity) => price * quantity),
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true }),
];
// при teardown: cleanups.forEach((cleanup) => cleanup());
```

`enableWhen` / `disableWhen` работают с состоянием ноды формы и существуют только как операторы
поведения (`@reformer/core/behaviors`).

Поведение **не владеет** валидацией — это отдельный слой. Мост «поведение инициирует валидацию» — через
`revalidateWhen`, который просто вызывает внешний раннер валидации:

```typescript
revalidateWhen([model.$.dep], () => void validateModel(model, schema));
```
