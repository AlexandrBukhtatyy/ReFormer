---
sidebar_position: 3
---

# Условная логика

Условная **доступность** и **сброс** полей в зависимости от других полей — операторы `enableWhen`,
`disableWhen`, `resetWhen` — и условное **скрытие** узлов схемы — `hideWhen`.

:::info Доступность ≠ валидация ≠ скрытие
Здесь речь о доступности и значениях. Смежные механизмы:

- **условная валидация** — оператор `validateWhen(cond, () => …)` в схеме валидации (см.
  [Валидацию](../validation/overview));
- **скрытие из разметки** — `hideWhen` над узлом схемы, если форму рисует рендерер (см.
  [ниже](#скрытие-узлов-схемы)); в разметке руками — условный рендер через `useFormControlValue`
  (см. [React-хуки](../react/hooks)).
  :::

## enableWhen

`enableWhen(target, condition, { resetOnDisable? })` включает/выключает поле реактивно. Пока условие
ложно, поле **disabled**: его замечания сняты, а `valid` / `invalid` формы его не учитывают. С
`resetOnDisable: true` значение поля сбрасывается при выключении; по умолчанию `false` — значение
сохраняется.

:::warning Правила доступность не читают
Схема валидации проверяет модель и о доступности нод не знает: правило выключенного поля
по-прежнему участвует в прогоне `bundle.submit` / `bundle.validate`. Условие для правила задаётся
в самой схеме валидации — `validateWhen(() => model.loanType === 'mortgage', () => …)`. Удобно
держать условие одной функцией-предикатом и звать её и в `enableWhen`, и в `validateWhen`.
:::

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

:::warning Только DSL
`enableWhen` / `disableWhen` меняют состояние нод формы, поэтому живут только в DSL
`@reformer/core/behaviors` — императивного примитива у них нет. Поле-цель должно быть в форме: у
строк массива подключайте поведение через `applyEach`.
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

- Поле должно стать **недоступным** (и не показывать замечаний) → `enableWhen(..., { resetOnDisable: true })`;
  правило поля при этом оборачивается в `validateWhen` с тем же условием.
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

## Скрытие узлов схемы

`hideWhen(node, condition)` скрывает узел схемы, пока условие истинно: секцию, шаг, отдельное поле.
Узел берётся из схемы области поведения по `selector` — `schema.node('mortgage')`. Оператор
записывает правило, а исполняет его рендерер (`FormRenderer`); в разметке руками правило не
действует — там скрывают условным рендером.

```typescript
import { defineFormBehavior, enableWhen, hideWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<CreditForm>(({ model, schema }) => {
  // узел схемы: { selector: 'mortgage', component: Section, children: [...] }
  hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');
  // скрытое поле не должно уходить в проверку — выключаем его тем же условием
  enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', { resetOnDisable: true });
});
```

Скрытие не меняет ни значение, ни доступность поля: правила проверяют и скрытые поля. Если поле
не должно проверяться, выключайте его `enableWhen` с тем же условием, а правило оборачивайте в
`validateWhen`. Принудительное `schema.node(selector).setHidden(...)` (например, из
`bundle.render.node(selector)` снаружи формы) главнее условия.

## Дальше

- [Синхронизация полей](./sync) — `copyFrom`, `syncFields`.
- [Вычисляемые поля](./computed) — `compute` с опцией `when` для условной записи.
- [Реакции на изменения](./watch) — `onChange` для сложной логики.
