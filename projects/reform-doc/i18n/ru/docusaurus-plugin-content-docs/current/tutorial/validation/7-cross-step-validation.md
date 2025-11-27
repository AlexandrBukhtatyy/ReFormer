---
sidebar_position: 7
---

# Валидация между шагами

Валидация бизнес-правил, охватывающих несколько шагов формы, с пользовательскими и асинхронными валидаторами.

## Что мы валидируем

Валидация между шагами применяет бизнес-правила, которые зависят от полей нескольких шагов:

| Правило | Задействованные поля | Тип валидации |
|--------|-----------------|-----------------|
| Первоначальный платёж >= 20% имущества | Шаг 1: `initialPayment`, `propertyValue` | Пользовательский |
| Ежемесячный платёж <= 50% дохода | Шаг 1: `monthlyPayment`<br/>Шаг 4: `totalIncome`<br/>Шаг 5: `coBorrowersIncome` | Пользовательский |
| Сумма кредита <= цена автомобиля | Шаг 1: `loanAmount`, `carPrice` | Пользовательский |
| Остаток кредита <= оригинальная сумма | Шаг 5: `existingLoans[*].remainingAmount`, `amount` | Пользовательский |
| Валидация возраста 18-70 | Шаг 2: `age` (рассчитано из `birthDate`) | Пользовательский |
| Проверка ИНН | Шаг 2: `inn` | Асинхронный |
| Проверка СНИЛС | Шаг 2: `snils` | Асинхронный |
| Уникальность email | Шаг 3: `email` | Асинхронный |

## Создание файла валидатора

Создайте файл валидатора между шагами:

```bash
touch src/schemas/validators/cross-step.validators.ts
```

## Реализация

### Валидация первоначального платежа

Убедитесь, что первоначальный платёж составляет минимум 20% от стоимости имущества:

```typescript title="src/schemas/validators/cross-step.validators.ts"
import { createValidator, createAsyncValidator } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация между шагами
 *
 * Валидирует бизнес-правила, охватывающие несколько шагов формы:
 * - Первоначальный платёж >= 20% от стоимости имущества
 * - Ежемесячный платёж <= 50% от общего дохода домохозяйства
 * - Сумма кредита <= цена автомобиля
 * - Остаток кредита <= оригинальная сумма кредита
 * - Требования возраста (18-70)
 * - Асинхронно: ИНН, СНИЛС, уникальность email
 */
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Первоначальный платёж >= 20% от имущества
  // ==========================================
  createValidator(
    path.initialPayment,
    [path.propertyValue, path.loanType],
    (initialPayment, [propertyValue, loanType]) => {
      // Валидируйте только для ипотечных кредитов
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
};
```

### Валидация ежемесячного платежа против дохода

Убедитесь, что ежемесячный платёж не превышает 50% от общего дохода домохозяйства:

```typescript title="src/schemas/validators/cross-step.validators.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // 2. Ежемесячный платёж <= 50% дохода
  // ==========================================
  createValidator(
    path.monthlyPayment,
    [path.totalIncome, path.coBorrowersIncome],
    (monthlyPayment, [totalIncome, coBorrowersIncome]) => {
      const householdIncome = (totalIncome as number || 0) + (coBorrowersIncome as number || 0);

      // Нельзя валидировать без информации о доходе
      if (!householdIncome || !monthlyPayment) return null;

      const maxPayment = householdIncome * 0.5;
      if ((monthlyPayment as number) > maxPayment) {
        return {
          type: 'maxPaymentToIncome',
          message: `Ежемесячный платёж превышает 50% дохода домохозяйства (макс: ${maxPayment.toLocaleString()})`,
        };
      }

      return null;
    }
  );
};
```

### Валидация суммы кредита для автокредита

Убедитесь, что сумма кредита не превышает цену автомобиля:

```typescript title="src/schemas/validators/cross-step.validators.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // 3. Сумма кредита <= цена автомобиля
  // ==========================================
  createValidator(
    path.loanAmount,
    [path.carPrice, path.loanType],
    (loanAmount, [carPrice, loanType]) => {
      // Валидируйте только для автокредитов
      if (loanType !== 'car') return null;
      if (!carPrice || !loanAmount) return null;

      if ((loanAmount as number) > (carPrice as number)) {
        return {
          type: 'loanExceedsCarPrice',
          message: 'Сумма кредита не может превышать цену автомобиля',
        };
      }

      return null;
    }
  );
};
```

### Валидация остатка кредита

Валидируйте остаток кредита, чтобы он не превышал оригинальную сумму:

```typescript title="src/schemas/validators/cross-step.validators.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // 4. Остаток кредита <= оригинальная сумма
  // ==========================================
  createValidator(
    path.existingLoans['*'].remainingAmount,
    [path.existingLoans['*'].amount],
    (remaining, [amount]) => {
      if (!remaining || !amount) return null;

      if ((remaining as number) > (amount as number)) {
        return {
          type: 'remainingExceedsAmount',
          message: 'Остаток кредита не может превышать оригинальную сумму',
        };
      }

      return null;
    }
  );
};
```

### Валидация возраста

Валидируйте возраст между 18 и 70:

```typescript title="src/schemas/validators/cross-step.validators.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // 5. Требования возраста (18-70)
  // ==========================================
  createValidator(
    path.age,
    [path.personalData.birthDate],
    (age) => {
      if (!age) return null;

      if ((age as number) < 18) {
        return {
          type: 'minAge',
          message: 'Заявитель должен быть не моложе 18 лет',
        };
      }

      if ((age as number) > 70) {
        return {
          type: 'maxAge',
          message: 'Заявитель должен быть не старше 70 лет',
        };
      }

      return null;
    }
  );
};
```

### Асинхронная валидация: Проверка ИНН

Добавьте асинхронную валидацию для проверки ИНН:

```typescript title="src/schemas/validators/cross-step.validators.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // 6. Асинхронно: Проверка ИНН
  // ==========================================
  createAsyncValidator(
    path.inn,
    async (inn) => {
      // Пропустите если пусто или слишком коротко
      if (!inn || typeof inn !== 'string') return null;
      if (inn.length < 10) return null;

      try {
        // Вызовите серверный API для проверки ИНН
        const response = await fetch(`/api/validate/inn?value=${inn}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            type: 'invalidInn',
            message: result.message || 'Неверный ИНН',
          };
        }

        return null;
      } catch (error) {
        console.error('Ошибка валидации ИНН:', error);
        // Не ломайте валидацию на сетевых ошибках
        return null;
      }
    },
    { debounce: 500 }  // Ждите 500ms после остановки набора текста
  );
};
```

### Асинхронная валидация: Проверка СНИЛС

Добавьте асинхронную валидацию для проверки СНИЛС:

```typescript title="src/schemas/validators/cross-step.validators.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // 7. Асинхронно: Проверка СНИЛС
  // ==========================================
  createAsyncValidator(
    path.snils,
    async (snils) => {
      if (!snils || typeof snils !== 'string') return null;
      if (snils.length < 11) return null;

      try {
        const response = await fetch(`/api/validate/snils?value=${snils}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            type: 'invalidSnils',
            message: result.message || 'Неверный СНИЛС',
          };
        }

        return null;
      } catch (error) {
        console.error('Ошибка валидации СНИЛС:', error);
        return null;
      }
    },
    { debounce: 500 }
  );
};
```

### Асинхронная валидация: Уникальность email

Добавьте асинхронную валидацию для уникальности email:

```typescript title="src/schemas/validators/cross-step.validators.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // 8. Асинхронно: Проверка уникальности email
  // ==========================================
  createAsyncValidator(
    path.email,
    async (email) => {
      if (!email || typeof email !== 'string') return null;

      // Проверьте базовый формат email сначала
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return null;

      try {
        const response = await fetch(
          `/api/validate/email-unique?email=${encodeURIComponent(email)}`
        );
        const result = await response.json();

        if (!result.unique) {
          return {
            type: 'emailNotUnique',
            message: 'Этот email уже зарегистрирован. Используйте другой email или войдите.',
          };
        }

        return null;
      } catch (error) {
        console.error('Ошибка проверки уникальности email:', error);
        return null;
      }
    },
    { debounce: 800 }  // Более длинный debounce для сетевых запросов
  );
};
```

## Полный код

Вот полный валидатор между шагами:

```typescript title="src/schemas/validators/cross-step.validators.ts"
import { createValidator, createAsyncValidator } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация между шагами
 *
 * Валидирует бизнес-правила, охватывающие несколько шагов формы
 */
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Первоначальный платёж >= 20% от имущества
  // ==========================================
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

  // ==========================================
  // 2. Ежемесячный платёж <= 50% дохода
  // ==========================================
  createValidator(
    path.monthlyPayment,
    [path.totalIncome, path.coBorrowersIncome],
    (monthlyPayment, [totalIncome, coBorrowersIncome]) => {
      const householdIncome = (totalIncome as number || 0) + (coBorrowersIncome as number || 0);
      if (!householdIncome || !monthlyPayment) return null;

      const maxPayment = householdIncome * 0.5;
      if ((monthlyPayment as number) > maxPayment) {
        return {
          type: 'maxPaymentToIncome',
          message: `Ежемесячный платёж превышает 50% дохода домохозяйства (макс: ${maxPayment.toLocaleString()})`,
        };
      }

      return null;
    }
  );

  // ==========================================
  // 3. Сумма кредита <= цена автомобиля
  // ==========================================
  createValidator(
    path.loanAmount,
    [path.carPrice, path.loanType],
    (loanAmount, [carPrice, loanType]) => {
      if (loanType !== 'car') return null;
      if (!carPrice || !loanAmount) return null;

      if ((loanAmount as number) > (carPrice as number)) {
        return {
          type: 'loanExceedsCarPrice',
          message: 'Сумма кредита не может превышать цену автомобиля',
        };
      }

      return null;
    }
  );

  // ==========================================
  // 4. Остаток кредита <= оригинальная сумма
  // ==========================================
  createValidator(
    path.existingLoans['*'].remainingAmount,
    [path.existingLoans['*'].amount],
    (remaining, [amount]) => {
      if (!remaining || !amount) return null;

      if ((remaining as number) > (amount as number)) {
        return {
          type: 'remainingExceedsAmount',
          message: 'Остаток кредита не может превышать оригинальную сумму',
        };
      }

      return null;
    }
  );

  // ==========================================
  // 5. Требования возраста (18-70)
  // ==========================================
  createValidator(
    path.age,
    [path.personalData.birthDate],
    (age) => {
      if (!age) return null;

      if ((age as number) < 18) {
        return {
          type: 'minAge',
          message: 'Заявитель должен быть не моложе 18 лет',
        };
      }

      if ((age as number) > 70) {
        return {
          type: 'maxAge',
          message: 'Заявитель должен быть не старше 70 лет',
        };
      }

      return null;
    }
  );

  // ==========================================
  // 6. Асинхронно: Проверка ИНН
  // ==========================================
  createAsyncValidator(
    path.inn,
    async (inn) => {
      if (!inn || typeof inn !== 'string') return null;
      if (inn.length < 10) return null;

      try {
        const response = await fetch(`/api/validate/inn?value=${inn}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            type: 'invalidInn',
            message: result.message || 'Неверный ИНН',
          };
        }

        return null;
      } catch (error) {
        console.error('Ошибка валидации ИНН:', error);
        return null;
      }
    },
    { debounce: 500 }
  );

  // ==========================================
  // 7. Асинхронно: Проверка СНИЛС
  // ==========================================
  createAsyncValidator(
    path.snils,
    async (snils) => {
      if (!snils || typeof snils !== 'string') return null;
      if (snils.length < 11) return null;

      try {
        const response = await fetch(`/api/validate/snils?value=${snils}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            type: 'invalidSnils',
            message: result.message || 'Неверный СНИЛС',
          };
        }

        return null;
      } catch (error) {
        console.error('Ошибка валидации СНИЛС:', error);
        return null;
      }
    },
    { debounce: 500 }
  );

  // ==========================================
  // 8. Асинхронно: Проверка уникальности email
  // ==========================================
  createAsyncValidator(
    path.email,
    async (email) => {
      if (!email || typeof email !== 'string') return null;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return null;

      try {
        const response = await fetch(
          `/api/validate/email-unique?email=${encodeURIComponent(email)}`
        );
        const result = await response.json();

        if (!result.unique) {
          return {
            type: 'emailNotUnique',
            message: 'Этот email уже зарегистрирован. Используйте другой email или войдите.',
          };
        }

        return null;
      } catch (error) {
        console.error('Ошибка проверки уникальности email:', error);
        return null;
      }
    },
    { debounce: 800 }
  );
};
```

## Как это работает

### Пользовательские валидаторы с зависимостями

```typescript
createValidator(
  path.monthlyPayment,  // Поле для валидации
  [path.totalIncome, path.coBorrowersIncome],  // Зависимости
  (monthlyPayment, [totalIncome, coBorrowersIncome]) => {
    // Логика валидации
    // Возвращайте null если валидно
    // Возвращайте { type, message } если невалидно
  }
);
```

**Ключевые моменты**:
- Первый параметр: поле валидации
- Второй параметр: массив зависимостей
- Третий параметр: функция валидации
- Валидатор переиспускается когда любая зависимость изменяется

### Асинхронные валидаторы

```typescript
createAsyncValidator(
  path.inn,  // Поле для валидации
  async (inn) => {
    // Асинхронная логика валидации (можно использовать fetch, promises, и т.д.)
    // Возвращайте null если валидно
    // Возвращайте { type, message } если невалидно
  },
  { debounce: 500 }  // Опции: задержка debounce
);
```

**Ключевые особенности**:
- Можно делать API вызовы, запросы БД, и т.д.
- Debouncing предотвращает чрезмерные запросы
- Показывает состояние загрузки во время валидации
- Сетевые ошибки не должны ломать валидацию (возвращайте null)

### Debouncing

```typescript
{ debounce: 500 }  // Ждите 500ms после остановки набора текста
```

**Почему debounce?**:
- Предотвращает API вызов при каждом нажатии клавиши
- Улучшает пользовательский опыт
- Уменьшает нагрузку на сервер
- Типичные значения: 300-800ms

## Тестирование валидации

Протестируйте эти сценарии:

### Валидация первоначального платежа
- [ ] Выберите тип кредита ипотека
- [ ] Введите стоимость имущества: 5 000 000
- [ ] Введите первоначальный платёж < 1 000 000 (20%) → Ошибка показана
- [ ] Введите первоначальный платёж >= 1 000 000 → Ошибки нет
- [ ] Переключитесь на другой тип кредита → Ошибка исчезает

### Ежемесячный платёж против дохода
- [ ] Введите ежемесячный доход: 100 000
- [ ] Доход созаёмщиков: 50 000 (всего: 150 000)
- [ ] Ежемесячный платёж > 75 000 (50%) → Ошибка показана
- [ ] Ежемесячный платёж <= 75 000 → Ошибки нет
- [ ] Измените доход → Валидация переиспускается

### Сумма кредита на автомобиль
- [ ] Выберите тип кредита автокредит
- [ ] Введите цену автомобиля: 2 000 000
- [ ] Введите сумму кредита > 2 000 000 → Ошибка показана
- [ ] Введите сумму кредита <= 2 000 000 → Ошибки нет

### Остаток кредита
- [ ] Добавьте существующий кредит с суммой: 500 000
- [ ] Введите остаток > 500 000 → Ошибка показана
- [ ] Введите остаток <= 500 000 → Ошибки нет

### Валидация возраста
- [ ] Введите дату рождения которая делает возраст < 18 → Ошибка показана
- [ ] Введите дату рождения которая делает возраст > 70 → Ошибка показана
- [ ] Введите валидный возраст (18-70) → Ошибки нет

### Асинхронная валидация: Проверка ИНН
- [ ] Введите ИНН → Видите индикатор загрузки
- [ ] После 500ms → Сделан API вызов
- [ ] Невалидный ИНН → Ошибка показана с сервера
- [ ] Валидный ИНН → Ошибки нет

### Асинхронная валидация: Уникальность email
- [ ] Введите email → Видите индикатор загрузки
- [ ] После 800ms → Сделан API вызов
- [ ] Email уже зарегистрирован → Ошибка показана
- [ ] Уникальный email → Ошибки нет

## Макеты API ответов

Для тестирования создайте макеты API конечных точек:

```typescript
// /api/validate/inn
{
  valid: true | false,
  message: 'Неверная контрольная сумма ИНН' // Когда невалидно
}

// /api/validate/snils
{
  valid: true | false,
  message: 'Неверный СНИЛС' // Когда невалидно
}

// /api/validate/email-unique
{
  unique: true | false
}
```

## Ключевые выводы

1. **Пользовательские валидаторы** - Создавайте сложные бизнес-правила
2. **Зависимости** - Валидаторы переиспускаются когда зависимости изменяются
3. **Асинхронные валидаторы** - Делайте серверные вызовы валидации
4. **Debouncing** - Уменьшайте ненужные API вызовы
5. **Обработка ошибок** - Грациозно обрабатывайте сетевые ошибки
6. **Типобезопасность** - Полная поддержка TypeScript для всех валидаторов

## Лучшие практики

### 1. Ранние возвраты
```typescript
createValidator(path.field, [path.dependency], (value, [dep]) => {
  // Возвращайте ранее для случаев которые не нуждаются в валидации
  if (!value || !dep) return null;
  if (someCondition) return null;

  // Основная логика валидации
  if (invalid) {
    return { type: 'error', message: 'Сообщение об ошибке' };
  }

  return null;
});
```

### 2. Грациозный асинхронный отказ
```typescript
createAsyncValidator(path.field, async (value) => {
  try {
    // API вызов
  } catch (error) {
    console.error('Ошибка валидации:', error);
    return null;  // Не ломайте на сетевых ошибках
  }
}, { debounce: 500 });
```

### 3. Ясные сообщения об ошибках
```typescript
return {
  type: 'descriptiveErrorType',
  message: 'Ясное, действенное сообщение об ошибке с контекстом',
};
```

## Что дальше?

В финальном разделе мы **объединим все валидаторы** и зарегистрируем их с формой:
- Создадим основной файл валидатора
- Импортируем все валидаторы шагов
- Зарегистрируем с созданием формы
- Протестируем полную валидацию
- Проверим полную структуру файлов

Давайте всё свяжем вместе!
