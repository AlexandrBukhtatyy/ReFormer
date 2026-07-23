## 30. TYPE-SAFETY RECIPES

Идиоматичные паттерны, которые держат сгенерированный код без `any` и `as`-кастов под M1.

### Recipe 1 — Imports (root cause prevention)

- Модель/форма/хуки/типы/**примитивы behaviors** — из `@reformer/core`.
- Схема валидации (операторы + раннер `validateModel`) — из `@reformer/core/validation`.
- Чистые фабрики валидаторов — из `@reformer/core/validators`.
- Декларативный DSL (`defineFormBehavior` + операторы) — из `@reformer/core/behaviors`.

```typescript
import {
  createModel,
  createForm,
  type FormModel,
  type FormProxy,
  type ModelSignals,
} from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  cross,
  validateModel,
  type Rule,
} from '@reformer/core/validation';
import { required, min, max, email } from '@reformer/core/validators';
import { defineFormBehavior, compute, enableWhen, onChange } from '@reformer/core/behaviors';
```

> **watchField — из `@reformer/core`** (примитив), НЕ из `@reformer/core/behaviors` (там `onChange`).

### Recipe 2 — Form-shape types as `type`, not `interface`

`Record<string, FormValue>` требует index signature. У `interface` её нет неявно; у `type` —
структурно. Объявляй через `type`-alias всё, что попадает в `FormProxy<T>`/`ArrayNode<T>`:
корневую форму, вложенные группы, типы элементов массива.

```typescript
export type PropertyItem = {
  type: 'apartment' | 'house' | 'car';
  description: string;
  estimatedValue: number;
};

export type CreditApplicationForm = {
  loanAmount: number | null;
  properties: PropertyItem[];
  // ...
};
```

### Recipe 3 — Схема привязана к сигналам модели

`value` поля — это сигнал модели (`model.$.field`), а не литерал. Тип поля выводится из сигнала.
Layout-схема БЕЗ валидаторов — правила живут в отдельной validation-схеме.

```typescript
const model = createModel<CreditApplicationForm>(initial);

const schema = {
  loanAmount: { value: model.$.loanAmount, component: Input },
  // вложенная группа — builder, принимающий ModelSignals<Sub>
  personalData: personalDataNodes(model.$.personalData),
  // массив — { array, item }
  properties: { array: model.properties, item: propertyItem },
};

// правила — отдельно; типы полей выводятся из сигналов
const validation = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.loanAmount, [required(), min(50000)]);
});
```

### Recipe 4 — Cross-field валидаторы: `cross` над типизированным снапшотом

Правило — обычная функция `(f: Root) => ValidationError | null` над снапшотом `model.get()`.
Соседние поля читаются без `as`; ошибка вешается на поле-носитель `sig`:

```typescript
import type { ValidationError } from '@reformer/core';

const initialPaymentVsProperty = (f: CreditApplicationForm): ValidationError | null =>
  f.initialPayment && f.propertyValue && f.initialPayment > f.propertyValue
    ? { code: 'tooHigh', message: 'Взнос не может превышать стоимость' }
    : null;

// внутри defineValidationSchema<CreditApplicationForm>(({ model }) => { ... }):
cross(model.$.initialPayment, initialPaymentVsProperty);
```

### Recipe 5 — `compute` читает модель напрямую (без аннотаций)

`compute(target, () => …)` читает value-модель (`model.field`) — типы полей выводятся из типа
модели, `as`-касты не нужны:

```typescript
compute(model.$.monthlyPayment, () =>
  annuityMonthly(model.loanAmount ?? 0, model.loanTerm ?? 0, model.interestRate ?? 0)
);

// nested reads — тоже напрямую
compute(model.$.fullName, () =>
  [model.personalData.firstName, model.personalData.lastName].filter(Boolean).join(' ')
);
```

### Recipe 6 — `null` vs `undefined` для опциональных полей

Оба работают. `null` — конвенция «пользователь очистил поле». Встроенные валидаторы
(`min`, `max`, `minLength`, `maxLength`, `minDate`, `maxDate`, `minAge`, `maxAge`) пропускают
пустые значения — guard `if (value != null)` не нужен.

```typescript
export type CreditForm = {
  loanAmount: number | null;   // min(model.$.loanAmount, 50000) — ок
  loanPurpose: string | null;  // minLength — ок
  birthDate: string | null;    // minAge — ок
};
```

### Recipe 7 — Нода поля для кастомных компонентов

`useFormControl(control)` типизируется по `FieldNode<T>`. В props компонента используй `FieldNode<T>`:

```typescript
import type { FieldNode } from '@reformer/core';

type MyFieldProps<T> = { control: FieldNode<T> };
function MyField<T>({ control }: MyFieldProps<T>) {
  const { value, errors, disabled } = useFormControl(control);
  // ...
}
```

### Recipe 8 — Вынос правил в именованные функции

Field-правила — именованные `Rule<T>`, validation-схема остаётся плоской:

```typescript
import type { Rule } from '@reformer/core/validation';

const validateAdultAge: Rule<string | null> = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value).getFullYear();
  return age < 18 ? { code: 'tooYoung', message: 'Минимум 18 лет' } : null;
};

// внутри defineValidationSchema<MyForm>(({ model }) => { ... }):
validate(model.$.birthDate, [validateAdultAge]);
```

### Anti-patterns to avoid

- `import { computeFrom } from '@reformer/core/behaviors'` для примитива, вызываемого вне
  `defineFormBehavior` → примитив живёт в `@reformer/core` (возвращает cleanup).
- `interface MyForm { ... }` для form-shape → см. Recipe 2.
- `as`-касты значений полей внутри `compute` → читай `model.field` напрямую (Recipe 5).
- строковые пути / `(form) => ...` в behaviors → это удалённый API, используй сигналы (`model.$.x`).
