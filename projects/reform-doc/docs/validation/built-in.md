---
sidebar_position: 2
---

# Built-in Validators

All validators are imported from `reformer/validators`.

## required

Field must have a non-empty value.

```typescript
import { required } from 'reformer/validators';

validate(path.name, required())
// Error: { required: true }
```

Empty values: `''`, `null`, `undefined`, `[]`

## email

Valid email format.

```typescript
import { email } from 'reformer/validators';

validate(path.email, email())
// Error: { email: true }
```

## minLength / maxLength

String length constraints.

```typescript
import { minLength, maxLength } from 'reformer/validators';

validate(path.name, minLength(2))
// Error: { minLength: { required: 2, actual: 1 } }

validate(path.bio, maxLength(500))
// Error: { maxLength: { required: 500, actual: 501 } }
```

## min / max

Number value constraints.

```typescript
import { min, max } from 'reformer/validators';

validate(path.age, min(18))
// Error: { min: { min: 18, actual: 16 } }

validate(path.quantity, max(100))
// Error: { max: { max: 100, actual: 150 } }
```

## pattern

Match regex pattern.

```typescript
import { pattern } from 'reformer/validators';

// Only letters
validate(path.code, pattern(/^[A-Z]+$/))
// Error: { pattern: { pattern: '/^[A-Z]+$/' } }

// Custom error key
validate(path.code, pattern(/^[A-Z]+$/, 'uppercase'))
// Error: { uppercase: true }
```

## url

Valid URL format.

```typescript
import { url } from 'reformer/validators';

validate(path.website, url())
// Error: { url: true }
```

## phone

Valid phone number format.

```typescript
import { phone } from 'reformer/validators';

validate(path.phone, phone())
// Error: { phone: true }
```

## number

Must be a valid number.

```typescript
import { number } from 'reformer/validators';

validate(path.amount, number())
// Error: { number: true }
```

## date

Valid date value.

```typescript
import { date } from 'reformer/validators';

validate(path.birthDate, date())
// Error: { date: true }
```

## Combining Validators

Apply multiple validators to one field:

```typescript
validate(path.password,
  required(),
  minLength(8),
  pattern(/[A-Z]/, 'uppercase'),
  pattern(/[0-9]/, 'hasNumber')
)
```

All validators run, errors are merged:

```typescript
// If password is "abc"
errors: {
  minLength: { required: 8, actual: 3 },
  uppercase: true,
  hasNumber: true
}
```

## Next Steps

- [Async Validation](/docs/validation/async) — Server-side validation
- [Custom Validators](/docs/validation/custom) — Create your own
