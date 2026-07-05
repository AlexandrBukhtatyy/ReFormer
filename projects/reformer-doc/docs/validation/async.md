---
sidebar_position: 3
---

# Async Validation

Validate against server or perform expensive checks.

## Basic Async Validator

An async validator is a function returning `Promise<ValidationError | null>`. Place it in a
field's `asyncValidators` array in the schema:

```typescript
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    validators: [required()],
    asyncValidators: [
      async (value: string) => {
        const response = await fetch(`/api/check-username?name=${value}`);
        const { available } = await response.json();

        return available ? null : { code: 'usernameTaken', message: 'Username taken' };
      },
    ],
  },
};

const form = createForm({ model, schema });

// Whole-form validation (sync + async) runs the async validators too:
const { valid, errors } = await validateFormModel(model, schema);
```

## Debouncing

Avoid too many requests with a per-field `debounce` (ms). The async validator only runs after
typing pauses:

```typescript
const schema = {
  username: {
    value: model.$.username,
    component: Input,
    asyncValidators: [
      async (value: string) => {
        const available = await checkUsername(value);
        return available ? null : { code: 'usernameTaken', message: 'Username taken' };
      },
    ],
    debounce: 300, // Wait 300ms after typing stops
  },
};
```

## Loading State

Track async validation in progress with the field's `pending` signal:

```typescript
const username = form.username;

username.pending.value; // true while validating
```

```tsx
import { useFormControl } from '@reformer/core';

function UsernameField() {
  const field = useFormControl(form.username);

  return (
    <div>
      <input value={field.value} onChange={(e) => field.setValue(e.target.value)} />
      {field.pending && <span>Checking...</span>}
      {field.errors.find((e) => e.code === 'usernameTaken') && <span>Username taken</span>}
    </div>
  );
}
```

## Async with Cross-Field Access

Access other fields during async validation via `root`. The third argument is available when
the validator runs through `validateFormModel(model, schema)`:

```typescript
const checkEmail = async (value: string, _scope: unknown, root: { userId: string }) => {
  const userId = root.userId;

  const response = await fetch('/api/check-email', {
    method: 'POST',
    body: JSON.stringify({ email: value, userId }),
  });

  const { valid } = await response.json();
  return valid ? null : { code: 'emailInUse', message: 'Email already in use' };
};

// Inside the form schema:
email: { value: model.$.email, component: Input, asyncValidators: [checkEmail] },

// root is passed when validating the whole form:
await validateFormModel(model, schema);
```

## Combining Sync and Async

Sync validators run first. Async only runs if sync passes:

```typescript
import { required, minLength } from '@reformer/core/validators';

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    // Sync: runs immediately
    validators: [required(), minLength(3)],
    // Async: only runs if sync validators pass
    asyncValidators: [checkUsernameAvailable],
  },
};
```

## Next Steps

- [Custom Validators](/docs/validation/custom) — Create reusable validators
- [Behaviors](/docs/behaviors/overview) — Conditional validation with behaviors
  </content>
