## 2. API SIGNATURES

### Model & Form

```typescript
// Модель данных (источник истины значений)
createModel<T extends object>(initial: T): FormModel<T>
// model.get() / model.set(full) / model.patch(partial) / model.isDirty()
// model.reset() / model.captureInitial() / model.signalAt(path)
// model.$.field            → PathAwareSignal<FieldType>  (ручка: привязка в схеме, правиле, операторе)
// model.arrayField         → ModelArray<Item>            (push/removeAt/insertAt/move/swap/clear/at/map/length)

// Сборка одним вызовом: модель, форма, валидация и дерево для рендера
createForm<T>({ initial | model, schema: (model) => tree, behavior?, validation? }): FormBundle<T>
// bundle = { model, form, validation, render }

// Низкоуровневая фабрика: форма из готовых модели и дерева
createFormFromModel<T>({ model, schema, behavior? }): FormProxy<T>
// form.<field>             → FieldNode / GroupNode / ModelArrayNode
// form.<field>.setValue(v) / .value.value / .errors.value / .disabled.value / .pending.value
// form.<field>.enable() / .disable() / .reset() / .markAsTouched() / .setErrors([...])
// form.<field>.updateComponentProps({ ... })

// Валидация данных — ОТДЕЛЬНЫЙ контракт `@reformer/core/validation`: схема формы правил не несёт.
// Схема валидации — функция над моделью; раннер собирает результат и разносит ошибки по нодам формы.
validateModel<T>(model, schema, options?: { touch?: boolean }): Promise<boolean>
runValidation<T>(model, schema): Promise<ValidationResult>          // только сбор, ноды не трогает
applyValidationResult(result, options?: { touch?: boolean }): void  // разнос по нодам
// schema = defineValidationSchema<T>(({ model, cross }) => { validate(...); ... })
// ⚠️ form.submit() / form.validate() правил НЕ запускают: они отражают ошибки, которые уже разнёс
//    раннер. Перед отправкой — validation.validateAll() сборки либо validateModel(model, schema).
```

### Validators

Валидаторы — **чистые фабрики** из `@reformer/core/validators`: возвращают правило `Rule<T>` =
`(value: T) => ValidationError | null`. Передаются оператору `validate(sig, [required(), min(50000)])`
внутри схемы валидации, а **не** в схему формы.

```typescript
required(options?: { message?: string })                       // Rule<unknown>
min(value: number, options?: { message?: string })             // Rule<number | null | undefined>
max(value: number, options?: { message?: string })
minLength(length: number, options?: { message?: string })      // Rule<unknown>: строка либо массив
maxLength(length: number, options?: { message?: string })
email(options?: { message?: string })                          // Rule<string | null | undefined>
pattern(regex: RegExp, options?: { message?: string })
url(options?: { message?: string; requireProtocol?: boolean })
phone(options?: { message?: string; format?: PhoneFormat })
// Number validator factories — Rule<number | null | undefined>
isNumber(options?: { message?: string })
integer(options?: { message?: string })
multipleOf(divisor: number, options?: { message?: string })
nonNegative(options?: { message?: string })       // value >= 0
nonZero(options?: { message?: string })            // value !== 0
// Date validator factories — Rule<string | Date | null | undefined>
isDate(options?: { message?: string })
minDate(date: Date | string, options?: { message?: string })
maxDate(date: Date | string, options?: { message?: string })
pastDate(options?: { message?: string })
futureDate(options?: { message?: string })
minAge(years: number, options?: { message?: string })
maxAge(years: number, options?: { message?: string })
```

Тип значения правила сверяется с типом поля: `validate(model.$.age, [email()])` для числового поля
не компилируется. Набор правил для поля объявляют типом поля — `Rule<LoanType>[]`,
`Rule<number | null>[]`: фабрики с более широким типом значения в него присваиваются.

Кроме `message`, каждое правило принимает `messageKey` (ключ словаря приложения) и `params`.
Без `message` правило текст в ошибку не кладёт (`ValidationError.message` необязателен), а при
отображении он берётся из словаря локали по коду (`validation.<code>`): «Обязательное поле» под
русской локалью, английская фраза без провайдера. Явное `message` важнее словаря, но языком не
переключается; для локализуемого текста — `messageKey`. Подробно — [34-i18n.md](./34-i18n.md).

Использование: схема формы привязывает поля к ручкам модели, правила живут отдельной
`ValidationSchema` и запускаются раннером по требованию.

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, min, max, email } from '@reformer/core/validators';

type Loan = { email: string; age: number | null; amount: number | null };

// схема формы правил не несёт — только привязка поля к ручке модели + компонент
const loanSchema = (model: FormModel<Loan>): FormSchemaNode => ({
  children: [
    { model: model.$.email, component: Input },
    { model: model.$.age, component: InputNumber },
    { model: model.$.amount, component: InputNumber },
  ],
});

// правила — в ОТДЕЛЬНОЙ схеме валидации
const loanValidation = defineValidationSchema<Loan>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.age, [required(), min(18)]);
  validate(model.$.amount, [min(0), max(1000)]);
});

const { model, form, validation } = createForm<Loan>({
  initial: { email: '', age: null, amount: null },
  schema: loanSchema,
  validation: loanValidation,
});

const ok = await validation.validateAll(); // Promise<boolean>; ошибки сами доедут до form.<field>.errors
```

### Custom & cross-field validators

Контракт валидации — `@reformer/core/validation`. Схема (`ValidationSchema<T>`) — обычная функция
над (под)моделью; внутри вызываются операторы, которые сами пишут ошибки в сток текущего прогона —
автор коллектора не видит.

```typescript
type Rule<T>      = (value: T) => ValidationError | null;
type AsyncRule<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<ValidationError | null>;

interface ValidationScope<T> {
  readonly model: FormModel<T>;
  // правило над несколькими полями: check получает снимок модели области
  cross(handle: PathAwareSignal<unknown>, check: (snapshot: T) => ValidationError | null): void;
}
type ValidationSchema<T> = (scope: ValidationScope<T>) => void;
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
| `apply(...schemas: ValidationSchema<T>[])` | композиция схем над той же моделью |
| `defineValidationSchema<T>(fn): ValidationSchema<T>` | тонкая identity-обёртка (типизация/discoverability) |

Раннер:

| Функция | Что делает |
|---|---|
| `validateModel(model, schema, { touch }?)` | сбор + разнос; `true` только при статусе `valid` |
| `runValidation(model, schema)` | только сбор: `Promise<ValidationResult>`, ноды не трогает |
| `applyValidationResult(result, { touch }?)` | разнос собранного результата по нодам формы |

```typescript
type ValidationStatus = 'valid' | 'invalid' | 'cancelled' | 'error';

interface ValidationResult {
  readonly status: ValidationStatus;
  /** Ошибки по ручке поля `model.$.…`; путь — `handle.__path`. */
  readonly errors: ReadonlyMap<PathAwareSignal<unknown>, readonly ValidationError[]>;
  /** Правила, которые не вернули результат (сеть, исключение). */
  readonly failures: readonly { handle: PathAwareSignal<unknown>; error: unknown }[];
}
```

- `valid` — блокирующих ошибок нет (`severity: 'warning'` не блокирует);
- `invalid` — есть блокирующие ошибки;
- `error` — async-правило не вернуло результат: сбой **блокирует**, на поле ставится ошибка
  `{ code: 'ruleFailed' }` («Не удалось проверить поле. Повторите попытку»), причина — в `failures`;
- `cancelled` — прогон вытеснен более новым по той же паре (модель, схема); такой результат не
  разносится.

`validateModel` отвечает `false` на всё, кроме `valid`. Различить ошибки, сбой и отмену —
`runValidation` либо `validation.runAll()` / `validation.runStep(step)` сборки формы:

```typescript
const result = await validation.runAll();
if (result.status === 'error') showToast('Не удалось проверить форму, повторите попытку');
```

Пока идут async-правила поля, его нода в состоянии `pending` (`form.email.pending.value`).

Кастомные правила, cross-field и async — в схеме:

```typescript
import { type ValidationError } from '@reformer/core';
import {
  defineValidationSchema, validate, validateAsync,
  type Rule, type AsyncRule,
} from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type Signup = { password: string; confirm: string; email: string };

// Правило значения (Rule<T>)
const strongPassword: Rule<string> = (value) =>
  value.length < 8 ? { code: 'too-short', message: 'Минимум 8 символов' } : null;

// Правило над несколькими полями: обычная функция над снимком модели
const passwordsMatch = (signup: Signup): ValidationError | null =>
  signup.confirm && signup.password && signup.confirm !== signup.password
    ? { code: 'mismatch', message: 'Пароли не совпадают' }
    : null;

// Async (AsyncRule<T>): получает { signal }. Отклонённый промис — сбой правила: прогон получает
// статус `error`, поле — ошибку `ruleFailed`. Если сетевой сбой не должен блокировать отправку,
// перехвати его в правиле и верни `null`.
const emailUnique: AsyncRule<string> = async (value, { signal }) => {
  if (!value) return null;
  const response = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`, { signal });
  return (await response.json()).available
    ? null
    : { code: 'taken', message: 'Email уже зарегистрирован' };
};

const signupValidation = defineValidationSchema<Signup>(({ model, cross }) => {
  validate(model.$.password, [required(), strongPassword]);
  validate(model.$.confirm, [required()]);
  cross(model.$.confirm, passwordsMatch); // ошибка вешается на confirm
  validateAsync(model.$.email, [emailUnique]);
});
```

> Свободный `cross`, импортированный из `@reformer/core/validation`, оставлен для совместимости и
> помечен `@deprecated`: тип снимка у него не выводится. Бери `cross` из аргумента схемы.

### Conditional & array validation

Условные ветки, подформы и массивы — операторы внутри схемы (не узлы дерева):

- **условная ветка** `validateWhen(() => cond, () => { validate(...) })` — правила внутри активны только
  при истинном условии; при ложном ошибки полей ветки гасятся. Enable/сброс поля — дело поведения;
- **подформа** `apply(model.$.group, groupRules)` — схема над типом группы; принимает и массив ручек;
- **массив** `applyEach(model.$.items, rowRules)` — схема над типом строки применяется к каждой строке;
- **композиция** `apply(...schemas)` — объединяет схемы над той же моделью.

У схемы, подключённой через `apply(ручка, схема)` / `applyEach`, своя область: `model` — под-модель,
`cross` получает её снимок.

```typescript
import {
  apply, applyEach, defineValidationSchema, validate, validateWhen,
} from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

// Условная валидация — ипотечная ветка активна только при loanType === 'mortgage'
const loanRules = defineValidationSchema<LoanForm>(({ model }) => {
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
const coBorrowerRules = defineValidationSchema<CoBorrower>(({ model, cross }) => {
  validate(model.$.income, [required(), min(10_000)]);
  cross(model.$.income, (coBorrower) =>
    coBorrower.income < coBorrower.loanShare ? { code: 'tooLow', message: 'Доход ниже доли' } : null);
});

const additionalRules = defineValidationSchema<LoanForm>(({ model }) => {
  applyEach(model.$.coBorrowers, coBorrowerRules);
});
```

Пошаговая и полная валидация — поле `validation` сборки: ключ `steps` — `selector` шага в схеме.

```typescript
const { validation } = createForm<LoanForm>({
  initial,
  schema: loanSchema,
  validation: {
    steps: { loan: loanRules, additional: additionalRules }, // ключ = selector шага
    extras: crossStepRules, // правила всей формы — проверяются только целиком
  },
});

await validation.validateStep('loan');   // правила одного шага: по селектору либо по номеру (с 1)
await validation.validateAll();          // все шаги + extras
await validation.runStep('loan');        // то же с полным результатом (ValidationResult)
validation.validating.value;             // идёт ли прогон — полный либо шага
```

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

DSL-операторы: `compute` (auto-tracking, без явного списка источников), `computeFrom`, `copyFrom`,
`onChange` (реакция на изменение; `{ debounce, immediate }`, 2-й аргумент колбэка — `{ signal }` AbortSignal),
`enableWhen`/`disableWhen`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`,
`apply` (поведение подформы), `applyEach` (поведение строки массива), `exclusiveFlag`, `aggregateInto`;
операторы узлов схемы — `hideWhen`, `onComponentEvent`, `onMount`, `onUnmount`, `onInit`, `renderEffect`.
См. `20-compute-vs-watch.md`.

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
