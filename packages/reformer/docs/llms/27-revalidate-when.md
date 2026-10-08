# revalidateWhen — Перевалидация по триггерам

## Purpose

`revalidateWhen` вызывает переданный колбэк ревалидации, когда изменяется любая из
зависимостей. Применяется, когда правило зависит от значений других полей
(`amount <= maxAmount`, `confirmPassword === password`, `initialPayment >= propertyValue * 0.2`).
Валидация — отдельная функция-схема (`@reformer/core/validation`), прогоняемая по требованию через
`validateModel(model, schema)`. Поэтому ревалидация выражается явным колбэком, а не автоматической
привязкой к полю: поведение (`revalidateWhen`) лишь _инициирует_ прогон схемы валидации при изменении зависимости.

## API

`revalidateWhen` — оператор поведения (`@reformer/core/behaviors`, либо примитив `@reformer/core/model`).
Его сигнатура НЕ зависит от контракта валидации:

```typescript
// примитив: возвращает cleanup
function revalidateWhen(deps: ReadonlySignal<unknown>[], revalidate: () => void): () => void;

// DSL: cleanup управляется формой
function revalidateWhen(deps: ReadonlySignal<unknown>[], revalidate: () => void): void;
```

`deps` — массив сигналов-триггеров (`model.$.field`). `revalidate` — колбэк (обычно
`() => void validateModel(model, schema)`, где `schema` — `defineValidationSchema<T>(({ model }) => …)`).
Вызывается при изменении любой зависимости (НЕ на инициализации), вне effect-контекста.

## Examples

### Базовый сценарий — перевалидация amount при смене maxAmount

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

export const paymentBehavior = defineFormBehavior<PaymentForm>(({ model }) => {
  revalidateWhen([model.$.maxAmount], () => {
    void validateModel(model, paymentSchema);
  });
});
```

Пример: `revalidateWhen([model.$.maxAmount], () => void validateModel(model, paymentSchema))`.
Схема `paymentSchema` — стабильный module-level `const` (важно для отмены устаревших прогонов
в `validateModel`), где правило amount навешано оператором `cross` области схемы:
`cross(model.$.amount, amountVsMax)`.

### Несколько триггеров

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

export const mortgageBehavior = defineFormBehavior<MortgageForm>(({ model }) => {
  // initialPayment зависит и от propertyValue, и от loanAmount
  revalidateWhen([model.$.propertyValue, model.$.loanAmount], () => {
    void validateModel(model, mortgageSchema);
  });
});
```

### Парная перевалидация — confirmPassword

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';

// правило совпадения — cross-field в схеме: cross(model.$.confirmPassword, passwordsMatch),
// где passwordsMatch получает снимок формы (см. 03-api-signatures.md)
export const registrationBehavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  // при смене password перевалидируем схему (confirm перепроверится)
  revalidateWhen([model.$.password], () => {
    void validateModel(model, registrationSchema);
  });
});
```

### Как примитив (вне defineFormBehavior)

```typescript
import { revalidateWhen } from '@reformer/core/model';
import { validateModel } from '@reformer/core/validation';

const stop = revalidateWhen([model.$.maxAmount], () => void validateModel(model, schema));
```

## Anti-patterns

```typescript
// ❌ Триггер == поле, которое и так меняется само
revalidateWhen([model.$.amount], () => validateModel(model, schema));
// amount и так валидируется при собственном изменении в общем прогоне

// ✅ Триггеры — ДРУГИЕ поля, от которых зависит правило amount
revalidateWhen([model.$.maxAmount, model.$.discount], () => validateModel(model, schema));
```

```typescript
// ❌ Правило только через revalidateWhen, но в схеме нет зависимости от триггера
revalidateWhen([model.$.maxAmount], () => validateModel(model, schema));
// а валидатор amount — статичный max(1000), не читает maxAmount

// ✅ Сначала cross-field правило (получает снимок формы) в схеме валидации, потом revalidateWhen
const amountVsMax = (form: Form): ValidationError | null =>
  form.amount != null && form.maxAmount != null && form.amount > form.maxAmount
    ? { code: 'tooBig', message: '...' }
    : null;

const schema = defineValidationSchema<Form>(({ model, cross }) => {
  cross(model.$.amount, amountVsMax); // навешиваем правило на поле amount
});
revalidateWhen([model.$.maxAmount], () => void validateModel(model, schema));
```

## Troubleshooting

**Q: Ошибка target не пропадает после изменения триггера.**
A: Проверьте, что (1) правило реально читает значение триггера — cross-field `cross(sig, check)`,
где `check` получает снимок формы; (2) в `deps` передан именно сигнал (`model.$.trigger`);
(3) колбэк вызывает `validateModel` (он разносит ошибки по нодам формы).

**Q: Как перевалидировать только одно поле, а не всю схему?**
A: Схема — обычная функция, поэтому опиши стабильную под-схему только для этого поля и прогони её:
`validateModel(model, oneFieldSchema)`, где
`const oneFieldSchema = defineValidationSchema<Form>(({ model, cross }) => cross(model.$.amount, amountVsMax))`.
Раннер выставит/погасит ошибки только затронутых полей (гашение накапливается на пару `(model, schema)`).

## See also

- [03-api-signatures.md](./03-api-signatures.md) — cross-field `cross` области схемы и раннер `validateModel`
- [28-submit-and-reset.md](./28-submit-and-reset.md) — полная валидация формы
- [20-compute-vs-watch.md](./20-compute-vs-watch.md) — реактивные производные значения
