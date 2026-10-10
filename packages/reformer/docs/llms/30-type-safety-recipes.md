## 30. TYPE-SAFETY RECIPES

Идиоматичные паттерны, которые держат сгенерированный код без `any` и `as`-кастов.

### Recipe 1 — Imports (root cause prevention)

- Модель/форма/типы — из `@reformer/core`; хуки — из `@reformer/core/react`; примитивы над
  сигналами — из `@reformer/core/model`.
- Схема валидации (операторы + раннер `validateModel`) — из `@reformer/core/validation`.
- Чистые фабрики валидаторов — из `@reformer/core/validators`.
- Словарь текстов замечаний (`defineIssueMessages`) — из `@reformer/core/i18n`.
- Декларативный DSL (`defineFormBehavior` + операторы) — из `@reformer/core/behaviors`.

```typescript
import {
  createModel,
  createForm,
  type FormModel,
  type FormGroup,
  type FormSchemaNode,
} from '@reformer/core';
import { useFormBundle, useFormControl } from '@reformer/core/react';
import {
  defineValidation,
  validate,
  validateModel,
  type Rule,
} from '@reformer/core/validation';
import { required, min, max, email } from '@reformer/core/validators';
import { defineFormBehavior, compute, enableWhen, onChange } from '@reformer/core/behaviors';
```

> **watchField — из `@reformer/core/model`** (примитив), НЕ из `@reformer/core/behaviors` (там `onChange`)
> и не из корня `@reformer/core`.

### Recipe 2 — Form-shape types: `interface` или `type`

Оба варианта работают одинаково. Ограничения `Record<string, …>` у `createModel<T>`,
`createForm<T>`, `FormGroup<T>` и `FormArray<T>` нет (`createModel` и `createForm` требуют только
`T extends object`). Вид ноды поля `FormFields<T>` выводит по виду значения: обычный объект —
`FormGroup`, массив объектов — `FormArray`, остальное (примитив, массив примитивов, `Date`, `File`)
— `FormControl`. Index signature здесь не участвует, поэтому `interface` распознаётся так же, как
`type`. Эталонная форма объявлена через `interface`.

```typescript
export interface PropertyItem {
  type: 'apartment' | 'house' | 'car';
  description: string;
  estimatedValue: number;
}

export interface CreditApplication {
  loanAmount: number | null;
  properties: PropertyItem[]; // form.properties — FormArray<PropertyItem>
  address: Address; // form.address — FormGroup<Address>
  tags: string[]; // form.tags — FormControl<string[]>
  // ...
}

// вычисляемые поля — отдельным типом; форма — пересечение
export interface CreditApplicationDerived {
  monthlyPayment: number;
}
export type CreditApplicationForm = CreditApplication & CreditApplicationDerived;
```

Оговорка только для своих обобщённых хелперов: `interface` не присваивается
`Record<string, unknown>` (неявной index signature у него нет). Ограничение пиши через
`T extends object`:

```typescript
// ❌ interface-форму этот хелпер не примет
function snapshot<T extends Record<string, unknown>>(form: FormGroup<T>): T { return form.getValue(); }

// ✅
function snapshot<T extends object>(form: FormGroup<T>): T { return form.getValue(); }
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
    { model: model.$.properties, component: FieldArray, item: propertyRow },
  ],
});

// правила — отдельно; тип правила сверяется с типом поля
const LOAN_AMOUNT_RULES: Rule<number | null>[] = [required(), min(50000)];

const validation = defineValidation<CreditApplicationForm>(({ model }) => {
  validate(model.$.loanAmount, LOAN_AMOUNT_RULES);
});
```

### Recipe 4 — Cross-field валидаторы: `cross` над типизированным снимком

Правило — обычная функция `(snapshot: T) => ValidationIssue | null`. Оператор `cross` берётся из
аргумента схемы: тип снимка выведен из схемы, соседние поля читаются без `as`, ошибка вешается на
поле-носитель:

```typescript
import type { ValidationIssue } from '@reformer/core';

const initialPaymentVsProperty = (application: CreditApplicationForm): ValidationIssue | null =>
  application.initialPayment &&
  application.propertyValue &&
  application.initialPayment > application.propertyValue
    ? { code: 'initialPaymentTooHigh' } // текст — в словаре формы (defineIssueMessages)
    : null;

const loanRules = defineValidation<CreditApplicationForm>(({ model, cross }) => {
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
export interface CreditForm {
  loanAmount: number | null;   // validate(model.$.loanAmount, [min(50000)]) — ок
  loanPurpose: string | null;  // minLength — ок
  birthDate: string | null;    // minAge — ок
}
```

### Recipe 7 — Нода поля для кастомных компонентов

`useFormControl(control)` типизируется по `FormControl<T>`. В props компонента используй `FormControl<T>`:

```typescript
import type { FormControl } from '@reformer/core';
import { useFormControl } from '@reformer/core/react';

type MyFieldProps<T> = { control: FormControl<T> };
function MyField<T>({ control }: MyFieldProps<T>) {
  const { value, issues, disabled } = useFormControl(control);
  // ...
}
```

Для массива под-форм — `FormArray<Item>` (`useFormControl` отдаёт `ArrayControlState`), для группы —
`FormGroup<Group>`. Вид неизвестной ноды сужают гарды `isFormControl` / `isFormGroup` /
`isFormArray`.

### Recipe 8 — Вынос правил в именованные функции

Field-правила — именованные `Rule<T>`, validation-схема остаётся плоской:

```typescript
import type { Rule } from '@reformer/core/validation';

const validateAdultAge: Rule<string | null> = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value).getFullYear();
  return age < 18 ? { code: 'birthDate.adult', params: { minAge: 18 } } : null;
};

// внутри defineValidation<MyForm>(({ model }) => { ... }):
validate(model.$.birthDate, [validateAdultAge]);
```

### Recipe 9 — Результаты уровня формы — сужение по `status`

`bundle.validate()`, `bundle.submit(handler)` и `flow.next()` отвечают дискриминированными
объединениями: поле результата доступно после проверки `status`, без `as`.

```typescript
const outcome = await bundle.submit(api.send); // SubmitResult<Awaited<ReturnType<typeof api.send>>>
if (outcome.status === 'submitted') use(outcome.result);
else if (outcome.status === 'failed') report(outcome.error);
else showIssues(outcome.validation.issues); // 'invalid' | 'error' | 'cancelled'

const transition = await bundle.flow!.next(); // FlowTransition
if (transition.status === 'stayed') console.log(transition.reason); // 'invalid' | 'error' | …
```

### Anti-patterns to avoid

- `import { computeFrom } from '@reformer/core/behaviors'` для примитива, вызываемого вне
  `defineFormBehavior` → примитив живёт в `@reformer/core/model` (возвращает cleanup).
- `T extends Record<string, unknown>` в своих хелперах формы → `T extends object` (Recipe 2).
- `as`-касты значений полей внутри `compute` → читай `model.field` напрямую (Recipe 5).
- строковые пути / `(form) => ...` в behaviors → это удалённый API, используй сигналы (`model.$.x`).
- `node instanceof …` → ноды — интерфейсы; гарды `isFormControl` / `isFormGroup` / `isFormArray`.
