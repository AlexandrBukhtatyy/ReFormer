---
sidebar_position: 5
---

# Шаг 4: Валидация занятости

Валидация полей занятости и дохода с условными правилами основанными на статусе занятости.

## Что мы валидируем

Шаг 4 содержит поля, связанные с занятостью, с условными требованиями:

| Поле | Правила валидации |
|------|------------------|
| `employmentStatus` | Обязательно |
| `monthlyIncome` | Обязательно, min 10 000 |
| `additionalIncome` | Опционально, min 0 |
| **Для работающих** | |
| `companyName` | Обязательно при работе |
| `companyAddress` | Обязательно при работе |
| `position` | Обязательно при работе |
| `workExperienceTotal` | Опционально, min 0 |
| `workExperienceCurrent` | Обязательно при работе, min 3 месяца |
| **Для самозанятых** | |
| `businessType` | Обязательно при самозанятости |
| `businessInn` | Обязательно при самозанятости, 10 или 12 цифр |
| `businessAddress` | Обязательно при самозанятости |
| `businessExperience` | Обязательно при самозанятости, min 6 месяцев |

## Создание файла валидатора

Создайте файл валидатора для Шага 4:

```bash
touch src/validators/steps/step-4-employment.validators.ts
```

## Реализация

### Базовые поля занятости

Начните с требуемых полей, которые применяются ко всем статусам занятости:

```typescript title="src/validators/steps/step-4-employment.validators.ts"
import { required, min, minLength, requiredWhen, minWhen, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 4: Занятость
 *
 * Валидирует:
 * - Статус занятости (требуется для всех)
 * - Поля дохода (требуются для всех)
 * - Поля занятости (условно требуются)
 * - Поля самозанятости (условно требуются)
 */
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Базовые поля занятости
  // ==========================================

  // Статус занятости (всегда требуется)
  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  // Ежемесячный доход (всегда требуется, минимальный порог)
  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 10000, {
    message: 'Минимальный ежемесячный доход: 10 000',
  });

  // Дополнительный доход (опционален, но не может быть отрицательным если указан)
  min(path.additionalIncome, 0, {
    message: 'Дополнительный доход не может быть отрицательным',
  });
};
```

### Условная валидация: Работающие

Добавьте валидацию для работающих людей:

```typescript title="src/validators/steps/step-4-employment.validators.ts"
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Условно: Поля работающих
  // ==========================================

  // Название компании
  requiredWhen(
    path.companyName,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Название компании обязательно' }
  );

  // Адрес компании
  requiredWhen(
    path.companyAddress,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Адрес компании обязателен' }
  );

  // Должность
  requiredWhen(
    path.position,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Должность обязательна' }
  );

  // Стаж работы на текущем месте (минимум 3 месяца)
  requiredWhen(
    path.workExperienceCurrent,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Стаж работы на текущем месте обязателен' }
  );

  minWhen(
    path.workExperienceCurrent,
    3,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Минимум 3 месяца опыта на текущем месте требуется' }
  );

  // Общий стаж работы (опционален, но не может быть отрицательным)
  minWhen(
    path.workExperienceTotal,
    0,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Общий стаж не может быть отрицательным' }
  );
};
```

### Условная валидация: Самозанятые

Добавьте валидацию для самозанятых людей:

```typescript title="src/validators/steps/step-4-employment.validators.ts"
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Условно: Поля самозанятых
  // ==========================================

  // Тип бизнеса
  requiredWhen(
    path.businessType,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Тип бизнеса обязателен' }
  );

  // ИНН бизнеса (10 или 12 цифр)
  requiredWhen(
    path.businessInn,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'ИНН бизнеса обязателен' }
  );

  // Валидация паттерна только для самозанятых
  // Примечание: Это будет проверено в валидации между шагами с асинхронным валидатором
  pattern(path.businessInn, /^\d{10}$|^\d{12}$/, {
    message: 'ИНН бизнеса должен быть 10 или 12 цифр',
  });

  // Адрес бизнеса
  requiredWhen(
    path.businessAddress,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Адрес бизнеса обязателен' }
  );

  // Опыт в бизнесе (минимум 6 месяцев)
  requiredWhen(
    path.businessExperience,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Опыт в бизнесе обязателен' }
  );

  minWhen(
    path.businessExperience,
    6,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Минимум 6 месяцев опыта в бизнесе требуется' }
  );
};
```

## Полный код

Вот полный валидатор для Шага 4:

```typescript title="src/validators/steps/step-4-employment.validators.ts"
import { required, min, requiredWhen, minWhen, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 4: Занятость
 *
 * Валидирует:
 * - Статус занятости (требуется для всех)
 * - Поля дохода (требуются для всех)
 * - Поля занятости (условно требуются)
 * - Поля самозанятости (условно требуются)
 */
export const step4EmploymentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Базовые поля занятости
  // ==========================================

  required(path.employmentStatus, { message: 'Статус занятости обязателен' });

  required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
  min(path.monthlyIncome, 10000, {
    message: 'Минимальный ежемесячный доход: 10 000',
  });

  min(path.additionalIncome, 0, {
    message: 'Дополнительный доход не может быть отрицательным',
  });

  // ==========================================
  // Условно: Поля работающих
  // ==========================================

  requiredWhen(
    path.companyName,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Название компании обязательно' }
  );

  requiredWhen(
    path.companyAddress,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Адрес компании обязателен' }
  );

  requiredWhen(
    path.position,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Должность обязательна' }
  );

  requiredWhen(
    path.workExperienceCurrent,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Стаж работы на текущем месте обязателен' }
  );

  minWhen(
    path.workExperienceCurrent,
    3,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Минимум 3 месяца опыта на текущем месте требуется' }
  );

  minWhen(
    path.workExperienceTotal,
    0,
    path.employmentStatus,
    (status) => status === 'employed',
    { message: 'Общий стаж не может быть отрицательным' }
  );

  // ==========================================
  // Условно: Поля самозанятых
  // ==========================================

  requiredWhen(
    path.businessType,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Тип бизнеса обязателен' }
  );

  requiredWhen(
    path.businessInn,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'ИНН бизнеса обязателен' }
  );

  pattern(path.businessInn, /^\d{10}$|^\d{12}$/, {
    message: 'ИНН бизнеса должен быть 10 или 12 цифр',
  });

  requiredWhen(
    path.businessAddress,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Адрес бизнеса обязателен' }
  );

  requiredWhen(
    path.businessExperience,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Опыт в бизнесе обязателен' }
  );

  minWhen(
    path.businessExperience,
    6,
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    { message: 'Минимум 6 месяцев опыта в бизнесе требуется' }
  );
};
```

## Как это работает

### Всегда требуемые поля

Эти поля требуются независимо от статуса занятости:

```typescript
required(path.employmentStatus, { message: 'Статус занятости обязателен' });
required(path.monthlyIncome, { message: 'Ежемесячный доход обязателен' });
min(path.monthlyIncome, 10000, { message: 'Минимальный ежемесячный доход: 10 000' });
```

### Условно требуемые поля

Эти поля требуются только для определённых статусов занятости:

```typescript
// Требуется только при работе
requiredWhen(
  path.companyName,
  path.employmentStatus,
  (status) => status === 'employed',
  { message: 'Название компании обязательно' }
);

// Требуется только при самозанятости
requiredWhen(
  path.businessType,
  path.employmentStatus,
  (status) => status === 'selfEmployed',
  { message: 'Тип бизнеса обязателен' }
);
```

### Условные валидаторы min

Минимальные значения, которые применяются только при определённых условиях:

```typescript
minWhen(
  path.workExperienceCurrent,
  3,  // Минимальное значение
  path.employmentStatus,  // Зависимость
  (status) => status === 'employed',  // Условие
  { message: 'Минимум 3 месяца опыта на текущем месте требуется' }
);
```

### Интеграция с Behaviors

Из раздела Behaviors, у нас есть:

```typescript
// Behavior: Показывать поля компании только при работе
showWhen(path.companyName, path.employmentStatus, (status) => status === 'employed');
showWhen(path.companyAddress, path.employmentStatus, (status) => status === 'employed');

// Валидация: Требовать поля компании только при работе
requiredWhen(
  path.companyName,
  path.employmentStatus,
  (status) => status === 'employed',
  { message: 'Название компании обязательно' }
);
```

Идеальное выравнивание! Поля скрываются/показываются и требуются/опциональны в синхронизации.

## Тестирование валидации

Протестируйте эти сценарии:

### Базовые поля (все статусы)
- [ ] Оставьте статус занятости пусто → Ошибка показана
- [ ] Оставьте ежемесячный доход пусто → Ошибка показана
- [ ] Введите ежемесячный доход < 10 000 → Ошибка показана
- [ ] Введите ежемесячный доход >= 10 000 → Ошибки нет
- [ ] Введите отрицательный дополнительный доход → Ошибка показана
- [ ] Оставьте дополнительный доход пусто → Ошибки нет (опционально)

### Статус работающих
- [ ] Выберите "работающих" → Поля компании становятся требуемыми
- [ ] Оставьте название компании пусто → Ошибка показана
- [ ] Оставьте адрес компании пусто → Ошибка показана
- [ ] Оставьте должность пусто → Ошибка показана
- [ ] Оставьте стаж работы пусто → Ошибка показана
- [ ] Введите стаж < 3 месяцев → Ошибка показана
- [ ] Введите стаж >= 3 месяцев → Ошибки нет

### Статус самозанятых
- [ ] Выберите "самозанятых" → Поля бизнеса становятся требуемыми
- [ ] Оставьте тип бизнеса пусто → Ошибка показана
- [ ] Оставьте ИНН бизнеса пусто → Ошибка показана
- [ ] Введите ИНН бизнеса с 9 цифрами → Ошибка показана
- [ ] Введите ИНН бизнеса с 10 цифрами → Ошибки нет
- [ ] Введите ИНН бизнеса с 12 цифрами → Ошибки нет
- [ ] Оставьте адрес бизнеса пусто → Ошибка показана
- [ ] Оставьте опыт бизнеса пусто → Ошибка показана
- [ ] Введите опыт бизнеса < 6 месяцев → Ошибка показана
- [ ] Введите опыт бизнеса >= 6 месяцев → Ошибки нет

### Статус без работы/другой
- [ ] Выберите "без работы" → Только базовые поля требуются
- [ ] Поля компании не требуются
- [ ] Поля бизнеса не требуются
- [ ] Ежемесячный доход все ещё требуется

### Переключение статуса занятости
- [ ] Заполните поля работающих → Переключитесь на "самозанятых" → Ошибки работающих исчезают
- [ ] Заполните поля бизнеса → Переключитесь на "работающих" → Ошибки бизнеса исчезают
- [ ] Переключитесь на "без работы" → Все условные ошибки исчезают

## Значения статуса занятости

Типичные значения статуса занятости:

```typescript
type EmploymentStatus =
  | 'employed'       // Полная занятость
  | 'selfEmployed'   // Самозанятый / предприниматель
  | 'unemployed'     // Без работы
  | 'retired'        // На пенсии
  | 'student';       // Студент
```

Каждый статус может иметь различные требования валидации.

## Ключевые выводы

1. **Всегда требуется** - Некоторые поля требуются независимо от статуса
2. **Условно требуется** - Используйте `requiredWhen()` для полей, специфических для статуса
3. **Условный min** - Используйте `minWhen()` для условных пороговых значений
4. **Работает с Behaviors** - Скрытые поля пропускают валидацию
5. **Бизнес-правила** - Различные минимальные пороги (3 месяца работа, 6 месяцев бизнес)

## Распространённые паттерны

### Требуется для определённого статуса
```typescript
requiredWhen(
  path.field,
  path.employmentStatus,
  (status) => status === 'employed',
  { message: 'Поле требуется' }
);
```

### Минимум когда статус совпадает
```typescript
minWhen(
  path.field,
  minimumValue,
  path.employmentStatus,
  (status) => status === 'employed',
  { message: 'Минимальное значение не достигнуто' }
);
```

### Неотрицательное опциональное поле
```typescript
// Нет required(), просто min(0) чтобы предотвратить отрицательные значения
min(path.additionalIncome, 0, {
  message: 'Не может быть отрицательным',
});
```

## Что дальше?

В следующем разделе мы добавим валидацию для **Шага 5: Дополнительная информация**, включая:
- Валидация массивов (имущество, существующие кредиты, созаёмщики)
- Ограничения длины массива (min/max)
- Валидация отдельных элементов массива
- Валидация вложенных объектов в массивах
- Условные требования массивов

Это продемонстрирует мощные возможности валидации массивов в ReFormer!
