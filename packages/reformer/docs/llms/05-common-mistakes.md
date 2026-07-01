## 4. COMMON MISTAKES

### Imports rule (#1 cause of cascading errors — read first)

- Модель/форма/валидация/хуки/типы/**примитивы behaviors** — из `@reformer/core`.
- Чистые фабрики валидаторов — из `@reformer/core/validators`.
- Декларативный DSL (`defineFormBehavior` + операторы) — из `@reformer/core/behaviors`.

```typescript
// ✅ CORRECT
import {
  createModel,
  createForm,
  validateFormModel,
  useFormControl,
  useFormControlValue,
  type FormProxy,
  type FieldConfig,
  type ModelValidator,
} from '@reformer/core';
import { required, min, max, email } from '@reformer/core/validators';
// либо примитивы behaviors из основного пакета:
import { computeFrom, enableWhen, copyFrom } from '@reformer/core';
// либо декларативный DSL:
import { defineFormBehavior, compute, onChange } from '@reformer/core/behaviors';
```

> **watchField живёт в `@reformer/core`** (низкоуровневый примитив), НЕ в `@reformer/core/behaviors`.
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

### Валидаторы — фабрики в массиве `validators`

```typescript
// ❌ WRONG - нет операторов validate()/applyWhen(); строка вместо options
validate(path.email, required(), 'Email is required');

// ✅ CORRECT - фабрика с options, в поле схемы
const schema = {
  email: {
    value: model.$.email,
    component: Input,
    validators: [required({ message: 'Email is required' }), email()],
  },
};
```

### Cross-field — через `root`, а не `ctx.form`

```typescript
// ❌ WRONG - ctx.form / ctx.setFieldValue / value.value — старый API, не существует
watchField(path.amount, (amount, ctx) => {
  const rate = ctx.form.rate.value.value;
  ctx.setFieldValue('total', amount * rate);
});

// ✅ CORRECT - compute на сигналах; cross-field validator читает root
compute(model.$.total, () => (model.amount ?? 0) * (model.rate ?? 0));

const amountVsMax: ModelValidator<number, unknown, MyForm> = (value, _s, root) =>
  value != null && root.maxAmount != null && value > root.maxAmount
    ? { code: 'tooBig', message: 'Превышает лимит' }
    : null;
```

### Form-shape types — `type` over `interface`

```typescript
// ❌ interface лишён неявной index signature; конструкции ArrayNode<T> его отвергают
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
