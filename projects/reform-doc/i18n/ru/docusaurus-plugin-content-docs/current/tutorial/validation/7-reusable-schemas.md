---
sidebar_position: 7
---

# Переиспользуемые схемы валидации

Создание переиспользуемых схем валидации для типовых паттернов.

## Обзор

По мере роста приложения вы будете валидировать одни и те же паттерны снова и снова:

- Поля адреса (улица, город, почтовый индекс)
- Контактная информация (email, телефон)
- Диапазоны дат (даты начала/окончания)
- Учетные данные пользователя (имя пользователя, пароль)

Переиспользуемые схемы валидации позволяют:
- **Написать один раз, использовать везде** - Определить логику валидации в одном месте
- **Обеспечить консистентность** - Одни и те же правила во всем приложении
- **Упростить поддержку** - Обновить валидацию в одном файле
- **Составлять сложные формы** - Строить из небольших, протестированных частей

## Создание переиспользуемых схем

Переиспользуемая схема — это `ValidationSchemaFn<T>`, которая валидирует конкретную структуру данных:

```typescript
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, email } from 'reformer/validators';

interface EmailField {
  email: string;
}

export const emailValidation: ValidationSchemaFn<EmailField> = (
  path: FieldPath<EmailField>
) => {
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
};
```

Эту схему теперь можно переиспользовать в разных формах.

## Композиция схем с apply

Используйте функцию `apply` для композиции переиспользуемых схем в более крупные формы:

```typescript
import { apply } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface UserForm {
  name: string;
  email: string;
  password: string;
}

export const userFormValidation: ValidationSchemaFn<UserForm> = (
  path: FieldPath<UserForm>
) => {
  // Применяем схему валидации email
  apply(path, emailValidation);

  // Добавляем дополнительную валидацию, специфичную для UserForm
  required(path.name, { message: 'Имя обязательно' });
  required(path.password, { message: 'Пароль обязателен' });
};
```

### Несколько полей с одной схемой

Применяем одну и ту же схему к нескольким полям:

```typescript
interface ContactForm {
  primaryEmail: string;
  secondaryEmail: string;
}

export const contactValidation: ValidationSchemaFn<ContactForm> = (
  path: FieldPath<ContactForm>
) => {
  // Применяем валидацию email к обоим полям
  apply(path.primaryEmail, emailValidation);
  apply(path.secondaryEmail, emailValidation);
};
```

Или используем массив для нескольких полей:

```typescript
interface RegistrationForm {
  registrationAddress: Address;
  mailingAddress: Address;
}

export const registrationValidation: ValidationSchemaFn<RegistrationForm> = (
  path: FieldPath<RegistrationForm>
) => {
  // Применяем валидацию адреса к обоим полям адреса
  apply([path.registrationAddress, path.mailingAddress], addressValidation);
};
```

## Типовые переиспользуемые схемы

### Валидация адреса

```typescript title="src/validators/schemas/address-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, minLength, maxLength, pattern } from 'reformer/validators';

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Переиспользуемая схема валидации адреса
 *
 * Использование:
 * ```typescript
 * apply(path.shippingAddress, addressValidation);
 * apply(path.billingAddress, addressValidation);
 * ```
 */
export const addressValidation: ValidationSchemaFn<Address> = (
  path: FieldPath<Address>
) => {
  required(path.street, { message: 'Адрес улицы обязателен' });
  minLength(path.street, 3, { message: 'Минимум 3 символа' });
  maxLength(path.street, 200, { message: 'Максимум 200 символов' });

  required(path.city, { message: 'Город обязателен' });
  minLength(path.city, 2, { message: 'Минимум 2 символа' });
  maxLength(path.city, 100, { message: 'Максимум 100 символов' });

  required(path.state, { message: 'Регион обязателен' });

  required(path.postalCode, { message: 'Почтовый индекс обязателен' });
  pattern(path.postalCode, /^\d{6}$/, {
    message: 'Неверный формат почтового индекса (6 цифр)'
  });

  required(path.country, { message: 'Страна обязательна' });
};
```

### Email с асинхронной валидацией

```typescript title="src/validators/schemas/email-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, email, validateAsync } from 'reformer/validators';
import { checkEmailAvailability } from '../../api';

export interface EmailField {
  email: string;
}

/**
 * Переиспользуемая валидация email с проверкой уникальности
 */
export const emailWithUniquenessValidation: ValidationSchemaFn<EmailField> = (
  path: FieldPath<EmailField>
) => {
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  validateAsync(
    path.email,
    async (emailValue) => {
      if (!emailValue) return null;

      const { available } = await checkEmailAvailability(emailValue);

      if (!available) {
        return {
          code: 'email-taken',
          message: 'Этот email уже зарегистрирован',
        };
      }

      return null;
    },
    { debounce: 300 }
  );
};
```

### Валидация номера телефона

```typescript title="src/validators/schemas/phone-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, pattern } from 'reformer/validators';

export interface PhoneField {
  phone: string;
}

/**
 * Переиспользуемая валидация номера телефона (российский формат)
 */
export const phoneValidation: ValidationSchemaFn<PhoneField> = (
  path: FieldPath<PhoneField>
) => {
  required(path.phone, { message: 'Номер телефона обязателен' });
  pattern(path.phone, /^\+7\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}$/, {
    message: 'Неверный формат номера телефона'
  });
};

/**
 * Международная валидация телефона
 */
export const internationalPhoneValidation: ValidationSchemaFn<PhoneField> = (
  path: FieldPath<PhoneField>
) => {
  required(path.phone, { message: 'Номер телефона обязателен' });
  pattern(path.phone, /^\+?[1-9]\d{1,14}$/, {
    message: 'Неверный международный формат телефона'
  });
};
```

### Валидация диапазона дат

```typescript title="src/validators/schemas/date-range-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, validate } from 'reformer/validators';

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Переиспользуемая валидация диапазона дат
 *
 * Гарантирует, что дата окончания после даты начала
 */
export const dateRangeValidation: ValidationSchemaFn<DateRange> = (
  path: FieldPath<DateRange>
) => {
  required(path.startDate, { message: 'Дата начала обязательна' });
  required(path.endDate, { message: 'Дата окончания обязательна' });

  // Дата начала не может быть в прошлом
  validate(path.startDate, (value) => {
    if (!value) return null;

    const startDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return {
        code: 'past-date',
        message: 'Дата начала не может быть в прошлом',
      };
    }

    return null;
  });

  // Дата окончания должна быть после даты начала
  validate(path.endDate, (value, ctx) => {
    if (!value) return null;

    const startDate = ctx.form.startDate.value.value;
    if (!startDate) return null;

    const start = new Date(startDate);
    const end = new Date(value);

    if (end <= start) {
      return {
        code: 'invalid-range',
        message: 'Дата окончания должна быть после даты начала',
      };
    }

    return null;
  });
};
```

### Пароль с подтверждением

```typescript title="src/validators/schemas/password-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, minLength, validate } from 'reformer/validators';

export interface PasswordFields {
  password: string;
  confirmPassword: string;
}

/**
 * Переиспользуемая валидация пароля с подтверждением
 */
export const passwordValidation: ValidationSchemaFn<PasswordFields> = (
  path: FieldPath<PasswordFields>
) => {
  // Валидация пароля
  required(path.password, { message: 'Пароль обязателен' });
  minLength(path.password, 8, { message: 'Минимум 8 символов' });

  validate(path.password, (value) => {
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);

    if (!hasUpperCase || !hasLowerCase || !hasDigit) {
      return {
        code: 'weak-password',
        message: 'Пароль должен содержать заглавные, строчные буквы и цифры',
      };
    }

    return null;
  });

  // Подтверждение пароля
  required(path.confirmPassword, { message: 'Подтвердите пароль' });

  validate(path.confirmPassword, (value, ctx) => {
    const passwordValue = ctx.form.password.value.value;

    if (value && passwordValue && value !== passwordValue) {
      return {
        code: 'passwords-mismatch',
        message: 'Пароли не совпадают',
      };
    }

    return null;
  });
};
```

## Реальный пример

Полный пример многошаговой формы заявки на кредит с переиспользуемыми схемами:

```typescript title="src/validators/credit-application-form-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { apply, required, min, max, applyWhen } from 'reformer/validators';

// Импортируем переиспользуемые схемы
import { addressValidation, type Address } from './schemas/address-validation';
import { emailWithUniquenessValidation } from './schemas/email-validation';
import { phoneValidation } from './schemas/phone-validation';
import { dateRangeValidation } from './schemas/date-range-validation';

interface CreditApplicationForm {
  // Шаг 1: Параметры кредита
  loanAmount: number;
  loanTerm: number;
  loanType: 'consumer' | 'mortgage' | 'car';
  loanPurpose: string;

  // Шаг 2: Личные данные
  firstName: string;
  lastName: string;
  middleName: string;
  birthDate: string;
  phone: string;
  email: string;

  // Шаг 3: Адрес
  registrationAddress: Address;
  residenceAddress: Address;
  sameAddress: boolean;

  // Шаг 4: Занятость
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed' | 'retired';
  employmentStartDate: string;
  employmentEndDate: string;
  monthlyIncome: number;
}

/**
 * Основная валидация формы заявки на кредит
 *
 * Составлена из нескольких переиспользуемых схем
 */
export const creditApplicationFormValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ===================================================================
  // Шаг 1: Параметры кредита
  // ===================================================================
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
  max(path.loanAmount, 5000000, { message: 'Максимальная сумма кредита: 5 000 000 ₽' });

  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 360, { message: 'Максимальный срок: 360 месяцев' });

  required(path.loanType, { message: 'Тип кредита обязателен' });
  required(path.loanPurpose, { message: 'Цель кредита обязательна' });

  // ===================================================================
  // Шаг 2: Личная информация - Композиция схем email и телефона
  // ===================================================================
  required(path.firstName, { message: 'Имя обязательно' });
  required(path.lastName, { message: 'Фамилия обязательна' });
  required(path.middleName, { message: 'Отчество обязательно' });

  required(path.birthDate, { message: 'Дата рождения обязательна' });

  // Переиспользуем валидацию email
  apply(path, emailWithUniquenessValidation);

  // Переиспользуем валидацию телефона
  apply(path, phoneValidation);

  // ===================================================================
  // Шаг 3: Адрес - Переиспользуем схему адреса для обоих полей
  // ===================================================================
  apply(path.registrationAddress, addressValidation);

  // Валидируем адрес проживания только если он отличается от адреса регистрации
  applyWhen(
    path.sameAddress,
    (same) => !same,
    (path) => {
      apply(path.residenceAddress, addressValidation);
    }
  );

  // ===================================================================
  // Шаг 4: Занятость - Переиспользуем схему диапазона дат
  // ===================================================================
  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      // Переиспользуем валидацию диапазона дат для трудоустройства
      apply(path, dateRangeValidation);

      required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
      min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });
    }
  );
};

// Экспортируем валидацию для отдельных шагов (для пошаговой валидации)
export const STEP_VALIDATIONS = {
  1: (path: FieldPath<CreditApplicationForm>) => {
    required(path.loanAmount, { message: 'Сумма кредита обязательна' });
    min(path.loanAmount, 50000, { message: 'Минимальная сумма кредита: 50 000 ₽' });
    max(path.loanAmount, 5000000, { message: 'Максимальная сумма кредита: 5 000 000 ₽' });

    required(path.loanTerm, { message: 'Срок кредита обязателен' });
    min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
    max(path.loanTerm, 360, { message: 'Максимальный срок: 360 месяцев' });

    required(path.loanType, { message: 'Тип кредита обязателен' });
    required(path.loanPurpose, { message: 'Цель кредита обязательна' });
  },
  2: (path: FieldPath<CreditApplicationForm>) => {
    required(path.firstName, { message: 'Имя обязательно' });
    required(path.lastName, { message: 'Фамилия обязательна' });
    required(path.middleName, { message: 'Отчество обязательно' });
    required(path.birthDate, { message: 'Дата рождения обязательна' });
    apply(path, emailWithUniquenessValidation);
    apply(path, phoneValidation);
  },
  3: (path: FieldPath<CreditApplicationForm>) => {
    apply(path.registrationAddress, addressValidation);
    applyWhen(
      path.sameAddress,
      (same) => !same,
      (path) => apply(path.residenceAddress, addressValidation)
    );
  },
  4: (path: FieldPath<CreditApplicationForm>) => {
    required(path.employmentStatus, { message: 'Статус занятости обязателен' });
    applyWhen(
      path.employmentStatus,
      (status) => status === 'employed',
      (path) => {
        apply(path, dateRangeValidation);
        required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
        min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000 ₽' });
      }
    );
  },
};
```

## Параметризованные переиспользуемые схемы

Создаем схемы, принимающие конфигурацию:

```typescript title="src/validators/schemas/configurable-schemas.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, minLength, maxLength, pattern } from 'reformer/validators';

interface TextFieldConfig {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  required?: boolean;
}

/**
 * Фабрика для создания настраиваемой валидации текстового поля
 */
export function createTextFieldValidation(
  config: TextFieldConfig = {}
): ValidationSchemaFn<{ value: string }> {
  return (path: FieldPath<{ value: string }>) => {
    if (config.required !== false) {
      required(path.value, { message: 'Это поле обязательно' });
    }

    if (config.minLength) {
      minLength(path.value, config.minLength, {
        message: `Минимум ${config.minLength} символов`,
      });
    }

    if (config.maxLength) {
      maxLength(path.value, config.maxLength, {
        message: `Максимум ${config.maxLength} символов`,
      });
    }

    if (config.pattern) {
      pattern(path.value, config.pattern, {
        message: config.patternMessage || 'Неверный формат',
      });
    }
  };
}

// Использование
const usernameValidation = createTextFieldValidation({
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-zA-Z0-9_]+$/,
  patternMessage: 'Только буквы, цифры и подчеркивание',
});

const bioValidation = createTextFieldValidation({
  maxLength: 500,
  required: false,
});
```

## Лучшие практики

### 1. Держите схемы сфокусированными

```typescript
// ✅ Единственная ответственность - валидирует только поля адреса
export const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.street, { message: 'Улица обязательна' });
  required(path.city, { message: 'Город обязателен' });
  // ... только поля адреса
};

// ❌ Смешанные ответственности
export const addressAndContactValidation: ValidationSchemaFn<AddressAndContact> = (path) => {
  // Поля адреса
  required(path.street, { message: 'Улица обязательна' });
  // Контактные поля
  required(path.email, { message: 'Email обязателен' });
  // Слишком много ответственностей в одной схеме
};
```

### 2. Экспортируйте интерфейсы типов

```typescript
// ✅ Экспортируем интерфейс вместе со схемой
export interface Address {
  street: string;
  city: string;
  postalCode: string;
}

export const addressValidation: ValidationSchemaFn<Address> = (path) => {
  // ...
};

// Теперь потребители могут импортировать оба
import { addressValidation, type Address } from './address-validation';
```

### 3. Документируйте использование

```typescript
/**
 * Валидирует поля адреса
 *
 * Использование:
 * ```typescript
 * apply(path.shippingAddress, addressValidation);
 * apply([path.billing, path.shipping], addressValidation);
 * ```
 *
 * Валидируемые поля:
 * - street (обязательно, 3-200 символов)
 * - city (обязательно, 2-100 символов)
 * - postalCode (обязательно, формат: 6 цифр)
 * - country (обязательно)
 */
export const addressValidation: ValidationSchemaFn<Address> = (path) => {
  // ...
};
```

### 4. Организуйте файлы схем

```
src/validators/
  schemas/
    address-validation.ts    # Поля адреса
    email-validation.ts      # Поле email
    phone-validation.ts      # Поле телефона
    password-validation.ts   # Поля пароля
    date-range-validation.ts # Диапазон дат
  forms/
    registration-validation.ts   # Использует схемы
    checkout-validation.ts       # Использует схемы
    profile-validation.ts        # Использует схемы
```

### 5. Тестируйте схемы независимо

```typescript
// address-validation.test.ts
import { createForm } from 'reformer';
import { addressValidation, type Address } from './address-validation';

test('validates address fields', () => {
  const form = createForm<Address>({
    initialValue: {
      street: '',
      city: '',
      postalCode: '',
      country: '',
    },
    validation: addressValidation,
  });

  form.validate();

  expect(form.field('street').errors.value).toHaveLength(1);
  expect(form.field('city').errors.value).toHaveLength(1);
});
```

### 6. Компонуйте, не дублируйте

```typescript
// ✅ Компонуем переиспользуемые схемы
export const userFormValidation: ValidationSchemaFn<UserForm> = (path) => {
  apply(path, emailValidation);
  apply(path, passwordValidation);
  apply(path.address, addressValidation);
};

// ❌ Копируем-вставляем логику валидации
export const userFormValidation: ValidationSchemaFn<UserForm> = (path) => {
  // Дублированная валидация email
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный email' });

  // Дублированная валидация пароля
  required(path.password, { message: 'Пароль обязателен' });
  minLength(path.password, 8, { message: 'Минимум 8 символов' });
  // ...
};
```

## Резюме

Переиспользуемые схемы валидации помогают вам:

1. **Писать меньше кода** - Определите валидацию один раз, используйте везде
2. **Поддерживать консистентность** - Одни и те же правила во всем приложении
3. **Упростить обновления** - Изменяйте валидацию в одном месте
4. **Строить сложные формы** - Компонуйте из протестированных частей
5. **Улучшить тестируемость** - Тестируйте схемы независимо

Используйте `apply()` для композиции схем и организуйте их в отдельные файлы для максимальной переиспользуемости.
