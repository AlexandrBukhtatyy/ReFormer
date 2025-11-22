---
sidebar_position: 2
---

# Вычисляемые поля

Автоматическое вычисление значений полей из других полей.

## computeFrom

Вычисление значения поля на основе одного или нескольких исходных полей.

```typescript
import { computeFrom } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  // Один источник
  computeFrom(
    [path.price],
    path.priceWithTax,
    (price) => price * 1.2
  ),

  // Несколько источников
  computeFrom(
    [path.price, path.quantity, path.discount],
    path.total,
    (price, qty, discount) => (price * qty) - discount
  ),
]
```

### Пример: Полное имя

```typescript
const form = new GroupNode({
  schema: {
    firstName: new FieldNode({ value: '' }),
    lastName: new FieldNode({ value: '' }),
    fullName: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    computeFrom(
      [path.firstName, path.lastName],
      path.fullName,
      (first, last) => `${first} ${last}`.trim()
    ),
  ],
});

form.controls.firstName.setValue('Иван');
form.controls.lastName.setValue('Петров');
form.controls.fullName.value; // 'Иван Петров'
```

### Пример: Калькулятор кредита

```typescript
const form = new GroupNode({
  schema: {
    principal: new FieldNode({ value: 10000 }),
    rate: new FieldNode({ value: 5 }),
    years: new FieldNode({ value: 10 }),
    monthlyPayment: new FieldNode({ value: 0 }),
  },
  behaviorSchema: (path, ctx) => [
    computeFrom(
      [path.principal, path.rate, path.years],
      path.monthlyPayment,
      (principal, rate, years) => {
        const monthlyRate = rate / 100 / 12;
        const months = years * 12;
        return (principal * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -months));
      }
    ),
  ],
});
```

## transformValue

Трансформация значения поля при его изменении.

```typescript
import { transformValue } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  // Верхний регистр
  transformValue(path.code, (value) => value.toUpperCase()),

  // Форматирование телефона
  transformValue(path.phone, (value) =>
    value.replace(/\D/g, '').slice(0, 10)
  ),

  // Ограничение числа
  transformValue(path.quantity, (value) =>
    Math.max(1, Math.min(100, value))
  ),
]
```

### Пример: Ввод валюты

```typescript
const form = new GroupNode({
  schema: {
    amount: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    transformValue(path.amount, (value) => {
      // Удалить всё кроме цифр и точки
      const cleaned = value.replace(/[^\d.]/g, '');
      // Только одна десятичная точка
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
      }
      // Ограничить знаки после запятой
      if (parts[1]?.length > 2) {
        return parts[0] + '.' + parts[1].slice(0, 2);
      }
      return cleaned;
    }),
  ],
});
```

## Вычисления с вложенными полями

Доступ к вложенным полям в вычислениях:

```typescript
const form = new GroupNode({
  schema: {
    shipping: new GroupNode({
      schema: {
        method: new FieldNode({ value: 'standard' }),
        cost: new FieldNode({ value: 0 }),
      },
    }),
    subtotal: new FieldNode({ value: 100 }),
    total: new FieldNode({ value: 0 }),
  },
  behaviorSchema: (path, ctx) => [
    // Вычисление стоимости доставки
    computeFrom(
      [path.shipping.method],
      path.shipping.cost,
      (method) => method === 'express' ? 15 : 5
    ),

    // Вычисление итога
    computeFrom(
      [path.subtotal, path.shipping.cost],
      path.total,
      (subtotal, shipping) => subtotal + shipping
    ),
  ],
});
```

## Следующие шаги

- [Условная логика](/docs/behaviors/conditional) — show/hide, enable/disable
- [Синхронизация](/docs/behaviors/sync) — копирование и синхронизация полей
