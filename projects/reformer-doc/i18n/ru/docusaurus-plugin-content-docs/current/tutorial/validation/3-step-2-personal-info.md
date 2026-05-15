---
sidebar_position: 3
---

# Шаг 2: Валидация личной информации

Валидация имён, даты рождения, паспорта, ИНН и СНИЛС с паттернами и пользовательскими валидаторами.

## Что мы валидируем

Шаг 2 содержит личные данные, которые требуют тщательной валидации:

| Поле                      | Правила валидации                              |
| ------------------------- | ---------------------------------------------- |
| `personalData.firstName`  | Обязательно, minLength 2, только кириллица     |
| `personalData.lastName`   | Обязательно, minLength 2, только кириллица     |
| `personalData.middleName` | Опционально, только кириллица                  |
| `personalData.birthDate`  | Обязательно, не в будущем, возраст 18-70       |
| `passportData.series`     | Обязательно, ровно 4 цифры                     |
| `passportData.number`     | Обязательно, ровно 6 цифр                      |
| `passportData.issueDate`  | Обязательно, не в будущем, после даты рождения |
| `passportData.issuedBy`   | Обязательно, minLength 10                      |
| `inn`                     | Обязательно, 10 или 12 цифр                    |
| `snils`                   | Обязательно, ровно 11 цифр                     |

## Создание файла валидатора

Создайте файл валидатора для Шага 2:

```bash
touch src/schemas/validators/personal-info.ts
```

## Реализация

### Валидация имён с паттернами

Валидируйте имена используя паттерн кириллицы:

```typescript title="src/schemas/validators/personal-info.ts"
import { required, minLength, pattern, validate } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
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
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Личные данные: Имена
  // ==========================================

  // Фамилия
  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));
  validate(path.personalData.lastName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.personalData.lastName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  }));

  // Имя
  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(path.personalData.firstName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.personalData.firstName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  }));

  // Отчество (опционально, но должно быть кириллицей если указано)
  validate(path.personalData.middleName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  }));
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

```typescript title="src/schemas/validators/personal-info.ts"
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Дата рождения
  // ==========================================

  validate(path.personalData.birthDate, required({ message: 'Дата рождения обязательна' }));

  // Пользовательская: Не в будущем
  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDate',
        message: 'Дата рождения не может быть в будущем',
      };
    }

    return null;
  });

  // Пользовательская: Возраст между 18 и 70
  validate(path.personalData.birthDate, (birthDate) => {
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
        code: 'underAge',
        message: 'Заявитель должен быть не моложе 18 лет',
      };
    }

    if (age > 70) {
      return {
        code: 'overAge',
        message: 'Заявитель должен быть не старше 70 лет',
      };
    }

    return null;
  });
};
```

### Валидация паспорта

Добавьте валидацию для русского формата паспорта:

```typescript title="src/schemas/validators/personal-info.ts"
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Данные паспорта
  // ==========================================

  // Серия паспорта (4 цифры)
  validate(path.passportData.series, required({ message: 'Серия паспорта обязательна' }));
  validate(path.passportData.series, pattern(/^\d{4}$/, {
    message: 'Серия должна быть ровно 4 цифры',
  }));

  // Номер паспорта (6 цифр)
  validate(path.passportData.number, required({ message: 'Номер паспорта обязателен' }));
  validate(path.passportData.number, pattern(/^\d{6}$/, {
    message: 'Номер должен быть ровно 6 цифр',
  }));

  // Дата выдачи
  validate(path.passportData.issueDate, required({ message: 'Дата выдачи обязательна' }));

  // Пользовательская: Дата выдачи не в будущем
  validate(path.passportData.issueDate, (issueDate) => {
    if (!issueDate) return null;

    const date = new Date(issueDate as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDateIssue',
        message: 'Дата выдачи не может быть в будущем',
      };
    }

    return null;
  });

  // Пользовательская: Дата выдачи должна быть после даты рождения
  validate(path.passportData.issueDate, (issueDate, ctx) => {
    if (!issueDate) return null;

    const birthDate = root.personalData.birthDate.value.value;
    if (!birthDate) return null;

    const issue = new Date(issueDate as string);
    const birth = new Date(birthDate as string);

    if (issue <= birth) {
      return {
        code: 'issueDateBeforeBirth',
        message: 'Дата выдачи должна быть после даты рождения',
      };
    }

    return null;
  });

  // Орган выдачи
  validate(path.passportData.issuedBy, required({ message: 'Орган выдачи обязателен' }));
  validate(path.passportData.issuedBy, minLength(10, { message: 'Минимум 10 символов' }));
};
```

### Валидация ИНН и СНИЛС

Добавьте валидацию для российских идентификационных номеров:

```typescript title="src/schemas/validators/personal-info.ts"
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // ИНН (Индивидуальный номер налогоплательщика)
  // ==========================================

  validate(path.inn, required({ message: 'ИНН обязателен' }));
  validate(path.inn, pattern(/^\d{10}$|^\d{12}$/, {
    message: 'ИНН должен быть 10 или 12 цифр',
  }));

  // ==========================================
  // СНИЛС (Страховой номер)
  // ==========================================

  validate(path.snils, required({ message: 'СНИЛС обязателен' }));
  validate(path.snils, pattern(/^\d{11}$/, {
    message: 'СНИЛС должен быть ровно 11 цифр',
  }));
};
```

## Полный код

Вот полный валидатор для Шага 2:

```typescript title="src/schemas/validators/personal-info.ts"
import { required, minLength, pattern, validate } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
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
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Личные данные: Имена
  // ==========================================

  validate(path.personalData.lastName, required({ message: 'Фамилия обязательна' }));
  validate(path.personalData.lastName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.personalData.lastName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  }));

  validate(path.personalData.firstName, required({ message: 'Имя обязательно' }));
  validate(path.personalData.firstName, minLength(2, { message: 'Минимум 2 символа' }));
  validate(path.personalData.firstName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  }));

  validate(path.personalData.middleName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Используйте только кириллицу',
  }));

  // ==========================================
  // Дата рождения
  // ==========================================

  validate(path.personalData.birthDate, required({ message: 'Дата рождения обязательна' }));

  createValidator(path.personalData.birthDate, [], (birthDate) => {
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
  });

  createValidator(path.personalData.birthDate, [], (birthDate) => {
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
  });

  // ==========================================
  // Данные паспорта
  // ==========================================

  validate(path.passportData.series, required({ message: 'Серия паспорта обязательна' }));
  validate(path.passportData.series, pattern(/^\d{4}$/, {
    message: 'Серия должна быть ровно 4 цифры',
  }));

  validate(path.passportData.number, required({ message: 'Номер паспорта обязателен' }));
  validate(path.passportData.number, pattern(/^\d{6}$/, {
    message: 'Номер должен быть ровно 6 цифр',
  }));

  validate(path.passportData.issueDate, required({ message: 'Дата выдачи обязательна' }));

  createValidator(path.passportData.issueDate, [], (issueDate) => {
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
  });

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

  validate(path.passportData.issuedBy, required({ message: 'Орган выдачи обязателен' }));
  validate(path.passportData.issuedBy, minLength(10, { message: 'Минимум 10 символов' }));

  // ==========================================
  // ИНН и СНИЛС
  // ==========================================

  validate(path.inn, required({ message: 'ИНН обязателен' }));
  validate(path.inn, pattern(/^\d{10}$|^\d{12}$/, {
    message: 'ИНН должен быть 10 или 12 цифр',
  }));

  validate(path.snils, required({ message: 'СНИЛС обязателен' }));
  validate(path.snils, pattern(/^\d{11}$/, {
    message: 'СНИЛС должен быть ровно 11 цифр',
  }));
};
```

## Как это работает

### Валидаторы паттерна

```typescript
validate(path.personalData.firstName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
  message: 'Используйте только кириллицу',
}));
```

- Тестирует значение против регулярного выражения
- Возвращает ошибку если паттерн не совпадает
- Пропускает валидацию для пустых значений (используйте `required` отдельно)

### Пользовательские валидаторы

```typescript
validate(path.personalData.birthDate, (birthDate) => {
  // Логика валидации
  if (/* невалидно */) {
    return { code: 'errorType', message: 'Сообщение об ошибке' };
  }
  return null;  // Валидно
});
```

**Ключевые моменты**:

- Возвращайте `null` для валидных значений
- Возвращайте объект ошибки `{ code, message }` для невалидных значений
- Сначала проверьте наличие значения
- Используйте `ctx` для доступа к другим полям формы

### Пользовательские валидаторы с зависимостями

```typescript
validate(path.passportData.issueDate, (issueDate, ctx) => {
  if (!issueDate) return null;

  // Получите зависимые значения через контекст
  const birthDate = root.personalData.birthDate.value.value;
  if (!birthDate) return null;

  const issue = new Date(issueDate as string);
  const birth = new Date(birthDate as string);

  if (issue <= birth) {
    return {
      code: 'issueDateBeforeBirth',
      message: 'Дата выдачи должна быть после даты рождения',
    };
  }

  return null;
});
```

**Зависимости**:

- Валидатор переиспускается когда изменяется любое поле формы
- Используйте `root` для доступа к другим полям
- Полезна для валидации между полями

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
/^[А-ЯЁа-яё\s-]+$/;
```

### Русская серия/номер паспорта

```typescript
/^\d{4}$/  // Серия: 4 цифры
/^\d{6}$/  // Номер: 6 цифр
```

### ИНН (Индивидуальный номер налогоплательщика)

```typescript
/^\d{10}$|^\d{12}$/; // 10 или 12 цифр
```

### СНИЛС (Страховой номер)

```typescript
/^\d{11}$/; // 11 цифр
```

## Что дальше?

В следующем разделе мы добавим валидацию для **Шага 3: Контактная информация**, включая:

- Валидацию формата email
- Валидацию номера телефона
- Валидацию адреса (обязательные поля)
- Условную валидацию адреса проживания
- Валидацию формата почтового кода

Мы продолжим строить на паттернах, которые выучили здесь!
