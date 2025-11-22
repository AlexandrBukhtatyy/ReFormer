---
sidebar_position: 3
---

# Async Validation

Validate against server or perform expensive checks.

## Basic Async Validator

```typescript
import { GroupNode, FieldNode } from 'reformer';
import { required } from 'reformer/validators';

const form = new GroupNode({
  schema: {
    username: new FieldNode({ value: '' }),
  },
  validationSchema: (path, { validate, validateAsync }) => [
    validate(path.username, required()),
    validateAsync(path.username, async (value) => {
      const response = await fetch(`/api/check-username?name=${value}`);
      const { available } = await response.json();

      if (!available) {
        return { usernameTaken: true };
      }
      return null;
    }),
  ],
});
```

## Debouncing

Avoid too many requests with debounce:

```typescript
validateAsync(
  path.username,
  async (value) => {
    const available = await checkUsername(value);
    return available ? null : { usernameTaken: true };
  },
  { debounce: 300 } // Wait 300ms after typing stops
)
```

## Loading State

Track async validation in progress:

```typescript
const username = form.controls.username;

username.pending; // true while validating
```

```tsx
function UsernameField() {
  const field = useFormControl(form.controls.username);

  return (
    <div>
      <input value={field.value} onChange={...} />
      {field.pending && <span>Checking...</span>}
      {field.errors?.usernameTaken && <span>Username taken</span>}
    </div>
  );
}
```

## Async with Context

Access other fields during async validation:

```typescript
validateAsync(path.email, async (value, context) => {
  const userId = context.root.controls.userId.value;

  const response = await fetch('/api/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: value, userId }),
  });

  const { valid } = await response.json();
  return valid ? null : { emailInUse: true };
})
```

## Combining Sync and Async

Sync validators run first. Async only runs if sync passes:

```typescript
validationSchema: (path, { validate, validateAsync }) => [
  // Sync: runs immediately
  validate(path.username, required(), minLength(3)),

  // Async: only runs if sync validators pass
  validateAsync(path.username, checkUsernameAvailable),
]
```

## Next Steps

- [Custom Validators](/docs/validation/custom) — Create reusable validators
- [Behaviors](/docs/behaviors/overview) — Conditional validation with behaviors
