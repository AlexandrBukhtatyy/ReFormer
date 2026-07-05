---
sidebar_position: 4
---

# Схема поведений

Поведение определяет реактивную логику и побочные эффекты для формы.

## Определение поведений

В M1 поведения объявляются через `defineFormBehavior` и подключаются в `createForm({ behavior })`.
Setup-колбэк получает типобезопасный scope (`{ model, form }`); операторы привязываются к сигналам
модели (`model.$.<field>`), а жизненным циклом владеет форма:

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom, enableWhen } from '@reformer/core/behaviors';

type OrderForm = { price: number; quantity: number; total: number; discount: number };

const model = createModel<OrderForm>({ price: 100, quantity: 1, total: 0, discount: 0 });

const schema = {
  price: { value: model.$.price, component: Input, componentProps: { type: 'number' } },
  quantity: { value: model.$.quantity, component: Input, componentProps: { type: 'number' } },
  total: {
    value: model.$.total,
    component: Input,
    componentProps: { type: 'number', disabled: true },
  },
  discount: { value: model.$.discount, component: Input, componentProps: { type: 'number' } },
};

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Автовычисление итога
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price, quantity) => price * quantity
  );

  // Включить скидку только для крупных заказов
  enableWhen(model.$.discount, () => model.total > 500);
});

const form = createForm<OrderForm>({ model, schema, behavior });
```

## Доступные поведения

| Поведение        | Тип           | Описание                                |
| ---------------- | ------------- | --------------------------------------- |
| `computeFrom`    | Вычисляемое   | Вычислить поле из других полей          |
| `transformValue` | Вычисляемое   | Трансформировать значение при изменении |
| `enableWhen`     | Условное      | Включить/отключить по условию           |
| `resetWhen`      | Условное      | Сбросить поле при выполнении условия    |
| `copyFrom`       | Синхронизация | Копировать значение из другого поля     |
| `syncFields`     | Синхронизация | Двусторонняя синхронизация полей        |
| `watchField`     | Наблюдение    | Реагировать на изменения поля           |
| `revalidateWhen` | Наблюдение    | Запустить ревалидацию                   |

## Вычисляемые поведения

### computeFrom

Вычисление значения поля из других полей. Значения источников приходят позиционно:

```typescript
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Один источник
  computeFrom([model.$.firstName], model.$.initials, (firstName) =>
    firstName.charAt(0).toUpperCase()
  );

  // Несколько источников
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});
```

### transformValue

Трансформация значения при изменении (трансформер должен быть идемпотентным):

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Приведение к нижнему регистру
  transformValue(model.$.username, (value) => (value ?? '').toLowerCase());

  // Форматирование номера телефона
  transformValue(model.$.phone, (value) => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
});
```

## Условные поведения

### enableWhen

Включение или отключение поля по условию. Условие читает `model.*` реактивно:

```typescript
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Включить адрес доставки, если не совпадает с платёжным
  enableWhen(model.$.shippingAddress, () => !model.sameAsBilling);

  // Включить скидку для премиум-пользователей
  enableWhen(model.$.discount, () => model.userType === 'premium');
});
```

### resetWhen

Сброс поля при выполнении условия:

```typescript
import { defineFormBehavior, resetWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Сбросить доставку при выборе «совпадает с платёжным»
  resetWhen(model.$.shippingAddress, () => model.sameAsBilling === true);
});
```

## Синхронизация полей

### copyFrom

Копирование значения из другого поля (source и target могут быть полями или целыми группами):

```typescript
import { defineFormBehavior, copyFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Копировать платёжный адрес в доставку при установке чекбокса
  copyFrom(model.$.billingAddress, model.$.shippingAddress, {
    when: () => model.sameAsBilling === true,
  });
});
```

### syncFields

Двусторонняя синхронизация:

```typescript
import { defineFormBehavior, syncFields } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Синхронизация email-полей (изменение любого обновляет оба)
  syncFields(model.$.email, model.$.confirmEmail);
});
```

## Наблюдение за изменениями

### watchField

Реакция на изменения поля. `watchField` из `@reformer/core` — низкоуровневый примитив: обычная
подписка на сигнал модели, возвращающая cleanup:

```typescript
import { watchField } from '@reformer/core';

const stop = watchField(model.$.country, (country) => {
  model.city = ''; // сброс зависимого поля при смене страны
});
// stop(); // отписаться
```

Для async-реакции — загрузки зависимых опций с debounce и отменой запросов — используй `onChange`
внутри `defineFormBehavior` (колбэк выполняется вне effect-контекста и получает `AbortSignal`):

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      const states = await loadStates(country, { signal });
      form.state.updateComponentProps({ options: states });
    },
    { debounce: 300 }
  );
});
```

### revalidateWhen

Перезапуск валидации при изменении другого поля. В M1 валидация on-demand, поэтому ревалидация — это
явный колбэк, запускаемый сигналами-зависимостями:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Ревалидировать при изменении password (confirmPassword перепроверится относительно него)
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, schema);
  });
});
```

## Извлечение наборов поведений

Создавайте переиспользуемые функции поведений, работающие с сигналами под-модели:

```typescript
import type { ModelSignals } from '@reformer/core';
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

// Переиспользуемые поведения для под-модели адреса
function addressBehaviors(address: ModelSignals<Address>) {
  // Автоформатирование почтового индекса
  transformValue(address.zipCode, (value) => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}

// Использование — вызываем набор для каждой под-модели внутри defineFormBehavior
const behavior = defineFormBehavior<Order>(({ model }) => {
  addressBehaviors(model.$.billing);
  addressBehaviors(model.$.shipping);
});

const form = createForm<Order>({ model, schema, behavior });
```

## Поведение vs Валидация

| Аспект                | Валидация                | Поведение                         |
| --------------------- | ------------------------ | --------------------------------- |
| **Назначение**        | Проверка корректности    | Реакция на изменения              |
| **Результат**         | Ошибки                   | Побочные эффекты                  |
| **Когда срабатывает** | После изменения значения | После изменения значения          |
| **Примеры**           | Required, формат email   | Вычисляемый итог, показать/скрыть |

## Следующие шаги

- [Обзор поведений](/docs/behaviors/overview) — Подробное руководство
- [Вычисляемые поля](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Условная логика](/docs/behaviors/conditional) — `enableWhen`, `resetWhen`
- [Композиция](./composition) — Переиспользование наборов поведений
  </content>
