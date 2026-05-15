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
    validate(path.name, required());
    validate(path.name, minLength(2));
    validate(path.email, required());
    validate(path.email, email());
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
| `validate(path.field, required())`       | Поле должно иметь значение         | `required`  |
| `validate(path.field, email())`          | Корректный формат email            | `email`     |
| `validate(path.field, minLength(n))`   | Минимальная длина строки           | `minLength` |
| `validate(path.field, maxLength(n))`   | Максимальная длина строки          | `maxLength` |
| `validate(path.field, min(n))`         | Минимальное числовое значение      | `min`       |
| `validate(path.field, max(n))`         | Максимальное числовое значение     | `max`       |
| `validate(path.field, pattern(regex))` | Соответствие регулярному выражению | `pattern`   |
| `validate(path.field, url())`            | Корректный формат URL              | `url`       |
| `validate(path.field, phone())`          | Корректный формат телефона         | `phone`     |
| `validate(path.field, number())`         | Должно быть числом                 | `number`    |
| `validate(path.field, date())`           | Корректная дата                    | `date`      |

## Условная валидация

Применять валидацию только при выполнении условия:

```typescript
import { applyWhen, validate, required } from '@reformer/core/validators';

validation: (path) => {
  applyWhen(
    path.contactByPhone,
    (value) => value === true,
    (path) => {
      validate(path.phone, required());
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
