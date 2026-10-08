## 4. COMMON MISTAKES

### Imports rule (#1 cause of cascading errors — read first)

- Модель/форма/хуки/типы (`FormModel`, `FormSchemaNode`, `ValidationError`) — из `@reformer/core`.
- Схема валидации (`defineValidationSchema` + операторы `validate`/`validateAsync`/`validateWhen`/`apply`/`applyEach`) и раннер `validateModel` — из `@reformer/core/validation`. `cross` берётся из аргумента схемы.
- Чистые фабрики валидаторов (`required`/`min`/`email`/…) — из `@reformer/core/validators`.
- Декларативный DSL поведения (`defineFormBehavior` + операторы) — из `@reformer/core/behaviors`.

```typescript
// ✅ CORRECT
import {
  createModel,
  createForm,
  useFormControl,
  useFormControlValue,
  type FormProxy,
  type FormSchemaNode,
  type FormModel,
  type ValidationError,
} from '@reformer/core';
// схема валидации + раннер — отдельный слой:
import {
  defineValidationSchema,
  validate,
  validateAsync,
  validateWhen,
  apply,
  applyEach,
  validateModel,
  type Rule,
  type AsyncRule,
  type ValidationSchema,
} from '@reformer/core/validation';
import { required, min, max, email } from '@reformer/core/validators';
// поведение формы — декларативный DSL:
import { defineFormBehavior, compute, enableWhen, copyFrom, onChange } from '@reformer/core/behaviors';
// примитивы над сигналами (вне формы, возвращают cleanup) — отдельный сабпат:
import { computeFrom, watchField } from '@reformer/core/model';
```

> **В корне `@reformer/core` операторов поведения нет.** `computeFrom`, `copyFrom`, `watchField`,
> `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen` — примитивы сабпата
> `@reformer/core/model`; `enableWhen` / `disableWhen` — только операторы `@reformer/core/behaviors`.
> В DSL для реакции на изменения используется `onChange`.

### Значения — в модели, не в форме

Под M1 источник истины значений — модель. Форма (ноды) отражает их.

```typescript
// ✅ читаем/пишем значение
model.email = 'a@b.c';       // value-доступ
model.$.email.value;         // сигнал
model.get();                 // весь снимок для submit

// В компоненте — реактивно через хуки
const email = useFormControlValue(form.email);
```

### useFormControlValue (CRITICAL)

```typescript
// WRONG - useFormControlValue returns T directly, NOT { value: T }
const { value: loanType } = useFormControlValue(control.loanType);
// Result: loanType is ALWAYS undefined!

// CORRECT
const loanType = useFormControlValue(control.loanType);

// ALSO CORRECT - useFormControl returns object
const { value, errors } = useFormControl(control.loanType);
```

### Behaviors принимают СИГНАЛЫ, а не пути/форму

```typescript
// ❌ WRONG - строковые пути и (form) => ... это старый API, удалён
enableWhen(path.city, (form) => Boolean(form.country));
computeFrom(['price', 'quantity'], 'total', (values) => values.price * values.quantity);

// ✅ CORRECT - сигналы модели, условие читает model напрямую
enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true });
computeFrom([model.$.price, model.$.quantity], model.$.total, (price, qty) => price * qty);
```

### Валидаторы — оператор `validate`, а не узел схемы

Валидация — **отдельный слой** (`@reformer/core/validation`), а не ключ узла. Схема формы
(билдер `createForm` / JSON-DSL) правил **не несёт**: они живут в `ValidationSchema`, а запускает
их раннер. ⚠️ `form.validate()`/`submit()` правил **НЕ запускают** — прогон только через
`validation` сборки либо `validateModel(model, schema)`.

```typescript
// ❌ WRONG - ключей value и validators у узла нет, как и записи «имя → узел»
const schema = {
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
};
validate(path.email, required(), 'Email is required'); // старая сигнатура validate() — удалена

// ✅ CORRECT - операторы validate/validateAsync внутри defineValidationSchema; фабрики с options
const emailSchema = defineValidationSchema<MyForm>(({ model }) => {
  validate(model.$.email, [required({ message: 'Email is required' }), email()]);
  validateAsync(model.$.email, [
    async (value, { signal }) => {
      const res = await fetch(`/api/free?email=${value}`, { signal });
      return (await res.json()).free ? null : { code: 'taken', message: 'Email занят' };
    },
  ]);
});

// прогон по требованию (submit/шаг): ошибки сами доезжают до нод формы, warnings не блокируют.
// Отклонённое async-правило — сбой: прогон не проходит, на поле ошибка `ruleFailed`.
const ok = await validateModel(model, emailSchema);
```

### Cross-field — оператор `cross`, а не `ctx.form`

```typescript
// ❌ WRONG - ctx.form / ctx.setFieldValue / value.value — старый API; ModelValidator(value,scope,root) удалён
watchField(path.amount, (amount, ctx) => {
  const rate = ctx.form.rate.value.value;
  ctx.setFieldValue('total', amount * rate);
});

// ✅ CORRECT - compute (поведение) на сигналах; cross-field (валидация) через оператор cross
compute(model.$.total, () => (model.amount ?? 0) * (model.rate ?? 0));

// cross-field правило — обычная функция над снимком модели; `cross` берётся из аргумента схемы:
const amountVsMax = (form: MyForm): ValidationError | null =>
  form.amount != null && form.maxAmount != null && form.amount > form.maxAmount
    ? { code: 'tooBig', message: 'Превышает лимит' }
    : null;

const amountSchema = defineValidationSchema<MyForm>(({ model, cross }) => {
  cross(model.$.amount, amountVsMax); // check получает снимок модели, ошибка — на model.$.amount
});
```

### Form-shape types — `type` over `interface`

```typescript
// ❌ interface лишён неявной index signature; конструкции ModelArrayNode<T> его отвергают
export interface PropertyItem {
  type: PropertyType;
  description: string;
}

// ✅ type alias структурно совместим с Record<string, FormValue>
export type PropertyItem = {
  type: PropertyType;
  description: string;
};
```

`number | null` — конвенциональный тип для очищенного поля; встроенные валидаторы
(`min`, `max`, `minLength`, `maxLength`, `minDate`, `maxDate`, `minAge`, `maxAge`) пропускают
пустые значения внутри.

### Proxy не проходит instanceof

```typescript
// ❌ instanceof на Proxy не работает
if (node instanceof FieldNode) { ... }

// ✅ type guards
import { isFieldNode, isGroupNode, isArrayNode } from '@reformer/core';
if (isFieldNode(node)) { ... }
```
