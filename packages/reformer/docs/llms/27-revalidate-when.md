# revalidateWhen — Перевалидация по триггерам

## Purpose

`revalidateWhen` вызывает переданный колбэк ревалидации, когда изменяется любая из
зависимостей. Применяется, когда правило зависит от значений других полей
(`amount <= maxAmount`, `confirmPassword === password`, `initialPayment >= propertyValue * 0.2`).
Под M1 валидация on-demand (`validateFormModel`), поэтому ревалидация выражается явным
колбэком, а не автоматической привязкой к полю.

## API

Одинаково в примитиве (`@reformer/core`) и DSL (`@reformer/core/behaviors`):

```typescript
// примитив: возвращает cleanup
function revalidateWhen(deps: ReadonlySignal<unknown>[], revalidate: () => void): () => void;

// DSL: cleanup управляется формой
function revalidateWhen(deps: ReadonlySignal<unknown>[], revalidate: () => void): void;
```

`deps` — массив сигналов-триггеров (`model.$.field`). `revalidate` — колбэк (обычно
`() => validateFormModel(model, schema)`). Вызывается при изменении любой зависимости
(НЕ на инициализации), вне effect-контекста.

## Examples

### Базовый сценарий — перевалидация amount при смене maxAmount

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

export const paymentBehavior = defineFormBehavior<PaymentForm>(({ model }) => {
  revalidateWhen([model.$.maxAmount], () => {
    void validateFormModel(model, paymentSchema);
  });
});
```

Source: `BehaviorsExamples.tsx` (monorepo example): `revalidateWhen([model.$.maxAmount], () => validateFormModel(model, schema))`.

### Несколько триггеров

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

export const mortgageBehavior = defineFormBehavior<MortgageForm>(({ model }) => {
  // initialPayment зависит и от propertyValue, и от loanAmount
  revalidateWhen([model.$.propertyValue, model.$.loanAmount], () => {
    void validateFormModel(model, mortgageSchema);
  });
});
```

### Парная перевалидация — confirmPassword

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

// правило совпадения — cross-field ModelValidator на confirmPassword (см. 03-api-signatures.md)
export const registrationBehavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  // при смене password перевалидируем схему (confirm перепроверится)
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, registrationSchema);
  });
});
```

### Как примитив (вне defineFormBehavior)

```typescript
import { revalidateWhen, validateFormModel } from '@reformer/core';
const stop = revalidateWhen([model.$.maxAmount], () => void validateFormModel(model, schema));
```

## Anti-patterns

```typescript
// ❌ Триггер == поле, которое и так меняется само
revalidateWhen([model.$.amount], () => validateFormModel(model, schema));
// amount и так валидируется при собственном изменении в общем прогоне

// ✅ Триггеры — ДРУГИЕ поля, от которых зависит правило amount
revalidateWhen([model.$.maxAmount, model.$.discount], () => validateFormModel(model, schema));
```

```typescript
// ❌ Правило только через revalidateWhen, но в схеме нет зависимости от триггера
revalidateWhen([model.$.maxAmount], () => validateFormModel(model, schema));
// а валидатор amount — статичный max(1000), не читает maxAmount

// ✅ Сначала cross-field ModelValidator, читающий root, потом revalidateWhen
const amountVsMax: ModelValidator<number, unknown, Form> = (v, _s, root) =>
  v != null && root.maxAmount != null && v > root.maxAmount ? { code: 'tooBig', message: '...' } : null;
// amount: { value: model.$.amount, validators: [amountVsMax] }
revalidateWhen([model.$.maxAmount], () => validateFormModel(model, schema));
```

## Troubleshooting

**Q: Ошибка target не пропадает после изменения триггера.**
A: Проверьте, что (1) правило реально читает значение триггера через `root` (cross-field
`ModelValidator`); (2) в `deps` передан именно сигнал (`model.$.trigger`); (3) колбэк вызывает
`validateFormModel` (роутит ошибки в ноды).

**Q: Как перевалидировать только одно поле, а не всю схему?**
A: Передай в колбэк под-схему только этого поля: `validateFormModel(model, { children: [fieldNode] })`.

## See also

- [03-api-signatures.md](./03-api-signatures.md) — cross-field `ModelValidator` и `validateFormModel`
- [28-submit-and-reset.md](./28-submit-and-reset.md) — полная валидация формы
- [20-compute-vs-watch.md](./20-compute-vs-watch.md) — реактивные производные значения
