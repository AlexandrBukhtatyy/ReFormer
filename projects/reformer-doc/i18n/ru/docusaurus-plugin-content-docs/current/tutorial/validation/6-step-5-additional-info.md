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
touch src/schemas/validators/additional-info.ts
```

## Реализация

### Валидация массива имущества

Начните с валидации массива имущества:

```typescript title="src/schemas/validators/additional-info.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  applyWhen,
  notEmpty,
  validateItems,
  validate,
} from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
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
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Массив имущества
  // ==========================================

  applyWhen(
    path.hasProperty,
    (has) => has === true,
    (p) => {
      notEmpty(p.properties, { message: 'Добавьте хотя бы одно имущество' });
    }
  );

  // Максимум 10 элементов в массиве
  validate(path.properties, (properties) => {
    if (!properties || properties.length <= 10) return null;
    return {
      code: 'maxArrayLength',
      message: 'Максимум 10 имущества разрешено',
    };
  });

  // Валидация каждого элемента массива
  validateItems(path.properties, (itemPath) => {
    required(itemPath.type, { message: 'Тип имущества обязателен' });

    required(itemPath.description, { message: 'Описание имущества обязательно' });
    minLength(itemPath.description, 10, { message: 'Минимум 10 символов для описания' });

    required(itemPath.estimatedValue, { message: 'Приблизительная стоимость обязательна' });
    min(itemPath.estimatedValue, 0, { message: 'Стоимость должна быть неотрицательной' });
  });
};
```

:::tip Валидация элементов массива
Используйте `validateItems()` для валидации всех элементов в массиве:

- `validateItems(path.properties, (itemPath) => { ... })` валидирует каждый элемент
- Валидация запускается для каждого существующего элемента массива
- Новые элементы валидируются при добавлении
  :::

### Валидация массива существующих кредитов

Добавьте валидацию для существующих кредитов:

```typescript title="src/schemas/validators/additional-info.ts"
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Массив существующих кредитов
  // ==========================================

  applyWhen(
    path.hasExistingLoans,
    (has) => has === true,
    (p) => {
      notEmpty(p.existingLoans, { message: 'Добавьте хотя бы один существующий кредит' });
    }
  );

  // Максимум 20 элементов в массиве
  validate(path.existingLoans, (loans) => {
    if (!loans || loans.length <= 20) return null;
    return {
      code: 'maxArrayLength',
      message: 'Максимум 20 кредитов разрешено',
    };
  });

  // Валидация каждого элемента массива
  validateItems(path.existingLoans, (itemPath) => {
    required(itemPath.bank, { message: 'Название банка обязательно' });

    required(itemPath.amount, { message: 'Сумма кредита обязательна' });
    min(itemPath.amount, 0, { message: 'Сумма должна быть неотрицательной' });

    min(itemPath.remainingAmount, 0, { message: 'Остаток должен быть неотрицательным' });

    required(itemPath.monthlyPayment, { message: 'Ежемесячный платёж обязателен' });
    min(itemPath.monthlyPayment, 0, {
      message: 'Ежемесячный платёж должен быть неотрицательным',
    });
  });
};
```

### Валидация массива созаёмщиков

Добавьте валидацию для созаёмщиков с валидацией вложенных объектов:

```typescript title="src/schemas/validators/additional-info.ts"
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Массив созаёмщиков
  // ==========================================

  applyWhen(
    path.hasCoBorrower,
    (has) => has === true,
    (p) => {
      notEmpty(p.coBorrowers, { message: 'Добавьте хотя бы одного созаёмщика' });
    }
  );

  // Максимум 5 элементов в массиве
  validate(path.coBorrowers, (coBorrowers) => {
    if (!coBorrowers || coBorrowers.length <= 5) return null;
    return {
      code: 'maxArrayLength',
      message: 'Максимум 5 созаёмщиков разрешено',
    };
  });

  // Валидация каждого элемента массива
  validateItems(path.coBorrowers, (itemPath) => {
    required(itemPath.personalData.firstName, { message: 'Имя обязательно' });
    required(itemPath.personalData.lastName, { message: 'Фамилия обязательна' });

    required(itemPath.phone, { message: 'Номер телефона обязателен' });
    phone(itemPath.phone, { message: 'Неверный формат телефона' });

    required(itemPath.email, { message: 'Email обязателен' });
    email(itemPath.email, { message: 'Неверный формат email' });

    required(itemPath.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
    min(itemPath.monthlyIncome, 0, { message: 'Доход должен быть неотрицательным' });

    required(itemPath.relationship, { message: 'Связь с заявителем обязательна' });
  });
};
```

## Полный код

Вот полный валидатор для Шага 5:

```typescript title="src/schemas/validators/additional-info.ts"
import {
  required,
  min,
  minLength,
  email,
  phone,
  applyWhen,
  notEmpty,
  validateItems,
  validate,
} from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
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
export const additionalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Массив имущества
  // ==========================================

  applyWhen(
    path.hasProperty,
    (has) => has === true,
    (p) => {
      notEmpty(p.properties, { message: 'Добавьте хотя бы одно имущество' });
    }
  );

  validate(path.properties, (properties) => {
    if (!properties || properties.length <= 10) return null;
    return {
      code: 'maxArrayLength',
      message: 'Максимум 10 имущества разрешено',
    };
  });

  validateItems(path.properties, (itemPath) => {
    required(itemPath.type, { message: 'Тип имущества обязателен' });
    required(itemPath.description, { message: 'Описание имущества обязательно' });
    minLength(itemPath.description, 10, { message: 'Минимум 10 символов для описания' });
    required(itemPath.estimatedValue, { message: 'Приблизительная стоимость обязательна' });
    min(itemPath.estimatedValue, 0, { message: 'Стоимость должна быть неотрицательной' });
  });

  // ==========================================
  // Массив существующих кредитов
  // ==========================================

  applyWhen(
    path.hasExistingLoans,
    (has) => has === true,
    (p) => {
      notEmpty(p.existingLoans, { message: 'Добавьте хотя бы один существующий кредит' });
    }
  );

  validate(path.existingLoans, (loans) => {
    if (!loans || loans.length <= 20) return null;
    return {
      code: 'maxArrayLength',
      message: 'Максимум 20 кредитов разрешено',
    };
  });

  validateItems(path.existingLoans, (itemPath) => {
    required(itemPath.bank, { message: 'Название банка обязательно' });
    required(itemPath.amount, { message: 'Сумма кредита обязательна' });
    min(itemPath.amount, 0, { message: 'Сумма должна быть неотрицательной' });
    min(itemPath.remainingAmount, 0, { message: 'Остаток должен быть неотрицательным' });
    required(itemPath.monthlyPayment, { message: 'Ежемесячный платёж обязателен' });
    min(itemPath.monthlyPayment, 0, {
      message: 'Ежемесячный платёж должен быть неотрицательным',
    });
  });

  // ==========================================
  // Массив созаёмщиков
  // ==========================================

  applyWhen(
    path.hasCoBorrower,
    (has) => has === true,
    (p) => {
      notEmpty(p.coBorrowers, { message: 'Добавьте хотя бы одного созаёмщика' });
    }
  );

  validate(path.coBorrowers, (coBorrowers) => {
    if (!coBorrowers || coBorrowers.length <= 5) return null;
    return {
      code: 'maxArrayLength',
      message: 'Максимум 5 созаёмщиков разрешено',
    };
  });

  validateItems(path.coBorrowers, (itemPath) => {
    required(itemPath.personalData.firstName, { message: 'Имя обязательно' });
    required(itemPath.personalData.lastName, { message: 'Фамилия обязательна' });
    required(itemPath.phone, { message: 'Номер телефона обязателен' });
    phone(itemPath.phone, { message: 'Неверный формат телефона' });
    required(itemPath.email, { message: 'Email обязателен' });
    email(itemPath.email, { message: 'Неверный формат email' });
    required(itemPath.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
    min(itemPath.monthlyIncome, 0, { message: 'Доход должен быть неотрицательным' });
    required(itemPath.relationship, { message: 'Связь с заявителем обязательна' });
  });
};
```

## Как это работает

### Валидация длины массива

#### Условный минимум с notEmpty

```typescript
applyWhen(
  path.hasProperty,
  (has) => has === true,
  (p) => {
    notEmpty(p.properties, { message: 'Добавьте хотя бы одно имущество' });
  }
);
```

- Массив должен содержать элементы когда условие true
- Нет валидации когда условие false
- Работает с behaviors, которые показывают/скрывают массивы

#### Максимальная длина с validate

```typescript
validate(path.properties, (properties) => {
  if (!properties || properties.length <= 10) return null;
  return {
    code: 'maxArrayLength',
    message: 'Максимум 10 имущества разрешено',
  };
});
```

- Проверяет длину массива
- Предотвращает добавление больше чем разрешено элементов
- Пользователь видит ошибку при попытке добавить слишком много элементов

### Валидация элементов массива

Используйте `validateItems()` для валидации всех элементов массива:

```typescript
// Валидация каждого элемента имущества
validateItems(path.properties, (itemPath) => {
  required(itemPath.type, { message: 'Тип имущества обязателен' });
  minLength(itemPath.description, 10, { message: 'Минимум 10 символов для описания' });
});
```

**Как это работает**:

- `validateItems()` применяет валидацию к каждому элементу в массиве
- Валидация запускается для каждого существующего элемента
- Новые элементы валидируются при добавлении в массив
- Удаление элементов удаляет их ошибки валидации

### Валидация вложенных объектов

Валидируйте поля внутри вложенных объектов в массивах:

```typescript
// Валидирует firstName внутри personalData внутри каждого созаёмщика
validateItems(path.coBorrowers, (itemPath) => {
  required(itemPath.personalData.firstName, { message: 'Имя обязательно' });
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
applyWhen(
  path.hasProperty,
  (has) => has === true,
  (p) => {
    notEmpty(p.properties, { message: 'Добавьте хотя бы одно имущество' });
  }
);
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

1. **Длина массива** - Используйте `notEmpty()` и `validate()` для проверки длины
2. **Валидация элементов** - Используйте `validateItems()` для всех элементов
3. **Вложенные объекты** - Можно валидировать глубоко вложенные поля в массивах
4. **Условные массивы** - Массивы могут быть условно требуемы с `applyWhen()`
5. **Работает с Behaviors** - Скрытые массивы пропускают валидацию

## Распространённые паттерны

### Условный массив с валидацией элементов

```typescript
// Массив должен содержать элементы когда флажок true
applyWhen(
  path.hasItems,
  (has) => has === true,
  (p) => {
    notEmpty(p.items, { message: 'Добавьте хотя бы один элемент' });
  }
);

// Каждый элемент должен иметь требуемые поля
validateItems(path.items, (itemPath) => {
  required(itemPath.name, { message: 'Имя требуется' });
  min(itemPath.value, 0, { message: 'Значение должно быть неотрицательным' });
});
```

### Массив с максимальной длиной

```typescript
validate(path.items, (items) => {
  if (!items || items.length <= 10) return null;
  return {
    code: 'maxArrayLength',
    message: 'Максимум 10 элементов разрешено',
  };
});
```

### Вложенный объект в массиве

```typescript
// Валидируйте поля внутри вложенных объектов
validateItems(path.items, (itemPath) => {
  required(itemPath.contact.email, { message: 'Email требуется' });
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
