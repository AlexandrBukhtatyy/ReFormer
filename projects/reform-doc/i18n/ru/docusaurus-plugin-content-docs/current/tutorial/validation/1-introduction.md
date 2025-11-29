---
sidebar_position: 1
---

# Введение в валидацию

Добавление проверок качества данных в форму кредитного заявления.

## Что такое валидация?

Валидация обеспечивает качество данных и проверку бизнес-правил перед отправкой. Она предоставляет декларативные способы для:

- **Обязательные поля** - Проверка наличия критических данных
- **Форматная валидация** - Проверка формата email, телефона, паттернов
- **Валидация диапазонов** - Проверка минимальных и максимальных границ
- **Условные правила** - Применение валидации на основе других полей
- **Валидация между полями** - Проверка связей между полями
- **Асинхронная валидация** - Проверка данных на сервере

## Почему использовать валидацию?

Вместо императивного кода валидации:

```tsx
// ❌ Императивный подход - ручные проверки
function validateForm(formData) {
  const errors = {};

  if (!formData.loanAmount) {
    errors.loanAmount = 'Сумма кредита обязательна';
  } else if (formData.loanAmount < 50000) {
    errors.loanAmount = 'Минимальная сумма: 50 000';
  } else if (formData.loanAmount > 10000000) {
    errors.loanAmount = 'Максимальная сумма: 10 000 000';
  }

  if (!formData.email) {
    errors.email = 'Email обязателен';
  } else if (!isValidEmail(formData.email)) {
    errors.email = 'Неверный формат email';
  }

  // Больше валидации...
  // Это быстро становится неуправляемым!

  return errors;
}
```

Используйте декларативную валидацию:

```tsx
// ✅ Декларативный подход - схема валидации
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма: 50 000' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма: 10 000 000' });

  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });
};
```

Преимущества:

- **Меньше кода** - Лаконичные правила валидации
- **Декларативно** - Ясное намерение и легко читать
- **Поддерживаемо** - Изменения локализированы
- **Типобезопасно** - Полная поддержка TypeScript
- **Тестируемо** - Легко тестировать изолированно
- **Работает с Behaviors** - Скрытые поля не валидируются

## Типы валидаторов

ReFormer предоставляет несколько категорий валидаторов:

### Встроенные валидаторы

Базовая валидация для распространённых сценариев:

```typescript
import { required, min, max, minLength, maxLength } from 'reformer/validators';

// Обязательное поле
required(path.loanAmount, { message: 'Сумма кредита обязательна' });

// Числовые границы
min(path.loanAmount, 50000, { message: 'Минимум: 50 000' });
max(path.loanAmount, 10000000, { message: 'Максимум: 10 000 000' });

// Длина строки
minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });
```

### Валидаторы формата

Проверка распространённых форматов:

```typescript
import { email, phone, pattern } from 'reformer/validators';

// Формат email
email(path.email, { message: 'Неверный формат email' });

// Формат телефона
phone(path.phoneMain, { message: 'Неверный формат телефона' });

// Пользовательский паттерн (российский паспорт)
pattern(path.passportData.series, /^\d{4}$/, {
  message: 'Серия должна быть 4 цифры',
});
```

### Условные валидаторы

Применение валидации на основе других полей:

```typescript
import { requiredWhen, minWhen, maxWhen } from 'reformer/validators';

// Обязательно при условии true
requiredWhen(path.propertyValue, path.loanType, (loanType) => loanType === 'mortgage', {
  message: 'Стоимость имущества обязательна для ипотеки',
});

// Min/max при условии true
minWhen(path.propertyValue, 1000000, path.loanType, (loanType) => loanType === 'mortgage', {
  message: 'Минимальная стоимость имущества: 1 000 000',
});
```

### Валидаторы массивов

Валидация массивов и их элементов:

```typescript
import { arrayMinLength, arrayMaxLength, arrayMinLengthWhen } from 'reformer/validators';

// Валидация длины массива
arrayMinLengthWhen(path.properties, 1, path.hasProperty, (has) => has === true, {
  message: 'Добавьте хотя бы одно имущество',
});

arrayMaxLength(path.properties, 10, { message: 'Максимум 10 имущества' });

// Валидация элементов массива используя '*' wildcard
required(path.properties['*'].type, { message: 'Тип имущества обязателен' });
min(path.properties['*'].estimatedValue, 0, { message: 'Значение должно быть положительным' });
```

### Пользовательские валидаторы

Создайте свою логику валидации:

```typescript
import { createValidator } from 'reformer/validators';

// Пользовательский валидатор с зависимостями
createValidator(
  path.initialPayment,
  [path.propertyValue, path.loanType],
  (initialPayment, [propertyValue, loanType]) => {
    if (loanType !== 'mortgage') return null;
    if (!propertyValue || !initialPayment) return null;

    const minPayment = (propertyValue as number) * 0.2;
    if ((initialPayment as number) < minPayment) {
      return {
        type: 'minInitialPayment',
        message: `Минимальный первоначальный платёж: ${minPayment.toLocaleString()} (20% от стоимости имущества)`,
      };
    }

    return null;
  }
);
```

### Асинхронные валидаторы

Валидация с проверками на сервере:

```typescript
import { createAsyncValidator } from 'reformer/validators';

// Асинхронная валидация с debounce
createAsyncValidator(
  path.inn,
  async (inn) => {
    if (!inn || typeof inn !== 'string') return null;

    const response = await fetch(`/api/validate/inn?value=${inn}`);
    const result = await response.json();

    if (!result.valid) {
      return { type: 'invalidInn', message: result.message || 'Неверный ИНН' };
    }

    return null;
  },
  { debounce: 500 }
);
```

## Организация валидации по шагам

Для нашей формы кредитного заявления мы организуем валидацию по шагам формы - соответствуя структуре, которую мы использовали в Behaviors:

```typescript
// src/schemas/validators/credit-application.validators.ts
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Шаг 1: Информация о кредите
  step1LoanValidation(path);

  // Шаг 2: Личная информация
  step2PersonalValidation(path);

  // Шаг 3: Контактная информация
  step3ContactValidation(path);

  // Шаг 4: Занятость
  step4EmploymentValidation(path);

  // Шаг 5: Дополнительная информация
  step5AdditionalValidation(path);

  // Валидация между шагами
  crossStepValidation(path);
};
```

Такая организация предоставляет:

- **Ясность** - Легко найти валидацию для конкретного шага
- **Поддерживаемость** - Изменения в одном шаге не влияют на других
- **Масштабируемость** - Легко добавить новые правила валидации
- **Переиспользуемость** - Валидаторы шагов можно использовать в других формах

## Структура файлов

Мы создадим следующую структуру:

```
src/
├── schemas/
│   ├── validators/
│   │   ├── steps/
│   │   │   ├── step-1-loan-info.validators.ts
│   │   │   ├── step-2-personal-info.validators.ts
│   │   │   ├── step-3-contact-info.validators.ts
│   │   │   ├── step-4-employment.validators.ts
│   │   │   └── step-5-additional-info.validators.ts
│   │   ├── cross-step.validators.ts
│   │   └── credit-application.validators.ts  (главный файл)
│   └── create-form.ts  (валидация зарегистрирована здесь)
└── ...
```

## Что мы будем реализовывать

К концу этого раздела наша форма кредитного заявления будет иметь:

### Шаг 1: Информация о кредите

- Обязательные поля (loanAmount, loanTerm, loanPurpose)
- Числовые диапазоны (min/max для суммы и срока)
- Условная валидация (поля для ипотеки/автокредита)

### Шаг 2: Личная информация

- Валидация имён (обязательны, minLength, паттерн кириллицы)
- Валидация даты рождения (не в будущем, возраст 18-70)
- Валидация паспорта (формат серии/номера)
- ИНН и СНИЛС (валидация паттерна)

### Шаг 3: Контактная информация

- Форматы email и телефона
- Валидация адреса (обязательные поля)
- Условная валидация адреса проживания

### Шаг 4: Занятость

- Условная валидация полей занятости/бизнеса
- Валидация дохода (минимальный порог)
- Валидация стажа работы (минимум 3 месяца на текущей работе)

### Шаг 5: Дополнительная информация

- Валидация массивов (minLength при наличии)
- Валидация элементов массива
- Валидация созаёмщиков (email, телефон, доход)

### Между шагами

- Первоначальный платёж >= 20% от стоимости имущества
- Ежемесячный платёж <= 50% от общего дохода
- Возраст влияет на доступность полей
- Асинхронно: проверки ИНН, СНИЛС, уникальность email

## Интеграция с Behaviors

Валидация работает бесшовно с behaviors:

```typescript
// Behavior скрывает поле когда не нужно
enableWhen(path.propertyValue, path.loanType, (type) => type === 'mortgage');

// Валидация применяется только когда поле видно
requiredWhen(path.propertyValue, path.loanType, (type) => type === 'mortgage', {
  message: 'Стоимость имущества обязательна',
});
```

Когда поле скрыто behavior, его валидация автоматически пропускается!

## Начало работы

Давайте начнём с валидации Шага 1: Информация о кредите. Этот шаг демонстрирует наиболее распространённые паттерны валидации, которые вы будете использовать во всей форме.

В следующем разделе мы:

1. Создадим файл валидатора для Шага 1
2. Реализуем валидацию обязательных полей
3. Добавим валидацию числовых диапазонов (min/max)
4. Реализуем условную валидацию для полей ипотеки/автокредита
5. Протестируем валидацию в действии

Готовы? Начинаем!
