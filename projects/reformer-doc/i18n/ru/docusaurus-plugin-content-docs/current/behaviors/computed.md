---
sidebar_position: 2
---

# Вычисляемые поля

Автоматическое вычисление значений полей из других полей.

## computeFrom

Вычисление значения поля на основе одного или нескольких исходных полей.

```typescript
import { computeFrom } from '@reformer/core/behaviors';

behavior: (path) => {
  // Один источник
  computeFrom([path.price], path.priceWithTax, ({ price }) => price * 1.2);

  // Несколько источников
  computeFrom(
    [path.price, path.quantity, path.discount],
    path.total,
    ({ price, quantity, discount }) => price * quantity - discount
  );
};
```

### Пример: Полное имя

```typescript
const form = new GroupNode({
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
    fullName: { value: '' },
  },
  behavior: (path) => {
    computeFrom([path.firstName, path.lastName], path.fullName, ({ firstName, lastName }) =>
      `${firstName} ${lastName}`.trim()
    );
  },
});

form.firstName.setValue('Иван');
form.lastName.setValue('Петров');
form.fullName.value.value; // 'Иван Петров'
```

### Пример: Калькулятор кредита

```typescript
const form = new GroupNode({
  form: {
    principal: { value: 10000 },
    rate: { value: 5 },
    years: { value: 10 },
    monthlyPayment: { value: 0 },
  },
  behavior: (path) => {
    computeFrom(
      [path.principal, path.rate, path.years],
      path.monthlyPayment,
      ({ principal, rate, years }) => {
        const monthlyRate = rate / 100 / 12;
        const months = years * 12;
        return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
      }
    );
  },
});
```

## transformValue

Трансформация значения поля при его изменении.

```typescript
import { transformValue } from '@reformer/core/behaviors';

behavior: (path) => {
  // Верхний регистр
  transformValue(path.code, (value) => value.toUpperCase());

  // Форматирование телефона
  transformValue(path.phone, (value) => value.replace(/\D/g, '').slice(0, 10));

  // Ограничение числа
  transformValue(path.quantity, (value) => Math.max(1, Math.min(100, value)));
};
```

### Пример: Ввод валюты

```typescript
const form = new GroupNode({
  form: {
    amount: { value: '' },
  },
  behavior: (path) => {
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
    });
  },
});
```

## Вычисления с вложенными полями

Доступ к вложенным полям в вычислениях:

```typescript
const form = new GroupNode({
  form: {
    shipping: {
      method: { value: 'standard' },
      cost: { value: 0 },
    },
    subtotal: { value: 100 },
    total: { value: 0 },
  },
  behavior: (path) => {
    // Вычисление стоимости доставки
    computeFrom([path.shipping.method], path.shipping.cost, ({ method }) =>
      method === 'express' ? 15 : 5
    );

    // Вычисление итога
    computeFrom(
      [path.subtotal, path.shipping.cost],
      path.total,
      ({ subtotal, cost }) => subtotal + cost
    );
  },
});
```

## Следующие шаги

- [Условная логика](/docs/behaviors/conditional) — show/hide, enable/disable
- [Синхронизация](/docs/behaviors/sync) — копирование и синхронизация полей
