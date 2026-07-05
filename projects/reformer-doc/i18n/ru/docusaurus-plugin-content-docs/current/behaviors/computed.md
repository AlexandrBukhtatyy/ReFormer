---
sidebar_position: 2
---

# Вычисляемые поля

Автоматическое вычисление значений полей из других полей.

## computeFrom

Вычисление значения поля на основе одного или нескольких исходных полей.

```typescript
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  // Один источник — значения источников приходят позиционно
  computeFrom([model.$.price], model.$.priceWithTax, (price) => price * 1.2);

  // Несколько источников
  computeFrom(
    [model.$.price, model.$.quantity, model.$.discount],
    model.$.total,
    (price, quantity, discount) => price * quantity - discount
  );
});
```

### Пример: Полное имя

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

interface NameForm {
  firstName: string;
  lastName: string;
  fullName: string;
}

const model = createModel<NameForm>({ firstName: '', lastName: '', fullName: '' });

const behavior = defineFormBehavior<NameForm>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});

// `schema` связывает поля с компонентами (см. Быстрый старт).
const form = createForm<NameForm>({ model, schema, behavior });

form.firstName.setValue('Иван');
form.lastName.setValue('Петров');
form.fullName.value.value; // 'Иван Петров'
```

### Пример: Калькулятор кредита

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

interface LoanForm {
  principal: number;
  rate: number;
  years: number;
  monthlyPayment: number;
}

const model = createModel<LoanForm>({ principal: 10000, rate: 5, years: 10, monthlyPayment: 0 });

const behavior = defineFormBehavior<LoanForm>(({ model }) => {
  computeFrom(
    [model.$.principal, model.$.rate, model.$.years],
    model.$.monthlyPayment,
    (principal, rate, years) => {
      const monthlyRate = rate / 100 / 12;
      const months = years * 12;
      return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    }
  );
});

// `schema` связывает поля с компонентами (см. Быстрый старт).
const form = createForm<LoanForm>({ model, schema, behavior });
```

## transformValue

Трансформация значения поля при его изменении.

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  // Верхний регистр
  transformValue(model.$.code, (value) => value.toUpperCase());

  // Форматирование телефона
  transformValue(model.$.phone, (value) => value.replace(/\D/g, '').slice(0, 10));

  // Ограничение числа
  transformValue(model.$.quantity, (value) => Math.max(1, Math.min(100, value)));
});
```

### Пример: Ввод валюты

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

interface CurrencyForm {
  amount: string;
}

const model = createModel<CurrencyForm>({ amount: '' });

const behavior = defineFormBehavior<CurrencyForm>(({ model }) => {
  transformValue(model.$.amount, (value) => {
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
});

// `schema` связывает поля с компонентами (см. Быстрый старт).
const form = createForm<CurrencyForm>({ model, schema, behavior });
```

## Вычисления с вложенными полями

Доступ к вложенным полям в вычислениях:

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

interface CheckoutForm {
  shipping: { method: string; cost: number };
  subtotal: number;
  total: number;
}

const model = createModel<CheckoutForm>({
  shipping: { method: 'standard', cost: 0 },
  subtotal: 100,
  total: 0,
});

const behavior = defineFormBehavior<CheckoutForm>(({ model }) => {
  // Вычисление стоимости доставки
  computeFrom([model.$.shipping.method], model.$.shipping.cost, (method) =>
    method === 'express' ? 15 : 5
  );

  // Вычисление итога
  computeFrom(
    [model.$.subtotal, model.$.shipping.cost],
    model.$.total,
    (subtotal, cost) => subtotal + cost
  );
});

// `schema` связывает поля с компонентами (см. Быстрый старт).
const form = createForm<CheckoutForm>({ model, schema, behavior });
```

## Следующие шаги

- [Условная логика](/docs/behaviors/conditional) — show/hide, enable/disable
- [Синхронизация](/docs/behaviors/sync) — копирование и синхронизация полей
