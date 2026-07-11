---
sidebar_position: 3
---

# Условная логика

Условная **доступность** и **сброс** полей в зависимости от других полей. Три оператора:
`enableWhen`, `disableWhen`, `resetWhen`.

:::info Доступность ≠ валидация ≠ скрытие
Здесь речь о доступности и значениях. Смежные механизмы:

- **условная валидация** — нативный branch-узел схемы `{ when, children }`, исполняется
  `validateFormModel` (см. [Валидацию](../validation/overview));
- **скрытие из разметки** — условный рендер в JSX через `useFormControlValue` (см.
  [React-хуки](../react/hooks)).
  :::

## enableWhen

`enableWhen(target, condition, { resetOnDisable? })` включает/выключает поле реактивно. Пока условие
ложно, поле **disabled** и не участвует в валидации. С `resetOnDisable: true` значение поля
сбрасывается при выключении; по умолчанию `false` — значение сохраняется.

```typescript
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

type CreditForm = {
  loanType: 'mortgage' | 'car' | 'consumer';
  sameAsRegistration: boolean;
  propertyValue: number | null;
  initialPayment: number | null;
  residenceAddress: { city: string; street: string };
};

const behavior = defineFormBehavior<CreditForm>(({ model }) => {
  enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });
});
```

### Несколько целей и группы

`target` может быть **массивом** сигналов (одно условие на несколько полей) или **группой**
(поддерево целиком):

```typescript
const behavior = defineFormBehavior<CreditForm>(({ model }) => {
  // массив целей — одно условие на оба поля
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // группа — проходит по всему поддереву
  enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);
});
```

:::warning Групповой таргет — только DSL
Групповую цель поддерживает `enableWhen` из `@reformer/core/behaviors`. Одноимённый примитив из
`@reformer/core` резолвит только leaf-сигналы — на сигнале группы это тихий no-op.
:::

## disableWhen

`disableWhen(target, condition, { resetOnDisable? })` — инверсия `enableWhen`: выключает поле, когда
условие **истинно**.

```typescript
import { defineFormBehavior, disableWhen } from '@reformer/core/behaviors';

type OrderForm = { hasPromo: boolean; promoCode: string };

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // отключаем поле промокода, пока не отмечен флаг «есть промокод»
  disableWhen(model.$.promoCode, () => model.hasPromo === false, { resetOnDisable: true });
});
```

## resetWhen

`resetWhen(target, condition, { resetValue? })` сбрасывает значение поля к `resetValue`, когда
`condition` истинно. Альтернатива `enableWhen({ resetOnDisable: true })`, когда поле должно остаться
**enabled**, но содержимое нужно очистить. По умолчанию пишет `null`; для строк и чисел задавай
`resetValue` явно.

```typescript
import { defineFormBehavior, resetWhen } from '@reformer/core/behaviors';

type CheckoutForm = { paymentType: 'card' | 'cash'; cardNumber: string };

const behavior = defineFormBehavior<CheckoutForm>(({ model }) => {
  // сброс номера карты при переключении на наличные; поле остаётся доступным
  resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
});
```

:::tip enableWhen vs resetWhen

- Поле должно **исчезнуть** из валидации/состояния → `enableWhen(..., { resetOnDisable: true })`.
- Поле остаётся доступным, нужно лишь **очистить значение** → `resetWhen(..., { resetValue })`.
  :::

### Условие не должно читать собственную цель

`condition` в `resetWhen` (как и `when` в `copyFrom` / `enableWhen`) должно зависеть только от
**независимых** полей. Если оно читает целевое поле — сброс триггерит своё же условие:

```typescript
// ❌ самотриггер — условие читает cardNumber (цель)
resetWhen(model.$.cardNumber, () => model.cardNumber !== '');

// ✅ условие зависит только от независимого поля
resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
```

## Дальше

- [Синхронизация полей](./sync) — `copyFrom`, `syncFields`.
- [Вычисляемые поля](./computed) — `compute` с опцией `when` для условной записи.
- [Реакции на изменения](./watch) — `onChange` для сложной логики.
