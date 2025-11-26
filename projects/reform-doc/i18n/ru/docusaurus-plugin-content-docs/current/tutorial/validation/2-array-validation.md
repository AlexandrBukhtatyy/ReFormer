---
sidebar_position: 2
---

# Валидация массивов

Валидация массивов с `notEmpty` и `validateItems`.

## Обзор

ReFormer предоставляет специализированные валидаторы для работы с массивами:

| Валидатор | Назначение |
|-----------|------------|
| `notEmpty` | Проверка что массив содержит хотя бы один элемент |
| `validateItems` | Применение схемы валидации к каждому элементу массива |
| `minLength` | Минимальное количество элементов |
| `maxLength` | Максимальное количество элементов |

## notEmpty

Валидатор `notEmpty` проверяет, что массив содержит хотя бы один элемент.

```typescript
import { notEmpty } from 'reformer/validators';

notEmpty(path.items, { message: 'Добавьте хотя бы один элемент' });
```

### Базовый пример

```typescript title="src/validators/credit-validators.ts"
import { notEmpty } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
}

interface Property {
  address: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

export const propertyValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  notEmpty(path.properties, { message: 'Добавьте хотя бы один объект недвижимости' });
};
```

## validateItems

Валидатор `validateItems` применяет схему валидации к каждому элементу массива.

```typescript
import { validateItems } from 'reformer/validators';

validateItems(
  arrayField,     // Поле массива для валидации
  itemValidation  // Схема валидации для каждого элемента
);
```

### Базовый пример

```typescript title="src/validators/existing-loan-validators.ts"
import { validateItems, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface ExistingLoan {
  bankName: string;
  loanType: string;
  remainingAmount: number;
  monthlyPayment: number;
}

interface CreditApplicationForm {
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
}

// Валидация одного существующего кредита
const existingLoanValidation: ValidationSchemaFn<ExistingLoan> = (
  path: FieldPath<ExistingLoan>
) => {
  required(path.bankName, { message: 'Название банка обязательно' });
  required(path.loanType, { message: 'Тип кредита обязателен' });
  min(path.remainingAmount, 0, { message: 'Остаток задолженности не может быть отрицательным' });
  min(path.monthlyPayment, 0, { message: 'Ежемесячный платеж не может быть отрицательным' });
};

// Валидация основной формы
export const loansValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  notEmpty(path.existingLoans, { message: 'Добавьте информацию о существующих кредитах' });
  validateItems(path.existingLoans, existingLoanValidation);
};
```

### Валидация списка недвижимости

```typescript title="src/validators/property-list-validators.ts"
import { validateItems, required, min, notEmpty, pattern } from 'reformer/validators';
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

// Валидация одного объекта недвижимости
const propertyItemValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Адрес недвижимости обязателен' });
  required(path.cadastralNumber, { message: 'Кадастровый номер обязателен' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Неверный формат кадастрового номера (например, 77:01:0001001:123)',
  });
  required(path.type, { message: 'Тип недвижимости обязателен' });
  min(path.value, 100000, { message: 'Минимальная стоимость недвижимости 100 000' });
};

// Валидация основной формы
export const propertyFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  notEmpty(path.properties, { message: 'Добавьте хотя бы один объект недвижимости' });
  validateItems(path.properties, propertyItemValidation);
};
```

## Комбинирование валидаторов массивов

Используйте несколько валидаторов вместе для комплексной валидации массива:

```typescript title="src/validators/co-borrower-validators.ts"
import {
  notEmpty,
  validateItems,
  minLength,
  maxLength,
  required,
  email,
  min,
  pattern
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CoBorrower {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  phone: string;
  monthlyIncome: number;
  relationship: string;
}

interface CreditApplicationForm {
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

// Валидация созаемщика
const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.birthDate, { message: 'Дата рождения обязательна' });
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.phone, { message: 'Телефон обязателен' });
  pattern(path.phone, /^\+7\d{10}$/, { message: 'Формат телефона: +7XXXXXXXXXX' });
  required(path.relationship, { message: 'Степень родства обязательна' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный ежемесячный доход 10 000' });
};

// Валидация кредитной заявки
export const coBorrowerFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Массив не должен быть пустым
  notEmpty(path.coBorrowers, { message: 'Добавьте хотя бы одного созаемщика' });

  // Ограничения длины массива
  minLength(path.coBorrowers, 1, { message: 'Минимум 1 созаемщик' });
  maxLength(path.coBorrowers, 3, { message: 'Максимум 3 созаемщика' });

  // Валидация каждого созаемщика
  validateItems(path.coBorrowers, coBorrowerValidation);
};
```

## Вложенные массивы

Валидация вложенных массивов с рекурсивными схемами валидации:

```typescript title="src/validators/nested-validators.ts"
import { validateItems, required, notEmpty } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Task {
  title: string;
  completed: boolean;
}

interface Project {
  name: string;
  tasks: Task[];
}

interface Portfolio {
  title: string;
  projects: Project[];
}

// Валидация задачи
const taskValidation: ValidationSchemaFn<Task> = (path: FieldPath<Task>) => {
  required(path.title, { message: 'Название задачи обязательно' });
};

// Валидация проекта (включает вложенные задачи)
const projectValidation: ValidationSchemaFn<Project> = (path: FieldPath<Project>) => {
  required(path.name, { message: 'Название проекта обязательно' });
  notEmpty(path.tasks, { message: 'Добавьте хотя бы одну задачу' });
  validateItems(path.tasks, taskValidation);
};

// Валидация портфолио (включает вложенные проекты)
export const portfolioValidation: ValidationSchemaFn<Portfolio> = (path) => {
  required(path.title, { message: 'Название портфолио обязательно' });
  notEmpty(path.projects, { message: 'Добавьте хотя бы один проект' });
  validateItems(path.projects, projectValidation);
};
```

## Пример кредитной заявки

Реальный пример из формы кредитной заявки:

```typescript title="src/validators/credit-validators.ts"
import {
  notEmpty,
  validateItems,
  required,
  min,
  pattern
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  cadastralNumber: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

interface Vehicle {
  brand: string;
  model: string;
  year: number;
  value: number;
  registrationNumber: string;
}

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
  hasVehicles: boolean;
  vehicles: Vehicle[];
}

// Валидация объекта недвижимости
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Адрес недвижимости обязателен' });
  required(path.cadastralNumber, { message: 'Кадастровый номер обязателен' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Неверный формат кадастрового номера',
  });
  required(path.type, { message: 'Тип недвижимости обязателен' });
  min(path.value, 100000, { message: 'Минимальная стоимость недвижимости 100 000' });
};

// Валидация транспортного средства
const vehicleValidation: ValidationSchemaFn<Vehicle> = (path: FieldPath<Vehicle>) => {
  required(path.brand, { message: 'Марка автомобиля обязательна' });
  required(path.model, { message: 'Модель автомобиля обязательна' });
  min(path.year, 1990, { message: 'Год выпуска должен быть 1990 или позже' });
  min(path.value, 0, { message: 'Стоимость не может быть отрицательной' });
  required(path.registrationNumber, { message: 'Регистрационный номер обязателен' });
};

// Валидация основной формы для дополнительных секций
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Валидация недвижимости
  notEmpty(path.properties, { message: 'Добавьте хотя бы один объект недвижимости' });
  validateItems(path.properties, propertyValidation);

  // Валидация транспорта
  notEmpty(path.vehicles, { message: 'Добавьте хотя бы одно транспортное средство' });
  validateItems(path.vehicles, vehicleValidation);
};
```

## Условная валидация массивов

Валидация массивов только при выполнении определённых условий:

```typescript title="src/validators/conditional-array-validators.ts"
import { notEmpty, validateItems, applyWhen, required, min, pattern } from 'reformer/validators';
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

// Валидация недвижимости
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Адрес недвижимости обязателен' });
  required(path.cadastralNumber, { message: 'Кадастровый номер обязателен' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Неверный формат кадастрового номера',
  });
  required(path.type, { message: 'Тип недвижимости обязателен' });
  min(path.value, 100000, { message: 'Минимальная стоимость недвижимости 100 000' });
};

// Валидация кредитной заявки
export const propertyFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Валидируем массив недвижимости только когда hasProperty равно true
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

## Сложная вложенная структура

Валидация глубоко вложенных структур с массивами и объектами:

```typescript title="src/validators/co-borrower-nested-validators.ts"
import {
  validateItems,
  required,
  email,
  notEmpty,
  pattern,
  min
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Address {
  street: string;
  city: string;
  postalCode: string;
}

interface ContactInfo {
  email: string;
  phone: string;
  address: Address;
}

interface CoBorrower {
  firstName: string;
  lastName: string;
  contact: ContactInfo;
  monthlyIncome: number;
}

interface CreditApplicationForm {
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

// Валидация адреса
const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  required(path.street, { message: 'Улица обязательна' });
  required(path.city, { message: 'Город обязателен' });
  required(path.postalCode, { message: 'Почтовый индекс обязателен' });
  pattern(path.postalCode, /^\d{6}$/, { message: 'Индекс должен содержать 6 цифр' });
};

// Валидация контактов
const contactValidation: ValidationSchemaFn<ContactInfo> = (path: FieldPath<ContactInfo>) => {
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.phone, { message: 'Телефон обязателен' });
  pattern(path.phone, /^\+7\d{10}$/, { message: 'Формат телефона: +7XXXXXXXXXX' });
  // Примечание: для вложенных объектов используется apply() для address
};

// Валидация созаемщика
const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.lastName, { message: 'Фамилия обязательна' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });
  // Примечание: для вложенных объектов используется apply() для contact
};

// Валидация кредитной заявки
export const coBorrowerFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  notEmpty(path.coBorrowers, { message: 'Добавьте хотя бы одного созаемщика' });
  validateItems(path.coBorrowers, coBorrowerValidation);
};
```

## Лучшие практики

### 1. Всегда проверяйте существование массива первым

```typescript
// ✅ Проверяем что массив не пуст перед валидацией элементов
notEmpty(path.properties, { message: 'Добавьте хотя бы один объект недвижимости' });
validateItems(path.properties, propertyValidation);

// ❌ Валидация элементов без проверки существования массива
validateItems(path.properties, propertyValidation);
```

### 2. Создавайте переиспользуемые валидаторы элементов

```typescript
// ✅ Отдельная валидация элемента для переиспользования
const propertyValidation: ValidationSchemaFn<Property> = (path) => {
  required(path.address, { message: 'Адрес обязателен' });
  required(path.type, { message: 'Тип недвижимости обязателен' });
  min(path.value, 100000, { message: 'Минимальная стоимость 100 000' });
};

// Используем в нескольких местах
validateItems(path.properties, propertyValidation);
validateItems(path.inheritedProperties, propertyValidation);

// ❌ Дублирование логики валидации inline
```

### 3. Используйте условную валидацию для опциональных массивов

```typescript
// ✅ Валидируем только когда массив должен содержать элементы
applyWhen(
  path.hasCoBorrower,
  (value) => value === true,
  (path) => {
    notEmpty(path.coBorrowers, { message: 'Добавьте информацию о созаемщике' });
    validateItems(path.coBorrowers, coBorrowerValidation);
  }
);

// ❌ Всегда требуем элементы даже когда это неприменимо
notEmpty(path.coBorrowers, { message: 'Добавьте информацию о созаемщике' });
```

### 4. Устанавливайте разумные ограничения

```typescript
// ✅ Устанавливаем минимальный и максимальный лимиты
notEmpty(path.coBorrowers, { message: 'Добавьте хотя бы одного созаемщика' });
maxLength(path.coBorrowers, 3, { message: 'Максимум 3 созаемщика' });
validateItems(path.coBorrowers, coBorrowerValidation);

// ❌ Без верхнего ограничения - потенциальные проблемы производительности
```

### 5. Понятные сообщения об ошибках

```typescript
// ✅ Контекстно-специфичные сообщения
notEmpty(path.existingLoans, { message: 'Добавьте информацию о существующих кредитах' });
notEmpty(path.properties, { message: 'Добавьте хотя бы один объект недвижимости для продолжения' });

// ❌ Общие сообщения
notEmpty(path.existingLoans, { message: 'Обязательно' });
notEmpty(path.properties, { message: 'Не может быть пустым' });
```

## Следующий шаг

Теперь, когда вы понимаете валидацию массивов, давайте узнаем об условной валидации с `applyWhen`.
