---
sidebar_position: 6
---

# Шаг 5: Валидация дополнительной информации

Валидация массивов и их элементов с условными требованиями и валидацией вложенных объектов.

## Что мы валидируем

Шаг 5 содержит поля массивов, которые требуют специальную валидацию:

| Поле                                    | Правила валидации                                               |
| --------------------------------------- | --------------------------------------------------------------- |
| **Массив имущества**                    |                                                                 |
| `properties`                            | Min 1 элемент когда `hasProperty` = true, max 10 элементов      |
| `properties[*].type`                    | Требуется для каждого элемента                                  |
| `properties[*].description`             | Требуется, minLength 10                                         |
| `properties[*].estimatedValue`          | Требуется, min 0                                                |
| **Массив существующих кредитов**        |                                                                 |
| `existingLoans`                         | Min 1 элемент когда `hasExistingLoans` = true, max 20 элементов |
| `existingLoans[*].bank`                 | Требуется для каждого элемента                                  |
| `existingLoans[*].amount`               | Требуется, min 0                                                |
| `existingLoans[*].remainingAmount`      | Опционально, min 0                                              |
| **Массив созаёмщиков**                  |                                                                 |
| `coBorrowers`                           | Min 1 элемент когда `hasCoBorrower` = true, max 5 элементов     |
| `coBorrowers[*].personalData.firstName` | Требуется для каждого элемента                                  |
| `coBorrowers[*].personalData.lastName`  | Требуется для каждого элемента                                  |
| `coBorrowers[*].phone`                  | Требуется, формат телефона                                      |
| `coBorrowers[*].email`                  | Требуется, формат email                                         |
| `coBorrowers[*].monthlyIncome`          | Требуется, min 0                                                |

## Создание файла валидатора

Создайте файл валидатора для Шага 5:

```bash
touch src/schemas/validators/steps/step-5-additional-info.validators.ts
```

## Реализация

### Валидация массива имущества

Начните с валидации массива имущества:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  arrayMinLengthWhen,
  arrayMaxLength,
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 5: Дополнительная информация
 *
 * Валидирует:
 * - Массив имущества (условный, max 10 элементов)
 * - Массив существующих кредитов (условный, max 20 элементов)
 * - Массив созаёмщиков (условный, max 5 элементов)
 * - Валидация элементов массива для всех массивов
 */
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Массив имущества
  // ==========================================

  // Валидация длины массива
  arrayMinLengthWhen(path.properties, 1, path.hasProperty, (has) => has === true, {
    message: 'Добавьте хотя бы одно имущество',
  });

  arrayMaxLength(path.properties, 10, {
    message: 'Максимум 10 имущества разрешено',
  });

  // Валидация каждого элемента имущества используя '*' wildcard
  required(path.properties['*'].type, {
    message: 'Тип имущества обязателен',
  });

  required(path.properties['*'].description, {
    message: 'Описание имущества обязательно',
  });

  minLength(path.properties['*'].description, 10, {
    message: 'Минимум 10 символов для описания',
  });

  required(path.properties['*'].estimatedValue, {
    message: 'Приблизительная стоимость обязательна',
  });

  min(path.properties['*'].estimatedValue, 0, {
    message: 'Стоимость должна быть неотрицательной',
  });
};
```

:::tip Валидация элементов массива
Используйте `'*'` wildcard для валидации всех элементов в массиве:

- `path.properties['*'].type` валидирует поле `type` каждого имущества
- Валидация запускается для каждого существующего элемента массива
- Новые элементы валидируются при добавлении
  :::

### Валидация массива существующих кредитов

Добавьте валидацию для существующих кредитов:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Массив существующих кредитов
  // ==========================================

  // Валидация длины массива
  arrayMinLengthWhen(path.existingLoans, 1, path.hasExistingLoans, (has) => has === true, {
    message: 'Добавьте хотя бы один существующий кредит',
  });

  arrayMaxLength(path.existingLoans, 20, {
    message: 'Максимум 20 кредитов разрешено',
  });

  // Валидация каждого элемента кредита
  required(path.existingLoans['*'].bank, {
    message: 'Название банка обязательно',
  });

  required(path.existingLoans['*'].amount, {
    message: 'Сумма кредита обязательна',
  });

  min(path.existingLoans['*'].amount, 0, {
    message: 'Сумма должна быть неотрицательной',
  });

  // Остаток кредита опционален, но должен быть неотрицательным если указан
  min(path.existingLoans['*'].remainingAmount, 0, {
    message: 'Остаток должен быть неотрицательным',
  });

  required(path.existingLoans['*'].monthlyPayment, {
    message: 'Ежемесячный платёж обязателен',
  });

  min(path.existingLoans['*'].monthlyPayment, 0, {
    message: 'Ежемесячный платёж должен быть неотрицательным',
  });
};
```

### Валидация массива созаёмщиков

Добавьте валидацию для созаёмщиков с валидацией вложенных объектов:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Массив созаёмщиков
  // ==========================================

  // Валидация длины массива
  arrayMinLengthWhen(path.coBorrowers, 1, path.hasCoBorrower, (has) => has === true, {
    message: 'Добавьте хотя бы одного созаёмщика',
  });

  arrayMaxLength(path.coBorrowers, 5, {
    message: 'Максимум 5 созаёмщиков разрешено',
  });

  // Валидация вложенного объекта personalData в каждом созаёмщике
  required(path.coBorrowers['*'].personalData.firstName, {
    message: 'Имя обязательно',
  });

  required(path.coBorrowers['*'].personalData.lastName, {
    message: 'Фамилия обязательна',
  });

  // Валидация телефона
  required(path.coBorrowers['*'].phone, {
    message: 'Номер телефона обязателен',
  });

  phone(path.coBorrowers['*'].phone, {
    message: 'Неверный формат телефона',
  });

  // Валидация email
  required(path.coBorrowers['*'].email, {
    message: 'Email обязателен',
  });

  email(path.coBorrowers['*'].email, {
    message: 'Неверный формат email',
  });

  // Ежемесячный доход
  required(path.coBorrowers['*'].monthlyIncome, {
    message: 'Ежемесячный доход обязателен',
  });

  min(path.coBorrowers['*'].monthlyIncome, 0, {
    message: 'Доход должен быть неотрицательным',
  });

  // Связь с заявителем
  required(path.coBorrowers['*'].relationship, {
    message: 'Связь с заявителем обязательна',
  });
};
```

## Полный код

Вот полный валидатор для Шага 5:

```typescript title="src/schemas/validators/steps/step-5-additional-info.validators.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  arrayMinLengthWhen,
  arrayMaxLength,
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 5: Дополнительная информация
 *
 * Валидирует:
 * - Массив имущества (условный, max 10 элементов)
 * - Массив существующих кредитов (условный, max 20 элементов)
 * - Массив созаёмщиков (условный, max 5 элементов)
 * - Валидация элементов массива для всех массивов
 */
export const step5AdditionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Массив имущества
  // ==========================================

  arrayMinLengthWhen(path.properties, 1, path.hasProperty, (has) => has === true, {
    message: 'Добавьте хотя бы одно имущество',
  });

  arrayMaxLength(path.properties, 10, {
    message: 'Максимум 10 имущества разрешено',
  });

  required(path.properties['*'].type, {
    message: 'Тип имущества обязателен',
  });

  required(path.properties['*'].description, {
    message: 'Описание имущества обязательно',
  });

  minLength(path.properties['*'].description, 10, {
    message: 'Минимум 10 символов для описания',
  });

  required(path.properties['*'].estimatedValue, {
    message: 'Приблизительная стоимость обязательна',
  });

  min(path.properties['*'].estimatedValue, 0, {
    message: 'Стоимость должна быть неотрицательной',
  });

  // ==========================================
  // Массив существующих кредитов
  // ==========================================

  arrayMinLengthWhen(path.existingLoans, 1, path.hasExistingLoans, (has) => has === true, {
    message: 'Добавьте хотя бы один существующий кредит',
  });

  arrayMaxLength(path.existingLoans, 20, {
    message: 'Максимум 20 кредитов разрешено',
  });

  required(path.existingLoans['*'].bank, {
    message: 'Название банка обязательно',
  });

  required(path.existingLoans['*'].amount, {
    message: 'Сумма кредита обязательна',
  });

  min(path.existingLoans['*'].amount, 0, {
    message: 'Сумма должна быть неотрицательной',
  });

  min(path.existingLoans['*'].remainingAmount, 0, {
    message: 'Остаток должен быть неотрицательным',
  });

  required(path.existingLoans['*'].monthlyPayment, {
    message: 'Ежемесячный платёж обязателен',
  });

  min(path.existingLoans['*'].monthlyPayment, 0, {
    message: 'Ежемесячный платёж должен быть неотрицательным',
  });

  // ==========================================
  // Массив созаёмщиков
  // ==========================================

  arrayMinLengthWhen(path.coBorrowers, 1, path.hasCoBorrower, (has) => has === true, {
    message: 'Добавьте хотя бы одного созаёмщика',
  });

  arrayMaxLength(path.coBorrowers, 5, {
    message: 'Максимум 5 созаёмщиков разрешено',
  });

  required(path.coBorrowers['*'].personalData.firstName, {
    message: 'Имя обязательно',
  });

  required(path.coBorrowers['*'].personalData.lastName, {
    message: 'Фамилия обязательна',
  });

  required(path.coBorrowers['*'].phone, {
    message: 'Номер телефона обязателен',
  });

  phone(path.coBorrowers['*'].phone, {
    message: 'Неверный формат телефона',
  });

  required(path.coBorrowers['*'].email, {
    message: 'Email обязателен',
  });

  email(path.coBorrowers['*'].email, {
    message: 'Неверный формат email',
  });

  required(path.coBorrowers['*'].monthlyIncome, {
    message: 'Ежемесячный доход обязателен',
  });

  min(path.coBorrowers['*'].monthlyIncome, 0, {
    message: 'Доход должен быть неотрицательным',
  });

  required(path.coBorrowers['*'].relationship, {
    message: 'Связь с заявителем обязательна',
  });
};
```

## Как это работает

### Валидация длины массива

#### Условный минимум

```typescript
arrayMinLengthWhen(
  path.properties,
  1, // Минимальная длина
  path.hasProperty, // Поле зависимости
  (has) => has === true, // Условие
  { message: 'Добавьте хотя бы одно имущество' }
);
```

- Массив должен иметь минимум 1 элемент когда условие true
- Нет валидации когда условие false
- Работает с behaviors, которые показывают/скрывают массивы

#### Максимальная длина

```typescript
arrayMaxLength(path.properties, 10, {
  message: 'Максимум 10 имущества разрешено',
});
```

- Всегда применяется (не условна)
- Предотвращает добавление больше чем разрешено элементов
- Пользователь видит ошибку при попытке добавить слишком много элементов

### Валидация элементов массива

Используйте `'*'` wildcard для валидации всех элементов массива:

```typescript
// Валидирует поле 'type' в каждом имущества
required(path.properties['*'].type, {
  message: 'Тип имущества обязателен',
});

// Валидирует поле 'description' в каждом имущества
minLength(path.properties['*'].description, 10, {
  message: 'Минимум 10 символов для описания',
});
```

**Как это работает**:

- `path.properties['*']` означает "каждый элемент в массиве properties"
- Валидация запускается для каждого существующего элемента
- Новые элементы валидируются при добавлении в массив
- Удаление элементов удаляет их ошибки валидации

### Валидация вложенных объектов

Валидируйте поля внутри вложенных объектов в массивах:

```typescript
// Валидирует firstName внутри personalData внутри каждого созаёмщика
required(path.coBorrowers['*'].personalData.firstName, {
  message: 'Имя обязательно',
});
```

**Структура**:

```typescript
coBorrowers: [
  {
    personalData: {
      firstName: 'Иван', // ← Это поле
      lastName: 'Иванов',
    },
    phone: '+71234567890',
    email: 'ivan@example.com',
    monthlyIncome: 50000,
  },
];
```

### Интеграция с Behaviors

Из раздела Behaviors:

```typescript
// Behavior: Показывать массив имущества только когда флажок отмечен
enableWhen(path.properties, path.hasProperty, (has) => has === true);

// Валидация: Требовать минимум одно имущество когда видимо
arrayMinLengthWhen(path.properties, 1, path.hasProperty, (has) => has === true, {
  message: 'Добавьте хотя бы одно имущество',
});
```

Идеальная синхронизация! Массив скрывается/видим и требуется/опционален вместе.

## Тестирование валидации

Протестируйте эти сценарии:

### Массив имущества

- [ ] Отметьте "есть имущество" → Массив становится требуемым
- [ ] Оставьте массив пусто → Ошибка показана
- [ ] Добавьте одно имущество → Ошибки нет
- [ ] Попытайтесь добавить 11-е имущество → Ошибка показана
- [ ] Оставьте тип имущества пусто → Ошибка показана
- [ ] Оставьте описание пусто → Ошибка показана
- [ ] Введите описание < 10 символов → Ошибка показана
- [ ] Оставьте стоимость пусто → Ошибка показана
- [ ] Введите отрицательную стоимость → Ошибка показана

### Массив существующих кредитов

- [ ] Отметьте "есть существующие кредиты" → Массив становится требуемым
- [ ] Оставьте массив пусто → Ошибка показана
- [ ] Добавьте один кредит → Ошибки нет
- [ ] Попытайтесь добавить 21-й кредит → Ошибка показана
- [ ] Оставьте название банка пусто → Ошибка показана
- [ ] Оставьте сумму пусто → Ошибка показана
- [ ] Введите отрицательную сумму → Ошибка показана
- [ ] Введите отрицательный остаток → Ошибка показана

### Массив созаёмщиков

- [ ] Отметьте "есть созаёмщик" → Массив становится требуемым
- [ ] Оставьте массив пусто → Ошибка показана
- [ ] Добавьте одного созаёмщика → Ошибки нет
- [ ] Попытайтесь добавить 6-го созаёмщика → Ошибка показана
- [ ] Оставьте имя пусто → Ошибка показана
- [ ] Оставьте фамилию пусто → Ошибка показана
- [ ] Оставьте телефон пусто → Ошибка показана
- [ ] Введите неверный формат телефона → Ошибка показана
- [ ] Оставьте email пусто → Ошибка показана
- [ ] Введите неверный формат email → Ошибка показана
- [ ] Оставьте ежемесячный доход пусто → Ошибка показана
- [ ] Введите отрицательный доход → Ошибка показана

### Управление массивом

- [ ] Добавьте элемент → Элемент получает валидацию
- [ ] Удалите элемент → Ошибки элемента исчезают
- [ ] Отмените "есть имущество" → Массив не требуется, ошибки очищены

## Ключевые выводы

1. **Длина массива** - Используйте `arrayMinLengthWhen()` и `arrayMaxLength()`
2. **Валидация элементов** - Используйте `'*'` wildcard для всех элементов
3. **Вложенные объекты** - Можно валидировать глубоко вложенные поля в массивах
4. **Условные массивы** - Массивы могут быть условно требуемы
5. **Работает с Behaviors** - Скрытые массивы пропускают валидацию

## Распространённые паттерны

### Условный массив с валидацией элементов

```typescript
// Массив должен иметь минимум 1 элемент когда флажок true
arrayMinLengthWhen(path.items, 1, path.hasItems, (has) => has === true, {
  message: 'Добавьте хотя бы один элемент',
});

// Каждый элемент должен иметь требуемые поля
required(path.items['*'].name, { message: 'Имя требуется' });
min(path.items['*'].value, 0, { message: 'Значение должно быть неотрицательным' });
```

### Массив с максимальной длиной

```typescript
arrayMaxLength(path.items, 10, {
  message: 'Максимум 10 элементов разрешено',
});
```

### Вложенный объект в массиве

```typescript
// Валидируйте поля внутри вложенных объектов
required(path.items['*'].contact.email, {
  message: 'Email требуется',
});
```

## Что дальше?

В следующем разделе мы добавим **Валидацию между шагами**, включая:

- Валидацию, охватывающую несколько шагов формы
- Бизнес-правила (первоначальный платёж >= 20%, ежемесячный платёж <= 50% дохода)
- Валидацию на основе возраста (минимум/максимум возраст)
- Асинхронную валидацию (ИНН, СНИЛС, уникальность email)
- Сложную валидацию между полями

Это то, где мы всё связываем вместе!
