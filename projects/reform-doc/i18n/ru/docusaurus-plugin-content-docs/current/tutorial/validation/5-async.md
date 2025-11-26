---
sidebar_position: 5
---

# Асинхронная валидация

Асинхронная валидация с помощью `validateAsync`.

## Обзор

Асинхронная валидация необходима для:

- Проверки уникальности (имя пользователя, email)
- Валидации данных через внешние API
- Проверки на стороне сервера (ИНН, кредитный рейтинг)
- Проверки доступности в реальном времени

ReFormer предоставляет `validateAsync` со встроенным дебаунсингом для оптимальной производительности.

## validateAsync

Функция `validateAsync` выполняет асинхронную валидацию с автоматическим дебаунсингом.

```typescript
import { validateAsync } from 'reformer/validators';

validateAsync(
  field,          // Поле для валидации
  asyncValidator, // Асинхронная функция, возвращающая ошибку или null
  options         // { debounce?: number }
);
```

### Опции

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `debounce` | `number` | `0` | Задержка в миллисекундах перед запуском валидации |

### Функция валидатора

Асинхронный валидатор получает значение поля и должен вернуть объект ошибки или `null`:

```typescript
validateAsync(path.field, async (value) => {
  // Выполняем асинхронную валидацию
  const isValid = await checkSomething(value);

  if (!isValid) {
    return {
      code: 'error-code',
      message: 'Сообщение об ошибке'
    };
  }

  return null; // Валидация пройдена
});
```

## Базовые примеры

### Валидация ИНН

```typescript title="src/validators/inn-validators.ts"
import { validateAsync, required, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateINN } from '../api';

interface CreditApplicationForm {
  inn: string;
  firstName: string;
  lastName: string;
}

export const innValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Сначала синхронная валидация
  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{10,12}$/, {
    message: 'ИНН должен содержать 10 или 12 цифр'
  });

  // Асинхронная валидация: проверка ИНН через налоговую службу
  validateAsync(
    path.inn,
    async (inn) => {
      if (!inn || !/^\d{10,12}$/.test(inn)) {
        return null; // Пропускаем, если базовая валидация не прошла
      }

      try {
        const result = await validateINN(inn);

        if (!result.valid) {
          return {
            code: 'inn-invalid',
            message: result.message || 'Неверный ИНН',
          };
        }
      } catch (error) {
        return {
          code: 'check-failed',
          message: 'Не удалось проверить ИНН',
        };
      }

      return null;
    },
    { debounce: 500 } // Ждем 500мс после того, как пользователь прекратит печатать
  );
};
```

### Проверка уникальности email

```typescript title="src/validators/email-validators.ts"
import { validateAsync, required, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { checkApplicantEmailExists } from '../api';

interface CreditApplicationForm {
  email: string;
  phoneMain: string;
  firstName: string;
  lastName: string;
}

export const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  // Асинхронная проверка: существует ли заявка с таким email
  validateAsync(
    path.email,
    async (emailValue) => {
      if (!emailValue) return null;

      // Простая проверка формата перед вызовом API
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        return null; // Пусть синхронный валидатор обработает ошибки формата
      }

      try {
        const { exists, applicationStatus } = await checkApplicantEmailExists(emailValue);

        if (exists) {
          if (applicationStatus === 'pending') {
            return {
              code: 'application-pending',
              message: 'У вас уже есть заявка на рассмотрении. Проверьте вашу почту.',
            };
          }
          return {
            code: 'email-exists',
            message: 'Заявка с таким email уже существует',
          };
        }
      } catch (error) {
        console.error('Проверка email не удалась:', error);
        // Опционально возвращаем ошибку или разрешаем отправку
        return null;
      }

      return null;
    },
    { debounce: 300 }
  );
};
```

### Валидация СНИЛС

```typescript title="src/validators/snils-validators.ts"
import { validateAsync, required, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateSNILS } from '../api';

interface CreditApplicationForm {
  snils: string;
  firstName: string;
  lastName: string;
  middleName: string;
}

export const snilsValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.snils, { message: 'СНИЛС обязателен' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'СНИЛС должен содержать 11 цифр'
  });

  // Асинхронная валидация: проверка СНИЛС через базу данных ПФР
  validateAsync(
    path.snils,
    async (snils) => {
      if (!snils || !/^\d{11}$/.test(snils)) {
        return null;
      }

      try {
        const result = await validateSNILS(snils);

        if (!result.valid) {
          return {
            code: 'invalid-snils',
            message: result.message || 'Неверный СНИЛС',
          };
        }

        // Проверка контрольной суммы
        if (!result.checksumValid) {
          return {
            code: 'snils-checksum-error',
            message: 'Ошибка проверки контрольной суммы СНИЛС',
          };
        }
      } catch (error) {
        return {
          code: 'validation-error',
          message: 'Не удалось проверить СНИЛС',
        };
      }

      return null;
    },
    { debounce: 500 }
  );
};
```

## Продвинутые примеры

### Несколько асинхронных валидаторов

Применяем несколько асинхронных валидаторов к разным полям:

```typescript title="src/validators/applicant-validators.ts"
import { validateAsync, required, email, pattern, phone } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateINN, checkApplicantEmailExists, validatePhoneNumber } from '../api';

interface CreditApplicationForm {
  inn: string;
  email: string;
  phoneMain: string;
  firstName: string;
  lastName: string;
}

export const applicantValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ИНН
  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{10,12}$/, { message: 'ИНН должен содержать 10-12 цифр' });
  validateAsync(
    path.inn,
    async (inn) => {
      if (!inn || !/^\d{10,12}$/.test(inn)) return null;
      try {
        const result = await validateINN(inn);
        if (!result.valid) {
          return { code: 'inn-invalid', message: 'Неверный ИНН' };
        }
      } catch (error) {
        return { code: 'check-failed', message: 'Не удалось проверить ИНН' };
      }
      return null;
    },
    { debounce: 500 }
  );

  // Email
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный email' });
  validateAsync(
    path.email,
    async (emailValue) => {
      if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return null;
      try {
        const { exists } = await checkApplicantEmailExists(emailValue);
        if (exists) {
          return { code: 'exists', message: 'Заявка с таким email уже существует' };
        }
      } catch (error) {
        console.error('Проверка email не удалась:', error);
        return null;
      }
      return null;
    },
    { debounce: 300 }
  );

  // Телефон
  required(path.phoneMain, { message: 'Телефон обязателен' });
  phone(path.phoneMain, { message: 'Неверный формат телефона' });
  validateAsync(
    path.phoneMain,
    async (phoneValue) => {
      if (!phoneValue) return null;
      try {
        const { valid, carrier } = await validatePhoneNumber(phoneValue);
        if (!valid) {
          return { code: 'invalid-phone', message: 'Номер телефона недействителен' };
        }
      } catch (error) {
        console.error('Проверка телефона не удалась:', error);
        return null;
      }
      return null;
    },
    { debounce: 500 }
  );
};
```

### Условная асинхронная валидация

Комбинируем с `applyWhen` для условной асинхронной валидации:

```typescript title="src/validators/conditional-async-validators.ts"
import { validateAsync, required, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateCompanyINN, validateOGRNIP } from '../api';

interface CreditApplicationForm {
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed' | 'retired';
  companyInn: string;
  businessInn: string;
  ogrnip: string;
  businessType: string;
}

export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  // Валидация для самозанятых
  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (path) => {
      required(path.businessInn, { message: 'ИНН ИП обязателен для самозанятых' });
      pattern(path.businessInn, /^\d{12}$/, { message: 'ИНН ИП должен содержать 12 цифр' });

      // Асинхронная проверка: валидация ИНН ИП
      validateAsync(
        path.businessInn,
        async (businessInn) => {
          if (!businessInn || !/^\d{12}$/.test(businessInn)) return null;
          try {
            const result = await validateCompanyINN(businessInn);
            if (!result.valid) {
              return { code: 'invalid', message: 'Неверный ИНН ИП' };
            }
            if (result.status === 'inactive') {
              return { code: 'inactive', message: 'ИП не активен' };
            }
          } catch (error) {
            return { code: 'check-failed', message: 'Не удалось проверить ИНН ИП' };
          }
          return null;
        },
        { debounce: 500 }
      );

      required(path.ogrnip, { message: 'ОГРНИП обязателен' });
      pattern(path.ogrnip, /^\d{15}$/, { message: 'ОГРНИП должен содержать 15 цифр' });

      // Асинхронная проверка: валидация ОГРНИП
      validateAsync(
        path.ogrnip,
        async (ogrnip) => {
          if (!ogrnip || !/^\d{15}$/.test(ogrnip)) return null;
          try {
            const result = await validateOGRNIP(ogrnip);
            if (!result.valid) {
              return { code: 'invalid-ogrnip', message: 'Неверный ОГРНИП' };
            }
          } catch (error) {
            return { code: 'check-failed', message: 'Не удалось проверить ОГРНИП' };
          }
          return null;
        },
        { debounce: 500 }
      );
    }
  );
};
```

### Пример проверки кредитоспособности

Реальный пример асинхронной валидации кредита:

```typescript title="src/validators/credit-validators.ts"
import { validateAsync, required, min, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { checkCreditScore, validatePassport } from '../api';

interface CreditApplicationForm {
  passportSeries: string;
  passportNumber: string;
  monthlyIncome: number;
  loanAmount: number;
}

export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Валидация паспорта
  required(path.passportSeries, { message: 'Серия паспорта обязательна' });
  pattern(path.passportSeries, /^\d{4}$/, { message: 'Серия должна содержать 4 цифры' });
  required(path.passportNumber, { message: 'Номер паспорта обязателен' });
  pattern(path.passportNumber, /^\d{6}$/, { message: 'Номер должен содержать 6 цифр' });

  // Асинхронная проверка: валидация паспорта через государственную БД
  validateAsync(
    path.passportNumber,
    async (number, ctx) => {
      const series = ctx?.form?.passportSeries?.value?.value;
      if (!number || !series) return null;

      try {
        const result = await validatePassport(series, number);

        if (!result.valid) {
          return {
            code: 'invalid-passport',
            message: result.message || 'Ошибка валидации паспорта',
          };
        }

        if (result.expired) {
          return {
            code: 'expired-passport',
            message: 'Паспорт просрочен',
          };
        }
      } catch (error) {
        // Логируем ошибку, но не блокируем отправку
        console.error('Ошибка проверки паспорта:', error);
      }

      return null;
    },
    { debounce: 1000 } // Больший дебаунс для дорогого вызова API
  );

  // Доход и сумма
  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 10000, { message: 'Минимальный доход 10 000' });
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальный кредит 50 000' });

  // Асинхронная проверка: предварительная проверка кредитоспособности
  validateAsync(
    path.loanAmount,
    async (amount, ctx) => {
      const income = ctx?.form?.monthlyIncome?.value?.value;
      if (!amount || !income) return null;

      try {
        const result = await checkCreditScore({
          income,
          loanAmount: amount,
        });

        if (result.status === 'rejected') {
          return {
            code: 'credit-rejected',
            message: 'Предварительная проверка не пройдена: сумма слишком велика для дохода',
          };
        }

        if (result.status === 'review') {
          // Не ошибка, но информируем пользователя
          return null;
        }
      } catch (error) {
        // Не блокируем при ошибках проверки кредита
        console.error('Ошибка проверки кредита:', error);
      }

      return null;
    },
    { debounce: 1000 }
  );
};
```

## Стратегия дебаунсинга

### Выбор значения дебаунса

| Сценарий | Рекомендуемый дебаунс | Причина |
|----------|----------------------|---------|
| Проверка username/email | 300-500мс | Баланс между UX и нагрузкой на API |
| Валидация ИНН | 500-1000мс | Дорогие вызовы API |
| Поиск в реальном времени | 200-300мс | Нужна быстрая обратная связь |
| Проверка кредита | 1000-2000мс | Очень дорого, нужно ограничить |
| Простая проверка доступности | 200-400мс | Ожидается быстрый ответ |

### Примеры

```typescript
// Быстрая обратная связь для простых проверок
validateAsync(path.username, checkUsername, { debounce: 300 });

// Стандартная валидация через API
validateAsync(path.email, checkEmail, { debounce: 500 });

// Дорогой внешний API
validateAsync(path.taxId, validateTaxId, { debounce: 1000 });

// Очень дорого (проверка кредита и т.д.)
validateAsync(path.amount, checkCreditLimit, { debounce: 2000 });
```

## Обработка ошибок

### Плавная деградация

```typescript
validateAsync(
  path.email,
  async (email) => {
    if (!email) return null;

    try {
      const result = await checkEmailExists(email);

      if (result.exists) {
        return { code: 'exists', message: 'Email уже зарегистрирован' };
      }
    } catch (error) {
      // Вариант 1: Тихий отказ (разрешить отправку)
      console.error('Проверка email не удалась:', error);
      return null;

      // Вариант 2: Показать ошибку, но не блокировать
      // return { code: 'check-failed', message: 'Не удалось проверить email' };

      // Вариант 3: Заблокировать отправку
      // return { code: 'error', message: 'Сервис недоступен' };
    }

    return null;
  },
  { debounce: 500 }
);
```

### Логика повторных попыток

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

validateAsync(
  path.taxId,
  async (taxId) => {
    if (!taxId) return null;

    try {
      const result = await withRetry(() => validateTaxId(taxId), 2, 500);

      if (!result.valid) {
        return { code: 'invalid', message: 'Неверный ИНН' };
      }
    } catch (error) {
      return { code: 'error', message: 'Сервис валидации недоступен' };
    }

    return null;
  },
  { debounce: 500 }
);
```

## Лучшие практики

### 1. Всегда проверяйте предусловия

```typescript
// ✅ Пропускаем асинхронную валидацию, если синхронная не пройдет
validateAsync(
  path.username,
  async (username) => {
    // Сначала проверяем длину
    if (!username || username.length < 3) {
      return null; // Пусть синхронные валидаторы обработают это
    }

    // Теперь делаем дорогую асинхронную проверку
    const result = await checkAvailability(username);
    // ...
  },
  { debounce: 500 }
);

// ❌ Делаем вызовы API для невалидных значений
validateAsync(
  path.username,
  async (username) => {
    const result = await checkAvailability(username); // Расточительно для пустых/коротких значений
    // ...
  },
  { debounce: 500 }
);
```

### 2. Используйте подходящий дебаунс

```typescript
// ✅ Дебаунс в зависимости от стоимости API и ожиданий пользователя
validateAsync(path.email, checkEmail, { debounce: 300 }); // Быстрая проверка
validateAsync(path.taxId, validateTaxId, { debounce: 1000 }); // Дорогой API

// ❌ Без дебаунса для дорогих операций
validateAsync(path.taxId, validateTaxId); // Вызов API при каждом нажатии клавиши
```

### 3. Обрабатывайте ошибки корректно

```typescript
// ✅ Ловим ошибки и решаем, что делать
validateAsync(
  path.field,
  async (value) => {
    try {
      const result = await apiCall(value);
      if (!result.valid) {
        return { code: 'invalid', message: result.message };
      }
    } catch (error) {
      // Логируем и решаем: блокировать или разрешить?
      console.error('Ошибка валидации:', error);
      return null; // Разрешаем отправку, проверим на сервере
    }
    return null;
  },
  { debounce: 500 }
);

// ❌ Необработанные ошибки ломают валидацию
validateAsync(
  path.field,
  async (value) => {
    const result = await apiCall(value); // Возможно необработанное отклонение промиса
    return result.valid ? null : { code: 'invalid', message: 'Ошибка' };
  },
  { debounce: 500 }
);
```

### 4. Показывайте состояние загрузки

Форма автоматически отслеживает статус асинхронной валидации через сигнал `validating` поля:

```tsx
function FormField({ control }) {
  return (
    <div>
      <input {...control.inputProps} />
      {control.validating.value && <span>Проверяем...</span>}
      {control.errors.value.map(error => (
        <span key={error.code}>{error.message}</span>
      ))}
    </div>
  );
}
```

### 5. Синхронные валидаторы перед асинхронными

```typescript
// ✅ Сначала синхронные валидаторы, потом асинхронные
required(path.email, { message: 'Email обязателен' });
email(path.email, { message: 'Неверный формат email' });
validateAsync(path.email, checkEmailExists, { debounce: 300 });

// ❌ Асинхронные без синхронных предусловий
validateAsync(path.email, checkEmailExists, { debounce: 300 });
// Пользователь может увидеть "email уже существует" раньше "неверный формат"
```

## Следующий шаг

Теперь, когда вы понимаете асинхронную валидацию, давайте научимся создавать собственные валидаторы с помощью `validate`.
