---
sidebar_position: 4
---

# Синхронизация полей

Копирование значений между полями или синхронизация полей.

## copyFrom

Копирование значения из исходного поля в целевое.

```typescript
import { copyFrom } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  copyFrom(path.email, path.username),
]
```

### Пример: Одинаковый адрес

```typescript
const form = new GroupNode({
  schema: {
    billingAddress: new GroupNode({
      schema: {
        street: new FieldNode({ value: '' }),
        city: new FieldNode({ value: '' }),
      },
    }),
    shippingAddress: new GroupNode({
      schema: {
        street: new FieldNode({ value: '' }),
        city: new FieldNode({ value: '' }),
      },
    }),
    sameAsBilling: new FieldNode({ value: false }),
  },
  behaviorSchema: (path, ctx) => [
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
behaviorSchema: (path, ctx) => [
  // Копировать только один раз, при загрузке
  copyFrom(path.defaultEmail, path.email, { once: true }),
]
```

## syncFields

Двусторонняя синхронизация между полями.

```typescript
import { syncFields } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
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
  schema: {
    celsius: new FieldNode({ value: 0 }),
    fahrenheit: new FieldNode({ value: 32 }),
  },
  behaviorSchema: (path, ctx) => [
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
behaviorSchema: (path, ctx) => [
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
  schema: {
    templateEmails: new ArrayNode({
      schema: () => new FieldNode({ value: '' }),
      value: ['admin@example.com', 'support@example.com'],
    }),
    recipientEmails: new ArrayNode({
      schema: () => new FieldNode({ value: '' }),
      value: [],
    }),
    useTemplate: new FieldNode({ value: false }),
  },
  behaviorSchema: (path, ctx) => [
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
