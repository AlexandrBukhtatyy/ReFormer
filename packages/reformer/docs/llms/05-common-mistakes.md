## 4. COMMON MISTAKES

### Imports rule (#1 cause of cascading errors — read first)

- Модель/форма/типы (`createForm`, `FormModel`, `FormSchemaNode`, `ValidationIssue`, `FormFlow`) — из `@reformer/core`.
- Хуки (`useFormBundle`, `useFormControl`, `useFormFlow`, `useIssueMessage`, …) и `I18nProvider` — из `@reformer/core/react`.
- Схема валидации (`defineValidation` + операторы `validate`/`validateAsync`/`validateWhen`/`apply`/`applyEach`) и раннер `validateModel` — из `@reformer/core/validation`. `cross` берётся из аргумента схемы.
- Чистые фабрики валидаторов (`required`/`min`/`email`/…) — из `@reformer/core/validators`.
- Словарь текстов замечаний (`defineIssueMessages`, `resolveIssueMessage`) — из `@reformer/core/i18n`.
- Декларативный DSL поведения (`defineFormBehavior` + операторы) — из `@reformer/core/behaviors`.

```typescript
// ✅ CORRECT
import {
  createModel,
  createForm,
  type FormGroup,
  type FormSchemaNode,
  type FormModel,
  type ValidationIssue,
} from '@reformer/core';
import { useFormBundle, useFormControl, useFormControlValue } from '@reformer/core/react';
import { defineIssueMessages } from '@reformer/core/i18n';
// схема валидации + раннер — отдельный слой:
import {
  defineValidation,
  validate,
  validateAsync,
  validateWhen,
  apply,
  applyEach,
  validateModel,
  type Rule,
  type AsyncRule,
  type ValidationDefinition,
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

Источник истины значений — модель. Форма (ноды) отражает их; `form.x.setValue(v)` пишет в ту же
модель.

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
const { value, issues } = useFormControl(control.loanType);
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
(билдер `createForm` / JSON-DSL) правил **не несёт**: они живут в `ValidationDefinition` и уходят в
сборку полем `validation` (шаги — `flow`). Запуск — уровнем формы:
`bundle.submission.submit(handler)`, `bundle.validate()`, `bundle.validateStep(id)`; без сборки —
`validateModel(model, schema)`. У нод методов `validate()` / `submit()` нет.

```typescript
// ❌ WRONG - ключей value и validators у узла нет, как и записи «имя → узел»
const schema = {
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
};
validate(path.email, required(), 'Email is required'); // старая сигнатура validate() — удалена
required({ message: 'Email is required' }); // опции message нет — текст живёт в словаре формы

// ✅ CORRECT - операторы validate/validateAsync внутри defineValidation; у правила — код
const emailSchema = defineValidation<MyForm>(({ model }) => {
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
  validateAsync(model.$.email, [
    async (value, { signal }) => {
      const res = await fetch(`/api/free?email=${value}`, { signal });
      return (await res.json()).free ? null : { code: 'email.taken' };
    },
  ]);
});
// тексты кодов — словарь формы
export const formMessages = defineIssueMessages({
  'email.required': 'Укажите email',
  'email.taken': 'Email уже занят',
});

// прогон — уровнем формы: замечания сами доезжают до нод, warnings не блокируют.
// Отклонённое async-правило — сбой: статус `error`, на поле замечание `ruleFailed`.
const outcome = await bundle.submission.submit(api.send); // createForm({ …, validation: emailSchema })
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
const amountVsMax = (form: MyForm): ValidationIssue | null =>
  form.amount != null && form.maxAmount != null && form.amount > form.maxAmount
    ? { code: 'amount.tooBig', params: { max: form.maxAmount } }
    : null;

const amountSchema = defineValidation<MyForm>(({ model, cross }) => {
  cross(model.$.amount, amountVsMax); // check получает снимок модели, ошибка — на model.$.amount
});
```

### Form-shape types — `interface` или `type`

Форму данных можно объявлять и `interface`, и `type` — оба работают с `createModel<T>`,
`createForm<T>`, `FormGroup<T>` и `FormArray<T>`. Группу от поля `FormGroup` отличает по виду
значения (обычный объект, а не массив, дата, файл или функция), а не по index signature. Эталонная
форма (`CreditApplication`) объявлена через `interface`.

```typescript
// ✅ interface
export interface PropertyItem {
  type: PropertyType;
  description: string;
}

// ✅ type alias — то же самое
export type PropertyItem = {
  type: PropertyType;
  description: string;
};
```

Единственная оговорка — свои обобщённые хелперы: `interface` не присваивается
`Record<string, unknown>` (у него нет неявной index signature). Ограничение пиши через
`T extends object`, а не `T extends Record<string, unknown>`.

`number | null` — конвенциональный тип для очищенного поля; встроенные валидаторы
(`min`, `max`, `minLength`, `maxLength`, `minDate`, `maxDate`, `minAge`, `maxAge`) пропускают
пустые значения внутри.

### Вид ноды — гардами, а не instanceof

`FormControl`, `FormGroup`, `FormArray` — интерфейсы: классов нод в публичном API нет, проверка
`instanceof` не скомпилируется. Вид ноды различают гарды по метке вида:

```typescript
// ❌ FormControl — тип, а не класс
if (node instanceof FormControl) { ... }

// ✅ type guards
import { isFormNode, isFormControl, isFormGroup, isFormArray } from '@reformer/core';
if (isFormControl(node)) node.updateComponentProps({ placeholder: 'Email' });
if (isFormArray(node)) node.push();
```
