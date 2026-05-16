---
sidebar_position: 5
---

# Стратегии Валидации

Продвинутые паттерны и стратегии валидации для сложных форм.

## Время Валидации

### Валидация при Изменении

Мгновенная обратная связь во время ввода:

```typescript
const form = new GroupNode({
  form: {
    username: { value: '', updateOn: 'change' },
  },
  validation: (path) => {
    validate(path.username, required());
    validate(path.username, minLength(3));
  },
});
```

**Подходит для:**

- Простых полей (текст, числа)
- Обратной связи в реальном времени
- Клиентской валидации

**Избегайте для:**

- Дорогих валидаций
- API вызовов

### Валидация при Потере Фокуса

Валидация при потере фокуса полем:

```typescript
const form = new GroupNode({
  form: {
    email: { value: '', updateOn: 'blur' },
  },
  validation: (path) => {
    validate(path.email, required());
    validate(path.email, email());
  },
});
```

**Подходит для:**

- Большинства полей формы
- Лучшего UX (менее навязчиво)
- Асинхронной валидации с debounce

### Валидация при Отправке

Валидация только при отправке формы:

```typescript
const form = new GroupNode({
  form: {
    feedback: { value: '', updateOn: 'submit' },
  },
  validation: (path) => {
    validate(path.feedback, required());
    validate(path.feedback, minLength(10));
  },
});

// Запуск валидации вручную
const handleSubmit = () => {
  form.markAsTouched();
  if (form.valid.value) {
    console.log('Валидно:', form.getValue());
  }
};
```

**Подходит для:**

- Необязательных полей
- Больших текстовых областей
- Сложных форм, где валидация в реальном времени отвлекает

## Синхронная vs Асинхронная Валидация

### Стратегия Сначала Синхронная

Сначала запустите синхронную валидацию, затем асинхронную:

```typescript
const form = new GroupNode({
  form: {
    username: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    // Сначала синхронная валидация
    validate(path.username, required());
    validate(path.username, minLength(3));
    validate(path.username, maxLength(20));
    validate(path.username, pattern(/^[a-zA-Z0-9_]+$/, { message: 'Недопустимые символы' }));

    // Асинхронная валидация только если синхронная прошла
    validateAsync(
      path.username,
      async (value) => {
        if (!value || value.length < 3) return null;

        const response = await fetch(`/api/check-username?username=${value}`);
        const { available } = await response.json();

        return available ? null : { usernameTaken: true };
      },
      { debounce: 500 }
    );
  },
});
```

**Преимущества:**

- Быстрая обратная связь для базовых ошибок
- Сокращение ненужных API вызовов
- Лучшая производительность

### Параллельная Асинхронная Валидация

Запускайте несколько асинхронных валидаций параллельно:

```typescript
const form = new GroupNode({
  form: {
    username: { value: '' },
    email: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    // Проверка доступности имени пользователя
    validateAsync(
      path.username,
      async (value) => {
        const response = await fetch(`/api/check-username?username=${value}`);
        const { available } = await response.json();
        return available ? null : { usernameTaken: true };
      },
      { debounce: 500 }
    );

    // Проверка доступности email
    validateAsync(
      path.email,
      async (value) => {
        const response = await fetch(`/api/check-email?email=${value}`);
        const { available } = await response.json();
        return available ? null : { emailTaken: true };
      },
      { debounce: 500 }
    );
  },
});
```

## Условная Валидация

### Простое Условие

Валидация на основе другого поля:

```typescript
const form = new GroupNode({
  form: {
    hasCompany: { value: false },
    companyName: { value: '' },
    companyTaxId: { value: '' },
  },
  validation: (path) => {
    // Валидировать поля компании только если hasCompany истинно
    applyWhen(
      path.hasCompany,
      (hasCompany) => hasCompany === true,
      (path) => {
        validate(path.companyName, required());
        validate(path.companyTaxId, required());
        validate(path.companyTaxId, pattern(/^\d{10}$/, { message: 'Неверный ИНН' }));
      }
    );
  },
});
```

### Сложное Условие

Множественные условия:

```typescript
const form = new GroupNode({
  form: {
    accountType: { value: 'personal' },
    businessName: { value: '' },
    ein: { value: '' },
    ssn: { value: '' },
  },
  validation: (path) => {
    validate(path.accountType, required());

    // Валидация бизнес-аккаунта
    applyWhen(
      path.accountType,
      (accountType) => accountType === 'business',
      (path) => {
        validate(path.businessName, required());
        validate(path.ein, required());
        validate(path.ein, pattern(/^\d{10}$/, { message: 'Неверный ИНН' }));
      }
    );

    // Валидация личного аккаунта
    applyWhen(
      path.accountType,
      (accountType) => accountType === 'personal',
      (path) => {
        validate(path.ssn, required());
        validate(path.ssn, pattern(/^\d{3}-\d{2}-\d{4}$/, { message: 'Неверный СНИЛС' }));
      }
    );
  },
});
```

## Валидация Зависимых Полей

### Последовательная Валидация

Валидация на основе предыдущего поля:

```typescript
const form = new GroupNode({
  form: {
    password: { value: '' },
    confirmPassword: { value: '' },
  },
  validation: (path) => {
    validate(path.password, required());
    validate(path.password, minLength(8));

    validate(path.confirmPassword, required());

    // Валидация совпадения confirmPassword с password
    validate(path.confirmPassword, (value, _control, root) => {
      const password = root.password.value.value;
      if (value && password && value !== password) {
        return { passwordMismatch: true };
      }
      return null;
    });
  },
});
```

### Валидация Диапазона Дат

Валидация диапазонов дат:

```typescript
const form = new GroupNode({
  form: {
    startDate: { value: null as Date | null },
    endDate: { value: null as Date | null },
  },
  validation: (path) => {
    validate(path.startDate, required());
    validate(path.endDate, required());

    // Валидация, что дата окончания после даты начала
    validate(path.endDate, (value, _control, root) => {
      const startDate = root.startDate.value.value;

      if (!value || !startDate) return null;

      if (new Date(value) < new Date(startDate)) {
        return { endBeforeStart: true };
      }

      return null;
    });

    // Валидация, что диапазон не более 1 года
    validate(path.endDate, (value, _control, root) => {
      const startDate = root.startDate.value.value;

      if (!value || !startDate) return null;

      const start = new Date(startDate);
      const end = new Date(value);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays > 365) {
        return { rangeTooLong: { max: 365, actual: diffDays } };
      }

      return null;
    });
  },
});
```

## Множественная Валидация Полей

### Кросс-Полевая Валидация

Валидация нескольких полей вместе:

```typescript
const form = new GroupNode({
  form: {
    minPrice: { value: 0 },
    maxPrice: { value: 0 },
  },
  validation: (path) => {
    validate(path.minPrice, required());
    validate(path.maxPrice, required());
    validate(path.minPrice, min(0));
    validate(path.maxPrice, min(0));

    // Валидация диапазона цен
    validate(path.maxPrice, (value, _control, root) => {
      const minPrice = root.minPrice.value.value;

      if (value && minPrice && value < minPrice) {
        return {
          invalidRange: {
            message: 'Максимальная цена должна быть больше минимальной',
          },
        };
      }

      return null;
    });
  },
});
```

### Валидация на Уровне Формы

Валидация всей формы:

```typescript
import { validateGroup } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    paymentMethod: { value: 'card' },
    cardNumber: { value: '' },
    bankAccount: { value: '' },
  },
  validation: (path) => {
    validate(path.paymentMethod, required());

    // Валидация на уровне формы
    validateGroup(path, (scope, _root) => {
      const { paymentMethod, cardNumber, bankAccount } = scope.getValue();

      if (paymentMethod === 'card' && !cardNumber) {
        return {
          cardNumber: { required: true },
        };
      }

      if (paymentMethod === 'bank' && !bankAccount) {
        return {
          bankAccount: { required: true },
        };
      }

      return null;
    });
  },
});
```

## Стратегии Валидации Массивов

### Валидация Всех Элементов

```typescript
const form = new GroupNode({
  form: {
    emails: [{ value: '' }],
  },
  validation: (path) => {
    // Каждый email должен быть валидным
    validate(path.emails.$each, required());
    validate(path.emails.$each, email());
  },
});
```

### Валидация Длины Массива

```typescript
const form = new GroupNode({
  form: {
    phoneNumbers: [{ value: '' }],
  },
  validation: (path) => {
    validate(path.phoneNumbers.$each, required());
    validate(path.phoneNumbers.$each, pattern(/^\d{10}$/, { message: 'Неверный телефон' }));

    // Кастомный валидатор для длины массива
    validateGroup(path, (scope, _root) => {
      const phones = root.phoneNumbers.getValue();

      if (phones.length < 1) {
        return {
          phoneNumbers: {
            minItems: { required: 1, actual: phones.length },
          },
        };
      }

      if (phones.length > 5) {
        return {
          phoneNumbers: {
            maxItems: { max: 5, actual: phones.length },
          },
        };
      }

      return null;
    });
  },
});
```

### Валидация Уникальности Элементов

```typescript
const form = new GroupNode({
  form: {
    tags: [{ value: '' }],
  },
  validation: (path) => {
    validate(path.tags.$each, required());

    // Валидация уникальности тегов
    validateGroup(path, (scope, _root) => {
      const tags = root.tags.getValue();
      const uniqueTags = new Set(tags);

      if (uniqueTags.size !== tags.length) {
        return {
          tags: {
            notUnique: { message: 'Теги должны быть уникальными' },
          },
        };
      }

      return null;
    });
  },
});
```

## Оптимизация Производительности

### Debounce Асинхронной Валидации

```typescript
validation: (path, { validateAsync }) => {
  // Debounce дорогих API вызовов
  validateAsync(
    path.username,
    async (value) => {
      const response = await fetch(`/api/check-username?username=${value}`);
      const { available } = await response.json();
      return available ? null : { usernameTaken: true };
    },
    {
      debounce: 500, // Ждать 500мс после остановки ввода
    }
  );
};
```

### Отмена Предыдущих Асинхронных Валидаций

ReFormer автоматически отменяет предыдущие асинхронные валидации при запуске новых:

```typescript
validation: (path, { validateAsync }) => {
  validateAsync(
    path.search,
    async (value) => {
      // Эта валидация автоматически отменяется
      // если пользователь вводит снова до её завершения
      const results = await searchAPI(value);
      return results.length > 0 ? null : { noResults: true };
    },
    { debounce: 300 }
  );
};
```

### Ленивая Валидация

Валидируйте только при необходимости:

```typescript
const form = new GroupNode({
  form: {
    optionalSection: {
      field1: { value: '' },
      field2: { value: '' },
    },
  },
  validation: (path) => {
    // Валидировать только если секция видима/включена
    applyWhen(
      path.optionalSection.enabled,
      (enabled) => enabled === true,
      (path) => {
        validate(path.optionalSection.field1, required());
        validate(path.optionalSection.field2, required());
      }
    );
  },
});
```

## Стратегии Валидации по Случаям Использования

### Форма Регистрации

```typescript
const form = new GroupNode({
  form: {
    username: { value: '', updateOn: 'blur' },
    email: { value: '', updateOn: 'blur' },
    password: { value: '', updateOn: 'change' },
    confirmPassword: { value: '', updateOn: 'change' },
  },
  validation: (path, { validateAsync }) => {
    // Username: синхронная + асинхронная
    validate(path.username, required());
    validate(path.username, minLength(3));
    validateAsync(path.username, checkUsernameAvailability(), {
      debounce: 500,
    });

    // Email: синхронная + асинхронная
    validate(path.email, required());
    validate(path.email, email());
    validateAsync(path.email, checkEmailAvailability(), { debounce: 500 });

    // Password: только синхронная
    validate(path.password, required());
    validate(path.password, minLength(8));
    validate(path.password, strongPassword());

    // Confirm password: синхронная зависимая
    validate(path.confirmPassword, required());
    validate(path.confirmPassword, matchesPassword());
  },
});
```

### Форма Поиска

```typescript
const form = new GroupNode({
  form: {
    query: { value: '', updateOn: 'change' },
    filters: {
      category: { value: '' },
      minPrice: { value: 0 },
      maxPrice: { value: 0 },
    },
  },
  validation: (path) => {
    // Запрос: минимальная валидация, мгновенная
    validate(path.query, minLength(2));

    // Фильтры: валидировать при отправке
    validate(path.filters.minPrice, min(0));
    validate(path.filters.maxPrice, min(0));
    validate(path.filters.maxPrice, (value, _control, root) => {
      const minPrice = root.filters.minPrice.value.value;
      if (value && minPrice && value < minPrice) {
        return { invalidRange: true };
      }
      return null;
    });
  },
});
```

### Форма Оплаты

```typescript
const form = new GroupNode({
  form: {
    cardNumber: { value: '', updateOn: 'blur' },
    expiryDate: { value: '', updateOn: 'blur' },
    cvv: { value: '', updateOn: 'blur' },
    billingZip: { value: '', updateOn: 'blur' },
  },
  validation: (path, { validateAsync }) => {
    // Номер карты: синхронная + асинхронная
    validate(path.cardNumber, required());
    validate(path.cardNumber, creditCard());
    validateAsync(path.cardNumber, validateCardWithBank(), {
      debounce: 1000,
    });

    // Срок действия: только синхронная
    validate(path.expiryDate, required());
    validate(path.expiryDate, notExpired());

    // CVV: только синхронная
    validate(path.cvv, required());
    validate(path.cvv, pattern(/^\d{3,4}$/, { message: 'Неверный CVV' }));

    // Индекс: только синхронная
    validate(path.billingZip, required());
    validate(path.billingZip, pattern(/^\d{6}$/, { message: 'Неверный индекс' }));
  },
});
```

## Лучшие Практики

### 1. Валидируйте Рано, Валидируйте Часто

```typescript
// ✅ Хорошо - множественные проверки валидации
validate(path.password, required());
validate(path.password, minLength(8));
validate(path.password, strongPassword());

// ❌ Плохо - единая общая валидация
validate(path.password, (value) => {
  if (!value || value.length < 8 || !isStrong(value)) {
    return { invalid: true };
  }
  return null;
});
```

### 2. Предоставляйте Конкретные Сообщения об Ошибках

```typescript
// ✅ Хорошо - конкретные ошибки
if (value.length < 8) return { tooShort: { min: 8 } };
if (!/[A-Z]/.test(value)) return { noUppercase: true };
if (!/[0-9]/.test(value)) return { noNumber: true };

// ❌ Плохо - общая ошибка
if (!isValid(value)) return { invalid: true };
```

### 3. Используйте Debounce для Дорогих Операций

```typescript
// ✅ Хорошо - debounced асинхронная валидация
validateAsync(path.username, checkAvailability(), { debounce: 500 });

// ❌ Плохо - валидация при каждом нажатии клавиши
validateAsync(path.username, checkAvailability());
```

### 4. Используйте Условную Валидацию

```typescript
// ✅ Хорошо - валидировать только при необходимости
applyWhen(
  path.hasCompany,
  (hasCompany) => hasCompany === true,
  (path) => validate(path.companyName, required())
);

// ❌ Плохо - всегда валидировать, скрывать ошибки
validate(path.companyName, required());
// Затем скрывать ошибки в UI - расточительно
```

### 5. Разделяйте Синхронную и Асинхронную

```typescript
// ✅ Хорошо - сначала синхронная, затем асинхронная
validate(path.email, required());
validate(path.email, email());
validateAsync(path.email, checkEmailAvailability());

// ❌ Плохо - только асинхронная (медленнее обратная связь)
validateAsync(path.email, async (value) => {
  if (!value) return { required: true };
  if (!isEmail(value)) return { email: true };
  const available = await checkAvailability(value);
  return available ? null : { taken: true };
});
```

## Извлечение Вложенных Правил

Когда тело `applyWhen`, `validateGroup` или `validate` разрастается дальше нескольких строк,
вынесите его в **именованную top-level-функцию**, типизированную одним из публичных типов
из `@reformer/core`. Это делает основную схему плоской (читается как оглавление) и
выводит **намерение** каждого правила в его имя.

Используйте существующие публичные типы:

- `ValidationSchemaFn<TForm>` — вложенная схема для `applyWhen` или `apply`.
- `GroupValidator<TForm, TScope = TForm>` — кросс-полевой валидатор для `validateGroup`.
- `Validator<TForm, TField>` / `AsyncValidator<TForm, TField>` — валидатор поля для
  `validate` / `validateAsync`.

### До — inline callbacks

```typescript
export const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.loanType, required());

  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      validate(path.propertyValue, required());
      validate(path.propertyValue, min(1000000));
      validate(path.initialPayment, required());

      validateGroup(
        path,
        (scope) => {
          const form = scope.getValue();
          if (
            form.initialPayment &&
            form.propertyValue &&
            form.initialPayment > form.propertyValue
          ) {
            return { code: 'initialPaymentTooHigh', message: '...' };
          }
          return null;
        },
        { targetField: path.initialPayment }
      );
    }
  );
};
```

### После — извлечённые именованные функции

```typescript
import type { GroupValidator, ValidationSchemaFn } from '@reformer/core';

const initialPaymentVsPropertyValue: GroupValidator<CreditApplicationForm> = (scope) => {
  const form = scope.getValue();
  if (form.initialPayment && form.propertyValue && form.initialPayment > form.propertyValue) {
    return { code: 'initialPaymentTooHigh', message: '...' };
  }
  return null;
};

const mortgageFieldsRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.propertyValue, required());
  validate(path.propertyValue, min(1000000));
  validate(path.initialPayment, required());
  validateGroup(path, initialPaymentVsPropertyValue, { targetField: path.initialPayment });
};

export const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.loanType, required());
  applyWhen(path.loanType, (type) => type === 'mortgage', mortgageFieldsRules);
};
```

### Конвенция именования

Используйте **смысловые** имена (а не дублирующие название оператора):

- Вложенная схема `applyWhen` → описывает условную ветку:
  `mortgageFieldsRules`, `employedFieldsRules`, `residenceAddressRules`.
- `GroupValidator` → описывает проверяемый инвариант:
  `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`, `currentExperienceVsTotal`.
- `Validator` → описывает проверку поля:
  `validateAdultAge`, `validatePasswordsMatch`, `validatePassportIssueDateNotFuture`.

### Когда выносить

- **Выносить** любое тело длиннее ~3 строк или содержащее вложенный
  `validateGroup` / `applyWhen`.
- **Оставлять inline** короткие одно-строчные условия внутри `applyWhen` —
  `(type) => type === 'mortgage'` ничего не выигрывает от именования.

## Следующие Шаги

- [Обработка Ошибок](/docs/validation/error-handling) — Обработка и отображение ошибок валидации
- [Кастомные Валидаторы](/docs/validation/custom) — Создание кастомной логики валидации
- [Асинхронная Валидация](/docs/validation/async) — Паттерны серверной валидации
