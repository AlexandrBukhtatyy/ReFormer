## 3. COMMON PATTERNS

Все паттерны — на архитектуре M1: значения в модели (`model.$.field`), behaviors на сигналах,
валидация через `validateFormModel`.

### Conditional Fields with Auto-Reset

```typescript
import { enableWhen } from '@reformer/core';

// поле включается по условию; при выключении — сброс к initial
enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', {
  resetOnDisable: true,
});
```

Или декларативно внутри `defineFormBehavior`:

```typescript
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  enableWhen(
    [model.$.propertyValue, model.$.initialPayment],
    () => model.loanType === 'mortgage',
    { resetOnDisable: true }
  );
});
```

### Computed Field (same or cross level)

`compute`/`computeFrom` пишут в целевой сигнал при изменении источников. Цель не входит
в источники → цикла нет. Кросс-уровневые вычисления работают так же — источники берутся
по сигналам из любого места модели.

```typescript
import { defineFormBehavior, compute, computeFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  // compute: auto-tracking — читаем что нужно прямо из value-модели
  compute(model.$.total, () => (model.price ?? 0) * (model.quantity ?? 0));

  // computeFrom: явный список источников
  computeFrom([model.$.price, model.$.quantity], model.$.total, (price, qty) => price * qty);

  // кросс-уровневое: fullName из вложенной группы
  compute(model.$.fullName, () =>
    [model.personalData.firstName, model.personalData.lastName].filter(Boolean).join(' ')
  );
});
```

### Async reaction / dynamic options — `onChange`

Для async-реакции на изменение поля (загрузка справочников, зависимые селекты) используй
`onChange` из DSL. Колбэк выполняется вне effect-контекста (можно писать сигналы/ноды), а
2-й аргумент — `{ signal }` (AbortSignal) для отмены устаревших запросов.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model, form }) => {
  onChange(
    model.$.region,
    async (region, { signal }) => {
      if (!region) {
        form.city.updateComponentProps({ options: [] });
        return;
      }
      const cities = await fetchCities(region, { signal });
      form.city.updateComponentProps({ options: cities });
    },
    { debounce: 300 }
  );
});
```

> Низкоуровневый аналог — примитив `watchField(model.$.region, cb)` из `@reformer/core` (без debounce/AbortSignal;
> для сети предпочтителен `onChange`). См. `20-compute-vs-watch.md`, `32-async-options-loading.md`.

### Reading values

```typescript
// В React-компоненте — хуки
const { value, errors, disabled } = useFormControl(form.email);
const loanType = useFormControlValue(form.loanType); // значение напрямую

// Вне React — из модели
model.email;             // value-доступ (реактивно внутри effect/computed)
model.$.email.value;     // через сигнал
model.$.email.peek();    // нереактивный снимок
model.get();             // весь объект-снимок
```

### Submit + validation

```typescript
import { validateFormModel } from '@reformer/core';

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const result = await validateFormModel(model, schema); // ошибки роутятся в ноды формы
  if (!result.valid) return;                             // result.errors — { path: ValidationError[] }
  await api.send(model.get());
  model.reset(); // к initial-снимку
}
```

Multi-step: держи отдельные под-схемы на шаг и вызывай `validateFormModel(model, stepSchema)`.
См. `13-multi-step.md`, `28-submit-and-reset.md`.

### Cross-field validation — через `root`

Cross-field правило — `ModelValidator`, читает соседние поля через `root`, вешается на
поле-носитель ошибки:

```typescript
import type { ModelValidator } from '@reformer/core';

const initialPaymentVsProperty: ModelValidator<number, unknown, MyForm> = (_value, _scope, root) =>
  root.initialPayment && root.propertyValue && root.initialPayment > root.propertyValue
    ? { code: 'tooHigh', message: 'Взнос не может превышать стоимость' }
    : null;

const schema = {
  initialPayment: { value: model.$.initialPayment, component: Input, validators: [initialPaymentVsProperty] },
};
```

Чтобы правило перезапускалось при изменении зависимости — добавь `revalidateWhen`:

```typescript
import { revalidateWhen } from '@reformer/core';
revalidateWhen([model.$.propertyValue], () => validateFormModel(model, schema));
```

### Extracting named rules

Когда тело кастомного валидатора или behavior-оператора растёт — выноси в именованную
функцию, типизированную `ModelValidator<TField, TScope, TRoot>`. Схема остаётся плоской и
читается как оглавление:

```typescript
import type { ModelValidator } from '@reformer/core';

const validateAdultAge: ModelValidator<string> = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value).getFullYear();
  return age < 18 ? { code: 'tooYoung', message: 'Минимум 18 лет' } : null;
};

const schema = {
  birthDate: { value: model.$.birthDate, component: Input, validators: [validateAdultAge] },
};
```

**Naming convention** (camelCase, семантика, не эхо оператора):

- Cross-field правило → инвариант: `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`.
- Field-правило → проверка: `validateAdultAge`, `passwordsMatch`.
