---
sidebar_position: 2
---

# Встроенные валидаторы

Все валидаторы импортируются из `@reformer/core/validators` и кладутся в массив `validators` узла схемы поля.

## required

Поле должно иметь непустое значение.

```typescript
import { required } from '@reformer/core/validators';

// В узле схемы поля:
name: { value: model.$.name, validators: [required()] },
// Ошибка: { code: 'required', message: '...' }
```

Пустые значения: `''`, `null`, `undefined`, `[]`

## email

Корректный формат email.

```typescript
import { email } from '@reformer/core/validators';

email: { value: model.$.email, validators: [email()] },
// Ошибка: { code: 'email', message: '...' }
```

## minLength / maxLength

Ограничения длины строки.

```typescript
import { minLength, maxLength } from '@reformer/core/validators';

name: { value: model.$.name, validators: [minLength(2)] },
// Ошибка: { code: 'minLength', params: { required: 2, actual: 1 } }

bio: { value: model.$.bio, validators: [maxLength(500)] },
// Ошибка: { code: 'maxLength', params: { required: 500, actual: 501 } }
```

## min / max

Ограничения числового значения.

```typescript
import { min, max } from '@reformer/core/validators';

age: { value: model.$.age, validators: [min(18)] },
// Ошибка: { code: 'min', params: { min: 18, actual: 16 } }

quantity: { value: model.$.quantity, validators: [max(100)] },
// Ошибка: { code: 'max', params: { max: 100, actual: 150 } }
```

## pattern

Соответствие регулярному выражению.

```typescript
import { pattern } from '@reformer/core/validators';

// Только буквы
code: { value: model.$.code, validators: [pattern(/^[A-Z]+$/)] },
// Ошибка: { code: 'pattern', params: { pattern: '/^[A-Z]+$/' } }

// Кастомный ключ ошибки
code: { value: model.$.code, validators: [pattern(/^[A-Z]+$/, { message: 'uppercase' })] },
// Ошибка: { code: 'uppercase' }
```

## url

Корректный формат URL.

```typescript
import { url } from '@reformer/core/validators';

website: { value: model.$.website, validators: [url()] },
// Ошибка: { code: 'url', message: '...' }
```

## phone

Корректный формат телефонного номера.

```typescript
import { phone } from '@reformer/core/validators';

phone: { value: model.$.phone, validators: [phone()] },
// Ошибка: { code: 'phone', message: '...' }
```

## isNumber

Значение — конечное число (type guard: `typeof === 'number' && !isNaN`).

```typescript
import { isNumber } from '@reformer/core/validators';

amount: { value: model.$.amount, validators: [isNumber()] },
```

## integer

Число должно быть целым. Не-числа пропускаются (комбинируйте с `isNumber` для строгой проверки типа).

```typescript
import { integer } from '@reformer/core/validators';

count: { value: model.$.count, validators: [integer()] },
```

## multipleOf

Число должно быть кратно указанному делителю.

```typescript
import { multipleOf } from '@reformer/core/validators';

price: { value: model.$.price, validators: [multipleOf(0.01)] },
rating: { value: model.$.rating, validators: [multipleOf(0.5)] },
```

## nonNegative

Число должно быть `>= 0`.

```typescript
import { nonNegative } from '@reformer/core/validators';

quantity: { value: model.$.quantity, validators: [nonNegative()] },
```

## nonZero

Число не должно равняться нулю.

```typescript
import { nonZero } from '@reformer/core/validators';

divisor: { value: model.$.divisor, validators: [nonZero()] },
```

Композируйте атомарные проверки — единой фабрики `number()` больше нет:

```typescript
import { isNumber, integer, min, max } from '@reformer/core/validators';

percent: { value: model.$.percent, validators: [isNumber(), integer(), min(0), max(100)] },
```

## date

Корректное значение даты.

```typescript
import { isDate } from '@reformer/core/validators';

birthDate: { value: model.$.birthDate, validators: [isDate()] },
// Ошибка: { code: 'date_invalid', message: '...' }
```

## Комбинирование валидаторов

Применение нескольких валидаторов к одному полю:

```typescript
import { required, minLength, pattern } from '@reformer/core/validators';

password: {
  value: model.$.password,
  validators: [
    required(),
    minLength(8),
    pattern(/[A-Z]/, { message: 'uppercase' }),
    pattern(/[0-9]/, { message: 'hasNumber' }),
  ],
},
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
