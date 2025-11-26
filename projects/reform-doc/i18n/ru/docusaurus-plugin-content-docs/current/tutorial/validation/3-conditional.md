---
sidebar_position: 3
---

# Условная валидация

Условная валидация с `apply` и `applyWhen`.

## Обзор

Условная валидация позволяет:

- Применять правила валидации только при выполнении определённых условий
- Использовать разные правила валидации для разных сценариев
- Композировать схемы валидации для вложенных объектов
- Создавать динамическую валидацию на основе состояния формы

ReFormer предоставляет две ключевые функции:

| Функция | Назначение |
|---------|------------|
| `apply` | Композиция схем валидации для вложенных объектов |
| `applyWhen` | Применение валидации только когда условие истинно |

## apply

Функция `apply` композирует схемы валидации, позволяя разбивать сложные формы на меньшие, переиспользуемые функции валидации.

```typescript
import { apply } from 'reformer/validators';

apply(
  path,           // Путь к полю (обычно корневой или путь к вложенному объекту)
  validationFn    // Функция схемы валидации для применения
);
```

### Базовый пример

```typescript title="src/validators/credit-validators.ts"
import { apply, required, email, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Address {
  street: string;
  city: string;
  postalCode: string;
}

interface CreditApplicationForm {
  firstName: string;
  lastName: string;
  email: string;
  registrationAddress: Address;
  residenceAddress: Address;
}

// Отдельная валидация для адреса
const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  required(path.street, { message: 'Улица обязательна' });
  required(path.city, { message: 'Город обязателен' });
  required(path.postalCode, { message: 'Почтовый индекс обязателен' });
  pattern(path.postalCode, /^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' });
};

// Валидация основной формы
export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  // Применяем валидацию адреса к вложенным объектам
  apply(path.registrationAddress, addressValidation);
  apply(path.residenceAddress, addressValidation);
};
```

### Композиция нескольких схем

```typescript title="src/validators/credit-validators.ts"
import { apply } from 'reformer/validators';
import type { ValidationSchemaFn } from 'reformer';

interface CreditApplicationForm {
  // Базовая информация
  lastName: string;
  firstName: string;
  middleName: string;
  // Персональные данные
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  // Трудоустройство
  employmentStatus: string;
  companyName: string;
  monthlyIncome: number;
  // Контакты
  phone: string;
  email: string;
}

// Отдельные схемы валидации
const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.firstName, { message: 'Имя обязательно' });
};

const personalDataValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.birthDate, { message: 'Дата рождения обязательна' });
  required(path.passportSeries, { message: 'Серия паспорта обязательна' });
  required(path.passportNumber, { message: 'Номер паспорта обязателен' });
};

const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phone, { message: 'Телефон обязателен' });
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
};

// Композиция всех валидаций
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path, basicInfoValidation);
  apply(path, personalDataValidation);
  apply(path, contactValidation);
};
```

## applyWhen

Функция `applyWhen` применяет валидацию только когда условие выполнено.

```typescript
import { applyWhen } from 'reformer/validators';

applyWhen(
  conditionField,   // Поле для проверки условия
  condition,        // Функция, возвращающая true когда валидация должна применяться
  validationFn      // Валидация для применения когда условие истинно
);
```

### Базовый пример: Статус занятости

```typescript title="src/validators/employment-validators.ts"
import { applyWhen, required, min, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed' | 'retired';
  companyName: string;
  companyInn: string;
  position: string;
  monthlyIncome: number;
  businessType: string;
  businessInn: string;
  businessActivity: string;
}

export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  // Валидация полей трудоустройства только для работающих
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      required(path.companyName, { message: 'Название компании обязательно' });
      required(path.companyInn, { message: 'ИНН компании обязателен' });
      pattern(path.companyInn, /^\d{10}$/, { message: 'ИНН компании должен содержать 10 цифр' });
      required(path.position, { message: 'Должность обязательна' });
      min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });
    }
  );

  // Валидация полей бизнеса только для самозанятых
  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (path) => {
      required(path.businessType, { message: 'Тип бизнеса обязателен' });
      required(path.businessInn, { message: 'ИНН бизнеса обязателен' });
      pattern(path.businessInn, /^\d{10,12}$/, { message: 'ИНН бизнеса должен содержать 10-12 цифр' });
      required(path.businessActivity, { message: 'Вид деятельности обязателен' });
      min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });
    }
  );
};
```

### Валидация типа кредита

```typescript title="src/validators/loan-type-validators.ts"
import { applyWhen, required, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  loanType: 'consumer' | 'mortgage' | 'car';
  loanAmount: number;
  loanTerm: number;
  // Поля ипотеки
  propertyValue: number;
  initialPayment: number;
  // Поля автокредита
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;
}

export const loanTypeValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanType, { message: 'Выберите тип кредита' });

  // Валидация для ипотеки
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      required(path.propertyValue, { message: 'Стоимость недвижимости обязательна' });
      min(path.propertyValue, 500000, { message: 'Минимальная стоимость недвижимости 500 000' });
      required(path.initialPayment, { message: 'Первоначальный взнос обязателен' });
      min(path.initialPayment, 0, { message: 'Первоначальный взнос не может быть отрицательным' });
      min(path.loanTerm, 12, { message: 'Минимальный срок ипотеки 12 месяцев' });
      max(path.loanTerm, 360, { message: 'Максимальный срок ипотеки 360 месяцев' });
    }
  );

  // Валидация для автокредита
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (path) => {
      required(path.carBrand, { message: 'Марка автомобиля обязательна' });
      required(path.carModel, { message: 'Модель автомобиля обязательна' });
      required(path.carYear, { message: 'Год выпуска обязателен' });
      min(path.carYear, 2000, { message: 'Год выпуска должен быть 2000 или позже' });
      required(path.carPrice, { message: 'Стоимость автомобиля обязательна' });
      min(path.carPrice, 100000, { message: 'Минимальная стоимость автомобиля 100 000' });
      min(path.loanTerm, 6, { message: 'Минимальный срок автокредита 6 месяцев' });
      max(path.loanTerm, 84, { message: 'Максимальный срок автокредита 84 месяца' });
    }
  );

  // Потребительский кредит использует стандартные ограничения срока (обрабатывается в другом месте)
};
```

### Булевое условие

```typescript title="src/validators/property-validators.ts"
import { applyWhen, notEmpty, validateItems, required, min, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  cadastralNumber: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
}

const propertyItemValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Адрес недвижимости обязателен' });
  required(path.cadastralNumber, { message: 'Кадастровый номер обязателен' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Неверный формат кадастрового номера',
  });
  required(path.type, { message: 'Тип недвижимости обязателен' });
  min(path.value, 100000, { message: 'Минимальная стоимость недвижимости 100 000' });
};

export const propertyFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Валидируем недвижимость только когда hasProperty равно true
  applyWhen(
    path.hasProperty,
    (value) => value === true,
    (path) => {
      notEmpty(path.properties, { message: 'Добавьте хотя бы один объект недвижимости' });
      validateItems(path.properties, propertyItemValidation);
    }
  );
};
```

## Комбинирование apply и applyWhen

Используйте обе функции вместе для сложных сценариев валидации:

```typescript title="src/validators/loan-validators.ts"
import { apply, applyWhen, required, min, max, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface MortgageFields {
  propertyValue: number;
  propertyAddress: string;
  propertyType: 'apartment' | 'house' | 'land';
}

interface CarLoanFields {
  carBrand: string;
  carModel: string;
  carYear: number;
}

interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  amount: number;
  term: number;
  // Условные поля
  propertyValue: number;
  propertyAddress: string;
  propertyType: 'apartment' | 'house' | 'land';
  carBrand: string;
  carModel: string;
  carYear: number;
}

// Общая валидация
const commonValidation: ValidationSchemaFn<LoanForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.amount, { message: 'Сумма обязательна' });
  min(path.amount, 10000, { message: 'Минимальная сумма кредита 10 000' });
  max(path.amount, 10000000, { message: 'Максимальная сумма кредита 10 000 000' });
  required(path.term, { message: 'Срок обязателен' });
  min(path.term, 6, { message: 'Минимальный срок 6 месяцев' });
  max(path.term, 360, { message: 'Максимальный срок 360 месяцев' });
};

// Валидация для ипотеки
const mortgageValidation: ValidationSchemaFn<LoanForm> = (path) => {
  required(path.propertyValue, { message: 'Стоимость недвижимости обязательна' });
  min(path.propertyValue, 500000, { message: 'Минимальная стоимость недвижимости 500 000' });
  required(path.propertyAddress, { message: 'Адрес недвижимости обязателен' });
  required(path.propertyType, { message: 'Тип недвижимости обязателен' });
};

// Валидация для автокредита
const carLoanValidation: ValidationSchemaFn<LoanForm> = (path) => {
  required(path.carBrand, { message: 'Марка автомобиля обязательна' });
  required(path.carModel, { message: 'Модель автомобиля обязательна' });
  required(path.carYear, { message: 'Год выпуска обязателен' });
  min(path.carYear, 2000, { message: 'Год выпуска должен быть 2000 или позже' });
};

// Основная валидация
export const loanValidation: ValidationSchemaFn<LoanForm> = (path) => {
  // Применяем общую валидацию
  apply(path, commonValidation);

  // Применяем валидацию ипотеки когда тип кредита - ипотека
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    mortgageValidation
  );

  // Применяем валидацию автокредита когда тип кредита - автокредит
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    carLoanValidation
  );
};
```

## Вложенная условная валидация

Обработка сложных вложенных условий:

```typescript title="src/validators/co-borrower-validators.ts"
import { applyWhen, required, min, email, pattern, notEmpty, validateItems } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CoBorrower {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  monthlyIncome: number;
}

interface CreditApplicationForm {
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
  // Для женатых/замужних
  spouseFirstName: string;
  spouseLastName: string;
  spouseIncome: number;
}

const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.phone, { message: 'Телефон обязателен' });
  pattern(path.phone, /^\+7\d{10}$/, { message: 'Формат телефона: +7XXXXXXXXXX' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });
};

export const familyValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Выберите семейное положение' });

  // Валидация информации о супруге для женатых/замужних
  applyWhen(
    path.maritalStatus,
    (status) => status === 'married',
    (path) => {
      required(path.spouseFirstName, { message: 'Имя супруга обязательно' });
      required(path.spouseLastName, { message: 'Фамилия супруга обязательна' });
      min(path.spouseIncome, 0, { message: 'Доход супруга не может быть отрицательным' });
    }
  );

  // Валидация информации о созаемщиках если применимо
  applyWhen(
    path.hasCoBorrower,
    (value) => value === true,
    (path) => {
      notEmpty(path.coBorrowers, { message: 'Добавьте хотя бы одного созаемщика' });
      validateItems(path.coBorrowers, coBorrowerValidation);
    }
  );
};
```

## Пример кредитной заявки

Полный пример из кредитной заявки:

```typescript title="src/validators/credit-application-validators.ts"
import {
  apply,
  applyWhen,
  required,
  email,
  phone,
  min,
  pattern,
  notEmpty,
  validateItems
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  value: number;
  type: string;
}

interface CreditApplicationForm {
  // Персональные данные
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  // Трудоустройство
  employmentStatus: 'employed' | 'self-employed' | 'unemployed' | 'retired';
  companyName: string;
  position: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  // Недвижимость
  hasProperty: boolean;
  properties: Property[];
}

// Валидация объекта недвижимости
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Адрес обязателен' });
  required(path.type, { message: 'Тип недвижимости обязателен' });
  min(path.value, 100000, { message: 'Минимальная стоимость 100 000' });
};

// Валидация персональных данных
const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.phone, { message: 'Телефон обязателен' });
  phone(path.phone, { message: 'Неверный формат телефона' });
};

// Валидация трудоустройства (условная)
const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  // Валидация для работающих
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      required(path.companyName, { message: 'Название компании обязательно' });
      required(path.position, { message: 'Должность обязательна' });
      min(path.workExperienceTotal, 0, { message: 'Общий стаж не может быть отрицательным' });
      min(path.workExperienceCurrent, 0, { message: 'Текущий стаж не может быть отрицательным' });
      min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });
    }
  );
};

// Основная валидация
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Применяем секционные валидации
  apply(path, personalValidation);
  apply(path, employmentValidation);

  // Валидация недвижимости (условная)
  applyWhen(
    path.hasProperty,
    (value) => value === true,
    (path) => {
      notEmpty(path.properties, { message: 'Добавьте хотя бы один объект недвижимости' });
      validateItems(path.properties, propertyValidation);
    }
  );
};
```

## Лучшие практики

### 1. Держите функции условий простыми

```typescript
// ✅ Простое, понятное условие
applyWhen(
  path.status,
  (status) => status === 'active',
  activeValidation
);

// ❌ Сложная логика в условии
applyWhen(
  path.status,
  (status) => {
    const isActive = status === 'active';
    const isPending = status === 'pending';
    return isActive || (isPending && someOtherCondition);
  },
  validation
);
```

### 2. Используйте apply для организации кода

```typescript
// ✅ Организовано с apply
apply(path, personalInfoValidation);
apply(path, addressValidation);
apply(path, employmentValidation);

// ❌ Вся валидация в одной большой функции
export const formValidation = (path) => {
  // 100+ строк валидации...
};
```

### 3. Группируйте связанные условные валидации

```typescript
// ✅ Связанные условия сгруппированы вместе
applyWhen(path.paymentType, (t) => t === 'card', cardValidation);
applyWhen(path.paymentType, (t) => t === 'bank', bankValidation);
applyWhen(path.paymentType, (t) => t === 'crypto', cryptoValidation);

// ❌ Разбросаны по коду
```

### 4. Документируйте сложные условия

```typescript
// ✅ Понятное намерение с комментариями
// Валидация информации о супруге только для женатых/замужних
applyWhen(
  path.maritalStatus,
  (status) => status === 'married',
  spouseValidation
);

// Валидация деталей бизнеса для самозанятых с доходом > 100к
applyWhen(
  path.employmentStatus,
  (status) => status === 'self-employed',
  (path) => {
    // Дополнительная валидация для самозанятых с высоким доходом
    applyWhen(
      path.monthlyIncome,
      (income) => income > 100000,
      detailedBusinessValidation
    );
  }
);
```

### 5. Избегайте глубоко вложенных условий

```typescript
// ✅ Выравнивайте когда возможно
applyWhen(path.type, (t) => t === 'business' && form.size === 'large', largeBusinessValidation);

// ❌ Глубоко вложенное - сложно следить
applyWhen(path.type, (t) => t === 'business', (path) => {
  applyWhen(path.size, (s) => s === 'large', (path) => {
    applyWhen(path.industry, (i) => i === 'tech', techValidation);
  });
});
```

## Следующий шаг

Теперь, когда вы понимаете условную валидацию, давайте узнаем о кросс-полевой валидации с `validateTree`.
