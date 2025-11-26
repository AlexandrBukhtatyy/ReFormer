---
sidebar_position: 1
---

# Вычисляемые поля

Создание автоматически рассчитываемых полей с помощью `computeFrom`.

## Обзор

Вычисляемые поля автоматически рассчитывают свои значения на основе других полей формы. Типичные случаи использования:

- `fullName` = `firstName` + ` ` + `lastName`
- `totalIncome` = `salary` + `additionalIncome`
- `age` вычисляется из даты рождения
- `monthlyPayment` вычисляется из суммы кредита, срока и процентной ставки

## computeFrom

Поведение `computeFrom` отслеживает указанные поля-источники и автоматически обновляет целевое поле при изменении любого из источников.

```typescript
import { computeFrom } from 'reformer/behaviors';

computeFrom(
  sourceFields,    // Массив путей полей для отслеживания
  targetField,     // Путь поля для обновления
  computeFn        // Функция, вычисляющая новое значение
);
```

### Базовый пример: Расчёт итога

```typescript title="src/behaviors/order-behavior.ts"
import { computeFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface OrderForm {
  price: number;
  quantity: number;
  total: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
  // total = price × quantity
  computeFrom(
    [path.price, path.quantity],
    path.total,
    (values) => (values.price as number) * (values.quantity as number)
  );
};
```

### Вычисление полного имени

```typescript title="src/behaviors/user-behavior.ts"
interface UserForm {
  firstName: string;
  lastName: string;
  middleName: string;
  fullName: string;
}

export const userBehavior: BehaviorSchemaFn<UserForm> = (path: FieldPath<UserForm>) => {
  computeFrom(
    [path.firstName, path.lastName, path.middleName],
    path.fullName,
    (values) => {
      const parts = [
        values.lastName,
        values.firstName,
        values.middleName,
      ].filter(Boolean);
      return parts.join(' ');
    }
  );
};
```

### Возраст из даты рождения

```typescript title="src/behaviors/personal-behavior.ts"
interface PersonalForm {
  birthDate: string;
  age: number;
}

const computeAge = (values: Record<string, unknown>): number => {
  const birthDate = values.birthDate as string;
  if (!birthDate) return 0;

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

export const personalBehavior: BehaviorSchemaFn<PersonalForm> = (path) => {
  computeFrom([path.birthDate], path.age, computeAge);
};
```

## Сложные вычисляемые поля

### Ежемесячный платёж по кредиту

Расчёт ежемесячного платежа по формуле аннуитета:

```typescript title="src/behaviors/loan-behavior.ts"
interface LoanForm {
  loanAmount: number;
  loanTerm: number;      // месяцы
  interestRate: number;  // годовой процент
  monthlyPayment: number;
}

const computeMonthlyPayment = (values: Record<string, unknown>): number => {
  const amount = values.loanAmount as number;
  const termMonths = values.loanTerm as number;
  const annualRate = values.interestRate as number;

  if (!amount || !termMonths || !annualRate) return 0;

  // Месячная процентная ставка
  const monthlyRate = annualRate / 100 / 12;

  // Формула аннуитета: P = A * (r * (1+r)^n) / ((1+r)^n - 1)
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const payment = amount * (monthlyRate * factor) / (factor - 1);

  return Math.round(payment);
};

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    computeMonthlyPayment
  );
};
```

### Процентная ставка на основе нескольких факторов

```typescript title="src/behaviors/credit-behavior.ts"
interface CreditForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  region: string;
  hasProperty: boolean;
  interestRate: number;
}

const computeInterestRate = (values: Record<string, unknown>): number => {
  const loanType = values.loanType as string;
  const region = values.region as string;
  const hasProperty = values.hasProperty as boolean;

  // Базовые ставки
  const baseRates: Record<string, number> = {
    mortgage: 8.5,
    car: 12.0,
    consumer: 15.0,
  };

  let rate = baseRates[loanType] || 15.0;

  // Скидка по региону
  if (region === 'Москва' || region === 'Санкт-Петербург') {
    rate -= 0.5;
  }

  // Скидка за залог имущества
  if (hasProperty) {
    rate -= 1.0;
  }

  return Math.max(rate, 5.0); // Минимум 5%
};

export const creditBehavior: BehaviorSchemaFn<CreditForm> = (path) => {
  computeFrom(
    [path.loanType, path.region, path.hasProperty],
    path.interestRate,
    computeInterestRate
  );
};
```

### Вычисление из вложенных групп

При вычислении из вложенных структур, таких как персональные данные:

```typescript title="src/behaviors/application-behavior.ts"
interface ApplicationForm {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  fullName: string;
  age: number;
}

const computeFullName = (values: Record<string, unknown>): string => {
  const personalData = values.personalData as ApplicationForm['personalData'];
  if (!personalData) return '';

  return [
    personalData.lastName,
    personalData.firstName,
    personalData.middleName,
  ].filter(Boolean).join(' ');
};

const computeAge = (values: Record<string, unknown>): number => {
  const personalData = values.personalData as ApplicationForm['personalData'];
  if (!personalData?.birthDate) return 0;

  const birth = new Date(personalData.birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const applicationBehavior: BehaviorSchemaFn<ApplicationForm> = (path) => {
  // Отслеживаем всю группу personalData
  computeFrom([path.personalData], path.fullName, computeFullName);
  computeFrom([path.personalData], path.age, computeAge);
};
```

### Вычисление из массивов

Суммирование значений из массива элементов:

```typescript title="src/behaviors/income-behavior.ts"
interface IncomeForm {
  coBorrowers: Array<{
    monthlyIncome: number;
  }>;
  coBorrowersIncome: number;
}

const computeCoBorrowersIncome = (values: Record<string, unknown>): number => {
  const coBorrowers = values.coBorrowers as IncomeForm['coBorrowers'];
  if (!coBorrowers || coBorrowers.length === 0) return 0;

  return coBorrowers.reduce((sum, cb) => sum + (cb.monthlyIncome || 0), 0);
};

export const incomeBehavior: BehaviorSchemaFn<IncomeForm> = (path) => {
  computeFrom([path.coBorrowers], path.coBorrowersIncome, computeCoBorrowersIncome);
};
```

## Отображение вычисляемых полей

Вычисляемые поля обычно отображаются как только для чтения:

```tsx title="src/components/OrderSummary.tsx"
import { useFormControl } from 'reformer';

function OrderSummary({ control }: OrderFormProps) {
  const { value: total } = useFormControl(control.total);

  return (
    <div className="p-4 bg-gray-100 rounded">
      <div className="flex justify-between">
        <span>Итого:</span>
        <span className="font-bold">{total.toFixed(2)} ₽</span>
      </div>
    </div>
  );
}
```

Или определите поле как disabled в схеме:

```typescript title="src/schemas/order-schema.ts"
const orderSchema: FormSchema<OrderForm> = {
  total: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Итого',
      type: 'number',
      disabled: true,  // Всегда только для чтения
    },
  },
};
```

## Лучшие практики

### 1. Выносите функции вычисления

Храните функции вычисления отдельно для тестируемости:

```typescript
// utils/compute-functions.ts
export const computeTotal = (values: Record<string, unknown>): number => {
  return (values.price as number) * (values.quantity as number);
};

// behaviors/order-behavior.ts
import { computeTotal } from '../utils/compute-functions';

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  computeFrom([path.price, path.quantity], path.total, computeTotal);
};
```

### 2. Обрабатывайте граничные случаи

Всегда обрабатывайте отсутствующие или невалидные значения:

```typescript
const computeTotal = (values: Record<string, unknown>): number => {
  const price = values.price as number;
  const quantity = values.quantity as number;

  // Обработка граничных случаев
  if (!price || !quantity || price < 0 || quantity < 0) {
    return 0;
  }

  return price * quantity;
};
```

### 3. Избегайте циклических зависимостей

Не создавайте циклические цепочки вычислений:

```typescript
// ❌ ПЛОХО: Циклическая зависимость
computeFrom([path.a], path.b, computeB);
computeFrom([path.b], path.a, computeA); // Создаёт бесконечный цикл!

// ✅ ХОРОШО: Однонаправленный поток
computeFrom([path.price, path.quantity], path.subtotal, computeSubtotal);
computeFrom([path.subtotal, path.taxRate], path.total, computeTotal);
```

## Следующий шаг

Теперь, когда вы понимаете вычисляемые поля, давайте узнаем об управлении видимостью полей с помощью `showWhen` и `hideWhen`.