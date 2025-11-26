---
sidebar_position: 1
---

# Встроенные валидаторы

Все встроенные валидаторы ReFormer.

## Обзор

ReFormer предоставляет полный набор встроенных валидаторов для типичных сценариев валидации:

| Валидатор | Назначение | Тип значения |
|-----------|------------|--------------|
| `required` | Обязательное поле | Любой |
| `min` | Минимальное числовое значение | `number` |
| `max` | Максимальное числовое значение | `number` |
| `minLength` | Минимальная длина строки/массива | `string` / `array` |
| `maxLength` | Максимальная длина строки/массива | `string` / `array` |
| `email` | Валидный формат email | `string` |
| `url` | Валидный формат URL | `string` |
| `phone` | Валидный формат телефона | `string` |
| `pattern` | Соответствие регулярному выражению | `string` |
| `number` | Валидное числовое значение | `string` / `number` |
| `date` | Валидный формат даты | `string` / `Date` |

## Базовое использование

Импортируйте валидаторы из `reformer/validators`:

```typescript
import { required, email, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  loanAmount: number;
  loanTerm: number;
  email: string;
  phoneMain: string;
}

export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальный кредит: 50 000' });
  max(path.loanAmount, 5000000, { message: 'Максимальный кредит: 5 000 000' });

  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
};
```

## API валидаторов

Все валидаторы следуют единому паттерну API:

```typescript
validator(field, [value], options);
```

- **field** — Путь к полю для валидации
- **value** — Значение, специфичное для валидатора (лимит, паттерн и т.д.) — опционально для некоторых валидаторов
- **options** — Объект конфигурации со свойством `message`

## required

Валидирует, что поле имеет непустое значение.

```typescript
import { required } from 'reformer/validators';

// Базовое использование
required(path.loanAmount);

// С кастомным сообщением
required(path.loanAmount, { message: 'Сумма кредита обязательна' });
```

Считается пустым:
- `null`, `undefined`
- Пустая строка `''`
- Пустой массив `[]`

```typescript title="src/validators/basic-info-validation.ts"
interface BasicInfoForm {
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  phoneMain: string;
  email: string;
  agreeTerms: boolean;
}

export const basicInfoValidation: ValidationSchemaFn<BasicInfoForm> = (path) => {
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  required(path.loanPurpose, { message: 'Цель кредита обязательна' });
  required(path.phoneMain, { message: 'Номер телефона обязателен' });
  required(path.email, { message: 'Email обязателен' });
  required(path.agreeTerms, { message: 'Необходимо принять условия' });
};
```

## min и max

Валидация числовых границ.

```typescript
import { min, max } from 'reformer/validators';

// Минимальное значение
min(path.loanAmount, 50000, { message: 'Минимальный кредит: 50 000' });

// Максимальное значение
max(path.loanAmount, 5000000, { message: 'Максимальный кредит: 5 000 000' });
```

```typescript title="src/validators/loan-amount-validation.ts"
interface LoanForm {
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
  dependents: number;
}

export const loanValidation: ValidationSchemaFn<LoanForm> = (path) => {
  // Сумма кредита: 50 000 - 5 000 000
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000' });
  max(path.loanAmount, 5000000, { message: 'Максимальная сумма кредита: 5 000 000' });

  // Срок кредита: 6 - 360 месяцев
  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 360, { message: 'Максимальный срок: 360 месяцев' });

  // Ежемесячный доход: минимум 10 000
  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000' });

  // Иждивенцы: 0-10
  min(path.dependents, 0, { message: 'Количество иждивенцев не может быть отрицательным' });
  max(path.dependents, 10, { message: 'Максимум 10 иждивенцев' });
};
```

## minLength и maxLength

Валидация длины строки или массива.

```typescript
import { minLength, maxLength } from 'reformer/validators';

// Минимальная длина
minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });

// Максимальная длина
maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });
```

```typescript title="src/validators/text-fields-validation.ts"
interface EmploymentForm {
  companyName: string;
  position: string;
  loanPurpose: string;
  additionalIncomeSource: string;
}

export const employmentValidation: ValidationSchemaFn<EmploymentForm> = (path) => {
  // Название компании: 2-100 символов
  required(path.companyName, { message: 'Название компании обязательно' });
  minLength(path.companyName, 2, { message: 'Минимум 2 символа' });
  maxLength(path.companyName, 100, { message: 'Максимум 100 символов' });

  // Должность: 2-50 символов
  required(path.position, { message: 'Должность обязательна' });
  minLength(path.position, 2, { message: 'Минимум 2 символа' });
  maxLength(path.position, 50, { message: 'Максимум 50 символов' });

  // Цель кредита: 10-500 символов
  required(path.loanPurpose, { message: 'Укажите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Опишите подробнее (минимум 10 символов)' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  // Источник дополнительного дохода (опционально)
  maxLength(path.additionalIncomeSource, 200, { message: 'Максимум 200 символов' });
};
```

## email

Валидирует формат email.

```typescript
import { email } from 'reformer/validators';

email(path.email, { message: 'Неверный формат email' });
```

```typescript title="src/validators/contact-validation.ts"
interface ContactForm {
  email: string;
  emailAdditional: string;
}

export const contactValidation: ValidationSchemaFn<ContactForm> = (path) => {
  // Основной email
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  // Дополнительный email (опционально)
  email(path.emailAdditional, { message: 'Неверный формат email' });
};
```

## url

Валидирует формат URL.

```typescript
import { url } from 'reformer/validators';

url(path.companyWebsite, { message: 'Неверный формат URL' });
```

```typescript title="src/validators/company-validation.ts"
interface CompanyForm {
  companyWebsite: string;
  linkedInProfile: string;
}

export const companyValidation: ValidationSchemaFn<CompanyForm> = (path) => {
  url(path.companyWebsite, { message: 'Неверный URL сайта компании' });
  url(path.linkedInProfile, { message: 'Неверный URL LinkedIn' });
};
```

## phone

Валидирует формат номера телефона.

```typescript
import { phone } from 'reformer/validators';

phone(path.phoneMain, { message: 'Неверный формат телефона' });
```

```typescript title="src/validators/phone-validation.ts"
interface PhoneForm {
  phoneMain: string;
  phoneAdditional: string;
  companyPhone: string;
}

export const phoneValidation: ValidationSchemaFn<PhoneForm> = (path) => {
  // Основной телефон
  required(path.phoneMain, { message: 'Номер телефона обязателен' });
  phone(path.phoneMain, { message: 'Неверный формат телефона' });

  // Дополнительный телефон (опционально)
  phone(path.phoneAdditional, { message: 'Неверный формат телефона' });

  // Телефон компании
  phone(path.companyPhone, { message: 'Неверный формат телефона компании' });
};
```

## pattern

Валидирует соответствие регулярному выражению.

```typescript
import { pattern } from 'reformer/validators';

// ИНН (10-12 цифр)
pattern(path.inn, /^\d{10,12}$/, {
  message: 'ИНН должен содержать 10-12 цифр'
});

// СНИЛС (11 цифр)
pattern(path.snils, /^\d{11}$/, {
  message: 'СНИЛС должен содержать 11 цифр'
});
```

```typescript title="src/validators/documents-validation.ts"
interface DocumentsForm {
  inn: string;
  snils: string;
  passportSeries: string;
  passportNumber: string;
}

export const documentsValidation: ValidationSchemaFn<DocumentsForm> = (path) => {
  // ИНН: 10-12 цифр
  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{10,12}$/, {
    message: 'ИНН должен содержать 10-12 цифр'
  });

  // СНИЛС: 11 цифр
  required(path.snils, { message: 'СНИЛС обязателен' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'СНИЛС должен содержать 11 цифр'
  });

  // Серия паспорта: 4 цифры
  required(path.passportSeries, { message: 'Серия паспорта обязательна' });
  pattern(path.passportSeries, /^\d{4}$/, {
    message: 'Серия должна содержать 4 цифры'
  });

  // Номер паспорта: 6 цифр
  required(path.passportNumber, { message: 'Номер паспорта обязателен' });
  pattern(path.passportNumber, /^\d{6}$/, {
    message: 'Номер должен содержать 6 цифр'
  });
};
```

## number

Валидирует, что значение является валидным числом.

```typescript
import { number } from 'reformer/validators';

number(path.loanAmount, { message: 'Должно быть валидным числом' });
```

```typescript title="src/validators/numeric-validation.ts"
interface NumericForm {
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
  additionalIncome: number;
}

export const numericValidation: ValidationSchemaFn<NumericForm> = (path) => {
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  number(path.loanAmount, { message: 'Сумма кредита должна быть валидным числом' });

  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  number(path.loanTerm, { message: 'Срок кредита должен быть валидным числом' });

  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  number(path.monthlyIncome, { message: 'Доход должен быть валидным числом' });

  // Дополнительный доход (опционально)
  number(path.additionalIncome, { message: 'Должно быть валидным числом' });
};
```

## date

Валидирует формат даты.

```typescript
import { date } from 'reformer/validators';

date(path.birthDate, { message: 'Неверный формат даты' });
```

```typescript title="src/validators/date-validation.ts"
interface PersonalDataForm {
  birthDate: string;
  passportIssueDate: string;
}

export const personalDataValidation: ValidationSchemaFn<PersonalDataForm> = (path) => {
  // Дата рождения
  required(path.birthDate, { message: 'Дата рождения обязательна' });
  date(path.birthDate, { message: 'Неверный формат даты' });

  // Дата выдачи паспорта
  required(path.passportIssueDate, { message: 'Дата выдачи обязательна' });
  date(path.passportIssueDate, { message: 'Неверный формат даты' });
};
```

## Комбинирование валидаторов

Вы можете применять несколько валидаторов к одному полю:

```typescript title="src/validators/combined-validation.ts"
interface CreditApplicationForm {
  loanAmount: number;
  email: string;
  phoneMain: string;
  inn: string;
  loanPurpose: string;
}

export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Сумма кредита: required, number, min, max
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  number(path.loanAmount, { message: 'Должно быть валидным числом' });
  min(path.loanAmount, 50000, { message: 'Минимум: 50 000' });
  max(path.loanAmount, 5000000, { message: 'Максимум: 5 000 000' });

  // Email: required, email format
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  // Телефон: required, phone format
  required(path.phoneMain, { message: 'Телефон обязателен' });
  phone(path.phoneMain, { message: 'Неверный формат телефона' });

  // ИНН: required, pattern
  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{10,12}$/, { message: 'ИНН должен содержать 10-12 цифр' });

  // Цель кредита: required, minLength, maxLength
  required(path.loanPurpose, { message: 'Цель кредита обязательна' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });
};
```

## Лучшие практики

### 1. Всегда предоставляйте понятные сообщения

```typescript
// ✅ Понятное, конкретное сообщение
min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000' });

// ❌ Общее сообщение
min(path.loanAmount, 50000, { message: 'Неверное значение' });
```

### 2. Располагайте валидаторы логично

```typescript
// ✅ Сначала проверяем наличие, потом формат, затем границы
required(path.loanAmount, { message: 'Сумма кредита обязательна' });
number(path.loanAmount, { message: 'Должно быть валидным числом' });
min(path.loanAmount, 50000, { message: 'Минимум: 50 000' });
max(path.loanAmount, 5000000, { message: 'Максимум: 5 000 000' });

// ❌ Проверяем границы до наличия
min(path.loanAmount, 50000, { message: 'Минимум: 50 000' });
required(path.loanAmount, { message: 'Сумма кредита обязательна' });
```

### 3. Опциональные поля не нуждаются в `required`

```typescript
// ✅ Опциональное поле - валидируем только формат, если заполнено
email(path.emailAdditional, { message: 'Неверный формат email' });
phone(path.phoneAdditional, { message: 'Неверный формат телефона' });

// ❌ Делаем опциональное поле обязательным
required(path.emailAdditional, { message: 'Email обязателен' });
email(path.emailAdditional, { message: 'Неверный формат' });
```

### 4. Используйте подходящие типы валидаторов

```typescript
// ✅ Используйте специфичные валидаторы
email(path.email, { message: 'Неверный email' });
phone(path.phoneMain, { message: 'Неверный телефон' });

// ❌ Используете pattern для общих форматов
pattern(path.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Неверный email' });
```

## Следующий шаг

Теперь, когда вы понимаете встроенные валидаторы, давайте изучим валидацию массивов.
