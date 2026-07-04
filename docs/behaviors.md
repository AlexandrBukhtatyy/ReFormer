# Система Behaviors

Behaviors — это декларативный способ описания зависимостей и автоматизации логики между полями формы.

Под архитектурой M1 операторы объявляются внутри `defineFormBehavior(({ model, form }) => { … })` из `@reformer/core/behaviors` и привязываются к форме через `createForm({ model, schema, behavior })`. Операторы работают с сигналами модели (`model.$.<field>`); условия — это замыкания без аргументов, читающие модель.

## Обзор всех behaviors

```mermaid
mindmap
  root((Behaviors))
    Вычисления
      compute
      computeFrom
      transformValue
    Условия
      enableWhen
      disableWhen
      resetWhen
    Синхронизация
      copyFrom
      syncFields
    Отслеживание
      onChange
      revalidateWhen
```

---

## computeFrom

Автоматически вычисляет значение поля на основе других полей. Источники приходят в функцию **позиционно**.

```mermaid
flowchart LR
    subgraph Sources["Источники"]
        price[price: 100]
        quantity[quantity: 3]
    end

    subgraph Behavior["computeFrom"]
        fn["(price, quantity) =&gt;<br/>price * quantity"]
    end

    subgraph Target["Результат"]
        total[total: 300]
    end

    price -->|watch| Behavior
    quantity -->|watch| Behavior
    Behavior -->|setValue| total
```

### Использование

```typescript
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price, quantity) => price * quantity
  );
});
```

### Опции

| Опция  | Тип                      | Описание                                |
| ------ | ------------------------ | --------------------------------------- |
| `when` | `(...values) => boolean` | Пропустить пересчёт, если условие ложно |

> Есть также `compute(target, () => …)` с авто-трекингом зависимостей — без явного списка источников.

---

## enableWhen / disableWhen

Условное включение/отключение полей. Условие — замыкание без аргументов, читающее модель.

```mermaid
stateDiagram-v2
    [*] --> Disabled: hasDiscount = false
    Disabled --> Enabled: hasDiscount = true
    Enabled --> Disabled: hasDiscount = false

    Enabled: discountPercent поле активно
    Disabled: discountPercent поле disabled
```

### Использование

```typescript
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Поле активно только если hasDiscount = true
  enableWhen(model.$.discountPercent, () => model.hasDiscount, { resetOnDisable: true });

  // Или наоборот — отключить при условии
  disableWhen(model.$.manualTotal, () => model.autoCalculate);
});
```

### Опции

| Опция            | Тип       | Описание                         |
| ---------------- | --------- | -------------------------------- |
| `resetOnDisable` | `boolean` | Сбросить значение при отключении |

> `enableWhen` — state-операция: поле должно быть материализовано в форме (`createForm`), чтобы нода нашлась в реестре.

---

## onChange

Реагирует на изменение поля и выполняет callback. Колбэк выполняется ВНЕ effect-контекста — можно безопасно писать сигналы и ноды. Для async-колбэков 2-м аргументом приходит `{ signal }` (AbortSignal): при следующей смене значения предыдущий `signal` аннулируется.

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Country as country field
    participant Watch as onChange effect
    participant API as External API
    participant City as city field

    User->>Country: Выбирает "Russia"
    Country->>Watch: Signal изменился
    Note over Watch: debounce 300ms
    Watch->>API: fetchCities("Russia")
    API-->>Watch: ["Moscow", "SPb", ...]
    Watch->>City: updateComponentProps({ options })
    Watch->>City: model.city = null
```

### Использование

```typescript
const behavior = defineFormBehavior<AddressForm>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      if (!country) return;
      const cities = await fetchCities(country, { signal });
      form.city.updateComponentProps({ options: cities });
      model.city = null;
    },
    { debounce: 300 }
  );
});
```

### Опции

| Опция       | Тип       | Описание                        |
| ----------- | --------- | ------------------------------- |
| `debounce`  | `number`  | Задержка перед вызовом (мс)     |
| `immediate` | `boolean` | Вызвать сразу при инициализации |

> Низкоуровневый примитив `watchField(source, cb, opts)` (из `@reformer/core`) — без `debounce`/AbortSignal; в схемах поведения используйте `onChange`.

---

## copyFrom

Копирует значение из одного поля в другое (скаляр или группа-объект целиком).

```mermaid
flowchart LR
    subgraph Source["Источник"]
        shipping[shippingAddress]
    end

    subgraph Condition["Условие"]
        check{useShippingAsBilling?}
    end

    subgraph Target["Цель"]
        billing[billingAddress]
    end

    shipping --> check
    check -->|true| billing
    check -->|false| X[Не копировать]
```

### Использование

```typescript
const behavior = defineFormBehavior<CheckoutForm>(({ model }) => {
  copyFrom(model.$.shippingAddress, model.$.billingAddress, {
    when: () => model.useShippingAsBilling,
  });
});
```

---

## syncFields

Двусторонняя синхронизация двух полей.

```mermaid
flowchart LR
    field1[syncField1] <-->|sync| field2[syncField2]
```

### Использование

```typescript
const behavior = defineFormBehavior<MyForm>(({ model }) => {
  syncFields(model.$.field1, model.$.field2);
});
```

---

## resetWhen

Сбрасывает поле при выполнении условия.

### Использование

```typescript
const behavior = defineFormBehavior<MyForm>(({ model }) => {
  resetWhen(model.$.selectedCity, () => model.country !== previousCountry, { resetValue: '' });
});
```

---

## revalidateWhen

Перезапускает валидацию при изменении зависимостей. Первый аргумент — массив сигналов-зависимостей, второй — колбэк ревалидации.

```mermaid
flowchart LR
    password[password изменился]
    trigger[Триггер revalidateWhen]
    confirm[validateFormModel]

    password --> trigger --> confirm
```

### Использование

```typescript
const behavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  // Перевалидировать при изменении password
  revalidateWhen([model.$.password], () => validateFormModel(model, schema));
});
```

---

## transformValue

Трансформирует значение поля при изменении (идемпотентно).

### Использование

```typescript
const behavior = defineFormBehavior<MyForm>(({ model }) => {
  transformValue(
    model.$.phone,
    (value) => value.replace(/\D/g, '') // Только цифры
  );
});
```

---

## Комбинирование behaviors

```typescript
const behavior = defineFormBehavior<OrderForm>(({ model, form }) => {
  // 1. Вычисление итога
  compute(model.$.subtotal, () =>
    model.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  );

  // 2. Скидка активна только при subtotal > 100
  enableWhen(model.$.discountCode, () => model.subtotal > 100);

  // 3. При изменении страны — загрузить города
  onChange(model.$.country, async (country) => {
    const cities = await api.getCities(country);
    form.city.updateComponentProps({ options: cities });
  });

  // 4. Перевалидация при изменении зависимостей
  revalidateWhen([model.$.email], () => validateFormModel(model, schema));
});
```

---

## Best practices: типизация и структура callback'ов

Эти правила относятся ко всей схеме поведения (`defineFormBehavior<T>`).

### 1. Используй типизированный generic формы — НЕ `any`

`defineFormBehavior<T>` параметризован form-interface'ом. Передай его явно — тогда `model`/`form` и значения в callback'ах инферятся правильно:

```typescript
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import type { OrderForm } from './types';

// ✅ generic зафиксирован — TS инферит source-values, model, value
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  computeFrom([model.$.price, model.$.quantity], model.$.total, (price, quantity) => price * quantity);
});

// ❌ generic пропущен — silent fail на опечатках в имени поля
const behavior = defineFormBehavior(({ model }: any) => { ... });
```

### 2. Inline callback OK для коротких, extract module-level для содержательных

**Inline-callback** (короткие predicates, один вызов):

```typescript
enableWhen(model.$.discountCode, () => model.subtotal > 100);
copyFrom(model.$.shippingAddress, model.$.billingAddress, {
  when: () => model.sameAsShipping === true,
});
```

**Extracted module-level function** (предпочтительно для computeFrom, async onChange, любой логики >5 строк):

```typescript
// ✅ предпочтительно — extracted типизированный helper
function computeMonthlyPayment(loanAmount: number, loanTerm: number, annual: number): number {
  if (!loanAmount || !loanTerm || !annual || loanAmount <= 0 || loanTerm <= 0) return 0;
  const i = annual / 100 / 12;
  if (i <= 0) return Math.round(loanAmount / loanTerm);
  const factor = Math.pow(1 + i, loanTerm);
  return Math.round((loanAmount * (i * factor)) / (factor - 1));
}

const behavior = defineFormBehavior<LoanForm>(({ model }) => {
  computeFrom(
    [model.$.loanAmount, model.$.loanTerm, model.$.interestRate],
    model.$.monthlyPayment,
    computeMonthlyPayment // референс — TS инферит сигнатуру
  );
});
```

**Когда extract обязателен:**

- callback >5 строк или содержит несколько return-веток / try/catch;
- callback переиспользуется в нескольких behavior-вызовах (DRY);
- async onChange с try/catch на 10+ строк — extracted async-функция читаемее.

**Inline OK когда:**

- predicate в `enableWhen`/`disableWhen`/`copyFrom.when`;
- onChange с 2-3 строками простой логики;
- single computeFn на 1 line (`(price, qty) => price * qty`).

См. примеры: [`projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/behavior.ts`](../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/behavior.ts).

---

## Связанные документы

- [Архитектура](architecture.md)
- [Signals и реактивность](signals.md)
- [Валидация](validation.md)
