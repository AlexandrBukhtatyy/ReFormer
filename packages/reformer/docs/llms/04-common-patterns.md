## 3. COMMON PATTERNS

Значения живут в модели (`model.$.field`), поведение (`defineFormBehavior`) работает на живых
сигналах, валидация — отдельная схема (`defineValidation`, прогон по требованию через
раннер). Слои раздельны: схема формы правил НЕ несёт.

### Conditional Fields with Auto-Reset

`enableWhen` — оператор поведения: поле включается по условию, при выключении сбрасывается к
initial. Вызывается внутри `defineFormBehavior`:

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

> Низкоуровневый аналог — примитив `watchField(model.$.region, cb)` из `@reformer/core/model` (без debounce/AbortSignal;
> для сети предпочтителен `onChange`). См. `20-compute-vs-watch.md`, `32-async-options-loading.md`.

### Reading values

```typescript
// В React-компоненте — хуки (@reformer/core/react)
const { value, issues, disabled } = useFormControl(form.email);
const loanType = useFormControlValue(form.loanType); // значение напрямую

// Вне React — из модели
model.email;             // value-доступ (реактивно внутри effect/computed)
model.$.email.value;     // через сигнал
model.$.email.peek();    // нереактивный снимок
model.get();             // весь объект-снимок
```

### Submit + validation

Валидация — отдельная `ValidationDefinition<T>` (`defineValidation`), а не часть layout; в сборку
она уходит полем `validation`. `bundle.submission.submit(handler)` прогоняет все правила один раз,
разносит замечания по нодам и зовёт обработчик только при статусе `valid` (`severity: 'warning'` не
блокирует). Результат — `SubmitResult`.

```typescript
async function handleSubmit(event: React.FormEvent) {
  event.preventDefault();
  const outcome = await bundle.submission.submit(async (values) => {
    await api.send(values);
    bundle.model.reset(); // к initial-снимку — только после успеха
  });
  if (outcome.status === 'invalid') showHint('Проверьте форму'); // поля уже подсвечены
}
```

Без сборки — раннер `validateModel(model, schema)`: сам разносит замечания по нодам и отвечает
`Promise<boolean>`.

Multi-step: шаги и их правила — поток сборки `createForm({ flow: { steps: [{ id, rules }] } })`
(`id` — `selector` шага), правила вне шагов — `validation: { extras }`. Сборка отдаёт
`bundle.validateStep(id)`, `bundle.validate()` и поток `bundle.flow` (`next` / `previous` / `goTo`);
визард принимает поток пропом `flow`. См. `13-multi-step.md`, `28-submit-and-reset.md`,
`38-form-flow.md`.

### Cross-field validation — через `cross`

Cross-field правило — обычная функция над **снимком** модели. Оператор `cross` берётся из
аргумента схемы и вешает правило на поле-носитель ошибки; тип снимка выведен из схемы:

```typescript
import { defineValidation, validate } from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';
import type { ValidationIssue } from '@reformer/core';

// снимок формы читается напрямую — без каста, соседние поля доступны как поля объекта
const initialPaymentVsProperty = (form: MyForm): ValidationIssue | null =>
  form.initialPayment && form.propertyValue && form.initialPayment > form.propertyValue
    ? { code: 'initialPaymentTooHigh' } // текст кода — в словаре формы (defineIssueMessages)
    : null;

const schema = defineValidation<MyForm>(({ model, cross }) => {
  validate(model.$.initialPayment, [required(), min(0)]);
  cross(model.$.initialPayment, initialPaymentVsProperty); // ошибка сядет на initialPayment
});
```

> Правила строки массива и подформы — отдельная схема над их типом, подключённая через
> `applyEach(model.$.items, rowRules)` / `apply(model.$.group, groupRules)`. У такой схемы своя
> область: её `cross` получает снимок строки или группы.

### Conditional validation — `validateWhen`

Условная валидация — `validateWhen(() => cond, () => { … })`: правила внутри активны, только пока
условие истинно; при `false` ранее тронутые поля гасятся. Это не `enable` (то — поведение), а
включение/выключение самих проверок:

```typescript
import { defineValidation, validateWhen, validate } from '@reformer/core/validation';

const loanRules = defineValidation<MyForm>(({ model, cross }) => {
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [required(), min(1000000)]);
      cross(model.$.initialPayment, initialPaymentVsProperty);
    }
  );
});
```

### Перезапуск прогона — `revalidateWhen` (мост поведение → валидация)

Схема прогоняется по требованию (submit/шаг) либо живой стратегией сборки
(`validation: { strategy: 'change' }`, см. `33-validation-strategy.md`). Чтобы перезапустить
отдельную схему при изменении зависимости — `revalidateWhen` из **поведения** (мост
поведение → валидация):

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  revalidateWhen([model.$.propertyValue], () => void validateModel(model, schema));
});
```

### Extracting named rules

Когда тело правила растёт — выноси в именованную функцию. Field-правило типизируй `Rule<T>`
(`(value) => ValidationIssue | null`), cross-field — обычной `(f: Root) => ValidationIssue | null`.
Схема остаётся плоской и читается как оглавление:

```typescript
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import type { Rule } from '@reformer/core/validation';

// field-правило: (value) => error
const validateAdultAge: Rule<string> = (value) => {
  if (!value) return null;
  const age = new Date().getFullYear() - new Date(value).getFullYear();
  return age < 18 ? { code: 'tooYoung' } : null;
};

const schema = defineValidation<MyForm>(({ model }) => {
  validate(model.$.birthDate, [required(), validateAdultAge]);
});
```

**Naming convention** (camelCase, семантика, не эхо оператора):

- Cross-field правило → инвариант: `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`.
- Field-правило → проверка: `validateAdultAge`, `passwordsMatch`.
