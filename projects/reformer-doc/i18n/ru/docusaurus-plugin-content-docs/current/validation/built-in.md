---
sidebar_position: 2
---

# Встроенные валидаторы

Все валидаторы импортируются из `reformer/validators`.

## required

Поле должно иметь непустое значение.

```typescript
import { required } from '@reformer/core/validators';

validate(path.name, required());
// Ошибка: { code: 'required', message: '...' }
```

Пустые значения: `''`, `null`, `undefined`, `[]`

## email

Корректный формат email.

```typescript
import { email } from '@reformer/core/validators';

validate(path.email, email());
// Ошибка: { code: 'email', message: '...' }
```

## minLength / maxLength

Ограничения длины строки.

```typescript
import { minLength, maxLength } from '@reformer/core/validators';

validate(path.name, minLength(2));
// Ошибка: { code: 'minLength', params: { required: 2, actual: 1 } }

validate(path.bio, maxLength(500));
// Ошибка: { code: 'maxLength', params: { required: 500, actual: 501 } }
```

## min / max

Ограничения числового значения.

```typescript
import { min, max } from '@reformer/core/validators';

validate(path.age, min(18));
// Ошибка: { code: 'min', params: { min: 18, actual: 16 } }

validate(path.quantity, max(100));
// Ошибка: { code: 'max', params: { max: 100, actual: 150 } }
```

## pattern

Соответствие регулярному выражению.

```typescript
import { pattern } from '@reformer/core/validators';

// Только буквы
validate(path.code, pattern(/^[A-Z]+$/));
// Ошибка: { code: 'pattern', params: { pattern: '/^[A-Z]+$/' } }

// Кастомный ключ ошибки
validate(path.code, pattern(/^[A-Z]+$/, { message: 'uppercase' }));
// Ошибка: { code: 'uppercase' }
```

## url

Корректный формат URL.

```typescript
import { url } from '@reformer/core/validators';

validate(path.website, url());
// Ошибка: { code: 'url', message: '...' }
```

## phone

Корректный формат телефонного номера.

```typescript
import { phone } from '@reformer/core/validators';

validate(path.phone, phone());
// Ошибка: { code: 'phone', message: '...' }
```

## isNumber

Значение — конечное число (type guard: `typeof === 'number' && !isNaN`).

```typescript
import { validate, isNumber } from '@reformer/core/validators';

validate(path.amount, isNumber());
```

## integer

Число должно быть целым. Не-числа пропускаются (комбинируйте с `isNumber` для строгой проверки типа).

```typescript
import { validate, integer } from '@reformer/core/validators';

validate(path.count, integer());
```

## multipleOf

Число должно быть кратно указанному делителю.

```typescript
import { validate, multipleOf } from '@reformer/core/validators';

validate(path.price, multipleOf(0.01));
validate(path.rating, multipleOf(0.5));
```

## nonNegative

Число должно быть `>= 0`.

```typescript
import { validate, nonNegative } from '@reformer/core/validators';

validate(path.quantity, nonNegative());
```

## nonZero

Число не должно равняться нулю.

```typescript
import { validate, nonZero } from '@reformer/core/validators';

validate(path.divisor, nonZero());
```

Композируйте атомарные проверки — единой фабрики `number()` больше нет:

```typescript
import { validate, isNumber, integer, min, max } from '@reformer/core/validators';

validate(path.percent, isNumber());
validate(path.percent, integer());
validate(path.percent, min(0));
validate(path.percent, max(100));
```

## date

Корректное значение даты.

```typescript
import { date } from '@reformer/core/validators';

validate(path.birthDate, date());
// Ошибка: { code: 'date', message: '...' }
```

## Комбинирование валидаторов

Применение нескольких валидаторов к одному полю:

```typescript
validation: (path) => {
  validate(path.password, required());
  validate(path.password, minLength(8));
  validate(path.password, pattern(/[A-Z]/, { message: 'uppercase' }));
  validate(path.password, pattern(/[0-9]/, { message: 'hasNumber' }));
};
```

Все валидаторы выполняются, ошибки собираются:

```typescript
// Если пароль "abc"
errors: [
  { code: 'minLength', params: { required: 8, actual: 3 } },
  { code: 'uppercase' },
  { code: 'hasNumber' },
];
```

## Следующие шаги

- [Асинхронная валидация](/docs/validation/async) — серверная валидация
- [Кастомные валидаторы](/docs/validation/custom) — создание своих валидаторов
