---
sidebar_position: 1
---

# Обзор валидации

ReFormer предоставляет декларативную валидацию со встроенными валидаторами и поддержкой кастомной валидации.

## Базовое использование

Определите валидацию в `validation`:

```typescript
import { GroupNode } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
  validation: (path) => {
    required(path.name);
    minLength(path.name, 2);
    required(path.email);
    email(path.email);
  },
});
```

## Состояние валидации

```typescript
// Проверка состояния валидации
form.valid; // true если все поля валидны
form.invalid; // true если есть невалидные поля

// Проверка конкретного поля
form.controls.name.valid;
form.controls.name.errors; // { required: true } или null
```

## Сообщения об ошибках

Доступ к ошибкам отдельных полей:

```typescript
const name = form.controls.name;

name.errors;
// null - когда валидно
// { required: true } - когда required не прошёл
// { minLength: { required: 2, actual: 1 } } - когда minLength не прошёл
```

## Встроенные валидаторы

| Валидатор                    | Описание                           | Ключ ошибки |
| ---------------------------- | ---------------------------------- | ----------- |
| `required(path.field)`       | Поле должно иметь значение         | `required`  |
| `email(path.field)`          | Корректный формат email            | `email`     |
| `minLength(path.field, n)`   | Минимальная длина строки           | `minLength` |
| `maxLength(path.field, n)`   | Максимальная длина строки          | `maxLength` |
| `min(path.field, n)`         | Минимальное числовое значение      | `min`       |
| `max(path.field, n)`         | Максимальное числовое значение     | `max`       |
| `pattern(path.field, regex)` | Соответствие регулярному выражению | `pattern`   |
| `url(path.field)`            | Корректный формат URL              | `url`       |
| `phone(path.field)`          | Корректный формат телефона         | `phone`     |
| `number(path.field)`         | Должно быть числом                 | `number`    |
| `date(path.field)`           | Корректная дата                    | `date`      |

## Условная валидация

Применять валидацию только при выполнении условия:

```typescript
import { when } from '@reformer/core/validators';

validation: (path) => {
  when(
    () => form.controls.contactByPhone.value === true,
    (path) => {
      required(path.phone);
    }
  );
};
```

## Время валидации

Валидация запускается автоматически когда:

- Изменяется значение
- Поле помечается как touched (для отображения)

```typescript
// Ручная валидация
form.validate(); // Валидировать всю форму
```

## Следующие шаги

- [Встроенные валидаторы](/docs/validation/built-in) — все валидаторы с примерами
- [Асинхронная валидация](/docs/validation/async) — серверная валидация
- [Кастомные валидаторы](/docs/validation/custom) — создание своих валидаторов
