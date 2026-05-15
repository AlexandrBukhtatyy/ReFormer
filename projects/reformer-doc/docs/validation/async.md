---
sidebar_position: 3
---

# Async Validation

Validate against server or perform expensive checks.

## Basic Async Validator

`validateAsync` is an operator imported from `@reformer/core/validators`. The validator's
signature is `(value, control, root) => Promise<ValidationError | null>`.

```typescript
import { GroupNode } from '@reformer/core';
import { validate, validateAsync, required } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    username: { value: '' },
  },
  validation: (path) => {
    validate(path.username, required());

    validateAsync(path.username, async (value) => {
      const response = await fetch(`/api/check-username?name=${value}`);
      const { available } = await response.json();

      if (!available) {
        return { code: 'usernameTaken', message: 'Username taken' };
      }
      return null;
    });
  },
});
```

## Debouncing

Avoid too many requests with debounce:

```typescript
validation: (path) => {
  validateAsync(
    path.username,
    async (value) => {
      const available = await checkUsername(value as string);
      return available ? null : { code: 'usernameTaken', message: 'Username taken' };
    },
    { debounce: 300 } // Wait 300ms after typing stops
  );
};
```

## Loading State

Track async validation in progress:

```typescript
const username = form.controls.username;

username.pending.value; // true while validating
```

```tsx
function UsernameField() {
  const field = useFormControl(form.controls.username);

  return (
    <div>
      <input value={field.value} onChange={(e) => field.setValue(e.target.value)} />
      {field.pending && <span>Checking...</span>}
      {field.errors?.find((e) => e.code === 'usernameTaken') && <span>Username taken</span>}
    </div>
  );
}
```

## Async with Cross-Field Access

Access other fields during async validation via `root`:

```typescript
validation: (path) => {
  validateAsync(path.email, async (value, _control, root) => {
    const userId = root.userId.value.value;

    const response = await fetch('/api/check-email', {
      method: 'POST',
      body: JSON.stringify({ email: value, userId }),
    });

    const { valid } = await response.json();
    return valid ? null : { code: 'emailInUse', message: 'Email already in use' };
  });
};
```

## Combining Sync and Async

Sync validators run first. Async only runs if sync passes:

```typescript
validation: (path) => {
  // Sync: runs immediately
  validate(path.username, required());
  validate(path.username, minLength(3));

  // Async: only runs if sync validators pass
  validateAsync(path.username, checkUsernameAvailable);
};
```

## Next Steps

- [Custom Validators](/docs/validation/custom) — Create reusable validators
- [Behaviors](/docs/behaviors/overview) — Conditional validation with behaviors
