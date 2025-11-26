---
sidebar_position: 6
---

# Перевалидация и сброс

Перевалидация и сброс полей с `revalidateWhen` и `resetWhen`.

## Обзор

Эти поведения помогают управлять состоянием полей на основе изменений других полей:

- **revalidateWhen** — Запуск валидации при изменении зависимых полей
- **resetWhen** — Сброс значения поля когда условие становится истинным

Типичные случаи использования:
- Перевалидация суммы при изменении максимального лимита
- Сброс номера карты при смене типа оплаты
- Перевалидация подтверждения пароля при изменении основного пароля
- Сброс зависимого поля при изменении родительского выбора

## revalidateWhen

Поведение `revalidateWhen` запускает валидацию поля при изменении любого из указанных триггерных полей.

```typescript
import { revalidateWhen } from 'reformer/behaviors';

revalidateWhen(
  targetField,    // Поле для перевалидации
  triggerFields,  // Массив полей, запускающих перевалидацию
  options         // { debounce?: number }
);
```

### Базовый пример: Зависимая валидация

Перевалидация суммы при изменении максимального лимита:

```typescript title="src/behaviors/amount-behavior.ts"
import { revalidateWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface OrderForm {
  maxAmount: number;
  amount: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
  // При изменении maxAmount перевалидировать amount
  revalidateWhen(path.amount, [path.maxAmount]);
};
```

С соответствующей валидацией:

```typescript title="src/validators/order-validators.ts"
import { max } from 'reformer/validators';

export const orderValidation = (path: FieldPath<OrderForm>) => {
  // Этот валидатор запустится снова при изменении maxAmount
  max(path.amount, (form) => form.maxAmount, {
    message: 'Сумма превышает лимит',
  });
};
```

### Подтверждение пароля

Перевалидация подтверждения пароля при изменении основного пароля:

```typescript title="src/behaviors/password-behavior.ts"
interface PasswordForm {
  password: string;
  confirmPassword: string;
}

export const passwordBehavior: BehaviorSchemaFn<PasswordForm> = (path) => {
  // При изменении password перевалидировать confirmPassword
  revalidateWhen(path.confirmPassword, [path.password]);
};
```

С валидацией:

```typescript title="src/validators/password-validators.ts"
import { custom } from 'reformer/validators';

export const passwordValidation = (path: FieldPath<PasswordForm>) => {
  custom(path.confirmPassword, (value, form) => {
    if (value !== form.password) {
      return { code: 'passwords-mismatch', message: 'Пароли не совпадают' };
    }
    return true;
  });
};
```

### Пример кредитной заявки

Перевалидация дохода при изменении ежемесячного платежа:

```typescript title="src/behaviors/credit-behavior.ts"
interface CreditForm {
  monthlyPayment: number;
  monthlyIncome: number;
  initialPayment: number;
  propertyValue: number;
}

export const creditBehavior: BehaviorSchemaFn<CreditForm> = (path) => {
  // Перевалидировать доход при изменении платежа (доход должен быть > 2× платежа)
  revalidateWhen(path.monthlyIncome, [path.monthlyPayment]);

  // Перевалидировать первоначальный взнос при изменении стоимости недвижимости
  revalidateWhen(path.initialPayment, [path.propertyValue]);
};
```

### С debounce

Debounce перевалидации для производительности:

```typescript title="src/behaviors/search-behavior.ts"
interface SearchForm {
  searchQuery: string;
  results: string[];
}

export const searchBehavior: BehaviorSchemaFn<SearchForm> = (path) => {
  revalidateWhen(path.results, [path.searchQuery], {
    debounce: 300, // Ждать 300мс после последнего изменения
  });
};
```

## resetWhen

Поведение `resetWhen` сбрасывает поле к указанному значению когда условие становится истинным.

```typescript
import { resetWhen } from 'reformer/behaviors';

resetWhen(
  targetField,   // Поле для сброса
  condition,     // Функция, возвращающая true когда поле должно быть сброшено
  options        // { resetValue?: T }
);
```

### Базовый пример: Переключение типа оплаты

Сброс номера карты когда тип оплаты не "card":

```typescript title="src/behaviors/payment-behavior.ts"
import { resetWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface PaymentForm {
  paymentType: 'card' | 'cash' | 'transfer';
  cardNumber: string;
}

export const paymentBehavior: BehaviorSchemaFn<PaymentForm> = (path: FieldPath<PaymentForm>) => {
  // Сбросить номер карты когда тип оплаты не "card"
  resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
    resetValue: '',
  });
};
```

### Сброс к пользовательскому значению

Сброс к конкретному значению, а не к начальному:

```typescript title="src/behaviors/discount-behavior.ts"
interface OrderForm {
  hasDiscount: boolean;
  discountPercent: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Сбросить скидку к 0 когда hasDiscount равен false
  resetWhen(path.discountPercent, (form) => !form.hasDiscount, {
    resetValue: 0,
  });
};
```

### Сброс связанных полей

Сброс нескольких связанных полей:

```typescript title="src/behaviors/address-behavior.ts"
interface AddressForm {
  country: string;
  region: string;
  city: string;
}

export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  // Сбросить регион при изменении страны
  resetWhen(path.region, (form, prev) => form.country !== prev?.country, {
    resetValue: '',
  });

  // Сбросить город при изменении региона
  resetWhen(path.city, (form, prev) => form.region !== prev?.region, {
    resetValue: '',
  });
};
```

### Переключение типа кредита

Сброс полей специфичных для типа кредита при изменении типа:

```typescript title="src/behaviors/loan-behavior.ts"
interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  // Поля ипотеки
  propertyValue: number;
  propertyType: string;
  // Поля автокредита
  carBrand: string;
  carModel: string;
  carYear: number;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Сбросить поля ипотеки когда не ипотека
  resetWhen(path.propertyValue, (form) => form.loanType !== 'mortgage', {
    resetValue: 0,
  });
  resetWhen(path.propertyType, (form) => form.loanType !== 'mortgage', {
    resetValue: '',
  });

  // Сбросить поля автокредита когда не автокредит
  resetWhen(path.carBrand, (form) => form.loanType !== 'car', {
    resetValue: '',
  });
  resetWhen(path.carModel, (form) => form.loanType !== 'car', {
    resetValue: '',
  });
  resetWhen(path.carYear, (form) => form.loanType !== 'car', {
    resetValue: 0,
  });
};
```

## Комбинирование revalidateWhen и resetWhen

Эти поведения хорошо работают вместе:

```typescript title="src/behaviors/order-behavior.ts"
interface OrderForm {
  orderType: 'standard' | 'express';
  maxWeight: number;
  weight: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Сбросить вес при изменении типа заказа
  resetWhen(path.weight, (form, prev) => form.orderType !== prev?.orderType, {
    resetValue: 0,
  });

  // Перевалидировать вес при изменении maxWeight
  revalidateWhen(path.weight, [path.maxWeight]);
};
```

## Сравнение: resetWhen vs enableWhen с resetOnDisable

Оба подхода могут сбрасывать поля, но служат разным целям:

### enableWhen с resetOnDisable

```typescript
// Поле деактивируется И сбрасывается когда условие ложно
enableWhen(path.cardNumber, (form) => form.paymentType === 'card', {
  resetOnDisable: true,
});
```

Используйте когда:
- Поле должно быть визуально деактивировано
- Пользователь не должен взаимодействовать с полем
- Поле является частью условной секции

### resetWhen

```typescript
// Поле сбрасывается когда условие истинно, но остаётся активным
resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
  resetValue: '',
});
```

Используйте когда:
- Поле должно оставаться активным
- Вам нужно только очистить значение
- Поле может быть скрыто через условный рендеринг

## Лучшие практики

### 1. Используйте debounce для производительности

```typescript
// ✅ Debounce когда перевалидация срабатывает часто
revalidateWhen(path.searchResults, [path.query], {
  debounce: 300,
});

// ❌ Без debounce - перевалидация на каждое нажатие клавиши
revalidateWhen(path.searchResults, [path.query]);
```

### 2. Предоставляйте осмысленные значения для сброса

```typescript
// ✅ Сброс к подходящему значению по умолчанию
resetWhen(path.quantity, (form) => !form.hasItems, {
  resetValue: 1, // Минимальное количество
});

// ❌ Сброс к undefined - может вызвать проблемы
resetWhen(path.quantity, (form) => !form.hasItems);
```

### 3. Учитывайте пользовательский опыт

```typescript
// ✅ Сбрасывать только когда необходимо
resetWhen(path.city, (form, prev) => {
  // Сбрасывать только если регион реально изменился, а не при начальной загрузке
  return prev !== undefined && form.region !== prev.region;
}, { resetValue: '' });

// ❌ Сбрасывается при каждой проверке
resetWhen(path.city, (form) => form.region === '', {
  resetValue: '',
});
```

### 4. Комбинируйте с условным рендерингом

```tsx
// Компонент
{paymentType === 'card' && (
  <FormField control={control.cardNumber} />
)}

// Поведение - сброс при скрытии
resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
  resetValue: '',
});
```

### 5. Порядок имеет значение

```typescript
// ✅ Сначала сброс, потом перевалидация
resetWhen(path.amount, (form) => !form.hasAmount, { resetValue: 0 });
revalidateWhen(path.amount, [path.maxAmount]);

// Это гарантирует что перевалидация выполнится с правильным значением
```

## Когда использовать каждое поведение

| Сценарий | revalidateWhen | resetWhen |
|----------|----------------|-----------|
| Изменение максимального лимита | ✅ | - |
| Связанное поле влияет на валидацию | ✅ | - |
| Очистка поля при смене типа | - | ✅ |
| Каскадный сброс (страна → регион → город) | - | ✅ |
| Валидация подтверждения | ✅ | - |
| Очистка секции формы | Рассмотрите | ✅ |

## Следующий шаг

Теперь, когда вы понимаете поведения перевалидации и сброса, давайте узнаем как создавать пользовательские поведения для специфических случаев.
