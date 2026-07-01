## 2. API SIGNATURES

### Model & Form

```typescript
// Модель данных (источник истины значений)
createModel<T extends object>(initial: T): FormModel<T>
// model.get() / model.set(partial) / model.patch(partial) / model.isDirty()
// model.reset() / model.captureInitial() / model.signalAt(path)
// model.$.field            → PathAwareSignal<FieldType>  (escape-hatch к сигналу)
// model.arrayField         → ModelArray<Item>            (push/removeAt/insertAt/move/swap/clear/at/map/length)

// Форма (ноды поверх сигналов модели)
createForm<T>({ model, schema, behavior? }): FormProxy<T>
// form.<field>             → FieldNode / GroupNode / FormArrayProxy
// form.<field>.setValue(v) / .value.value / .errors.value / .disabled.value
// form.<field>.enable() / .disable() / .reset() / .markAsTouched() / .setErrors([...])
// form.<field>.updateComponentProps({ ... })

// Валидация данных (headless). schema — то же дерево, что в createForm.
validateFormModel<T>(model, schema): Promise<{ valid: boolean; errors: Record<string, ValidationError[]> }>
validateModel<T>(model, schema): Promise<{ valid; errors }>       // без роутинга ошибок в ноды
validateModelSync<T>(model, schema): { valid; errors }             // async-валидаторы пропускаются
```

### Validators

Валидаторы — **чистые фабрики**: возвращают функцию `(value) => ValidationError | null`.
Кладутся в поле схемы как массив `validators: [required(), min(50000)]`.

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

Использование в схеме:

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, min, max, email } from '@reformer/core/validators';

const model = createModel<{ email: string; age: number; amount: number }>({
  email: '', age: 0, amount: 0,
});

const schema = {
  email:  { value: model.$.email,  component: Input, validators: [required(), email()] },
  age:    { value: model.$.age,    component: Input, validators: [required(), min(18)] },
  amount: { value: model.$.amount, component: Input, validators: [min(0), max(1000)] },
};

const form = createForm({ model, schema });
```

### Custom & cross-field validators

Кастомный валидатор — функция `(value, scope, root) => ValidationError | null | Promise<...>`
(тип `ModelValidator`). `scope` — ближайшая под-модель (элемент массива или корень), `root` —
корневая модель. Cross-field правило читает соседние поля через `root` и вешается на
поле-носитель ошибки:

```typescript
import type { ModelValidator } from '@reformer/core';

// Value-only
const strongPassword: ModelValidator<string> = (value) =>
  !value || value.length < 8 ? { code: 'too-short', message: 'Минимум 8 символов' } : null;

// Cross-field: сравниваем с другим полем через root
const passwordsMatch: ModelValidator<string, unknown, { password: string }> = (value, _scope, root) =>
  value && root.password && value !== root.password
    ? { code: 'mismatch', message: 'Пароли не совпадают' }
    : null;

// Async (проверка уникальности)
const emailUnique: ModelValidator<string> = async (value) => {
  if (!value) return null;
  const res = await fetch(`/api/check-email?email=${encodeURIComponent(value)}`);
  const { available } = await res.json();
  return available ? null : { code: 'taken', message: 'Email уже зарегистрирован' };
};

// в схеме
const schema = {
  password: { value: model.$.password, component: Input, validators: [strongPassword] },
  confirm:  { value: model.$.confirm,  component: Input, validators: [passwordsMatch] },
  email:    { value: model.$.email,    component: Input, validators: [emailUnique] },
};
```

### Conditional & array validation (schema tree)

`validateFormModel` обходит дерево схемы. Кроме field-узлов (`{ value, validators }`) движок понимает:

- **условную ветку** `{ when: (scope, root) => boolean, children: [...] }` — поддерево валидируется
  только при истинном `when`; при ложном ошибки полей ветки очищаются;
- **секцию массива** — узел с `componentProps.itemComponent` (`(item) => subSchema`) и `componentProps.control`
  (модель-массив с `at`/`length`) — валидируется per-item со scope = под-модель элемента.

```typescript
// Условная валидация (branch node)
const schema = {
  children: [
    { value: model.$.loanType, validators: [required()] },
    {
      when: (form) => form.loanType === 'mortgage',
      children: [
        { value: model.$.propertyValue, validators: [required(), min(1_000_000)] },
        { value: model.$.initialPayment, validators: [required()] },
      ],
    },
  ],
};
```

> В примерах монорепо эти узлы собираются авторскими хелперами (`field`/`when`/`applyWhen`/`arraySection`)
> — это **локальный typed-сахар в самом примере**, а не экспорт `@reformer/core`. Публичный API — сам
> `validateFormModel(model, schema)` и форма узлов выше.

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
