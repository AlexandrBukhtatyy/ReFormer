## 2. API SIGNATURES

### Model & Form

```typescript
// Модель данных (источник истины значений)
createModel<T extends object>(initial: T): FormModel<T>
// model.get() / model.set(full) / model.patch(partial) / model.isDirty()
// model.reset() / model.captureInitial() / model.signalAt(path)
// model.$.field            → PathAwareSignal<FieldType>  (escape-hatch к сигналу)
// model.arrayField         → ModelArray<Item>            (push/removeAt/insertAt/move/swap/clear/at/map/length)

// Форма (ноды поверх сигналов модели)
createForm<T>({ model, schema, behavior? }): FormProxy<T>
// form.<field>             → FieldNode / GroupNode / FormArrayProxy
// form.<field>.setValue(v) / .value.value / .errors.value / .disabled.value
// form.<field>.enable() / .disable() / .reset() / .markAsTouched() / .setErrors([...])
// form.<field>.updateComponentProps({ ... })

// Валидация данных — ОТДЕЛЬНЫЙ контракт `@reformer/core/validation` (НЕ дерево createForm: то несёт
// только layout, без validators). Схема — функция над моделью; внешний раннер разносит ошибки по нодам
// формы (setErrors), warning не блокирует submit, устаревший прогон отменяется.
validateModel<T>(model: FormModel<T>, schema: ValidationSchema<T>): Promise<boolean>   // из @reformer/core/validation
// schema = defineValidationSchema<T>(({ model }) => { validate(...); ... })
// ⚠️ form.submit() / form.validate() БОЛЬШЕ НЕ прогоняют schema-валидацию — гоняйте validateModel(model, schema) снаружи.
```

### Validators

Валидаторы — **чистые фабрики** из `@reformer/core/validators`: возвращают правило `Rule<T>` =
`(value) => ValidationError | null` (принимают nullable value). Передаются оператору
`validate(sig, [required(), min(50000)])` внутри схемы валидации, а **не** в layout-дерево `createForm`.

```typescript
required(options?: { message?: string })
min(value: number, options?: { message?: string })
max(value: number, options?: { message?: string })
minLength(length: number, options?: { message?: string })
maxLength(length: number, options?: { message?: string })
email(options?: { message?: string })
pattern(regex: RegExp, options?: { message?: string })
url(options?: { message?: string; requireProtocol?: boolean })
phone(options?: { message?: string; format?: PhoneFormat })
// Number validator factories
isNumber(options?: { message?: string })
integer(options?: { message?: string })
multipleOf(divisor: number, options?: { message?: string })
nonNegative(options?: { message?: string })       // value >= 0
nonZero(options?: { message?: string })            // value !== 0
// Date validator factories
isDate(options?: { message?: string })
minDate(date: Date | string, options?: { message?: string })
maxDate(date: Date | string, options?: { message?: string })
pastDate(options?: { message?: string })
futureDate(options?: { message?: string })
minAge(years: number, options?: { message?: string })
maxAge(years: number, options?: { message?: string })
```

Использование: layout-дерево `createForm` привязывает поля к сигналам, правила живут отдельной
`ValidationSchema` и гоняются раннером `validateModel` по требованию.

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, min, max, email } from '@reformer/core/validators';

type Loan = { email: string; age: number; amount: number };
const model = createModel<Loan>({ email: '', age: 0, amount: 0 });

// layout-схема createForm НЕ несёт validators — только привязка поля к сигналу + компонент
const form = createForm({
  model,
  schema: {
    email:  { value: model.$.email,  component: Input },
    age:    { value: model.$.age,    component: Input },
    amount: { value: model.$.amount, component: Input },
  },
});

// правила — в ОТДЕЛЬНОЙ схеме валидации (не в layout)
const loanValidation = defineValidationSchema<Loan>(({ model }) => {
  validate(model.$.email,  [required(), email()]);
  validate(model.$.age,    [required(), min(18)]);
  validate(model.$.amount, [min(0), max(1000)]);
});

const ok = await validateModel(model, loanValidation);   // Promise<boolean>; ошибки сами доедут до form.<field>.errors
```

### Custom & cross-field validators

Контракт валидации — `@reformer/core/validation`. Схема (`ValidationSchema<T>`) — обычная функция над
(под)моделью; внутри вызываются свободные операторы, которые сами пишут ошибки в ноды текущего прогона
(`getNodeForSignal(sig).setErrors(...)` — автор коллектора не видит).

```typescript
type Rule<T>      = (value: T, scope: never, root: never) => ValidationError | null;   // scope/root = never (см. ниже)
type AsyncRule<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<ValidationError | null>;
type ValidationSchema<T> = (ctx: { model: FormModel<T> }) => void;
```

Операторы (ambient — валидны только внутри прогона `validateModel`):

| Оператор | Назначение |
|---|---|
| `validate(sig, rules: Rule<T>[])` | синхронные правила поля |
| `validateAsync(sig, rules: AsyncRule<T>[])` | асинхронные правила (раннер дожидается, прокидывает `AbortSignal`) |
| `validateWhen(cond: () => boolean, cb: () => void)` | условная ветка: правила внутри активны/гасятся по `cond` (не трогает enable — это поведение) |
| `cross(sig, fn: (form) => err \| null)` | cross-field; `fn` получает снапшот модели текущего scope (`model.get()`) |
| `each(arr, itemFn: (im: FormModel<U>) => void)` | per-item по элементам массива модели |
| `apply(...schemas: ValidationSchema<T>[])` | композиция под-схем над той же моделью |
| `defineValidationSchema<T>(fn): ValidationSchema<T>` | тонкая identity-обёртка (типизация/discoverability) |
| `validateModel<T>(model, schema): Promise<boolean>` | внешний раннер (warning не блокирует, устаревший прогон отменяется) |

> `Rule<T>` намеренно несёт `scope: never, root: never` — так value-only фабрики (`required()` = `(value, model, root)`)
> и inline `(value) => err` ОБА присваиваются в `Rule<T>[]`, сохраняя проверку типа поля
> (`validate(model.$.age, [email()])` подсветится). Ментальная модель автора — `(value) => error`.

Кастомные правила, cross-field и async — в схеме:

```typescript
import { type ValidationError } from '@reformer/core';
import {
  defineValidationSchema, validate, validateAsync, cross,
  type Rule, type AsyncRule,
} from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

type Signup = { password: string; confirm: string; email: string };

// Value-only правило (Rule<T>)
const strongPassword: Rule<string> = (value) =>
  !value || value.length < 8 ? { code: 'too-short', message: 'Минимум 8 символов' } : null;

// Cross-field: обычная функция над снапшотом модели (model.get()), вешается через cross(sig, fn)
const passwordsMatch = (f: Signup): ValidationError | null =>
  f.confirm && f.password && f.confirm !== f.password
    ? { code: 'mismatch', message: 'Пароли не совпадают' }
    : null;

// Async (AsyncRule<T>): получает { signal }; сетевой сбой → null (submit не блокируется)
const emailUnique: AsyncRule<string> = async (value, { signal }) => {
  if (!value) return null;
  try {
    const res = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`, { signal });
    return (await res.json()).available ? null : { code: 'taken', message: 'Email уже зарегистрирован' };
  } catch {
    return null;
  }
};

const signupValidation = defineValidationSchema<Signup>(({ model }) => {
  validate(model.$.password, [required(), strongPassword]);
  validate(model.$.confirm, [required()]);
  cross(model.$.confirm, passwordsMatch);        // ошибка вешается на confirm
  validateAsync(model.$.email, [emailUnique]);
});
```

### Conditional & array validation

Условные ветки и массивы — операторы `validateWhen` / `each` / `apply` внутри схемы (не узлы дерева):

- **условная ветка** `validateWhen(() => cond, () => { validate(...) })` — правила внутри активны только
  при истинном условии; при ложном ошибки полей ветки гасятся (`setErrors([])`). Enable/сброс поля — дело поведения;
- **массив** `each(model.arr, (im) => { validate(im.$.field, [...]) })` — правила применяются к каждому
  элементу; `im` — под-модель элемента. Для cross-field над элементом захватывайте снапшот в замыкание (`const item = im.get()`);
- **композиция** `apply(...schemas)` — объединяет под-схемы над той же моделью (напр. полную схему из per-step).

```typescript
import {
  defineValidationSchema, validate, validateWhen, cross, each, apply, validateModel,
} from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';

// Условная валидация — ипотечная ветка активна только при loanType === 'mortgage'
const step1 = defineValidationSchema<LoanForm>(({ model }) => {
  validate(model.$.loanType, [required()]);
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [required(), min(1_000_000)]);
      validate(model.$.initialPayment, [required()]);
    },
  );
});

// Per-item валидация элементов массива (each над ModelArray)
const step5 = defineValidationSchema<LoanForm>(({ model }) => {
  each(model.coBorrowers, (im) => {
    const item = im.get();                          // снапшот элемента для cross
    validate(im.$.income, [required(), min(10_000)]);
    cross(im.$.income, () =>
      item.income < item.loanShare ? { code: 'tooLow', message: 'Доход ниже доли' } : null);
  });
});

// Полная схема формы = композиция шагов (apply над той же моделью)
const formValidation = defineValidationSchema<LoanForm>(() => apply(step1, step5));
```

Wizard-конфиг (per-step + полная валидация) — поверх того же раннера `validateModel`:

```typescript
const STEP_SCHEMAS = [step1, /* step2, … */ step5] as const;

function makeValidationConfig(model: FormModel<LoanForm>) {
  return {
    validateStep: (n: number) => validateModel(model, STEP_SCHEMAS[n - 1]),
    validateAll: () => validateModel(model, formValidation),   // formValidation = apply(...STEP_SCHEMAS, extras)
  };
}
```

Операторы `validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply` экспортируются напрямую из
`@reformer/core/validation` — это публичный API, а не локальный сахар примера.

### Behaviors

Два способа. **Примитивы из `@reformer/core`** (принимают сигналы, возвращают cleanup):

```typescript
computeFrom(sources: ReadonlySignal[], target: Signal, fn: (...vals) => R, options?: { when?: (...vals) => boolean }): () => void
copyFrom(source: ReadonlySignal, target: Signal, options?: { when?: () => boolean; transform?: (v) => v }): () => void
watchField(source: ReadonlySignal, cb: (value) => void, options?: { immediate?: boolean }): () => void
enableWhen(target: ReadonlySignal, condition: () => boolean, options?: { resetOnDisable?: boolean }): () => void
disableWhen(target: ReadonlySignal, condition: () => boolean, options?: { resetOnDisable?: boolean }): () => void
transformValue(target: Signal, transformer: (value) => value): () => void
resetWhen(target: Signal, condition: () => boolean, options?: { resetValue?: T }): () => void
syncFields(a: Signal, b: Signal, options?: { transform?: (v) => v }): () => void
revalidateWhen(deps: ReadonlySignal[], revalidate: () => void): () => void
```

```typescript
import { computeFrom, enableWhen, copyFrom } from '@reformer/core';

const cleanups = [
  computeFrom([model.$.price, model.$.quantity], model.$.total, (p, q) => p * q),
  enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true }),
  copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true }),
];
// при teardown: cleanups.forEach((c) => c());
```

**Декларативный DSL из `@reformer/core/behaviors`** (регистрирует cleanup сам, передаётся в `createForm({ behavior })`):

```typescript
import { defineFormBehavior, compute, enableWhen, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model, form }) => {
  compute(model.$.total, () => model.price * model.quantity);
  enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true });
  onChange(model.$.country, async (country) => {
    form.city.updateComponentProps({ options: await loadCities(country) });
  });
});

const form = createForm({ model, schema, behavior });
```

DSL-операторы: `compute` (auto-tracking, без явного списка источников), `computeFrom`, `copyFrom`,
`onChange` (реакция на изменение; `{ debounce, immediate }`, 2-й аргумент колбэка — `{ signal }` AbortSignal),
`enableWhen`/`disableWhen`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`,
`apply` (под-схема для группы), `applyEach` (per-item для массива), `exclusiveFlag`, `aggregateInto`.
См. `20-compute-vs-watch.md`.

Поведение **не владеет** валидацией — это отдельный слой. Мост «поведение инициирует валидацию» — через
`revalidateWhen`, который просто вызывает внешний раннер валидации:

```typescript
revalidateWhen([model.$.dep], () => void validateModel(model, schema));
```
