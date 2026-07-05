---
sidebar_position: 1
---

# Обзор валидации

ReFormer предоставляет декларативную валидацию со встроенными валидаторами и поддержкой кастомной валидации.

## Базовое использование

Определите валидаторы прямо в узле схемы поля через массив `validators`:

```typescript
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

type ContactForm = { name: string; email: string };

const model = createModel<ContactForm>({ name: '', email: '' });

const schema = {
  name: { value: model.$.name, validators: [required(), minLength(2)] },
  email: { value: model.$.email, validators: [required(), email()] },
};

const form = createForm<ContactForm>({ model, schema });

// Валидация по требованию — ошибки разводятся по полям для отображения:
const result = await validateFormModel(model, schema); // { valid, errors }
```

## Состояние валидации

Реактивное состояние поля читается через `useFormControl` внутри компонентов:

```typescript
import { useFormControl } from '@reformer/core';

function NameField() {
  const { value, errors, valid, shouldShowError } = useFormControl(form.name);
  // errors: ValidationError[] — пустой [] когда поле валидно
  // valid: boolean
  // shouldShowError: true только после того, как поле стало touched
}
```

Валидация всей модели на сабмите — ошибки разводятся обратно по полям:

```typescript
const { valid, errors } = await validateFormModel(model, schema);
```

## Сообщения об ошибках

`errors` поля — это массив объектов `ValidationError` (`{ code, message, params? }`),
пустой когда поле валидно:

```typescript
form.name.errors.value;
// []                                                  — когда валидно
// [{ code: 'required', message: 'Имя обязательно' }]  — когда required не прошёл
// [{ code: 'minLength', message: 'Слишком коротко',
//    params: { minLength: 2, actualLength: 1 } }]     — когда minLength не прошёл
```

## Встроенные валидаторы

| Валидатор                      | Описание                           | Ключ ошибки    |
| ------------------------------ | ---------------------------------- | -------------- |
| `validators: [required()]`     | Поле должно иметь значение         | `required`     |
| `validators: [email()]`        | Корректный формат email            | `email`        |
| `validators: [minLength(n)]`   | Минимальная длина строки           | `minLength`    |
| `validators: [maxLength(n)]`   | Максимальная длина строки          | `maxLength`    |
| `validators: [min(n)]`         | Минимальное числовое значение      | `min`          |
| `validators: [max(n)]`         | Максимальное числовое значение     | `max`          |
| `validators: [pattern(regex)]` | Соответствие регулярному выражению | `pattern`      |
| `validators: [url()]`          | Корректный формат URL              | `url`          |
| `validators: [phone()]`        | Корректный формат телефона         | `phone`        |
| `validators: [isNumber()]`     | Значение — число                   | `isNumber`     |
| `validators: [integer()]`      | Целое число                        | `integer`      |
| `validators: [multipleOf(n)]`  | Кратно n                           | `multipleOf`   |
| `validators: [nonNegative()]`  | `≥ 0`                              | `nonNegative`  |
| `validators: [nonZero()]`      | `≠ 0`                              | `nonZero`      |
| `validators: [isDate()]`       | Корректная дата                    | `date_invalid` |

## Условная валидация

Применять валидацию только при выполнении условия:

```typescript
import { required } from '@reformer/core/validators';

// Branch-узел валидирует children только когда `when` истинно.
// При ложном условии поддерево пропускается, а ошибки его полей очищаются.
const schema = {
  children: [
    {
      when: (_scope, root) => root.contactByPhone === true,
      children: [{ value: model.$.phone, validators: [required()] }],
    },
  ],
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
