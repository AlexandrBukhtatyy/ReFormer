---
sidebar_position: 3
---

# Условная логика

Поле включается, выключается или очищается по значению других полей, а узел схемы скрывается по
условию. Это операторы [поведения](../reference/glossary.md) `enableWhen`, `disableWhen`,
`resetWhen` и `hideWhen`.

## Когда нужно

- Поля ипотеки нужны только при типе кредита «ипотека».
- Промокод вводят, только если отмечен флаг «Есть промокод».
- При переходе на оплату наличными номер карты нужно стереть.
- Секцию формы нужно спрятать целиком.

## Пример

```typescript
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

type Credit = {
  loanType: 'mortgage' | 'car' | 'consumer';
  propertyValue: number | null;
  initialPayment: number | null;
};

const creditBehavior = defineFormBehavior<Credit>(({ model }) => {
  // Поля ипотеки доступны только для ипотеки; при выключении очищаются.
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });
});
```

Живой пример с `enableWhen` — на странице [Вычисляемые поля](./computed.mdx).

## enableWhen

`enableWhen(цель, условие, { resetOnDisable? })` держит поле доступным, пока условие истинно, и
выключает, когда ложно.

Выключенное поле:

- не проверяется: проверка формы, шага, отправка и живая стратегия его правила пропускают, а его
  замечания снимаются;
- не влияет на `valid` формы;
- остаётся в значениях модели и уходит в отправку. Чтобы значение не уходило, включите
  `resetOnDisable: true` — при выключении поле вернётся к значению, с которым создано.

Цель — одно поле, массив полей или группа целиком:

```typescript
const profileBehavior = defineFormBehavior<Profile>(({ model }) => {
  // массив целей — одно условие на два поля
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage');

  // группа — всё поддерево адреса
  enableWhen(model.$.residenceAddress, () => model.sameAsRegistration === false);
});
```

:::warning Только внутри `defineFormBehavior`
`enableWhen` и `disableWhen` меняют состояние нод формы, поэтому отдельных функций для них нет.
У поля-цели должна быть нода в форме — узел в схеме. Для полей строк массива подключайте поведение
строки через [`applyEach`](./custom.md#applyeach).
:::

:::info Раннер без сборки не знает о доступности
`validateModel(model, rules)` проверяет модель и не смотрит на ноды. Там условие пишут в самих
правилах — `validateWhen(() => model.loanType === 'mortgage', () => …)`.
:::

## disableWhen

`disableWhen(цель, условие, { resetOnDisable? })` — обратный `enableWhen`: поле выключено, пока
условие **истинно**.

```typescript
import { defineFormBehavior, disableWhen } from '@reformer/core/behaviors';

type Order = { hasPromo: boolean; promoCode: string };

const orderBehavior = defineFormBehavior<Order>(({ model }) => {
  disableWhen(model.$.promoCode, () => !model.hasPromo, { resetOnDisable: true });
});
```

## resetWhen

`resetWhen(цель, условие, { resetValue })` записывает в поле `resetValue`, когда условие истинно.
Поле при этом остаётся доступным. Без `resetValue` пишется `null`, поэтому для поля, в тип которого
`null` не входит (строка, число), `resetValue` обязателен — иначе код не скомпилируется.

```typescript
import { defineFormBehavior, resetWhen } from '@reformer/core/behaviors';

type Checkout = { paymentType: 'card' | 'cash'; cardNumber: string };

const checkoutBehavior = defineFormBehavior<Checkout>(({ model }) => {
  // Перешли на наличные — номер карты стёрт, поле остаётся доступным.
  resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
});
```

Что выбрать:

- поле должно стать недоступным и не проверяться — `enableWhen(…, { resetOnDisable: true })`;
- поле остаётся доступным, нужно только очистить значение — `resetWhen(…, { resetValue })`.

## Скрытие узлов схемы

`hideWhen(узел, условие)` скрывает узел схемы — секцию, шаг, поле, — пока условие истинно. Узел
берут из области поведения по `selector`: `schema.node('mortgage')`. Правило выполняет рендерер
`FormRenderer`; если форму рисуют руками в JSX, скрывают условным рендером по
[`useFormControlValue`](../react/hooks.md#useformcontrolvalue).

```typescript
import { defineFormBehavior, enableWhen, hideWhen } from '@reformer/core/behaviors';

const creditBehavior = defineFormBehavior<Credit>(({ model, schema }) => {
  // узел схемы: { selector: 'mortgage', component: Section, children: [...] }
  hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');
  // скрытое поле проверялось бы — выключаем его тем же условием
  enableWhen(model.$.propertyValue, () => model.loanType === 'mortgage', { resetOnDisable: true });
});
```

Скрытие не меняет ни значение, ни доступность поля: правила проверяют и скрытые поля. Чтобы поле
не проверялось, выключите его `enableWhen` с тем же условием. Явный
`schema.node(selector).setHidden(...)` — например, снаружи формы через `bundle.render.node(selector)`
— главнее условия.

## Подводные камни

- **Условие не должно читать собственную цель.** `resetWhen(model.$.cardNumber, () =>
model.cardNumber !== '')` запускает сам себя. Условие зависит только от других полей — так же у
  `enableWhen` и `copyFrom`.
- **Доступность — не валидация.** Чтобы правило действовало только в части формы, есть
  `validateWhen` в схеме валидации; `enableWhen` выключает само поле.
- **Вычисляемое поле под `enableWhen`** требует того же условия в опции `when` у `compute` — см.
  [Вычисляемые поля](./computed.mdx#условный-пересчёт).
- **`componentProps.disabled` поле не выключает** — только элемент интерфейса. Выключает
  `enableWhen`, `disableWhen` или ключ узла `disabled`.

## См. также

- [Вычисляемые поля](./computed.mdx) — `compute` с условием `when`.
- [Синхронизация полей](./sync.md) — `copyFrom`, `syncFields`.
- [Обзор валидации](../validation/overview.mdx#условная-валидация) — `validateWhen`.
