---
sidebar_position: 3
---

# Async Validation

Validate against server or perform expensive checks.

## Basic Async Validator

```typescript
import { GroupNode } from '@reformer/core';
import { required } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    username: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    required(path.username);

    validateAsync(path.username, async (value) => {
      const response = await fetch(`/api/check-username?name=${value}`);
      const { available } = await response.json();

      if (!available) {
        return { usernameTaken: true };
      }
      return null;
    });
  },
});
```

## Debouncing

Avoid too many requests with debounce:

```typescript
validation: (path, { validateAsync }) => {
  validateAsync(
    path.username,
    async (value) => {
      const available = await checkUsername(value);
      return available ? null : { usernameTaken: true };
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
      {field.errors?.usernameTaken && <span>Username taken</span>}
    </div>
  );
}
```

## Async with Context

Access other fields during async validation:

```typescript
validation: (path, { validateAsync }) => {
  validateAsync(path.email, async (value, ctx) => {
    const userId = ctx.form.userId.value.value;

    const response = await fetch('/api/check-email', {
      method: 'POST',
      body: JSON.stringify({ email: value, userId }),
    });

    const { valid } = await response.json();
    return valid ? null : { emailInUse: true };
  });
};
```

## Combining Sync and Async

Sync validators run first. Async only runs if sync passes:

```typescript
validation: (path, { validateAsync }) => {
  // Sync: runs immediately
  required(path.username);
  minLength(path.username, 3);

  // Async: only runs if sync validators pass
  validateAsync(path.username, checkUsernameAvailable);
};
```

## Next Steps

- [Custom Validators](/docs/validation/custom) — Create reusable validators
- [Behaviors](/docs/behaviors/overview) — Conditional validation with behaviors
