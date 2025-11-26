---
sidebar_position: 3
---

# Шаг 2: Валидация личной информации

Валидация имён, даты рождения, паспорта, ИНН и СНИЛС с паттернами и пользовательскими валидаторами.

## Что мы валидируем

Шаг 2 содержит личные данные, которые требуют тщательной валидации:

| Поле | Правила валидации |
|------|------------------|
| `personalData.firstName` | Обязательно, minLength 2, только кириллица |
| `personalData.lastName` | Обязательно, minLength 2, только кириллица |
| `personalData.middleName` | Опционально, только кириллица |
| `personalData.birthDate` | Обязательно, не в будущем, возраст 18-70 |
| `passportData.series` | Обязательно, ровно 4 цифры |
| `passportData.number` | Обязательно, ровно 6 цифр |
| `passportData.issueDate` | Обязательно, не в будущем, после даты рождения |
| `passportData.issuedBy` | Обязательно, minLength 10 |
| `inn` | Обязательно, 10 или 12 цифр |
| `snils` | Обязательно, ровно 11 цифр |

## Создание файла валидатора

Создайте файл валидатора для Шага 2:

```bash
touch src/validators/steps/step-2-personal-info.validators.ts
```

## Реализация

### Валидация имён с паттернами

Валидируйте имена используя паттерн кириллицы:

```typescript title="src/validators/steps/step-2-personal-info.validators.ts"
import { required, minLength, pattern, createValidator } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 2: Личная информация
 *
 * Валидирует:
 * - Полное имя (только символы кириллицы)
 * - Дата рождения (не в будущем, требования возраста)
 * - Данные паспорта (формат и даты)
 * - ИНН и СНИЛС (российские идентификационные номера)
 */
export const step2PersonalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Личные данные: Имена
  // ==========================================

  // Фамилия
  required(path.personalData.lastName, { message: 'Фамилия обязательна' });
  minLength(path.personalData.lastName, 2, { message: 'Минимум 2 символа' });
  pattern(path.personalData.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  // Имя
  required(path.personalData.firstName, { message: 'Имя обязательно' });
  minLength(path.personalData.firstName, 2, { message: 'Минимум 2 символа' });
  pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  // Отчество (опционально, но должно быть кириллицей если указано)
  pattern(path.personalData.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });
};
```

:::tip Валидация паттерна
Паттерн `/^[А-ЯЁа-яё\s-]+$/` обеспечивает:
- Только буквы кириллицы (А-Я, а-я, Ё, ё)
- Пробелы разрешены (для составных имён типа "Мария Анна")
- Дефисы разрешены (для имён типа "Иван-Павел")
:::

### Валидация даты рождения

Добавьте пользовательскую валидацию для даты рождения:

```typescript title="src/validators/steps/step-2-personal-info.validators.ts"
export const step2PersonalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Дата рождения
  // ==========================================

  required(path.personalData.birthDate, { message: 'Дата рождения обязательна' });

  // Пользовательская: Не в будущем
  createValidator(
    path.personalData.birthDate,
    [],
    (birthDate) => {
      if (!birthDate) return null;

      const date = new Date(birthDate as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date > today) {
        return {
          type: 'futureDate',
          message: 'Дата рождения не может быть в будущем',
        };
      }

      return null;
    }
  );

  // Пользовательская: Возраст между 18 и 70
  createValidator(
    path.personalData.birthDate,
    [],
    (birthDate) => {
      if (!birthDate) return null;

      const date = new Date(birthDate as string);
      const today = new Date();

      let age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age--;
      }

      if (age < 18) {
        return {
          type: 'underAge',
          message: 'Заявитель должен быть не моложе 18 лет',
        };
      }

      if (age > 70) {
        return {
          type: 'overAge',
          message: 'Заявитель должен быть не старше 70 лет',
        };
      }

      return null;
    }
  );
};
```

### Валидация паспорта

Добавьте валидацию для русского формата паспорта:

```typescript title="src/validators/steps/step-2-personal-info.validators.ts"
export const step2PersonalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Данные паспорта
  // ==========================================

  // Серия паспорта (4 цифры)
  required(path.passportData.series, { message: 'Серия паспорта обязательна' });
  pattern(path.passportData.series, /^\d{4}$/, {
    message: 'Серия должна быть ровно 4 цифры',
  });

  // Номер паспорта (6 цифр)
  required(path.passportData.number, { message: 'Номер паспорта обязателен' });
  pattern(path.passportData.number, /^\d{6}$/, {
    message: 'Номер должен быть ровно 6 цифр',
  });

  // Дата выдачи
  required(path.passportData.issueDate, { message: 'Дата выдачи обязательна' });

  // Пользовательская: Дата выдачи не в будущем
  createValidator(
    path.passportData.issueDate,
    [],
    (issueDate) => {
      if (!issueDate) return null;

      const date = new Date(issueDate as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date > today) {
        return {
          type: 'futureDateIssue',
          message: 'Дата выдачи не может быть в будущем',
        };
      }

      return null;
    }
  );

  // Пользовательская: Дата выдачи должна быть после даты рождения
  createValidator(
    path.passportData.issueDate,
    [path.personalData.birthDate],
    (issueDate, [birthDate]) => {
      if (!issueDate || !birthDate) return null;

      const issue = new Date(issueDate as string);
      const birth = new Date(birthDate as string);

      if (issue <= birth) {
        return {
          type: 'issueDateBeforeBirth',
          message: 'Дата выдачи должна быть после даты рождения',
        };
      }

      return null;
    }
  );

  // Орган выдачи
  required(path.passportData.issuedBy, { message: 'Орган выдачи обязателен' });
  minLength(path.passportData.issuedBy, 10, { message: 'Минимум 10 символов' });
};
```

### Валидация ИНН и СНИЛС

Добавьте валидацию для российских идентификационных номеров:

```typescript title="src/validators/steps/step-2-personal-info.validators.ts"
export const step2PersonalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // ИНН (Индивидуальный номер налогоплательщика)
  // ==========================================

  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{10}$|^\d{12}$/, {
    message: 'ИНН должен быть 10 или 12 цифр',
  });

  // ==========================================
  // СНИЛС (Страховой номер)
  // ==========================================

  required(path.snils, { message: 'СНИЛС обязателен' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'СНИЛС должен быть ровно 11 цифр',
  });
};
```

## Полный код

Вот полный валидатор для Шага 2:

```typescript title="src/validators/steps/step-2-personal-info.validators.ts"
import { required, minLength, pattern, createValidator } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 2: Личная информация
 *
 * Валидирует:
 * - Полное имя (только кириллица)
 * - Дата рождения (не в будущем, возраст 18-70)
 * - Данные паспорта (формат и даты)
 * - ИНН и СНИЛС (российские идентификационные номера)
 */
export const step2PersonalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Личные данные: Имена
  // ==========================================

  required(path.personalData.lastName, { message: 'Фамилия обязательна' });
  minLength(path.personalData.lastName, 2, { message: 'Минимум 2 символа' });
  pattern(path.personalData.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  required(path.personalData.firstName, { message: 'Имя обязательно' });
  minLength(path.personalData.firstName, 2, { message: 'Минимум 2 символа' });
  pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  pattern(path.personalData.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  });

  // ==========================================
  // Дата рождения
  // ==========================================

  required(path.personalData.birthDate, { message: 'Дата рождения обязательна' });

  createValidator(
    path.personalData.birthDate,
    [],
    (birthDate) => {
      if (!birthDate) return null;

      const date = new Date(birthDate as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date > today) {
        return {
          type: 'futureDate',
          message: 'Дата рождения не может быть в будущем',
        };
      }

      return null;
    }
  );

  createValidator(
    path.personalData.birthDate,
    [],
    (birthDate) => {
      if (!birthDate) return null;

      const date = new Date(birthDate as string);
      const today = new Date();

      let age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age--;
      }

      if (age < 18) {
        return {
          type: 'underAge',
          message: 'Заявитель должен быть не моложе 18 лет',
        };
      }

      if (age > 70) {
        return {
          type: 'overAge',
          message: 'Заявитель должен быть не старше 70 лет',
        };
      }

      return null;
    }
  );

  // ==========================================
  // Данные паспорта
  // ==========================================

  required(path.passportData.series, { message: 'Серия паспорта обязательна' });
  pattern(path.passportData.series, /^\d{4}$/, {
    message: 'Серия должна быть ровно 4 цифры',
  });

  required(path.passportData.number, { message: 'Номер паспорта обязателен' });
  pattern(path.passportData.number, /^\d{6}$/, {
    message: 'Номер должен быть ровно 6 цифр',
  });

  required(path.passportData.issueDate, { message: 'Дата выдачи обязательна' });

  createValidator(
    path.passportData.issueDate,
    [],
    (issueDate) => {
      if (!issueDate) return null;

      const date = new Date(issueDate as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date > today) {
        return {
          type: 'futureDateIssue',
          message: 'Дата выдачи не может быть в будущем',
        };
      }

      return null;
    }
  );

  createValidator(
    path.passportData.issueDate,
    [path.personalData.birthDate],
    (issueDate, [birthDate]) => {
      if (!issueDate || !birthDate) return null;

      const issue = new Date(issueDate as string);
      const birth = new Date(birthDate as string);

      if (issue <= birth) {
        return {
          type: 'issueDateBeforeBirth',
          message: 'Дата выдачи должна быть после даты рождения',
        };
      }

      return null;
    }
  );

  required(path.passportData.issuedBy, { message: 'Орган выдачи обязателен' });
  minLength(path.passportData.issuedBy, 10, { message: 'Минимум 10 символов' });

  // ==========================================
  // ИНН и СНИЛС
  // ==========================================

  required(path.inn, { message: 'ИНН обязателен' });
  pattern(path.inn, /^\d{10}$|^\d{12}$/, {
    message: 'ИНН должен быть 10 или 12 цифр',
  });

  required(path.snils, { message: 'СНИЛС обязателен' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'СНИЛС должен быть ровно 11 цифр',
  });
};
```

## Как это работает

### Валидаторы паттерна

```typescript
pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
  message: 'Используйте только кириллицу',
});
```

- Тестирует значение против регулярного выражения
- Возвращает ошибку если паттерн не совпадает
- Пропускает валидацию для пустых значений (используйте `required` отдельно)

### Пользовательские валидаторы

```typescript
createValidator(
  path.personalData.birthDate,
  [],  // Зависимости (пусто если нет)
  (birthDate) => {
    // Логика валидации
    if (/* невалидно */) {
      return { type: 'errorType', message: 'Сообщение об ошибке' };
    }
    return null;  // Валидно
  }
);
```

**Ключевые моменты**:
- Возвращайте `null` для валидных значений
- Возвращайте объект ошибки `{ type, message }` для невалидных значений
- Сначала проверьте наличие значения
- Второй параметр - массив зависимостей

### Пользовательские валидаторы с зависимостями

```typescript
createValidator(
  path.passportData.issueDate,
  [path.personalData.birthDate],  // ← Зависит от даты рождения
  (issueDate, [birthDate]) => {  // ← Получает оба значения
    if (!issueDate || !birthDate) return null;

    const issue = new Date(issueDate as string);
    const birth = new Date(birthDate as string);

    if (issue <= birth) {
      return {
        type: 'issueDateBeforeBirth',
        message: 'Дата выдачи должна быть после даты рождения',
      };
    }

    return null;
  }
);
```

**Зависимости**:
- Валидатор переиспускается когда изменяется любая зависимость
- Полезна для валидации между полями
- Получает значения зависимостей в порядке

## Тестирование валидации

Протестируйте эти сценарии:

### Валидация имён
- [ ] Оставьте имя пусто → Ошибка показана
- [ ] Введите имя с < 2 символами → Ошибка показана
- [ ] Введите имя с латинскими буквами → Ошибка показана
- [ ] Введите имя с кириллицей → Ошибки нет
- [ ] Повторите для фамилии

### Валидация даты рождения
- [ ] Оставьте дату рождения пусто → Ошибка показана
- [ ] Введите будущую дату → Ошибка показана
- [ ] Введите дату которая делает возраст < 18 → Ошибка показана
- [ ] Введите дату которая делает возраст > 70 → Ошибка показана
- [ ] Введите валидный возраст (18-70) → Ошибки нет

### Валидация паспорта
- [ ] Оставьте серию пусто → Ошибка показана
- [ ] Введите серию с < 4 цифрами → Ошибка показана
- [ ] Введите серию с > 4 цифрами → Ошибка показана
- [ ] Введите серию с буквами → Ошибка показана
- [ ] Введите ровно 4 цифры → Ошибки нет
- [ ] Повторите для номера паспорта (6 цифр)
- [ ] Введите дату выдачи в будущем → Ошибка показана
- [ ] Введите дату выдачи раньше даты рождения → Ошибка показана

### ИНН и СНИЛС
- [ ] Оставьте ИНН пусто → Ошибка показана
- [ ] Введите ИНН с 9 цифрами → Ошибка показана
- [ ] Введите ИНН с 10 цифрами → Ошибки нет
- [ ] Введите ИНН с 12 цифрами → Ошибки нет
- [ ] Оставьте СНИЛС пусто → Ошибка показана
- [ ] Введите СНИЛС с 10 цифрами → Ошибка показана
- [ ] Введите СНИЛС с 11 цифрами → Ошибки нет

## Ключевые выводы

1. **Валидация паттерна** - Используйте regex для проверки формата (кириллица, цифры)
2. **Пользовательские валидаторы** - Создавайте сложную логику валидации
3. **Зависимости** - Валидируйте поля относительно других полей
4. **Расчёт возраста** - Рассмотрите месяц и день при расчёте возраста
5. **Валидация дат** - Проверьте на будущие даты и логические связи

## Распространённые паттерны

### Имена на кириллице
```typescript
/^[А-ЯЁа-яё\s-]+$/
```

### Русская серия/номер паспорта
```typescript
/^\d{4}$/  // Серия: 4 цифры
/^\d{6}$/  // Номер: 6 цифр
```

### ИНН (Индивидуальный номер налогоплательщика)
```typescript
/^\d{10}$|^\d{12}$/  // 10 или 12 цифр
```

### СНИЛС (Страховой номер)
```typescript
/^\d{11}$/  // 11 цифр
```

## Что дальше?

В следующем разделе мы добавим валидацию для **Шага 3: Контактная информация**, включая:
- Валидацию формата email
- Валидацию номера телефона
- Валидацию адреса (обязательные поля)
- Условную валидацию адреса проживания
- Валидацию формата почтового кода

Мы продолжим строить на паттернах, которые выучили здесь!
