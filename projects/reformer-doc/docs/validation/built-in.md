---
sidebar_position: 2
---

# Built-in Validator Factories

All factories are imported from `@reformer/core/validators`. They return a `Validator<TForm, TField>`
and are placed in a schema node's `validators: [...]` array.

## required

Field must have a non-empty value.

```typescript
import { required } from '@reformer/core/validators';

// In a schema field node:
name: { value: model.$.name, validators: [required()] },
// Error: { code: 'required', message: '...' }
```

Empty values: `''`, `null`, `undefined`. For booleans, requires `true`.

## email

Valid email format.

```typescript
import { email } from '@reformer/core/validators';

email: { value: model.$.email, validators: [email()] },
// Error: { code: 'email', message: '...' }
```

## minLength / maxLength

String or array length constraints. Skipped for empty values.

```typescript
import { minLength, maxLength } from '@reformer/core/validators';

name: { value: model.$.name, validators: [minLength(2)] },
// Error: { code: 'minLength', params: { minLength: 2, actualLength: 1 } }

bio: { value: model.$.bio, validators: [maxLength(500)] },
// Error: { code: 'maxLength', params: { maxLength: 500, actualLength: 501 } }
```

## min / max

Number value constraints. Skipped for empty values.

```typescript
import { min, max } from '@reformer/core/validators';

age: { value: model.$.age, validators: [min(18)] },
// Error: { code: 'min', params: { min: 18, actual: 16 } }

quantity: { value: model.$.quantity, validators: [max(100)] },
// Error: { code: 'max', params: { max: 100, actual: 150 } }
```

## pattern

Match regex pattern.

```typescript
import { pattern } from '@reformer/core/validators';

code: { value: model.$.code, validators: [pattern(/^[A-Z]+$/)] },
// Error: { code: 'pattern', params: { pattern: '^[A-Z]+$' } }

// With custom message
code: { value: model.$.code, validators: [pattern(/^[A-Z]+$/, { message: 'Must be uppercase' })] },
```

## url

Valid URL format.

```typescript
import { url } from '@reformer/core/validators';

website: { value: model.$.website, validators: [url()] },

// Options:
// url({ requireProtocol: true })
// url({ allowedProtocols: ['https'] })
```

## phone

Valid phone number format.

```typescript
import { phone } from '@reformer/core/validators';

phone: { value: model.$.phone, validators: [phone()] },

// Options:
// phone({ format: 'ru' })
```

## isNumber

Value must be a finite number (type guard: `typeof === 'number' && !isNaN`).

```typescript
import { isNumber } from '@reformer/core/validators';

amount: { value: model.$.amount, validators: [isNumber()] },
```

## integer

Number must be an integer. Skips non-numbers (compose with `isNumber` for strict type check).

```typescript
import { integer } from '@reformer/core/validators';

count: { value: model.$.count, validators: [integer()] },
```

## multipleOf

Number must be a multiple of the given divisor.

```typescript
import { multipleOf } from '@reformer/core/validators';

price: { value: model.$.price, validators: [multipleOf(0.01)] },
rating: { value: model.$.rating, validators: [multipleOf(0.5)] },
```

## nonNegative

Number must be `>= 0`.

```typescript
import { nonNegative } from '@reformer/core/validators';

quantity: { value: model.$.quantity, validators: [nonNegative()] },
```

## nonZero

Number must not equal zero.

```typescript
import { nonZero } from '@reformer/core/validators';

divisor: { value: model.$.divisor, validators: [nonZero()] },
```

Compose for richer constraints — there is no single `number()` factory anymore:

```typescript
import { isNumber, integer, min, max } from '@reformer/core/validators';

percent: { value: model.$.percent, validators: [isNumber(), integer(), min(0), max(100)] },
```

## date

Valid date value with optional constraints.

```typescript
import { isDate, pastDate, minAge, minDate } from '@reformer/core/validators';

birthDate: { value: model.$.birthDate, validators: [isDate(), pastDate(), minAge(18)] },

eventDate: { value: model.$.eventDate, validators: [isDate(), minDate(new Date())] },
```

## notEmpty

Array must not be empty.

```typescript
import { minLength } from '@reformer/core/validators';

// A non-empty array is expressed as minLength(1) on the array field:
items: { value: model.$.items, validators: [minLength(1, { message: 'Add at least one item' })] },
```

## Combining Validators

Apply multiple validators to one field. All run, errors are collected:

```typescript
import { required, minLength, pattern } from '@reformer/core/validators';

password: {
  value: model.$.password,
  validators: [
    required(),
    minLength(8),
    pattern(/[A-Z]/, { message: 'Must contain uppercase' }),
    pattern(/[0-9]/, { message: 'Must contain a number' }),
  ],
},
```

```typescript
// If password is "abc"
errors: [
  { code: 'minLength', message: 'Min 8 chars', params: { minLength: 8, actualLength: 3 } },
  { code: 'pattern', message: 'Must contain uppercase', params: { pattern: '[A-Z]' } },
  { code: 'pattern', message: 'Must contain a number', params: { pattern: '[0-9]' } },
];
```

## Next Steps

- [Async Validation](/docs/validation/async) — Server-side validation
- [Custom Validators](/docs/validation/custom) — Create your own
