---
sidebar_position: 4
---

# Синхронизация полей

Значение одного поля копируется в другое, два поля держатся одинаковыми, значение нормализуется при
вводе. Это операторы [поведения](../reference/glossary.md) `copyFrom`, `syncFields` и
`transformValue`.

## Когда нужно

- «Адрес доставки совпадает с адресом регистрации» — копирование группы по флагу.
- Одно значение в двух полях разного вида — двусторонняя связь.
- Код в верхнем регистре, email без пробелов, сумма без копеек — нормализация.

## Пример

```typescript
import { copyFrom, defineFormBehavior } from '@reformer/core/behaviors';

type Address = { city: string; street: string };
type Order = { sameAddress: boolean; shipping: Address; billing: Address };

const orderBehavior = defineFormBehavior<Order>(({ model }) => {
  // Пока флаг включён, адрес оплаты повторяет адрес доставки.
  copyFrom(model.$.shipping, model.$.billing, { when: () => model.sameAddress });
});
```

## copyFrom

`copyFrom(источник, цель, { when?, transform? })` копирует значение источника в цель, пока условие
`when` истинно. Источник и цель — поле (`model.$.email`) или группа целиком (`model.$.shipping`).

`transform` меняет значение перед записью:

```typescript
copyFrom(model.$.email, model.$.billingEmail, {
  when: () => model.sameEmail,
  transform: (email) => email.trim().toLowerCase(),
});
```

- Когда условие становится ложным, `copyFrom` перестаёт копировать, но цель не очищает. Очистить
  её — `resetWhen` с обратным условием.
- Группы разной формы копируются по общим полям: поля цели, которых нет в источнике, остаются
  прежними (в режиме разработки — предупреждение). Значение цели целиком собирает `transform`.

## syncFields

`syncFields(a, b, { transform? })` связывает два поля в обе стороны: правка любого переписывает
другое. При создании связи `b` получает значение `a`.

```typescript
import { defineFormBehavior, syncFields } from '@reformer/core/behaviors';

type Codes = { internalCode: string; displayCode: string };

const codesBehavior = defineFormBehavior<Codes>(({ model }) => {
  // a → b — в верхнем регистре; b → a — как есть.
  syncFields(model.$.internalCode, model.$.displayCode, {
    transform: (code) => code.toUpperCase(),
  });
});
```

`transform` применяется только в направлении `a → b`. Пару `copyFrom(a, b)` + `copyFrom(b, a)`
вместо `syncFields` не собирайте: два копирования спорят о направлении.

## transformValue

`transformValue(поле, f)` переписывает значение поля результатом `f` после каждого изменения — от
пользователя, от `model.x = …`, от другого оператора.

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

type Profile = { promoCode: string; email: string; amount: number | null };

const profileBehavior = defineFormBehavior<Profile>(({ model }) => {
  transformValue(model.$.promoCode, (code) => code.toUpperCase());
  transformValue(model.$.email, (email) => email.trim().toLowerCase());
  transformValue(model.$.amount, (amount) => (amount === null ? null : Math.round(amount)));
});
```

`f` должна быть идемпотентной: `f(f(x))` равно `f(x)`. Иначе запись запускает новую запись без
конца.

```typescript
// ❌ f(f(x)) = "prefix-prefix-x"
transformValue(model.$.code, (code) => `prefix-${code}`);

// ✅ уже преобразованное значение не меняется
transformValue(model.$.code, (code) => (code.startsWith('prefix-') ? code : `prefix-${code}`));
```

`transformValue` видит только своё поле. Значение, которое зависит от других полей, — это
[`compute`](./computed.mdx#compute).

## Подводные камни

- **Условие `when` у `copyFrom` не читает цель.** Иначе копирование запускает само себя.
- **`copyFrom` не очищает цель**, когда условие выключилось, — добавьте `resetWhen`.
- **Двусторонняя связь — только `syncFields`.**
- **Неидемпотентный `transformValue`** зацикливается.

## См. также

- [Условная логика](./conditional.md) — `resetWhen` для очистки цели.
- [Вычисляемые поля](./computed.mdx) — значение из нескольких полей.
- [Реакции на изменения](./watch.md) — `onChange` для запросов.
