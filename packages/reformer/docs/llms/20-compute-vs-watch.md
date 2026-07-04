## 17. COMPUTE vs ONCHANGE

Под M1 behaviors работают на сигналах модели. Есть два способа их писать:

- **примитивы из `@reformer/core`** — принимают сигналы, возвращают cleanup, вызываются
  императивно (например, в `useEffect`), cleanup складывается в массив;
- **декларативный DSL из `@reformer/core/behaviors`** — `defineFormBehavior(...)` + операторы,
  cleanup управляется формой, передаётся в `createForm({ behavior })`.

Для производных значений — `compute`/`computeFrom`. Для side-эффектов на изменение (async,
обновление componentProps) — `onChange` (DSL) или примитив `watchField`.

### compute — auto-tracking (DSL)

`compute(target, read)` подписывается на сигналы, прочитанные внутри `read()`, и пишет
результат в `target`. Цель не входит в источники → цикла нет; запись идемпотентна (peek-guard).
Кросс-уровневые вычисления работают так же — читай любые поля модели.

```typescript
import { defineFormBehavior, compute } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  // same-level
  compute(model.$.total, () => (model.price ?? 0) * (model.quantity ?? 0));

  // nested-to-nested / cross-level — просто читаем нужные поля
  compute(model.$.fullName, () =>
    [model.personalData.firstName, model.personalData.lastName].filter(Boolean).join(' ')
  );

  // условный пересчёт
  compute(model.$.initialPayment, () => model.propertyValue * 0.2, {
    when: () => model.loanType === 'mortgage',
  });
});
```

> **Не читай `model.get()` внутри `compute`/`when`** — это нереактивный снимок, зависимость не
> отследится и пересчёта не будет. Читай поля по отдельности (`model.field` или `model.$.field.value`).
> `model.get()` — только вне реактивного контекста (в `onChange`, обработчиках событий).

### Computed sum over a FormArray

Агрегат по массиву (сумма доходов созаёмщиков и т.п.) считается **реактивно** через value-proxy
массива — `model.<array>.map(...)`:

```typescript
compute(model.$.coBorrowersIncome, () =>
  model.coBorrowers.map((cb) => cb.monthlyIncome ?? 0).reduce((s, v) => s + v, 0)
);
```

Почему реактивно: `.map` читает сигнал самого массива (трекает `push`/`removeAt`/reorder) **и**
внутри колбэка читает каждый `cb.<field>` (трекает правки элементов) → пересчёт срабатывает на оба
вида изменений.

Ключевой нюанс — **на каком proxy** живёт `.map`/`.reduce`(-via-`.map`):

- **value-proxy `model.coBorrowers`** — есть `.map`/`.forEach`/`.at`/индексы (обходит элементы как
  значения). Именно его читай в `compute`.
- **signals-proxy `model.$.coBorrowers`** — только индексный доступ и `.length`, без `.map`. Для
  агрегата не подходит.

Если нужен только **счётчик** (пересчёт лишь на изменение длины, без чтения полей элементов) —
`model.<array>.map(() => null)` (длина трекается, значения — нет):

```typescript
// зависит только от КОЛИЧЕСТВА элементов, не от их полей
compute(model.$.interestRate, () => computeRate(model.properties.map(() => null).length));
```

> **Не агрегируй через `model.get()` / `model.<array>.peek()`** в `compute` — это нереактивный
> снапшот массива, зависимость не отследится и сумма не пересчитается. Читай массив только через
> value-proxy `model.<array>.map(...)`.

### computeFrom — явный список источников

Когда нужен явный контроль зависимостей — `computeFrom(sources, target, fn)`. Значения
источников приходят в `fn` позиционно.

```typescript
import { computeFrom } from '@reformer/core/behaviors'; // или из '@reformer/core' как примитив

computeFrom(
  [model.$.loanAmount, model.$.loanTerm, model.$.interestRate],
  model.$.monthlyPayment,
  (amount, term, rate) => annuityMonthly(amount ?? 0, term ?? 0, rate ?? 0)
);
```

> Примитив `computeFrom` из `@reformer/core` имеет ту же сигнатуру и возвращает cleanup-функцию.

### onChange — реакция на изменение (async, side-effects)

`onChange(source, cb, { debounce, immediate })` вызывает `cb(value, { signal })` при изменении.
Колбэк выполняется ВНЕ effect-контекста — можно писать сигналы/ноды. `signal` (AbortSignal)
аннулируется при следующей смене значения.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      const cities = await fetchCities(country, { signal });
      form.city.updateComponentProps({ options: cities });
    },
    { debounce: 300 }
  );
});
```

### Примитив watchField

Низкоуровневая подписка из `@reformer/core` (без debounce/AbortSignal). `onChange` построен
поверх неё. Для простых синхронных реакций:

```typescript
import { watchField } from '@reformer/core';
const stop = watchField(model.$.country, () => { model.city = ''; });
```

### Rule of Thumb

| Scenario | Use |
|----------|-----|
| Производное значение (любой уровень) | `compute` (auto-tracking) |
| Производное с явными зависимостями | `computeFrom` |
| Async-реакция, обновление componentProps | `onChange` (debounce + AbortSignal) |
| Простая синхронная реакция (примитив) | `watchField` |

### Chained computeds

Если несколько вычислений зависят друг от друга (`interestRate` → `monthlyPayment` →
`paymentToIncomeRatio`), объяви каждое отдельным `compute` — они выстроятся в правильном
порядке через реактивный граф (цель одного = источник другого). Расходящиеся взаимные
`compute` без стабилизации бросят понятную ошибку (см. `22-cycle-detection.md`).
