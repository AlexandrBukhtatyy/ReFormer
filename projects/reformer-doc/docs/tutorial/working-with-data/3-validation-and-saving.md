---
sidebar_position: 3
---

# Validation and Saving

Checking form validity and submitting data.

## Checking Form Validity

### Method 1: `form.valid` Property

Reactive property that automatically updates when fields change:

```typescript
// Trigger validation
await form.validate();

// Check result
if (form.valid.value) {
  await saveApplication(form.getValue());
} else {
  form.markAsTouched(); // Show errors
}
```

### Method 2: `validateForm(form, schema)` Function

Validation against a specific schema. Used for multi-step forms:

```typescript
import { validateForm } from 'reformer';

// Validate only current step fields
const isValid = await validateForm(form, loanValidation);

if (isValid) {
  goToNextStep();
} else {
  form.markAsTouched();
}
```

## Saving the Form

```typescript
const handleSubmit = async () => {
  await form.validate();

  if (!form.valid.value) {
    form.markAsTouched();
    return;
  }

  const values = form.getValue();
  await saveApplication(values);
};
```

## Key Methods

| Method                        | Purpose                 |
| ----------------------------- | ----------------------- |
| `validate()`                  | Trigger validation      |
| `valid.value`                 | Check validity          |
| `validateForm(form, schema)`  | Validate against schema |
| `markAsTouched()`             | Show errors             |
| `getValue()`                  | Get form values         |
