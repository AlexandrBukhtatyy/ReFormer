---
sidebar_position: 2
---

# Встроенные валидаторы

Все валидаторы импортируются из `reformer/validators`.

## required

Поле должно иметь непустое значение.

```typescript
import { required } from 'reformer/validators';

validate(path.name, required())
// Ошибка: { required: true }
```

Пустые значения: `''`, `null`, `undefined`, `[]`

## email

Корректный формат email.

```typescript
import { email } from 'reformer/validators';

validate(path.email, email())
// Ошибка: { email: true }
```

## minLength / maxLength

Ограничения длины строки.

```typescript
import { minLength, maxLength } from 'reformer/validators';

validate(path.name, minLength(2))
// Ошибка: { minLength: { required: 2, actual: 1 } }

validate(path.bio, maxLength(500))
// Ошибка: { maxLength: { required: 500, actual: 501 } }
```

## min / max

Ограничения числового значения.

```typescript
import { min, max } from 'reformer/validators';

validate(path.age, min(18))
// Ошибка: { min: { min: 18, actual: 16 } }

validate(path.quantity, max(100))
// Ошибка: { max: { max: 100, actual: 150 } }
```

## pattern

Соответствие регулярному выражению.

```typescript
import { pattern } from 'reformer/validators';

// Только буквы
validate(path.code, pattern(/^[A-Z]+$/))
// Ошибка: { pattern: { pattern: '/^[A-Z]+$/' } }

// Кастомный ключ ошибки
validate(path.code, pattern(/^[A-Z]+$/, 'uppercase'))
// Ошибка: { uppercase: true }
```

## url

Корректный формат URL.

```typescript
import { url } from 'reformer/validators';

validate(path.website, url())
// Ошибка: { url: true }
```

## phone

Корректный формат телефонного номера.

```typescript
import { phone } from 'reformer/validators';

validate(path.phone, phone())
// Ошибка: { phone: true }
```

## number

Должно быть валидным числом.

```typescript
import { number } from 'reformer/validators';

validate(path.amount, number())
// Ошибка: { number: true }
```

## date

Корректное значение даты.

```typescript
import { date } from 'reformer/validators';

validate(path.birthDate, date())
// Ошибка: { date: true }
```

## Комбинирование валидаторов

Применение нескольких валидаторов к одному полю:

```typescript
validate(path.password,
  required(),
  minLength(8),
  pattern(/[A-Z]/, 'uppercase'),
  pattern(/[0-9]/, 'hasNumber')
)
```

Все валидаторы выполняются, ошибки объединяются:

```typescript
// Если пароль "abc"
errors: {
  minLength: { required: 8, actual: 3 },
  uppercase: true,
  hasNumber: true
}
```

## Следующие шаги

- [Асинхронная валидация](/docs/validation/async) — серверная валидация
- [Кастомные валидаторы](/docs/validation/custom) — создание своих валидаторов
