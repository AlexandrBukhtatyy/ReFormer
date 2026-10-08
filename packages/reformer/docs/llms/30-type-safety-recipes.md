## 30. TYPE-SAFETY RECIPES

Идиоматичные паттерны, которые держат сгенерированный код без `any` и `as`-кастов.

### Recipe 1 — Imports (root cause prevention)

- Модель/форма/хуки/типы — из `@reformer/core`; примитивы над сигналами — из `@reformer/core/model`.
- Схема валидации (операторы + раннер `validateModel`) — из `@reformer/core/validation`.
- Чистые фабрики валидаторов — из `@reformer/core/validators`.
- Декларативный DSL (`defineFormBehavior` + операторы) — из `@reformer/core/behaviors`.

```typescript
import {
  createModel,
  createForm,
  type FormModel,
  type FormProxy,
  type FormSchemaNode,
} from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  validateModel,
  type Rule,
} from '@reformer/core/validation';
import { required, min, max, email } from '@reformer/core/validators';
import { defineFormBehavior, compute, enableWhen, onChange } from '@reformer/core/behaviors';
```

> **watchField — из `@reformer/core/model`** (примитив), НЕ из `@reformer/core/behaviors` (там `onChange`)
> и не из корня `@reformer/core`.

### Recipe 2 — Form-shape types as `type`, not `interface`

`Record<string, FormValue>` требует index signature. У `interface` её нет неявно; у `type` —
структурно. Объявляй через `type`-alias всё, что попадает в `FormProxy<T>`/`ModelArrayNode<T>`:
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

### Recipe 3 — Схема привязана к ручкам модели

Привязка узла — ручка модели (`model: model.$.field`), а не литерал. Тип узла `FormSchemaNode`
закрыт: вид узла (поле, массив под-форм, подформа) сверяется с тем, чем является привязка, а
опечатка в ключе не компилируется. Правил в схеме нет — они живут в отдельной схеме валидации.

```typescript
const creditSchema = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  children: [
    { model: model.$.loanAmount, component: InputNumber },
    // вложенная группа — подформа: билдер получает под-модель FormModel<PersonalData>
    { model: model.$.personalData, part: personalData },
    // массив под-форм — { model, item }: билдер получает под-модель строки
    { model: model.$.properties, component: FormArray, item: propertyRow },
  ],
});

// правила — отдельно; тип правила сверяется с типом поля
const LOAN_AMOUNT_RULES: Rule<number | null>[] = [required(), min(50000)];

const validation = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.loanAmount, LOAN_AMOUNT_RULES);
});
```

### Recipe 4 — Cross-field валидаторы: `cross` над типизированным снимком

Правило — обычная функция `(snapshot: T) => ValidationError | null`. Оператор `cross` берётся из
аргумента схемы: тип снимка выведен из схемы, соседние поля читаются без `as`, ошибка вешается на
поле-носитель:

```typescript
import type { ValidationError } from '@reformer/core';

const initialPaymentVsProperty = (application: CreditApplicationForm): ValidationError | null =>
  application.initialPayment &&
  application.propertyValue &&
  application.initialPayment > application.propertyValue
    ? { code: 'tooHigh', message: 'Взнос не может превышать стоимость' }
    : null;

const loanRules = defineValidationSchema<CreditApplicationForm>(({ model, cross }) => {
  cross(model.$.initialPayment, initialPaymentVsProperty);
});
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
