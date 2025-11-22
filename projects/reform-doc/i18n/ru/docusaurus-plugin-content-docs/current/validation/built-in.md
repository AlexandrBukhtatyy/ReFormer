---
sidebar_position: 2
---

# Встроенные валидаторы

Все валидаторы импортируются из `reformer/validators`.

## required

Поле должно иметь непустое значение.

```typescript
import { required } from 'reformer/validators';

required(path.name);
// Ошибка: { code: 'required', message: '...' }
```

Пустые значения: `''`, `null`, `undefined`, `[]`

## email

Корректный формат email.

```typescript
import { email } from 'reformer/validators';

email(path.email);
// Ошибка: { code: 'email', message: '...' }
```

## minLength / maxLength

Ограничения длины строки.

```typescript
import { minLength, maxLength } from 'reformer/validators';

minLength(path.name, 2);
// Ошибка: { code: 'minLength', params: { required: 2, actual: 1 } }

maxLength(path.bio, 500);
// Ошибка: { code: 'maxLength', params: { required: 500, actual: 501 } }
```

## min / max

Ограничения числового значения.

```typescript
import { min, max } from 'reformer/validators';

min(path.age, 18);
// Ошибка: { code: 'min', params: { min: 18, actual: 16 } }

max(path.quantity, 100);
// Ошибка: { code: 'max', params: { max: 100, actual: 150 } }
```

## pattern

Соответствие регулярному выражению.

```typescript
import { pattern } from 'reformer/validators';

// Только буквы
pattern(path.code, /^[A-Z]+$/);
// Ошибка: { code: 'pattern', params: { pattern: '/^[A-Z]+$/' } }

// Кастомный ключ ошибки
pattern(path.code, /^[A-Z]+$/, 'uppercase');
// Ошибка: { code: 'uppercase' }
```

## url

Корректный формат URL.

```typescript
import { url } from 'reformer/validators';

url(path.website);
// Ошибка: { code: 'url', message: '...' }
```

## phone

Корректный формат телефонного номера.

```typescript
import { phone } from 'reformer/validators';

phone(path.phone);
// Ошибка: { code: 'phone', message: '...' }
```

## number

Должно быть валидным числом.

```typescript
import { number } from 'reformer/validators';

number(path.amount);
// Ошибка: { code: 'number', message: '...' }
```

## date

Корректное значение даты.

```typescript
import { date } from 'reformer/validators';

date(path.birthDate);
// Ошибка: { code: 'date', message: '...' }
```

## Комбинирование валидаторов

Применение нескольких валидаторов к одному полю:

```typescript
validation: (path) => {
  required(path.password);
  minLength(path.password, 8);
  pattern(path.password, /[A-Z]/, 'uppercase');
  pattern(path.password, /[0-9]/, 'hasNumber');
}
```

Все валидаторы выполняются, ошибки собираются:

```typescript
// Если пароль "abc"
errors: [
  { code: 'minLength', params: { required: 8, actual: 3 } },
  { code: 'uppercase' },
  { code: 'hasNumber' }
]
```

## Следующие шаги

- [Асинхронная валидация](/docs/validation/async) — серверная валидация
- [Кастомные валидаторы](/docs/validation/custom) — создание своих валидаторов
