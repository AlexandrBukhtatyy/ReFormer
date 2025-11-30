---
sidebar_position: 2
---

# Built-in Validators

All validators are imported from `reformer/validators`.

## required

Field must have a non-empty value.

```typescript
import { required } from 'reformer/validators';

required(path.name);
// Error: { code: 'required', message: '...' }
```

Empty values: `''`, `null`, `undefined`, `[]`

## email

Valid email format.

```typescript
import { email } from 'reformer/validators';

email(path.email);
// Error: { code: 'email', message: '...' }
```

## minLength / maxLength

String length constraints.

```typescript
import { minLength, maxLength } from 'reformer/validators';

minLength(path.name, 2);
// Error: { code: 'minLength', params: { required: 2, actual: 1 } }

maxLength(path.bio, 500);
// Error: { code: 'maxLength', params: { required: 500, actual: 501 } }
```

## min / max

Number value constraints.

```typescript
import { min, max } from 'reformer/validators';

min(path.age, 18);
// Error: { code: 'min', params: { min: 18, actual: 16 } }

max(path.quantity, 100);
// Error: { code: 'max', params: { max: 100, actual: 150 } }
```

## pattern

Match regex pattern.

```typescript
import { pattern } from 'reformer/validators';

// Only letters
pattern(path.code, /^[A-Z]+$/);
// Error: { code: 'pattern', params: { pattern: '/^[A-Z]+$/' } }

// Custom error key
pattern(path.code, /^[A-Z]+$/, 'uppercase');
// Error: { code: 'uppercase' }
```

## url

Valid URL format.

```typescript
import { url } from 'reformer/validators';

url(path.website);
// Error: { code: 'url', message: '...' }
```

## phone

Valid phone number format.

```typescript
import { phone } from 'reformer/validators';

phone(path.phone);
// Error: { code: 'phone', message: '...' }
```

## number

Must be a valid number.

```typescript
import { number } from 'reformer/validators';

number(path.amount);
// Error: { code: 'number', message: '...' }
```

## date

Valid date value.

```typescript
import { date } from 'reformer/validators';

date(path.birthDate);
// Error: { code: 'date', message: '...' }
```

## Combining Validators

Apply multiple validators to one field:

```typescript
validation: (path) => {
  required(path.password);
  minLength(path.password, 8);
  pattern(path.password, /[A-Z]/, 'uppercase');
  pattern(path.password, /[0-9]/, 'hasNumber');
}
```

All validators run, errors are collected:

```typescript
// If password is "abc"
errors: [
  { code: 'minLength', params: { required: 8, actual: 3 } },
  { code: 'uppercase' },
  { code: 'hasNumber' }
]
```

## Next Steps

- [Async Validation](/docs/validation/async) — Server-side validation
- [Custom Validators](/docs/validation/custom) — Create your own
