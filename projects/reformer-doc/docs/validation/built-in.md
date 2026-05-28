---
sidebar_position: 2
---

# Built-in Validator Factories

All factories are imported from `@reformer/core/validators`. They return a `Validator<TForm, TField>`
and are passed to the `validate()` operator.

## required

Field must have a non-empty value.

```typescript
import { validate, required } from '@reformer/core/validators';

validate(path.name, required());
// Error: { code: 'required', message: '...' }
```

Empty values: `''`, `null`, `undefined`. For booleans, requires `true`.

## email

Valid email format.

```typescript
import { validate, email } from '@reformer/core/validators';

validate(path.email, email());
// Error: { code: 'email', message: '...' }
```

## minLength / maxLength

String or array length constraints. Skipped for empty values.

```typescript
import { validate, minLength, maxLength } from '@reformer/core/validators';

validate(path.name, minLength(2));
// Error: { code: 'minLength', params: { minLength: 2, actualLength: 1 } }

validate(path.bio, maxLength(500));
// Error: { code: 'maxLength', params: { maxLength: 500, actualLength: 501 } }
```

## min / max

Number value constraints. Skipped for empty values.

```typescript
import { validate, min, max } from '@reformer/core/validators';

validate(path.age, min(18));
// Error: { code: 'min', params: { min: 18, actual: 16 } }

validate(path.quantity, max(100));
// Error: { code: 'max', params: { max: 100, actual: 150 } }
```

## pattern

Match regex pattern.

```typescript
import { validate, pattern } from '@reformer/core/validators';

validate(path.code, pattern(/^[A-Z]+$/));
// Error: { code: 'pattern', params: { pattern: '^[A-Z]+$' } }

// With custom message
validate(path.code, pattern(/^[A-Z]+$/, { message: 'Must be uppercase' }));
```

## url

Valid URL format.

```typescript
import { validate, url } from '@reformer/core/validators';

validate(path.website, url());
validate(path.website, url({ requireProtocol: true }));
validate(path.website, url({ allowedProtocols: ['https'] }));
```

## phone

Valid phone number format.

```typescript
import { validate, phone } from '@reformer/core/validators';

validate(path.phone, phone());
validate(path.phone, phone({ format: 'ru' }));
```

## isNumber

Value must be a finite number (type guard: `typeof === 'number' && !isNaN`).

```typescript
import { validate, isNumber } from '@reformer/core/validators';

validate(path.amount, isNumber());
```

## integer

Number must be an integer. Skips non-numbers (compose with `isNumber` for strict type check).

```typescript
import { validate, integer } from '@reformer/core/validators';

validate(path.count, integer());
```

## multipleOf

Number must be a multiple of the given divisor.

```typescript
import { validate, multipleOf } from '@reformer/core/validators';

validate(path.price, multipleOf(0.01));
validate(path.rating, multipleOf(0.5));
```

## nonNegative

Number must be `>= 0`.

```typescript
import { validate, nonNegative } from '@reformer/core/validators';

validate(path.quantity, nonNegative());
```

## nonZero

Number must not equal zero.

```typescript
import { validate, nonZero } from '@reformer/core/validators';

validate(path.divisor, nonZero());
```

Compose for richer constraints — there is no single `number()` factory anymore:

```typescript
import { validate, isNumber, integer, min, max } from '@reformer/core/validators';

validate(path.percent, isNumber());
validate(path.percent, integer());
validate(path.percent, min(0));
validate(path.percent, max(100));
```

## date

Valid date value with optional constraints.

```typescript
import { validate, date } from '@reformer/core/validators';

validate(path.birthDate, date({ noFuture: true, minAge: 18 }));
validate(path.eventDate, date({ minDate: new Date() }));
```

## notEmpty

Array must not be empty.

```typescript
import { validate, notEmpty } from '@reformer/core/validators';

validate(path.items, notEmpty({ message: 'Add at least one item' }));
```

## Combining Validators

Apply multiple validators to one field. All run, errors are collected:

```typescript
validation: (path) => {
  validate(path.password, required());
  validate(path.password, minLength(8));
  validate(path.password, pattern(/[A-Z]/, { message: 'Must contain uppercase' }));
  validate(path.password, pattern(/[0-9]/, { message: 'Must contain a number' }));
};
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
