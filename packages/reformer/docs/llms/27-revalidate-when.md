# revalidateWhen — Перевалидация полей по триггерам

## Purpose

`revalidateWhen` перезапускает валидацию **target-поля**, когда изменяется любое из **trigger-полей**. Применяется, когда правило target зависит от значений других полей (`amount <= maxAmount`, `confirmPassword === password`, `initialPayment >= propertyValue * 0.2`). Без `revalidateWhen` валидатор target не получит сигнала о смене триггера и сохранит устаревшую ошибку. Не дублирует логику валидации — только просит перезапустить уже прописанные правила.

## API

```typescript
function revalidateWhen<TForm>(
  target: FieldPathNode<TForm, FormValue>,
  triggers: FieldPathNode<TForm, FormValue>[],
  options?: RevalidateWhenOptions,
): void;

interface RevalidateWhenOptions {
  /** Debounce в миллисекундах. */
  debounce?: number;
}
```

Внутри подписывается на `value.value` каждого `triggers[i]` и вызывает `target.validate()`. Если триггер исчез из формы (path не резолвится) — он игнорируется молча.

## Examples

### Базовый сценарий — amount ≤ maxAmount

```typescript
import { revalidateWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
import { max } from '@reformer/core/validators';
import type { FieldPath } from '@reformer/core';

interface PaymentForm {
  maxAmount: number;
  amount: number;
}

export const paymentValidation = (path: FieldPath<PaymentForm>) => {
  // ВНИМАНИЕ: max() сейчас принимает константу — для динамики комбинируйте с custom-валидатором
  max(path.amount, 1000);
};

export const paymentBehavior: BehaviorSchemaFn<PaymentForm> = (path) => {
  // Когда maxAmount меняется — перезапускаем валидацию amount
  revalidateWhen(path.amount, [path.maxAmount]);
};
```

Source: `BehaviorsExamples.tsx:252` (monorepo example).

### Несколько триггеров — initialPayment vs propertyValue/loanAmount

```typescript
import { revalidateWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface MortgageForm {
  propertyValue: number;
  loanAmount: number;
  initialPayment: number;
}

export const mortgageBehavior: BehaviorSchemaFn<MortgageForm> = (path) => {
  // initialPayment зависит и от propertyValue (минимум 20%), и от loanAmount (= propertyValue - loanAmount)
  revalidateWhen(path.initialPayment, [path.propertyValue, path.loanAmount], {
    debounce: 300,
  });
};
```

Source: `credit-application-behavior.ts:242-245` (monorepo example).

### Парная перевалидация — confirmPassword

```typescript
import { revalidateWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
import { equalTo } from '@reformer/core/validators';
import type { FieldPath } from '@reformer/core';

interface RegistrationForm {
  password: string;
  confirmPassword: string;
}

export const registrationValidation = (path: FieldPath<RegistrationForm>) => {
  equalTo(path.confirmPassword, path.password, { message: 'Пароли не совпадают' });
};

export const registrationBehavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
  // Если пользователь сначала ввёл confirm, потом меняет password — перевалидируем confirm
  revalidateWhen(path.confirmPassword, [path.password]);
};
```

### Edge case — перевалидация после async copyFrom

```typescript
import { revalidateWhen, copyFrom, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface CheckoutForm {
  sameEmail: boolean;
  email: string;
  emailAdditional: string;
}

export const checkoutBehavior: BehaviorSchemaFn<CheckoutForm> = (path) => {
  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
  });

  // После копирования валидаторы emailAdditional не догонят без явного триггера
  revalidateWhen(path.emailAdditional, [path.email, path.sameEmail], { debounce: 100 });
};
```

## Anti-patterns

```typescript
// ❌ Перевалидация ВСЕХ полей при изменении одного — оверкилл
revalidateWhen(path.field1, [path.x]);
revalidateWhen(path.field2, [path.x]);
revalidateWhen(path.field3, [path.x]);
// плюс field1/2/3 валидируются на собственное изменение → дублирующие пробеги

// ✅ Перевалидируйте только то, чьё правило ЗАВИСИТ от триггера
revalidateWhen(path.totalCheck, [path.x]); // одно поле
```

```typescript
// ❌ revalidateWhen вместо проверки в самом валидаторе
revalidateWhen(path.amount, [path.maxAmount]);
// но в схеме валидации стоит max(path.amount, 1000) — константа, не динамика

// ✅ Сначала custom-валидатор, читающий form, потом revalidateWhen
custom(path.amount, (value, form) => value <= form.maxAmount, { message: '...' });
revalidateWhen(path.amount, [path.maxAmount]);
```

```typescript
// ❌ Триггер == target
revalidateWhen(path.amount, [path.amount]);
// поле и так валидируется при изменении само по себе

// ✅ Триггеры — другие поля
revalidateWhen(path.amount, [path.maxAmount, path.discount]);
```

```typescript
// ❌ revalidateWhen на async-валидаторах без debounce
revalidateWhen(path.username, [path.email]);
// каждый keystroke email → fetch /username/check

// ✅ Debounce обязателен для async
revalidateWhen(path.username, [path.email], { debounce: 500 });
```

## Troubleshooting

**Q: Ошибка target не пропадает после изменения триггера.**
A: Проверьте, что (1) target имеет валидатор, который реально использует значение триггера (custom + read from form); (2) вы передали именно `path.trigger`, а не строку; (3) форма создана с текущим behavior (нет stale `useMemo`).

**Q: Валидация запускается слишком часто.**
A: Передайте `debounce: 200…500`. Для async-валидаторов debounce обязателен — иначе сервер получает шквал запросов.

**Q: Цикл при `revalidateWhen` + `transformValue` на target.**
A: `transformValue` модифицирует target → запускает свою validate → revalidateWhen видит изменение target… `revalidateWhen` подписан только на triggers, а не на target, поэтому цикла быть не должно. Если вы видите цикл — проверьте, не входит ли target в `triggers`.

**Q: Триггер — это вложенное поле в группе. Передаю `path.address.region` — не работает.**
A: `path.address.region` корректен, но если `address` создаётся как `FormProxy` динамически (например, через `apply`), убедитесь, что behavior вызывается **внутри** `apply`-callback с правильным path, а не из родителя.

**Q: Хочу перевалидировать после `form.patchValue(...)`.**
A: `revalidateWhen` сработает, потому что `patchValue` меняет values триггеров. Но если ваша задача — единый прогон валидации после загрузки данных, проще вызвать `await form.validate()` сразу после `patchValue` (см. [29-async-preload.md](./29-async-preload.md)).

## See also

- [03-api-signatures.md](./03-api-signatures.md) — встроенные валидаторы и custom
- [28-submit-and-reset.md](./28-submit-and-reset.md) — `form.validate()` целиком
- [11-async-watchfield.md](./11-async-watchfield.md) — низкоуровневая подписка на изменения
- [05-common-mistakes.md](./05-common-mistakes.md) — почему «всё перевалидировать» — антипаттерн
