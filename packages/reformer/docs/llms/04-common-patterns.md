## 3. COMMON PATTERNS

Все паттерны — на архитектуре M1: значения в модели (`model.$.field`), поведение (`defineFormBehavior`)
на живых сигналах, валидация — отдельной ambient-схемой (`defineValidationSchema`, прогон по требованию
через `validateModel`). Слои раздельны: layout НЕ несёт validators.

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

Валидация — отдельная `ValidationSchema<T>` (`defineValidationSchema`), а не часть layout. Раннер
`validateModel(model, schema)` сам роутит ошибки в ноды формы и возвращает `Promise<boolean>`
(`false` = есть блокирующая ошибка; `severity: 'warning'` не блокирует).

```typescript
import { validateModel } from '@reformer/core/validation';

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const ok = await validateModel(model, schema); // ошибки сами доезжают до нод формы (UI подсветит)
  if (!ok) return;                               // false → есть блокирующая ошибка
  await api.send(model.get());
  model.reset(); // к initial-снимку
}
```

Multi-step: держи отдельные под-схемы на шаг и вызывай `validateModel(model, stepSchema)`. Для wizard'а —
`makeValidationConfig(model)` → `{ validateStep, validateAll }` (`validateAll` прогоняет полную
`apply(...STEP_SCHEMAS, extras)`). См. `13-multi-step.md`, `28-submit-and-reset.md`.

### Cross-field validation — через `cross`

Cross-field правило — обычная функция над **снапшотом** модели (`fn` получает `model.get()`),
навешивается оператором `cross(sig, fn)` на поле-носитель ошибки внутри схемы:

```typescript
import { defineValidationSchema, validate, cross } from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';
import type { ValidationError } from '@reformer/core';

// снапшот формы читается напрямую — без каста, соседние поля доступны как поля объекта
const initialPaymentVsProperty = (f: MyForm): ValidationError | null =>
  f.initialPayment && f.propertyValue && f.initialPayment > f.propertyValue
    ? { code: 'tooHigh', message: 'Взнос не может превышать стоимость' }
    : null;

const schema = defineValidationSchema<MyForm>(({ model }) => {
  validate(model.$.initialPayment, [required(), min(0)]);
  cross(model.$.initialPayment, initialPaymentVsProperty); // ошибка сядет на initialPayment
});
```

> Для элемента массива / под-модели захвати нужный снапшот в замыкание (`const item = im.get();
> cross(im.$.x, () => rule(item))`) — `fn` всегда получает модель ТЕКУЩЕГО scope, а не под-модель.

### Conditional validation — `validateWhen`

Условная валидация — `validateWhen(() => cond, () => { … })`: правила внутри активны, только пока
условие истинно; при `false` ранее тронутые поля гасятся. Это не `enable` (то — поведение), а
включение/выключение самих проверок:

```typescript
import { validateWhen, validate, cross } from '@reformer/core/validation';

validateWhen(
  () => model.loanType === 'mortgage',
  () => {
    validate(model.$.propertyValue, [required(), min(1000000)]);
    cross(model.$.initialPayment, initialPaymentVsProperty);
  }
);
```

### Перезапуск прогона — `revalidateWhen` (мост поведение → валидация)

Схема прогоняется по требованию (submit/шаг). Чтобы перезапустить её при изменении зависимости —
`revalidateWhen` из **поведения** (единственный мост поведение → валидация):

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  revalidateWhen([model.$.propertyValue], () => void validateModel(model, schema));
});
```

### Extracting named rules

Когда тело правила растёт — выноси в именованную функцию. Field-правило типизируй `Rule<T>`
(`(value) => ValidationError | null`), cross-field — обычной `(f: Root) => ValidationError | null`.
Схема остаётся плоской и читается как оглавление:

```typescript
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { Rule } from '@reformer/core/validation';

// field-правило: (value) => error
const validateAdultAge: Rule<string> = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value).getFullYear();
  return age < 18 ? { code: 'tooYoung', message: 'Минимум 18 лет' } : null;
};

const schema = defineValidationSchema<MyForm>(({ model }) => {
  validate(model.$.birthDate, [required(), validateAdultAge]);
});
```

**Naming convention** (camelCase, семантика, не эхо оператора):

- Cross-field правило → инвариант: `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`.
- Field-правило → проверка: `validateAdultAge`, `passwordsMatch`.
