---
sidebar_position: 2
---

# Вычисляемые поля

Производные значения, которые автоматически пересчитываются при изменении полей-источников. Два
оператора: `compute` (auto-tracking) и `computeFrom` (явные зависимости).

## compute

`compute(target, read, { when? })` — вычисляемое поле с **auto-tracking**: подписывается на все
сигналы, прочитанные внутри `read()`, и пишет результат в `target`. Цель **не** входит в источники,
поэтому цикла не возникает; запись идемпотентна — если значение не изменилось, оператор не пишет.

```typescript
import { defineFormBehavior, compute } from '@reformer/core/behaviors';

type OrderForm = {
  price: number;
  quantity: number;
  total: number;
  personalData: { firstName: string; lastName: string };
  fullName: string;
};

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // На одном уровне — читаем поля напрямую (подписка авто)
  compute(model.$.total, () => (model.price ?? 0) * (model.quantity ?? 0));

  // Кросс-уровневое вычисление — просто читаем нужные поля модели
  compute(model.$.fullName, () =>
    [model.personalData.firstName, model.personalData.lastName].filter(Boolean).join(' ')
  );
});
```

:::warning Не читай `model.get()` внутри `compute`
`model.get()` — нереактивный снимок: зависимость не отследится и пересчёта не будет. Читай поля по
отдельности (`model.field`). `model.get()` — только вне реактивного контекста (в `onChange`,
обработчиках событий).
:::

### Условный пересчёт — `when`

Опция `{ when }` пересчитывает поле только когда условие истинно:

```typescript
compute(model.$.initialPayment, () => Math.round((model.propertyValue ?? 0) * 0.2), {
  when: () => model.loanType === 'mortgage',
});
```

## computeFrom

Когда нужен явный контроль зависимостей — `computeFrom(sources, target, fn, { when? })`. Значения
источников приходят в `fn` **позиционно**, в порядке массива `sources`.

```typescript
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

type LoanForm = {
  loanAmount: number;
  loanTerm: number;
  interestRate: number;
  monthlyPayment: number;
};

const behavior = defineFormBehavior<LoanForm>(({ model }) => {
  computeFrom(
    [model.$.loanAmount, model.$.loanTerm, model.$.interestRate],
    model.$.monthlyPayment,
    (amount, term, rate) => annuityMonthly(amount ?? 0, term ?? 0, rate ?? 0)
  );
});
```

:::info compute vs computeFrom
`compute` короче, зависимости выводятся из чтения полей — обычный случай. `computeFrom` берёт явный
список источников и отдаёт их значения позиционно — когда нужен точный контроль набора зависимостей.
:::

## Подключение к форме

Behavior подключается к форме через `createForm({ model, schema, behavior })`, дальше значения
пересчитываются сами:

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, compute } from '@reformer/core/behaviors';

type PriceForm = { price: number; quantity: number; total: number };

const model = createModel<PriceForm>({ price: 100, quantity: 2, total: 0 });

const behavior = defineFormBehavior<PriceForm>(({ model }) => {
  compute(model.$.total, () => model.price * model.quantity);
});

// schema привязывает поля к компонентам (см. «Быстрый старт»)
const form = createForm<PriceForm>({ model, schema, behavior });

model.price = 150;
model.total; // 300 — пересчиталось автоматически
```

## Агрегаты по массиву

Сумма по строкам динамического массива (например, суммарный доход созаёмщиков) считается
**реактивно** через value-proxy массива — `model.<array>.map(...)`:

```typescript
compute(model.$.coBorrowersIncome, () =>
  model.coBorrowers.map((cb) => cb.monthlyIncome ?? 0).reduce((sum, v) => sum + v, 0)
);
```

`.map` читает сигнал самого массива (реагирует на `push` / `removeAt` / reorder) **и** внутри
колбэка каждый `cb.<field>` (реагирует на правки элементов) → пересчёт срабатывает на оба вида
изменений.

:::warning Агрегат — только через value-proxy `model.<array>`
Читай агрегат через **value-proxy** `model.coBorrowers` (есть `.map` / `.forEach` / `.at`; для суммы
— `.map(...).reduce(...)` на результате `.map`), а не через `model.get()` / `.toArray()` (нереактивный
снимок — сумма не пересчитается) и не через signals-proxy `model.$.coBorrowers` (у него только индексы
и `.length`, без `.map`).
:::

Если нужен только **счётчик** (пересчёт лишь на изменение длины, без чтения полей элементов):

```typescript
// зависит только от КОЛИЧЕСТВА элементов, не от их полей
compute(model.$.interestRate, () => computeRate(model.properties.map(() => null).length));
```

## Цепочки вычислений

Если одно вычисляемое поле зависит от другого (`monthlyPayment` → `paymentToIncome`), объяви каждое
отдельным `compute` — они выстроятся в правильном порядке через реактивный граф (цель одного
вычисления = источник другого):

```typescript
const behavior = defineFormBehavior<CreditForm>(({ model }) => {
  compute(model.$.monthlyPayment, () =>
    annuityMonthly(model.loanAmount, model.loanTerm, model.interestRate)
  );
  compute(model.$.paymentToIncome, () => model.monthlyPayment / (model.monthlyIncome || 1));
});
```

## Защита от циклов

Цель не входит в источники, а запись идемпотентна — сходящийся пересчёт не зацикливается. Проблему
создаёт лишь **расходящийся взаимный** `compute` (два поля бесконечно гоняют значение друг у друга):

```typescript
// ❌ расходится → понятная ошибка «расходящийся цикл пересчёта»
compute(model.$.a, () => model.b + 1);
compute(model.$.b, () => model.a + 1);

// ✅ однонаправленная зависимость
compute(model.$.total, () => model.price * model.quantity);

// ✅ либо стабилизирующее условие when
compute(model.$.a, () => model.b + 1, { when: () => model.a !== model.b + 1 });
```

## Дальше

- [Условная логика](./conditional) — `enableWhen`, `resetWhen`.
- [Синхронизация полей](./sync) — `copyFrom`, `syncFields`, `transformValue`.
- [Реакции на изменения](./watch) — `onChange` для async-эффектов.
