---
sidebar_position: 4
---

# Синхронизация полей

Копирование значений между полями и двусторонняя синхронизация. Три оператора: `copyFrom`,
`syncFields`, `transformValue`.

## copyFrom

`copyFrom(source, target, { when?, transform? })` копирует значение из `source` в `target` при
выполнении условия `when`. Источник и цель — **скаляр** (`model.$.field`) или **группа целиком**
(`model.$.group`). Оператор сам выходит из реактивного контекста, поэтому не порождает «Cycle
detected».

```typescript
import { defineFormBehavior, copyFrom } from '@reformer/core/behaviors';

type Address = { street: string; city: string };

type OrderForm = {
  useShippingAsBilling: boolean;
  shippingAddress: Address;
  billingAddress: Address;
};

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // копирование группы целиком — когда флаг включён
  copyFrom(model.$.shippingAddress, model.$.billingAddress, {
    when: () => model.useShippingAsBilling === true,
  });
});
```

### Copy + transform

`transform` применяется к значению перед записью в target:

```typescript
import { defineFormBehavior, copyFrom } from '@reformer/core/behaviors';

type ContactForm = { sameEmail: boolean; email: string; emailAdditional: string };

const behavior = defineFormBehavior<ContactForm>(({ model }) => {
  copyFrom(model.$.email, model.$.emailAdditional, {
    when: () => model.sameEmail === true,
    transform: (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  });
});
```

:::info copyFrom при `when === false` не откатывает
Когда условие становится ложным, `copyFrom` просто перестаёт писать — значение target остаётся
последним скопированным. Чтобы очистить target при снятии флага, добавь параллельно `resetWhen`.
:::

## syncFields

`syncFields(a, b, { transform? })` создаёт **двустороннюю** связь: изменение любого из полей
переписывает второе. Внутренний guard исключает петли. `transform` **асимметричен** — применяется
только при движении `a → b`; обратно значение пишется как есть.

```typescript
import { defineFormBehavior, syncFields } from '@reformer/core/behaviors';

type DisplayForm = { internalCode: string; displayCode: string };

const behavior = defineFormBehavior<DisplayForm>(({ model }) => {
  // internalCode → displayCode: uppercase; обратно значение пишется как есть
  syncFields(model.$.internalCode, model.$.displayCode, {
    transform: (value) => (typeof value === 'string' ? value.toUpperCase() : value),
  });
});
```

:::warning Двустороннюю связь делает syncFields, а не пара copyFrom
Симметричная пара `copyFrom(a, b)` + `copyFrom(b, a)` конфликтует по направлению. Для двусторонней
связи бери `syncFields`; для одностороннего копирования по условию — `copyFrom`.
:::

## transformValue

`transformValue(target, transformer)` подписывается на изменение поля и переписывает его
трансформированной версией: uppercase для кодов, `trim + toLowerCase` для email, округление чисел.
Применяется ко всем источникам изменения (пользователь, `model.field = …`, `copyFrom`).

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

type ProfileForm = { promoCode: string; email: string; amount: number };

const behavior = defineFormBehavior<ProfileForm>(({ model }) => {
  transformValue(model.$.promoCode, (value) => (value ?? '').toUpperCase());
  transformValue(model.$.email, (value) => (value ?? '').trim().toLowerCase());
  transformValue(model.$.amount, (value) =>
    typeof value === 'number' ? Math.round(value) : value
  );
});
```

:::warning Трансформер обязан быть идемпотентным
`transformValue` пишет обратно в то же поле, поэтому `f(f(x)) === f(x)` обязательно — иначе
бесконечный цикл. Для добавления префикса ставь guard «уже преобразовано»:

```typescript
// ❌ f(f(x)) = "prefix-prefix-x" ≠ f(x)
transformValue(model.$.field, (v) => `prefix-${v}`);

// ✅ guard
transformValue(model.$.field, (v) => (v?.startsWith('prefix-') ? v : `prefix-${v}`));
```

:::

:::info transformValue vs compute
`transformValue` нормализует **само** поле — доступа к другим полям у него нет. Если значение
зависит от других полей, это [`compute`](./computed#compute), а не `transformValue`.
:::

## Дальше

- [Условная логика](./conditional) — `resetWhen` для сброса target.
- [Вычисляемые поля](./computed) — `compute` для производных значений.
- [Реакции на изменения](./watch) — `onChange`, `revalidateWhen`.
