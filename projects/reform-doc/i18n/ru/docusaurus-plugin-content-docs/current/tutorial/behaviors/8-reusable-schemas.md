---
sidebar_position: 8
---

# Переиспользуемые схемы поведений

Создание переиспользуемых схем поведений для типовых паттернов.

## Обзор

Когда одни и те же паттерны поведения встречаются в нескольких формах, вы можете вынести их в переиспользуемые схемы поведений. Этот подход:

- Устраняет дублирование кода
- Обеспечивает согласованное поведение между формами
- Упрощает тестирование
- Облегчает поддержку

## Создание переиспользуемой схемы поведения

Переиспользуемая схема поведения — это `BehaviorSchemaFn`, разработанная для конкретной вложенной структуры:

```typescript title="src/behaviors/address-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { fetchCities } from '../api';

// Определяем интерфейс Address
export interface Address {
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

/**
 * Переиспользуемая схема поведения для полей Address
 *
 * Возможности:
 * - Загрузка городов при изменении региона
 * - Очистка города при изменении региона
 * - Автоформатирование почтового индекса
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (path: FieldPath<Address>) => {
  // Загрузка городов при изменении региона
  watchField(
    path.region,
    async (region, ctx) => {
      if (region) {
        try {
          const { data: cities } = await fetchCities(region);
          ctx.form.city.updateComponentProps({ options: cities });
        } catch (error) {
          console.error('Не удалось загрузить города:', error);
          ctx.form.city.updateComponentProps({ options: [] });
        }
      }
    },
    { debounce: 300, immediate: false }
  );

  // Очистка города при изменении региона
  watchField(
    path.region,
    (_region, ctx) => {
      ctx.setFieldValue('city', '');
    },
    { immediate: false }
  );

  // Автоформатирование почтового индекса
  watchField(
    path.postalCode,
    (postalCode, ctx) => {
      const cleaned = postalCode?.replace(/\D/g, '').slice(0, 6);
      if (cleaned !== postalCode) {
        ctx.setFieldValue('postalCode', cleaned || '');
      }
    },
    { immediate: false }
  );
};
```

## Применение переиспользуемых поведений

### Прямое применение

Применяйте поведение напрямую в схеме поведения формы:

```typescript title="src/behaviors/user-form-behavior.ts"
import { type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { addressBehavior, type Address } from './address-behavior';

interface UserForm {
  name: string;
  email: string;
  address: Address;
}

export const userFormBehavior: BehaviorSchemaFn<UserForm> = (path: FieldPath<UserForm>) => {
  // Применить поведение адреса к вложенному полю address
  addressBehavior(path.address);
};
```

### Множественные экземпляры

Применяйте одно и то же поведение к нескольким полям:

```typescript title="src/behaviors/credit-application-behavior.ts"
import { copyFrom, enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { addressBehavior, type Address } from './address-behavior';

interface CreditApplicationForm {
  sameAsRegistration: boolean;
  registrationAddress: Address;
  residenceAddress: Address;
}

export const creditApplicationBehavior: BehaviorSchemaFn<CreditApplicationForm> = (path: FieldPath<CreditApplicationForm>) => {
  // Применить поведение адреса к обоим полям адреса
  addressBehavior(path.registrationAddress);
  addressBehavior(path.residenceAddress);

  // Копировать регистрацию → проживание при установке чекбокса
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // Деактивировать адрес проживания когда совпадает с регистрацией
  enableWhen(path.residenceAddress, (form) => !form.sameAsRegistration, {
    resetOnDisable: true,
  });
};
```

## Композиция схем поведений

Создавайте высокоуровневые поведения путём композиции более мелких:

```typescript title="src/behaviors/complete-user-behavior.ts"
import { computeFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { addressBehavior } from './address-behavior';
import { personalDataBehavior } from './personal-data-behavior';
import { contactBehavior } from './contact-behavior';

interface CompleteUserForm {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  contact: {
    phone: string;
    email: string;
    emailAdditional: string;
  };
  address: Address;
  fullName: string;
  age: number;
}

export const completeUserBehavior: BehaviorSchemaFn<CompleteUserForm> = (path: FieldPath<CompleteUserForm>) => {
  // Применить модульные поведения
  personalDataBehavior(path.personalData);
  contactBehavior(path.contact);
  addressBehavior(path.address);

  // Добавить вычисления специфичные для формы
  computeFrom([path.personalData], path.fullName, (values) => {
    const data = values.personalData as CompleteUserForm['personalData'];
    return [data.lastName, data.firstName, data.middleName].filter(Boolean).join(' ');
  });

  computeFrom([path.personalData], path.age, (values) => {
    const data = values.personalData as CompleteUserForm['personalData'];
    if (!data?.birthDate) return 0;
    const birth = new Date(data.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  });
};
```

## Пример поведения для персональных данных

```typescript title="src/behaviors/personal-data-behavior.ts"
import { computeFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
}

export const personalDataBehavior: BehaviorSchemaFn<PersonalData> = (path: FieldPath<PersonalData>) => {
  // Можно добавить поведения для:
  // - Капитализации имён
  // - Валидации даты рождения
  // - Ограничений по возрасту
};
```

## Пример поведения для контактов

```typescript title="src/behaviors/contact-behavior.ts"
import { copyFrom, watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface Contact {
  phone: string;
  email: string;
  emailAdditional: string;
  sameEmail?: boolean;
}

export const contactBehavior: BehaviorSchemaFn<Contact> = (path: FieldPath<Contact>) => {
  // Форматирование номера телефона
  watchField(
    path.phone,
    (phone, ctx) => {
      const cleaned = phone?.replace(/\D/g, '').slice(0, 11);
      if (cleaned !== phone) {
        ctx.form.phone.setValue(cleaned || '');
      }
    },
    { immediate: false }
  );

  // Email в нижнем регистре
  watchField(
    path.email,
    (email, ctx) => {
      const lower = email?.toLowerCase();
      if (lower !== email) {
        ctx.form.email.setValue(lower || '');
      }
    },
    { immediate: false }
  );

  // Копировать email в дополнительный email если sameEmail
  if ('sameEmail' in path) {
    copyFrom(path.emailAdditional, path.email, {
      when: (form) => form.sameEmail === true,
    });
  }
};
```

## Поведение для расчёта кредита

Более сложное переиспользуемое поведение для расчёта кредита:

```typescript title="src/behaviors/loan-calculation-behavior.ts"
import { computeFrom, watchField, revalidateWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface LoanFields {
  loanAmount: number;
  loanTerm: number;
  interestRate: number;
  monthlyPayment: number;
  totalPayment: number;
  overpayment: number;
}

const calculateMonthlyPayment = (amount: number, termMonths: number, annualRate: number): number => {
  if (!amount || !termMonths || annualRate <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (amount * monthlyRate * factor) / (factor - 1);
};

export const loanCalculationBehavior: BehaviorSchemaFn<LoanFields> = (path: FieldPath<LoanFields>) => {
  // Расчёт ежемесячного платежа
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const term = values.loanTerm as number;
      const rate = values.interestRate as number;
      return Math.round(calculateMonthlyPayment(amount, term, rate));
    }
  );

  // Расчёт общей суммы выплат
  computeFrom(
    [path.monthlyPayment, path.loanTerm],
    path.totalPayment,
    (values) => {
      const monthly = values.monthlyPayment as number;
      const term = values.loanTerm as number;
      return Math.round(monthly * term);
    }
  );

  // Расчёт переплаты
  computeFrom(
    [path.totalPayment, path.loanAmount],
    path.overpayment,
    (values) => {
      const total = values.totalPayment as number;
      const amount = values.loanAmount as number;
      return Math.max(0, total - amount);
    }
  );

  // Перевалидировать сумму при изменении ставки
  revalidateWhen(path.loanAmount, [path.interestRate]);
};
```

## Лучшие практики

### 1. Определяйте чёткие интерфейсы

```typescript
// ✅ Чёткое определение интерфейса
export interface Address {
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // ...
};

// ❌ Непонятная структура
export const addressBehavior = (path: any) => {
  // ...
};
```

### 2. Экспортируйте интерфейсы вместе с поведениями

```typescript title="src/behaviors/index.ts"
// Экспортируем и поведение, и его интерфейс
export { addressBehavior, type Address } from './address-behavior';
export { contactBehavior, type Contact } from './contact-behavior';
export { loanCalculationBehavior, type LoanFields } from './loan-calculation-behavior';
```

### 3. Сохраняйте модульность поведений

```typescript
// ✅ Сфокусированное, однозадачное поведение
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Только логика, связанная с адресом
};

// ❌ Поведение делает слишком много
export const addressAndValidationAndLoadingBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Логика адреса + валидация + состояния загрузки + ...
};
```

### 4. Документируйте зависимости

```typescript
/**
 * Поведение адреса для каскадных селектов
 *
 * Зависимости:
 * - API-функция fetchCities
 *
 * @requires Схема формы должна иметь компонент Select для поля city
 * @requires Свойство options в componentProps поля city
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // ...
};
```

### 5. Обрабатывайте граничные случаи

```typescript
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  watchField(path.region, async (region, ctx) => {
    // Обработка пустого региона
    if (!region) {
      ctx.form.city.updateComponentProps({ options: [] });
      return;
    }

    try {
      const cities = await fetchCities(region);
      ctx.form.city.updateComponentProps({ options: cities });
    } catch (error) {
      // Корректная обработка ошибок API
      console.error('Не удалось загрузить города:', error);
      ctx.form.city.updateComponentProps({ options: [] });
    }
  }, { immediate: false, debounce: 300 });
};
```

## Тестирование переиспользуемых поведений

```typescript title="src/behaviors/__tests__/address-behavior.test.ts"
import { GroupNode } from 'reformer';
import { addressBehavior, addressSchema } from '../address-behavior';

describe('addressBehavior', () => {
  let form: GroupNode<Address>;

  beforeEach(() => {
    form = new GroupNode({
      form: addressSchema,
      behavior: addressBehavior,
    });
  });

  it('должен очищать город при изменении региона', () => {
    form.city.setValue('Москва');
    form.region.setValue('new-region');
    expect(form.city.getValue()).toBe('');
  });

  it('должен форматировать почтовый индекс до 6 цифр', () => {
    form.postalCode.setValue('123-456-789');
    expect(form.postalCode.getValue()).toBe('123456');
  });

  it('должен загружать города при установке региона', async () => {
    // Мокаем API fetchCities
    jest.mock('../api', () => ({
      fetchCities: jest.fn().mockResolvedValue({ data: [
        { value: 'city1', label: 'Город 1' },
        { value: 'city2', label: 'Город 2' },
      ]}),
    }));

    form.region.setValue('test-region');

    await new Promise((r) => setTimeout(r, 400)); // Ждём debounce

    const options = form.city.componentProps.value.options;
    expect(options).toHaveLength(2);
  });
});
```

## Итоги

Переиспользуемые схемы поведений помогают вам:

- **Уменьшить дублирование** — Пишите логику поведения один раз, используйте везде
- **Обеспечить согласованность** — Одинаковый паттерн поведения во всех формах
- **Упростить тестирование** — Тестируйте поведение изолированно
- **Улучшить поддерживаемость** — Обновляйте логику в одном месте

Ключевые паттерны:
1. Определяйте чёткие интерфейсы для типов поведений
2. Экспортируйте поведения вместе с их интерфейсами
3. Компонуйте поведения для сложных форм
4. Документируйте зависимости и требования
5. Тестируйте поведения изолированно

Вы завершили раздел Behaviors учебника. Теперь вы понимаете, как использовать встроенные поведения и создавать пользовательские, переиспользуемые схемы поведений для ваших форм.
