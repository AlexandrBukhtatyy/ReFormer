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
    required(path.username);
    minLength(path.username, 3);
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
    required(path.email);
    email(path.email);
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
    required(path.feedback);
    minLength(path.feedback, 10);
  },
});

// Запуск валидации вручную
const handleSubmit = () => {
  form.markAllAsTouched();
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
    required(path.username);
    minLength(path.username, 3);
    maxLength(path.username, 20);
    pattern(path.username, /^[a-zA-Z0-9_]+$/, 'Недопустимые символы');

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
    when(
      () => form.controls.hasCompany.value.value,
      (path) => {
        required(path.companyName);
        required(path.companyTaxId);
        pattern(path.companyTaxId, /^\d{10}$/, 'Неверный ИНН');
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
    required(path.accountType);

    // Валидация бизнес-аккаунта
    when(
      () => form.controls.accountType.value.value === 'business',
      (path) => {
        required(path.businessName);
        required(path.ein);
        pattern(path.ein, /^\d{10}$/, 'Неверный ИНН');
      }
    );

    // Валидация личного аккаунта
    when(
      () => form.controls.accountType.value.value === 'personal',
      (path) => {
        required(path.ssn);
        pattern(path.ssn, /^\d{3}-\d{2}-\d{4}$/, 'Неверный СНИЛС');
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
    required(path.password);
    minLength(path.password, 8);

    required(path.confirmPassword);

    // Валидация совпадения confirmPassword с password
    validate(path.confirmPassword, (value, ctx) => {
      const password = ctx.form.password.value.value;
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
    required(path.startDate);
    required(path.endDate);

    // Валидация, что дата окончания после даты начала
    validate(path.endDate, (value, ctx) => {
      const startDate = ctx.form.startDate.value.value;

      if (!value || !startDate) return null;

      if (new Date(value) < new Date(startDate)) {
        return { endBeforeStart: true };
      }

      return null;
    });

    // Валидация, что диапазон не более 1 года
    validate(path.endDate, (value, ctx) => {
      const startDate = ctx.form.startDate.value.value;

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
    required(path.minPrice);
    required(path.maxPrice);
    min(path.minPrice, 0);
    min(path.maxPrice, 0);

    // Валидация диапазона цен
    validate(path.maxPrice, (value, ctx) => {
      const minPrice = ctx.form.minPrice.value.value;

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
import { validateTree } from 'reformer/validators';

const form = new GroupNode({
  form: {
    paymentMethod: { value: 'card' },
    cardNumber: { value: '' },
    bankAccount: { value: '' },
  },
  validation: (path) => {
    required(path.paymentMethod);

    // Валидация на уровне формы
    validateTree((ctx) => {
      const { paymentMethod, cardNumber, bankAccount } = ctx.form.getValue();

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
    required(path.emails.$each);
    email(path.emails.$each);
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
    required(path.phoneNumbers.$each);
    pattern(path.phoneNumbers.$each, /^\d{10}$/, 'Неверный телефон');

    // Кастомный валидатор для длины массива
    validateTree((ctx) => {
      const phones = ctx.form.phoneNumbers.getValue();

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
    required(path.tags.$each);

    // Валидация уникальности тегов
    validateTree((ctx) => {
      const tags = ctx.form.tags.getValue();
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
}
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
}
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
    when(
      () => form.controls.optionalSection.visible.value,
      (path) => {
        required(path.optionalSection.field1);
        required(path.optionalSection.field2);
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
    required(path.username);
    minLength(path.username, 3);
    validateAsync(path.username, checkUsernameAvailability(), {
      debounce: 500,
    });

    // Email: синхронная + асинхронная
    required(path.email);
    email(path.email);
    validateAsync(path.email, checkEmailAvailability(), { debounce: 500 });

    // Password: только синхронная
    required(path.password);
    minLength(path.password, 8);
    validate(path.password, strongPassword());

    // Confirm password: синхронная зависимая
    required(path.confirmPassword);
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
    minLength(path.query, 2);

    // Фильтры: валидировать при отправке
    min(path.filters.minPrice, 0);
    min(path.filters.maxPrice, 0);
    validate(path.filters.maxPrice, (value, ctx) => {
      const minPrice = ctx.form.filters.minPrice.value.value;
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
    required(path.cardNumber);
    validate(path.cardNumber, creditCard());
    validateAsync(path.cardNumber, validateCardWithBank(), {
      debounce: 1000,
    });

    // Срок действия: только синхронная
    required(path.expiryDate);
    validate(path.expiryDate, notExpired());

    // CVV: только синхронная
    required(path.cvv);
    pattern(path.cvv, /^\d{3,4}$/, 'Неверный CVV');

    // Индекс: только синхронная
    required(path.billingZip);
    pattern(path.billingZip, /^\d{6}$/, 'Неверный индекс');
  },
});
```

## Лучшие Практики

### 1. Валидируйте Рано, Валидируйте Часто

```typescript
// ✅ Хорошо - множественные проверки валидации
required(path.password);
minLength(path.password, 8);
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
when(
  () => form.controls.hasCompany.value.value,
  (path) => required(path.companyName)
);

// ❌ Плохо - всегда валидировать, скрывать ошибки
required(path.companyName);
// Затем скрывать ошибки в UI - расточительно
```

### 5. Разделяйте Синхронную и Асинхронную

```typescript
// ✅ Хорошо - сначала синхронная, затем асинхронная
required(path.email);
email(path.email);
validateAsync(path.email, checkEmailAvailability());

// ❌ Плохо - только асинхронная (медленнее обратная связь)
validateAsync(path.email, async (value) => {
  if (!value) return { required: true };
  if (!isEmail(value)) return { email: true };
  const available = await checkAvailability(value);
  return available ? null : { taken: true };
});
```

## Следующие Шаги

- [Обработка Ошибок](/docs/patterns/error-handling) — Обработка и отображение ошибок валидации
- [Кастомные Валидаторы](/docs/validation/custom) — Создание кастомной логики валидации
- [Асинхронная Валидация](/docs/validation/async) — Паттерны серверной валидации
