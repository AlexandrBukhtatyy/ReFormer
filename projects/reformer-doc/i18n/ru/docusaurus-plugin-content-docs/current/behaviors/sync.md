---
sidebar_position: 4
---

# Синхронизация полей

Копирование значений между полями или синхронизация полей.

## copyFrom

Копирование значения из исходного поля в целевое.

```typescript
import { copyFrom } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  copyFrom(path.email, path.username),
]
```

### Пример: Одинаковый адрес

```typescript
const form = new GroupNode({
  form: {
    billingAddress: {
      street: { value: '' },
      city: { value: '' },
    },
    shippingAddress: {
      street: { value: '' },
      city: { value: '' },
    },
    sameAsBilling: { value: false },
  },
  behaviors: (path, ctx) => [
    // Копировать только когда checkbox отмечен
    copyFrom(
      path.billingAddress.street,
      path.shippingAddress.street,
      { when: () => form.controls.sameAsBilling.value }
    ),
    copyFrom(
      path.billingAddress.city,
      path.shippingAddress.city,
      { when: () => form.controls.sameAsBilling.value }
    ),
  ],
});
```

### Пример: Начальное значение

```typescript
behaviors: (path, ctx) => [
  // Копировать только один раз, при загрузке
  copyFrom(path.defaultEmail, path.email, { once: true }),
]
```

## syncFields

Двусторонняя синхронизация между полями.

```typescript
import { syncFields } from 'reformer/behaviors';

behaviors: (path, ctx) => [
  syncFields(path.displayName, path.username),
]
```

При изменении любого из полей, другое обновляется:

```typescript
form.controls.displayName.setValue('john');
form.controls.username.value; // 'john'

form.controls.username.setValue('jane');
form.controls.displayName.value; // 'jane'
```

### Пример: Двунаправленная конвертация

```typescript
const form = new GroupNode({
  form: {
    celsius: { value: 0 },
    fahrenheit: { value: 32 },
  },
  behaviors: (path, ctx) => [
    syncFields(
      path.celsius,
      path.fahrenheit,
      {
        toTarget: (c) => (c * 9/5) + 32,
        toSource: (f) => (f - 32) * 5/9,
      }
    ),
  ],
});

form.controls.celsius.setValue(100);
form.controls.fahrenheit.value; // 212

form.controls.fahrenheit.setValue(68);
form.controls.celsius.value; // 20
```

## Условное копирование

Копирование с трансформацией:

```typescript
behaviors: (path, ctx) => [
  copyFrom(
    path.firstName,
    path.initials,
    {
      transform: (firstName) => {
        const lastName = form.controls.lastName.value;
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
      },
    }
  ),
]
```

## Копирование массивов

Копирование значений массивов:

```typescript
const form = new GroupNode({
  form: {
    templateEmails: [
      { value: 'admin@example.com' },
      { value: 'support@example.com' },
    ],
    recipientEmails: [],
    useTemplate: { value: false },
  },
  behaviors: (path, ctx) => [
    copyFrom(
      path.templateEmails,
      path.recipientEmails,
      { when: () => form.controls.useTemplate.value }
    ),
  ],
});
```

## Следующие шаги

- [Watch Behaviors](/docs/behaviors/watch) — кастомные реакции на изменения
- [Валидация](/docs/validation/overview) — комбинирование с валидацией
