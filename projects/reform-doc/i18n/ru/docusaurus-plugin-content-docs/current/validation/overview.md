---
sidebar_position: 1
---

# Обзор валидации

ReFormer предоставляет декларативную валидацию со встроенными валидаторами и поддержкой кастомной валидации.

## Базовое использование

Определите валидацию в `validationSchema`:

```typescript
import { GroupNode, FieldNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

const form = new GroupNode({
  schema: {
    name: new FieldNode({ value: '' }),
    email: new FieldNode({ value: '' }),
  },
  validationSchema: (path, { validate }) => [
    validate(path.name, required(), minLength(2)),
    validate(path.email, required(), email()),
  ],
});
```

## Состояние валидации

```typescript
// Проверка состояния валидации
form.valid;   // true если все поля валидны
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

| Валидатор | Описание | Ключ ошибки |
|-----------|----------|-------------|
| `required()` | Поле должно иметь значение | `required` |
| `email()` | Корректный формат email | `email` |
| `minLength(n)` | Минимальная длина строки | `minLength` |
| `maxLength(n)` | Максимальная длина строки | `maxLength` |
| `min(n)` | Минимальное числовое значение | `min` |
| `max(n)` | Максимальное числовое значение | `max` |
| `pattern(regex)` | Соответствие регулярному выражению | `pattern` |
| `url()` | Корректный формат URL | `url` |
| `phone()` | Корректный формат телефона | `phone` |
| `number()` | Должно быть числом | `number` |
| `date()` | Корректная дата | `date` |

## Условная валидация

Применять валидацию только при выполнении условия:

```typescript
import { applyWhen } from 'reformer/validators';

validationSchema: (path, { validate }) => [
  validate(
    path.phone,
    applyWhen(
      () => form.controls.contactByPhone.value === true,
      required()
    )
  ),
]
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
