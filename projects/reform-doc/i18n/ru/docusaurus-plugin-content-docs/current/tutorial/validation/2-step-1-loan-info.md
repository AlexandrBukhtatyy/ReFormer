---
sidebar_position: 2
---

# Шаг 1: Валидация информации о кредите

Валидация полей кредита с правилами required, min/max и условными правилами.

## Что мы валидируем

Шаг 1 содержит поля, связанные с кредитом, которые нуждаются в валидации:

| Поле | Правила валидации |
|------|------------------|
| `loanType` | Обязательно |
| `loanAmount` | Обязательно, min 50 000, max 10 000 000 |
| `loanTerm` | Обязательно, min 6 месяцев, max 360 месяцев |
| `loanPurpose` | Обязательно, minLength 10, maxLength 500 |
| `propertyValue` | Обязательно когда loanType = 'mortgage', min 1 000 000 |
| `initialPayment` | Обязательно когда loanType = 'mortgage' |
| `carBrand` | Обязательно когда loanType = 'car' |
| `carModel` | Обязательно когда loanType = 'car' |
| `carYear` | Обязательно когда loanType = 'car', min 2000 |
| `carPrice` | Обязательно когда loanType = 'car' |

## Создание файла валидатора

Создайте файл валидатора для Шага 1:

```bash
mkdir -p src/schemas/validators/steps
touch src/schemas/validators/steps/step-1-loan-info.validators.ts
```

## Реализация

### Валидация обязательных полей

Начните с базовых обязательных полей и числовых диапазонов:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
import { required, min, max, minLength, maxLength, requiredWhen, minWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 1: Информация о кредите
 *
 * Валидирует:
 * - Обязательные поля (loanType, loanAmount, loanTerm, loanPurpose)
 * - Числовые диапазоны (сумма, срок)
 * - Условные поля ипотеки
 * - Условные поля автокредита
 */
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Тип кредита
  // ==========================================
  required(path.loanType, { message: 'Пожалуйста, выберите тип кредита' });

  // ==========================================
  // Сумма кредита
  // ==========================================
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма: 50 000' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма: 10 000 000' });

  // ==========================================
  // Срок кредита
  // ==========================================
  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 360, { message: 'Максимальный срок: 360 месяцев (30 лет)' });

  // ==========================================
  // Цель кредита
  // ==========================================
  required(path.loanPurpose, { message: 'Цель кредита обязательна' });
  minLength(path.loanPurpose, 10, { message: 'Пожалуйста, укажите не менее 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  // Условная валидация будет добавлена дальше...
};
```

### Условная валидация: Поля ипотеки

Добавьте валидацию для полей, связанных с ипотекой, используя `requiredWhen` и `minWhen`:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Условно: Поля ипотеки
  // ==========================================

  // Стоимость имущества - обязательно только для ипотеки
  requiredWhen(
    path.propertyValue,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Стоимость имущества обязательна для ипотеки' }
  );

  // Минимальная стоимость имущества - применяется только для ипотеки
  minWhen(
    path.propertyValue,
    1000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Минимальная стоимость имущества: 1 000 000' }
  );

  // Максимальная стоимость имущества
  maxWhen(
    path.propertyValue,
    500000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Максимальная стоимость имущества: 500 000 000' }
  );

  // Первоначальный платёж - обязателен только для ипотеки
  requiredWhen(
    path.initialPayment,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Первоначальный платёж обязателен для ипотеки' }
  );

  // Минимальный первоначальный платёж
  minWhen(
    path.initialPayment,
    100000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Минимальный первоначальный платёж: 100 000' }
  );
};
```

### Условная валидация: Поля автокредита

Добавьте валидацию для полей, связанных с автокредитом:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Условно: Поля автокредита
  // ==========================================

  // Марка автомобиля
  requiredWhen(
    path.carBrand,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Марка автомобиля обязательна' }
  );

  // Модель автомобиля
  requiredWhen(
    path.carModel,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Модель автомобиля обязательна' }
  );

  // Год выпуска
  requiredWhen(
    path.carYear,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Год выпуска обязателен' }
  );

  // Минимальный год выпуска (машины не старше 2000)
  minWhen(
    path.carYear,
    2000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Автомобиль должен быть 2000 года или новее' }
  );

  // Максимальный год выпуска (текущий год + 1 для предзаказов)
  const currentYear = new Date().getFullYear();
  maxWhen(
    path.carYear,
    currentYear + 1,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: `Максимальный год: ${currentYear + 1}` }
  );

  // Цена автомобиля
  requiredWhen(
    path.carPrice,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Цена автомобиля обязательна' }
  );

  // Минимальная цена автомобиля
  minWhen(
    path.carPrice,
    100000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Минимальная цена автомобиля: 100 000' }
  );

  // Максимальная цена автомобиля
  maxWhen(
    path.carPrice,
    20000000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Максимальная цена автомобиля: 20 000 000' }
  );
};
```

## Полный код

Вот полный валидатор для Шага 1:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  requiredWhen,
  minWhen,
  maxWhen
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 1: Информация о кредите
 *
 * Валидирует:
 * - Обязательные поля (loanType, loanAmount, loanTerm, loanPurpose)
 * - Числовые диапазоны (сумма, срок)
 * - Условные поля ипотеки (propertyValue, initialPayment)
 * - Условные поля автокредита (carBrand, carModel, carYear, carPrice)
 */
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Тип кредита
  // ==========================================
  required(path.loanType, { message: 'Пожалуйста, выберите тип кредита' });

  // ==========================================
  // Сумма кредита
  // ==========================================
  required(path.loanAmount, { message: 'Сумма кредита обязательна' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма: 50 000' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма: 10 000 000' });

  // ==========================================
  // Срок кредита
  // ==========================================
  required(path.loanTerm, { message: 'Срок кредита обязателен' });
  min(path.loanTerm, 6, { message: 'Минимальный срок: 6 месяцев' });
  max(path.loanTerm, 360, { message: 'Максимальный срок: 360 месяцев (30 лет)' });

  // ==========================================
  // Цель кредита
  // ==========================================
  required(path.loanPurpose, { message: 'Цель кредита обязательна' });
  minLength(path.loanPurpose, 10, { message: 'Пожалуйста, укажите не менее 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });

  // ==========================================
  // Условно: Поля ипотеки
  // ==========================================
  requiredWhen(
    path.propertyValue,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Стоимость имущества обязательна для ипотеки' }
  );

  minWhen(
    path.propertyValue,
    1000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Минимальная стоимость имущества: 1 000 000' }
  );

  maxWhen(
    path.propertyValue,
    500000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Максимальная стоимость имущества: 500 000 000' }
  );

  requiredWhen(
    path.initialPayment,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Первоначальный платёж обязателен для ипотеки' }
  );

  minWhen(
    path.initialPayment,
    100000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Минимальный первоначальный платёж: 100 000' }
  );

  // ==========================================
  // Условно: Поля автокредита
  // ==========================================
  requiredWhen(
    path.carBrand,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Марка автомобиля обязательна' }
  );

  requiredWhen(
    path.carModel,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Модель автомобиля обязательна' }
  );

  requiredWhen(
    path.carYear,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Год выпуска обязателен' }
  );

  minWhen(
    path.carYear,
    2000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Автомобиль должен быть 2000 года или новее' }
  );

  const currentYear = new Date().getFullYear();
  maxWhen(
    path.carYear,
    currentYear + 1,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: `Максимальный год: ${currentYear + 1}` }
  );

  requiredWhen(
    path.carPrice,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Цена автомобиля обязательна' }
  );

  minWhen(
    path.carPrice,
    100000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Минимальная цена автомобиля: 100 000' }
  );

  maxWhen(
    path.carPrice,
    20000000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Максимальная цена автомобиля: 20 000 000' }
  );
};
```

## Как это работает

### Валидаторы required

```typescript
required(path.loanAmount, { message: 'Сумма кредита обязательна' });
```

- Срабатывает когда поле пусто, null или undefined
- Показывает сообщение об ошибке сразу когда пользователь оставляет поле пустым

### Валидаторы диапазонов

```typescript
min(path.loanAmount, 50000, { message: 'Минимальная сумма: 50 000' });
max(path.loanAmount, 10000000, { message: 'Максимальная сумма: 10 000 000' });
```

- `min`: Срабатывает когда значение < минимума
- `max`: Срабатывает когда значение > максимума
- Работает с числами и числовыми строками

### Условные валидаторы

```typescript
requiredWhen(
  path.propertyValue,
  path.loanType,
  (loanType) => loanType === 'mortgage',
  { message: 'Стоимость имущества обязательна для ипотеки' }
);
```

- **Первый аргумент**: Поле для валидации
- **Второй аргумент**: Поле для отслеживания (зависимость)
- **Третий аргумент**: Функция условия
- **Четвёртый аргумент**: Сообщение об ошибке
- Валидирует только когда условие возвращает `true`

### Интеграция с Behaviors

Помните из раздела Behaviors, у нас есть:

```typescript
// Behavior скрывает поля ипотеки когда не нужны
showWhen(path.propertyValue, path.loanType, (type) => type === 'mortgage');

// Валидация применяется только когда видимо
requiredWhen(
  path.propertyValue,
  path.loanType,
  (type) => type === 'mortgage',
  { message: 'Стоимость имущества обязательна' }
);
```

Когда `loanType` не 'mortgage':
1. Behavior **скрывает** поле → Пользователь его не видит
2. Валидация **пропускает** поле → Ошибки не показываются

Идеальная синхронизация!

## Тестирование валидации

Протестируйте эти сценарии:

### Обязательные поля
- [ ] Попытка отправить без выбора типа кредита → Ошибка показана
- [ ] Попытка отправить без суммы кредита → Ошибка показана
- [ ] Попытка отправить без срока → Ошибка показана
- [ ] Попытка отправить без цели → Ошибка показана

### Числовые диапазоны
- [ ] Введите сумму кредита < 50 000 → Ошибка показана
- [ ] Введите сумму кредита > 10 000 000 → Ошибка показана
- [ ] Введите срок < 6 → Ошибка показана
- [ ] Введите срок > 360 → Ошибка показана

### Длина строки
- [ ] Введите цель с < 10 символами → Ошибка показана
- [ ] Введите цель с > 500 символами → Ошибка показана

### Условно: Ипотека
- [ ] Выберите тип кредита = 'mortgage' → propertyValue и initialPayment становятся обязательны
- [ ] Оставьте propertyValue пусто → Ошибка показана
- [ ] Введите propertyValue < 1 000 000 → Ошибка показана
- [ ] Оставьте initialPayment пусто → Ошибка показана

### Условно: Автокредит
- [ ] Выберите тип кредита = 'car' → Поля автомобиля становятся обязательны
- [ ] Оставьте carBrand пусто → Ошибка показана
- [ ] Оставьте carModel пусто → Ошибка показана
- [ ] Введите carYear < 2000 → Ошибка показана
- [ ] Введите carPrice < 100 000 → Ошибка показана

### Переключение типов кредита
- [ ] Заполните поля ипотеки → Переключитесь на 'car' → Ошибки ипотеки исчезают
- [ ] Заполните поля автокредита → Переключитесь на 'mortgage' → Ошибки автокредита исчезают

## Ключевые выводы

1. **Декларативные правила** - Ясные, лаконичные определения валидации
2. **Условная валидация** - Используйте `requiredWhen`, `minWhen`, `maxWhen` для условных правил
3. **Работает с Behaviors** - Скрытые поля не валидируются
4. **Типобезопасно** - Полная поддержка TypeScript для путей полей
5. **Локализировано** - Вся валидация Шага 1 в одном файле

## Что дальше?

В следующем разделе мы добавим валидацию для **Шага 2: Личная информация**, включая:
- Валидацию имён с паттернами кириллицы
- Валидацию даты рождения с расчётом возраста
- Валидацию формата паспорта
- Валидацию паттерна ИНН и СНИЛС
- Пользовательские валидаторы для сложных правил

Паттерны валидации, которые мы выучили здесь, будут применены во всей форме!
