---
sidebar_position: 7
---

# Кастомные поведения

Создание пользовательских поведений для доменной логики.

## Обзор

Хотя ReFormer предоставляет множество встроенных поведений, вам могут понадобиться кастомные поведения для:

- Доменной бизнес-логики
- Сложных взаимодействий между полями
- Интеграции с внешними сервисами
- Переиспользуемых паттернов между формами

Это руководство показывает, как создавать кастомные поведения по тем же паттернам, что и встроенные.

## Структура поведения

Поведение — это функция, которая получает контекст формы и настраивает реактивные эффекты:

```typescript
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface MyForm {
  field1: string;
  field2: string;
}

// Функция кастомного поведения
export const myCustomBehavior: BehaviorSchemaFn<MyForm> = (path: FieldPath<MyForm>) => {
  // Настройка реактивных эффектов с использованием встроенных поведений
  watchField(path.field1, (value, ctx) => {
    // Кастомная логика здесь
  });
};
```

## Создание кастомных поведений

### Пример 1: Автодополнение

Создание поведения для автодополнения поля на основе значения другого поля:

```typescript title="src/behaviors/auto-complete-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface AddressForm {
  postalCode: string;
  city: string;
  region: string;
}

// API-функция для поиска адреса по почтовому индексу
async function lookupAddress(postalCode: string) {
  const response = await fetch(`/api/address/${postalCode}`);
  return response.json();
}

export const autoCompleteAddressBehavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
  watchField(
    path.postalCode,
    async (postalCode, ctx) => {
      // Поиск только когда индекс полный (6 цифр)
      if (postalCode?.length === 6) {
        try {
          const address = await lookupAddress(postalCode);
          if (address.city) {
            ctx.form.city.setValue(address.city);
          }
          if (address.region) {
            ctx.form.region.setValue(address.region);
          }
        } catch (error) {
          console.error('Ошибка поиска адреса:', error);
        }
      }
    },
    { immediate: false, debounce: 500 }
  );
};
```

### Пример 2: Поведение для расчётов

Создание поведения для сложных финансовых расчётов:

```typescript title="src/behaviors/finance-behavior.ts"
import { computeFrom, watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface LoanForm {
  principal: number;
  annualRate: number;
  termYears: number;
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
}

// Расчёт ежемесячного платежа по формуле аннуитета
function calculateMonthlyPayment(principal: number, annualRate: number, termYears: number): number {
  if (!principal || !annualRate || !termYears) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const termMonths = termYears * 12;

  if (monthlyRate === 0) return principal / termMonths;

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export const loanCalculationBehavior: BehaviorSchemaFn<LoanForm> = (path: FieldPath<LoanForm>) => {
  // Расчёт ежемесячного платежа
  computeFrom(
    [path.principal, path.annualRate, path.termYears],
    path.monthlyPayment,
    (values) => {
      const principal = values.principal as number;
      const rate = values.annualRate as number;
      const term = values.termYears as number;
      return Math.round(calculateMonthlyPayment(principal, rate, term) * 100) / 100;
    }
  );

  // Расчёт общей суммы процентов
  computeFrom(
    [path.monthlyPayment, path.termYears, path.principal],
    path.totalInterest,
    (values) => {
      const monthly = values.monthlyPayment as number;
      const term = values.termYears as number;
      const principal = values.principal as number;
      return Math.round((monthly * term * 12 - principal) * 100) / 100;
    }
  );

  // Расчёт общей стоимости
  computeFrom(
    [path.principal, path.totalInterest],
    path.totalCost,
    (values) => {
      const principal = values.principal as number;
      const interest = values.totalInterest as number;
      return principal + interest;
    }
  );
};
```

### Пример 3: Поведение для валидации

Создание поведения для кросс-валидации полей:

```typescript title="src/behaviors/date-range-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface DateRangeForm {
  startDate: string;
  endDate: string;
}

export const dateRangeBehavior: BehaviorSchemaFn<DateRangeForm> = (path: FieldPath<DateRangeForm>) => {
  // Валидация конечной даты при изменении начальной
  watchField(path.startDate, (startDate, ctx) => {
    const endDate = ctx.form.endDate.value.value;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        ctx.form.endDate.setErrors([
          { code: 'invalid-range', message: 'Дата окончания должна быть после даты начала' }
        ]);
      } else {
        ctx.form.endDate.clearErrors({ code: 'invalid-range' });
      }
    }
  });

  // Валидация начальной даты при изменении конечной
  watchField(path.endDate, (endDate, ctx) => {
    const startDate = ctx.form.startDate.value.value;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        ctx.form.endDate.setErrors([
          { code: 'invalid-range', message: 'Дата окончания должна быть после даты начала' }
        ]);
      } else {
        ctx.form.endDate.clearErrors({ code: 'invalid-range' });
      }
    }
  });
};
```

### Пример 4: Поведение для состояния загрузки

Создание поведения для управления состояниями загрузки:

```typescript title="src/behaviors/loading-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface SearchForm {
  query: string;
  results: string[];
  isLoading: boolean;
}

export const searchBehavior: BehaviorSchemaFn<SearchForm> = (path: FieldPath<SearchForm>) => {
  watchField(
    path.query,
    async (query, ctx) => {
      if (!query || query.length < 3) {
        ctx.form.results.setValue([]);
        return;
      }

      // Установка состояния загрузки
      ctx.form.isLoading.setValue(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        ctx.form.results.setValue(results);
      } catch (error) {
        ctx.form.results.setValue([]);
        console.error('Ошибка поиска:', error);
      } finally {
        // Сброс состояния загрузки
        ctx.form.isLoading.setValue(false);
      }
    },
    { immediate: false, debounce: 300 }
  );
};
```

## Композиция поведений

Вы можете комбинировать несколько поведений вместе:

```typescript title="src/behaviors/order-behavior.ts"
import { type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { pricingBehavior } from './pricing-behavior';
import { discountBehavior } from './discount-behavior';
import { shippingBehavior } from './shipping-behavior';

interface OrderForm {
  // ... поля заказа
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
  // Применить расчёты цен
  pricingBehavior(path);

  // Применить логику скидок
  discountBehavior(path);

  // Применить расчёты доставки
  shippingBehavior(path);
};
```

## Создание генерик-поведений

Создание поведений, работающих с любым типом формы:

```typescript title="src/behaviors/generic-behaviors.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

/**
 * Генерик-поведение для синхронизации двух полей одного типа
 */
export function createSyncBehavior<T extends object, K extends keyof T>(
  field1Key: K,
  field2Key: K
): BehaviorSchemaFn<T> {
  return (path: FieldPath<T>) => {
    const field1 = path[field1Key];
    const field2 = path[field2Key];

    watchField(field1, (value, ctx) => {
      const otherValue = (ctx.form as any)[field2Key].value.value;
      if (value !== otherValue) {
        (ctx.form as any)[field2Key].setValue(value);
      }
    });

    watchField(field2, (value, ctx) => {
      const otherValue = (ctx.form as any)[field1Key].value.value;
      if (value !== otherValue) {
        (ctx.form as any)[field1Key].setValue(value);
      }
    });
  };
}

/**
 * Генерик-поведение для форматирования строкового поля
 */
export function createFormatBehavior<T extends object, K extends keyof T>(
  fieldKey: K,
  formatter: (value: string) => string
): BehaviorSchemaFn<T> {
  return (path: FieldPath<T>) => {
    const field = path[fieldKey];

    watchField(field, (value, ctx) => {
      const formatted = formatter(String(value || ''));
      if (formatted !== value) {
        (ctx.form as any)[fieldKey].setValue(formatted);
      }
    }, { immediate: false });
  };
}
```

Использование:

```typescript title="src/behaviors/user-behavior.ts"
import { createFormatBehavior } from './generic-behaviors';

interface UserForm {
  phone: string;
  email: string;
}

// Форматирование номера телефона
const phoneBehavior = createFormatBehavior<UserForm, 'phone'>(
  'phone',
  (value) => value.replace(/\D/g, '').slice(0, 10)
);

// Email в нижнем регистре
const emailBehavior = createFormatBehavior<UserForm, 'email'>(
  'email',
  (value) => value.toLowerCase()
);

export const userBehavior: BehaviorSchemaFn<UserForm> = (path) => {
  phoneBehavior(path);
  emailBehavior(path);
};
```

## Использование методов контекста

Контекст callback предоставляет несколько полезных методов:

```typescript
watchField(path.field, (value, ctx) => {
  // Доступ к полям формы
  ctx.form.otherField.setValue('value');
  ctx.form.otherField.getValue();
  ctx.form.otherField.reset();

  // Обновление свойств компонента
  ctx.form.otherField.updateComponentProps({ disabled: true });

  // Управление ошибками
  ctx.form.otherField.setErrors([{ code: 'custom', message: 'Ошибка' }]);
  ctx.form.otherField.clearErrors({ code: 'custom' });

  // Установка значения поля по строковому пути
  ctx.setFieldValue('nested.field', 'value');
});
```

## Лучшие практики

### 1. Держите поведения сфокусированными

```typescript
// ✅ Одна ответственность
export const priceBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  computeFrom([path.price, path.quantity], path.subtotal, ...);
};

export const discountBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  computeFrom([path.subtotal, path.discount], path.total, ...);
};

// ❌ Слишком много ответственностей
export const everythingBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Цены, скидки, доставка, валидация, API-вызовы...
};
```

### 2. Используйте debounce для затратных операций

```typescript
// ✅ Debounce для API-вызовов
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
}, { debounce: 300 });

// ❌ Без debounce - срабатывает на каждое нажатие клавиши
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
});
```

### 3. Обрабатывайте ошибки корректно

```typescript
// ✅ Обработка ошибок
watchField(path.region, async (region, ctx) => {
  try {
    const cities = await fetchCities(region);
    ctx.form.city.updateComponentProps({ options: cities });
  } catch (error) {
    console.error('Не удалось загрузить города:', error);
    ctx.form.city.updateComponentProps({ options: [] });
  }
}, { immediate: false });

// ❌ Без обработки ошибок - падает при сбое
watchField(path.region, async (region, ctx) => {
  const cities = await fetchCities(region);
  ctx.form.city.updateComponentProps({ options: cities });
}, { immediate: false });
```

### 4. Документируйте ваши поведения

```typescript
/**
 * Поведение для каскадных полей адреса
 *
 * Возможности:
 * - Загрузка городов при изменении региона
 * - Очистка города при изменении региона
 * - Автоформатирование почтового индекса
 *
 * @example
 * const form = new GroupNode({
 *   form: addressSchema,
 *   behavior: addressBehavior,
 * });
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Реализация...
};
```

### 5. Тестируйте ваши поведения

```typescript
// behaviors/__tests__/address-behavior.test.ts
import { GroupNode } from 'reformer';
import { addressBehavior } from '../address-behavior';

describe('addressBehavior', () => {
  it('должен очищать город при изменении региона', () => {
    const form = new GroupNode({
      form: addressSchema,
      behavior: addressBehavior,
    });

    form.city.setValue('Москва');
    form.region.setValue('new-region');

    expect(form.city.getValue()).toBe('');
  });
});
```

## Следующий шаг

Теперь, когда вы понимаете кастомные поведения, давайте узнаем как создавать переиспользуемые схемы поведений, которые можно использовать в нескольких формах.
