---
sidebar_position: 4
---

# Шаг 3: Валидация контактной информации

Валидация email, телефона и полей адреса с форматными валидаторами и условными правилами.

## Что мы валидируем

Шаг 3 содержит контактные и адресные поля:

| Поле                             | Правила валидации                            |
| -------------------------------- | -------------------------------------------- |
| `phoneMain`                      | Обязательно, формат телефона                 |
| `phoneAdditional`                | Опционально, формат телефона                 |
| `email`                          | Обязательно, формат email                    |
| `emailAdditional`                | Опционально, формат email                    |
| `registrationAddress.city`       | Обязательно                                  |
| `registrationAddress.street`     | Обязательно                                  |
| `registrationAddress.house`      | Обязательно                                  |
| `registrationAddress.postalCode` | Опционально, 6 цифр                          |
| `residenceAddress.*`             | Обязательно когда `sameAsRegistration` false |

## Создание файла валидатора

Создайте файл валидатора для Шага 3:

```bash
touch src/schemas/validators/steps/step-3-contact-info.validators.ts
```

## Реализация

### Валидация телефона и email

Начните с валидации формата телефона и email:

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
import { required, email, phone, pattern, requiredWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 3: Контактная информация
 *
 * Валидирует:
 * - Номера телефонов (главный и дополнительный)
 * - Адреса email (главный и дополнительный)
 * - Адрес регистрации (всегда обязателен)
 * - Адрес проживания (условно обязателен)
 */
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Номера телефонов
  // ==========================================

  // Главный телефон (обязателен)
  required(path.phoneMain, { message: 'Главный номер телефона обязателен' });
  phone(path.phoneMain, { message: 'Неверный формат телефона' });

  // Дополнительный телефон (опционален, но должен быть валидным если указан)
  phone(path.phoneAdditional, { message: 'Неверный формат телефона' });

  // ==========================================
  // Адреса email
  // ==========================================

  // Главный email (обязателен)
  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  // Дополнительный email (опционален, но должен быть валидным если указан)
  email(path.emailAdditional, { message: 'Неверный формат email' });
};
```

:::tip Форматные валидаторы
Форматные валидаторы как `email()` и `phone()` автоматически пропускают пустые значения. Поэтому мы используем `required()` отдельно для обязательных полей.
:::

### Валидация адреса регистрации

Добавьте валидацию для адреса регистрации (всегда обязателен):

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Адрес регистрации (Всегда обязателен)
  // ==========================================

  required(path.registrationAddress.city, { message: 'Город обязателен' });

  required(path.registrationAddress.street, { message: 'Улица обязательна' });

  required(path.registrationAddress.house, { message: 'Номер дома обязателен' });

  // Квартира опциональна, валидация не требуется

  // Почтовый код (опционален, но должен быть 6 цифр если указан)
  pattern(path.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Почтовый код должен быть 6 цифр',
  });
};
```

### Условная валидация адреса проживания

Добавьте условную валидацию для адреса проживания (требуется только когда отличается от регистрации):

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... предыдущая валидация ...

  // ==========================================
  // Адрес проживания (Условно обязателен)
  // ==========================================

  // Город - обязателен когда sameAsRegistration false
  requiredWhen(path.residenceAddress.city, path.sameAsRegistration, (same) => !same, {
    message: 'Город обязателен',
  });

  // Улица - обязательна когда sameAsRegistration false
  requiredWhen(path.residenceAddress.street, path.sameAsRegistration, (same) => !same, {
    message: 'Улица обязательна',
  });

  // Дом - обязателен когда sameAsRegistration false
  requiredWhen(path.residenceAddress.house, path.sameAsRegistration, (same) => !same, {
    message: 'Номер дома обязателен',
  });

  // Квартира опциональна

  // Почтовый код (опционален, но должен быть 6 цифр если указан)
  pattern(path.residenceAddress.postalCode, /^\d{6}$/, {
    message: 'Почтовый код должен быть 6 цифр',
  });
};
```

## Полный код

Вот полный валидатор для Шага 3:

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
import { required, email, phone, pattern, requiredWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Валидация для Шага 3: Контактная информация
 *
 * Валидирует:
 * - Номера телефонов (главный и дополнительный)
 * - Адреса email (главный и дополнительный)
 * - Адрес регистрации (всегда обязателен)
 * - Адрес проживания (условно обязателен)
 */
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Номера телефонов
  // ==========================================

  required(path.phoneMain, { message: 'Главный номер телефона обязателен' });
  phone(path.phoneMain, { message: 'Неверный формат телефона' });

  phone(path.phoneAdditional, { message: 'Неверный формат телефона' });

  // ==========================================
  // Адреса email
  // ==========================================

  required(path.email, { message: 'Email обязателен' });
  email(path.email, { message: 'Неверный формат email' });

  email(path.emailAdditional, { message: 'Неверный формат email' });

  // ==========================================
  // Адрес регистрации (Всегда обязателен)
  // ==========================================

  required(path.registrationAddress.city, { message: 'Город обязателен' });
  required(path.registrationAddress.street, { message: 'Улица обязательна' });
  required(path.registrationAddress.house, { message: 'Номер дома обязателен' });

  pattern(path.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Почтовый код должен быть 6 цифр',
  });

  // ==========================================
  // Адрес проживания (Условно обязателен)
  // ==========================================

  requiredWhen(path.residenceAddress.city, path.sameAsRegistration, (same) => !same, {
    message: 'Город обязателен',
  });

  requiredWhen(path.residenceAddress.street, path.sameAsRegistration, (same) => !same, {
    message: 'Улица обязательна',
  });

  requiredWhen(path.residenceAddress.house, path.sameAsRegistration, (same) => !same, {
    message: 'Номер дома обязателен',
  });

  pattern(path.residenceAddress.postalCode, /^\d{6}$/, {
    message: 'Почтовый код должен быть 6 цифр',
  });
};
```

## Как это работает

### Валидатор email

```typescript
email(path.email, { message: 'Неверный формат email' });
```

- Встроенная валидация формата email
- Проверяет базовую структуру email: `user@domain.com`
- Пропускает пустые значения (не срабатывает на пустых полях)
- Используйте с `required()` для обязательных полей

### Валидатор телефона

```typescript
phone(path.phoneMain, { message: 'Неверный формат телефона' });
```

- Встроенная валидация формата телефона
- Поддерживает различные форматы:
  - `+7 (999) 123-45-67`
  - `+79991234567`
  - `89991234567`
  - `9991234567`
- Пропускает пустые значения
- Используйте с `required()` для обязательных полей

### Условно обязательно

```typescript
requiredWhen(
  path.residenceAddress.city,
  path.sameAsRegistration, // ← Отслеживайте это поле
  (same) => !same, // ← Условие: требуется когда false
  { message: 'Город обязателен' }
);
```

**Как это работает**:

1. Отслеживает поле `sameAsRegistration`
2. Когда `sameAsRegistration` изменяется, переоценивает условие
3. Если условие возвращает `true`, поле становится обязательным
4. Если условие возвращает `false`, требование удаляется

### Интеграция с Behaviors

Помните из раздела Behaviors:

```typescript
// Behavior: Скрыть адрес проживания когда совпадает с регистрацией
disableWhen(path.residenceAddress, path.sameAsRegistration, (same) => same === true);

// Behavior: Отключить адрес проживания когда совпадает с регистрацией
disableWhen(path.residenceAddress, path.sameAsRegistration, (same) => same === true);

// Валидация: Требовать адрес проживания когда отличается
requiredWhen(
  path.residenceAddress.city,
  path.sameAsRegistration,
  (same) => !same, // Требуется когда НЕ совпадает
  { message: 'Город обязателен' }
);
```

Идеальная синхронизация:

- Когда `sameAsRegistration = true` → Поле **скрыто** и **не требуется**
- Когда `sameAsRegistration = false` → Поле **видимо** и **требуется**

## Тестирование валидации

Протестируйте эти сценарии:

### Валидация телефона

- [ ] Оставьте главный телефон пусто → Ошибка показана
- [ ] Введите неверный формат главного телефона → Ошибка показана
- [ ] Введите валидный главный телефон → Ошибки нет
- [ ] Введите неверный дополнительный телефон → Ошибка показана (хотя опционален)
- [ ] Оставьте дополнительный телефон пусто → Ошибки нет

### Валидация email

- [ ] Оставьте главный email пусто → Ошибка показана
- [ ] Введите неверный формат email (без @) → Ошибка показана
- [ ] Введите неверный формат email (без домена) → Ошибка показана
- [ ] Введите валидный email → Ошибки нет
- [ ] Введите неверный дополнительный email → Ошибка показана (хотя опционален)
- [ ] Оставьте дополнительный email пусто → Ошибки нет

### Адрес регистрации

- [ ] Оставьте город пусто → Ошибка показана
- [ ] Оставьте улицу пусто → Ошибка показана
- [ ] Оставьте дом пусто → Ошибка показана
- [ ] Оставьте квартиру пусто → Ошибки нет (опционально)
- [ ] Введите неверный почтовый код (5 цифр) → Ошибка показана
- [ ] Введите неверный почтовый код (буквы) → Ошибка показана
- [ ] Введите валидный почтовый код (6 цифр) → Ошибки нет
- [ ] Оставьте почтовый код пусто → Ошибки нет (опционально)

### Адрес проживания

- [ ] Отметьте "совпадает с регистрацией" → Поля проживания не требуются
- [ ] Отмените "совпадает с регистрацией" → Поля проживания становятся требуемыми
- [ ] Оставьте город проживания пусто (когда отличается) → Ошибка показана
- [ ] Оставьте улицу проживания пусто (когда отличается) → Ошибка показана
- [ ] Оставьте дом проживания пусто (когда отличается) → Ошибка показана

## Поддерживаемые форматы телефонов

Валидатор `phone()` принимает различные форматы:

```typescript
// Все валидные форматы:
'+7 (999) 123-45-67';
'+79991234567';
'89991234567';
'9991234567';
'+1 (234) 567-8901'; // Международный
```

## Поддерживаемые форматы email

Валидатор `email()` следует стандартному формату email:

```typescript
// Валидные emails:
'user@example.com';
'user.name@example.com';
'user+tag@example.co.uk';
'user_name123@sub.example.org';

// Невалидные emails:
'user@'; // Нет домена
'@example.com'; // Нет пользователя
'user @example.com'; // Пробел в имени пользователя
'user@example'; // Нет TLD
```

## Ключевые выводы

1. **Форматные валидаторы** - Используйте встроенные `email()` и `phone()` для форматов
2. **Отдельно требуемое** - Форматные валидаторы пропускают пустые значения
3. **Условно требуемое** - Используйте `requiredWhen()` для динамических требований
4. **Работает с Behaviors** - Скрытые/отключённые поля пропускают валидацию
5. **Опциональная валидация** - Можно валидировать формат даже когда не требуется

## Распространённые паттерны

### Требуемый email

```typescript
required(path.email, { message: 'Email обязателен' });
email(path.email, { message: 'Неверный формат email' });
```

### Опциональный email (валидирует формат если указан)

```typescript
email(path.emailAdditional, { message: 'Неверный формат email' });
// Нет required() - поле опционально
```

### Русский почтовый код

```typescript
pattern(path.postalCode, /^\d{6}$/, {
  message: 'Почтовый код должен быть 6 цифр',
});
```

## Что дальше?

В следующем разделе мы добавим валидацию для **Шага 4: Занятость**, включая:

- Требуемый статус занятости
- Условную валидацию для работающих vs самозанятых
- Валидацию дохода с минимальными пороговыми значениями
- Валидацию стажа работы
- Валидацию полей, специфических для бизнеса

Мы продолжим использовать паттерны условной валидации, которые выучили здесь!
