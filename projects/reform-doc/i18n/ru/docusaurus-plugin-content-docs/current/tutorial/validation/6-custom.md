---
sidebar_position: 6
---

# Кастомные валидаторы

Создание собственных валидаторов с помощью `validate`.

## Обзор

Хотя ReFormer предоставляет множество встроенных валидаторов, вам часто потребуется кастомная логика валидации для:

- Правил, специфичных для домена (проверка возраста, бизнес-логика)
- Сложных паттернов валидации (надежность пароля, кастомные форматы)
- Ограничений, специфичных для приложения (captcha, принятие условий)
- Переиспользуемой логики валидации в вашем приложении

Функция `validate` предоставляет мощный способ создания кастомных валидаторов с полной типобезопасностью.

## Функция validate

Функция `validate` создает кастомный синхронный валидатор.

```typescript
import { validate } from 'reformer/validators';

validate(
  field,       // Поле для валидации
  validatorFn, // Функция, возвращающая ошибку или null
  options      // Опционально { message, params }
);
```

### Сигнатура функции валидатора

```typescript
validate(path.field, (value, ctx) => {
  // Выполняем логику валидации
  if (!isValid(value)) {
    return {
      code: 'error-code',
      message: 'Сообщение об ошибке'
    };
  }

  return null; // Валидация пройдена
});
```

**Параметры:**
- `value` - Текущее значение поля
- `ctx` - Контекст валидации с доступом к форме и другим полям

**Возвращает:**
- `{ code: string, message: string }` - Ошибка валидации
- `null` - Валидация пройдена

## Базовые примеры

### Надежность пароля

```typescript title="src/validators/password-validators.ts"
import { validate, required, minLength } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface LoginForm {
  username: string;
  password: string;
}

export const loginValidation: ValidationSchemaFn<LoginForm> = (
  path: FieldPath<LoginForm>
) => {
  required(path.password, { message: 'Пароль обязателен' });
  minLength(path.password, 8, { message: 'Минимум 8 символов' });

  // Кастомная проверка: пароль должен содержать заглавные, строчные и цифры
  validate(path.password, (value) => {
    if (!value) return null; // Пропускаем, если пусто (обработано required)

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
};
```

### Проверка возраста

```typescript title="src/validators/age-validators.ts"
import { validate, required } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  firstName: string;
  lastName: string;
}

export const applicantValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.birthDate, { message: 'Дата рождения обязательна' });

  // Кастомная проверка: заявителю должно быть от 18 до 70 лет
  validate(path.birthDate, (value) => {
    if (!value) return null;

    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Корректируем возраст, если день рождения еще не наступил в этом году
    const adjustedAge = monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1
        : age;

    if (adjustedAge < 18) {
      return {
        code: 'underage',
        message: 'Заявителю должно быть не менее 18 лет',
      };
    }

    if (adjustedAge > 70) {
      return {
        code: 'overage',
        message: 'Заявитель должен быть младше 70 лет',
      };
    }

    return null;
  });
};
```

### Валидация диапазона дат

```typescript title="src/validators/date-validators.ts"
import { validate, required } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  employmentStartDate: string;
  birthDate: string;
}

export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStartDate, { message: 'Дата начала работы обязательна' });

  // Кастомная проверка: дата начала работы не может быть в будущем
  validate(path.employmentStartDate, (value) => {
    if (!value) return null;

    const startDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Сбрасываем время для сравнения только дат

    if (startDate > today) {
      return {
        code: 'future-date',
        message: 'Дата начала работы не может быть в будущем',
      };
    }

    return null;
  });

  // Кастомная проверка: работа должна начаться после того, как заявителю исполнилось 14 лет
  validate(path.employmentStartDate, (value, ctx) => {
    if (!value) return null;

    const birthDate = ctx.form.birthDate.value.value;
    if (!birthDate) return null; // Пропускаем, если дата рождения не установлена

    const birth = new Date(birthDate);
    const employmentStart = new Date(value);

    // Вычисляем минимальный возраст для начала работы (14 лет)
    const minEmploymentDate = new Date(birth);
    minEmploymentDate.setFullYear(birth.getFullYear() + 14);

    if (employmentStart < minEmploymentDate) {
      return {
        code: 'invalid-employment-age',
        message: 'Дата начала работы должна быть после того, как заявителю исполнилось 14 лет',
      };
    }

    return null;
  });
};
```

## Параметризованные валидаторы

Создание переиспользуемых валидаторов, принимающих параметры:

### Валидатор минимального возраста

```typescript title="src/validators/reusable-validators.ts"
import { validate } from 'reformer/validators';
import type { FieldPathNode, ValidateOptions } from 'reformer';

/**
 * Проверяет, что возраст (вычисленный из даты рождения) соответствует минимальному требованию
 */
export function minAge<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  minimumAge: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (!value) return null;

    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    const adjustedAge = monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1
        : age;

    if (adjustedAge < minimumAge) {
      return {
        code: 'min-age',
        message: options?.message || `Вам должно быть не менее ${minimumAge} лет`,
      };
    }

    return null;
  });
}

/**
 * Проверяет, что строка соответствует кастомному паттерну с описанием
 */
export function customPattern<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  regex: RegExp,
  patternName: string,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (!value) return null;

    if (!regex.test(value)) {
      return {
        code: 'invalid-pattern',
        message: options?.message || `Неверный ${patternName}`,
      };
    }

    return null;
  });
}

/**
 * Проверяет, что число находится в диапазоне
 */
export function inRange<TForm>(
  fieldPath: FieldPathNode<TForm, number> | undefined,
  min: number,
  max: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (value === null || value === undefined) return null;

    if (value < min || value > max) {
      return {
        code: 'out-of-range',
        message: options?.message || `Значение должно быть между ${min} и ${max}`,
      };
    }

    return null;
  });
}
```

### Использование параметризованных валидаторов

```typescript title="src/validators/form-validation.ts"
import { minAge, customPattern, inRange } from './reusable-validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  cadastralNumber: string;
  workExperienceYears: number;
}

export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Используем кастомные параметризованные валидаторы
  minAge(path.birthDate, 18, { message: 'Заявителю должно быть не менее 18 лет' });

  customPattern(
    path.cadastralNumber,
    /^\d{2}:\d{2}:\d{6,7}:\d{1,}$/,
    'кадастровый номер',
    { message: 'Неверный формат кадастрового номера' }
  );

  inRange(path.workExperienceYears, 0, 50, {
    message: 'Стаж работы должен быть от 0 до 50 лет'
  });
};
```

## Использование контекста

Доступ к другим полям формы через контекст валидации:

### Подтверждение email

```typescript title="src/validators/email-confirmation.ts"
import { validate, required, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  email: string;
  emailAdditional: string;
  sameEmail: boolean;
}

export const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
  required(path.emailAdditional, { message: 'Подтвердите email' });
  email(path.emailAdditional, { message: 'Неверный формат email' });

  // Получаем доступ к полю email через контекст
  validate(path.emailAdditional, (value, ctx) => {
    const emailValue = ctx.form.email.value.value;
    const sameEmail = ctx.form.sameEmail.value.value;

    if (sameEmail && value && emailValue && value !== emailValue) {
      return {
        code: 'emails-mismatch',
        message: 'Email адреса не совпадают',
      };
    }

    return null;
  });
};
```

### Валидация зависимых полей

```typescript title="src/validators/loan-validators.ts"
import { validate, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  monthlyIncome: number;
  loanAmount: number;
  loanTerm: number;
}

export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000' });

  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальный кредит: 50 000' });

  // Проверяем, что ежемесячный платеж не превышает 40% дохода
  validate(path.loanAmount, (value, ctx) => {
    if (!value) return null;

    const income = ctx.form.monthlyIncome.value.value;
    const term = ctx.form.loanTerm.value.value;

    if (!income || !term) return null;

    // Простой расчет ежемесячного платежа (без процентов для демонстрации)
    const monthlyPayment = value / term;
    const maxPayment = income * 0.4;

    if (monthlyPayment > maxPayment) {
      return {
        code: 'payment-too-high',
        message: `Ежемесячный платеж (${monthlyPayment.toFixed(0)}) превышает 40% дохода`,
      };
    }

    return null;
  });
};
```

## Коды и сообщения ошибок

### Лучшие практики для кодов ошибок

```typescript
// ✅ Используйте описательные коды в kebab-case
return {
  code: 'weak-password',
  message: 'Пароль слишком слабый'
};

return {
  code: 'payment-exceeds-limit',
  message: 'Платеж превышает ваш кредитный лимит'
};

// ❌ Избегайте общих кодов
return {
  code: 'error',
  message: 'Что-то не так'
};
```

### Кастомные сообщения об ошибках

```typescript
// Разрешаем кастомные сообщения через опции
export function strongPassword<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    if (!hasUpperCase || !hasLowerCase || !hasDigit || !hasSpecial) {
      return {
        code: 'weak-password',
        message: options?.message ||
          'Пароль должен содержать заглавные, строчные буквы, цифру и спецсимвол',
      };
    }

    return null;
  });
}

// Использование
strongPassword(path.password); // Сообщение по умолчанию
strongPassword(path.password, {
  message: 'Создайте более надежный пароль'
}); // Кастомное сообщение
```

### Параметры ошибок

Включите дополнительные данные в параметры ошибки:

```typescript
validate(path.amount, (value, ctx) => {
  const max = ctx.form.creditLimit.value.value;

  if (value > max) {
    return {
      code: 'exceeds-limit',
      message: `Сумма превышает ваш лимит ${max}`,
      params: {
        value,
        limit: max,
        excess: value - max
      }
    };
  }

  return null;
});
```

## Реальный пример

Полный пример с несколькими кастомными валидаторами:

```typescript title="src/validators/credit-application-validators.ts"
import { validate, required, min, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  monthlyIncome: number;
  loanAmount: number;
  passportSeries: string;
  passportNumber: string;
  passportIssueDate: string;
}

export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Дата рождения - должно быть 18+
  required(path.birthDate, { message: 'Дата рождения обязательна' });
  validate(path.birthDate, (value) => {
    if (!value) return null;

    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    if (age < 18) {
      return {
        code: 'underage',
        message: 'Заемщику должно быть не менее 18 лет',
      };
    }

    if (age > 70) {
      return {
        code: 'overage',
        message: 'Заемщику должно быть менее 70 лет',
      };
    }

    return null;
  });

  // Валидация дохода
  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход: 10 000' });

  // Сумма кредита
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальный кредит: 50 000' });

  // Проверяем соотношение долга к доходу
  validate(path.loanAmount, (value, ctx) => {
    if (!value) return null;

    const income = ctx.form.monthlyIncome.value.value;
    if (!income) return null;

    // Максимальный кредит: 10x ежемесячного дохода
    const maxLoan = income * 10;

    if (value > maxLoan) {
      return {
        code: 'exceeds-income-ratio',
        message: `Максимальный кредит для вашего дохода: ${maxLoan.toLocaleString()}`,
      };
    }

    return null;
  });

  // Валидация паспорта
  required(path.passportSeries, { message: 'Серия паспорта обязательна' });
  pattern(path.passportSeries, /^\d{4}$/, {
    message: 'Серия должна содержать 4 цифры'
  });

  required(path.passportNumber, { message: 'Номер паспорта обязателен' });
  pattern(path.passportNumber, /^\d{6}$/, {
    message: 'Номер должен содержать 6 цифр'
  });

  required(path.passportIssueDate, { message: 'Дата выдачи обязательна' });

  // Валидация даты выдачи паспорта
  validate(path.passportIssueDate, (value, ctx) => {
    if (!value) return null;

    const issueDate = new Date(value);
    const today = new Date();

    // Не может быть в будущем
    if (issueDate > today) {
      return {
        code: 'future-date',
        message: 'Дата выдачи не может быть в будущем',
      };
    }

    // Должна быть выдана после того, как заемщику исполнилось 14
    const birthDate = ctx.form.birthDate.value.value;
    if (birthDate) {
      const birth = new Date(birthDate);
      const minIssueDate = new Date(birth);
      minIssueDate.setFullYear(birth.getFullYear() + 14);

      if (issueDate < minIssueDate) {
        return {
          code: 'invalid-issue-date',
          message: 'Паспорт должен быть выдан после того, как заемщику исполнилось 14',
        };
      }
    }

    return null;
  });
};
```

## Лучшие практики

### 1. Всегда обрабатывайте пустые значения

```typescript
// ✅ Пропускаем валидацию для пустых значений
validate(path.field, (value) => {
  if (!value) return null; // Пусть required() обработает пустые значения

  // Ваша логика валидации
});

// ❌ Валидация пустых значений
validate(path.field, (value) => {
  if (value.length < 3) { // Ошибка, если value undefined
    return { code: 'too-short', message: 'Слишком коротко' };
  }
});
```

### 2. Используйте описательные коды ошибок

```typescript
// ✅ Понятные, конкретные коды ошибок
return { code: 'weak-password', message: '...' };
return { code: 'underage', message: '...' };
return { code: 'exceeds-income-ratio', message: '...' };

// ❌ Общие коды ошибок
return { code: 'invalid', message: '...' };
return { code: 'error', message: '...' };
```

### 3. Предоставляйте понятные сообщения об ошибках

```typescript
// ✅ Конкретные, понятные сообщения
return {
  code: 'weak-password',
  message: 'Пароль должен содержать заглавные, строчные буквы, цифру и спецсимвол'
};

return {
  code: 'underage',
  message: 'Вам должно быть не менее 18 лет'
};

// ❌ Расплывчатые сообщения
return { code: 'invalid', message: 'Неверное значение' };
return { code: 'error', message: 'Ошибка' };
```

### 4. Делайте валидаторы переиспользуемыми

```typescript
// ✅ Создавайте переиспользуемые параметризованные валидаторы
export function minAge<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  minimumAge: number,
  options?: ValidateOptions
): void {
  // Реализация
}

// Используйте во всем приложении
minAge(path.birthDate, 18);
minAge(path.guardianBirthDate, 25);

// ❌ Дублирование логики валидации
validate(path.birthDate, (value) => {
  // Дублированный расчет возраста...
});
```

### 5. Сначала проверяйте предусловия

```typescript
// ✅ Проверяем существование зависимостей перед их использованием
validate(path.endDate, (value, ctx) => {
  if (!value) return null;

  const startDate = ctx.form.startDate.value.value;
  if (!startDate) return null; // Ждем дату начала

  // Теперь валидируем
});

// ❌ Предполагаем, что зависимости существуют
validate(path.endDate, (value, ctx) => {
  const startDate = ctx.form.startDate.value.value;
  if (value < startDate) { // Ошибка, если startDate undefined
    return { code: 'invalid', message: 'Неверная дата' };
  }
});
```

## Следующий шаг

Теперь, когда вы понимаете кастомные валидаторы, давайте научимся создавать переиспользуемые схемы валидации.
