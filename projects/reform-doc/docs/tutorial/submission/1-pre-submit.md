---
sidebar_position: 1
---

# Pre-Submit Validation

Validating form before submission.

:::info Work in Progress
This section is under development.
:::

## Overview

- `form.validate()`
- `form.markAsTouched()`
- Check `form.valid.value`
- Scroll to first error

## Implementation

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    // Submit form
  }
};
```

## Examples

```typescript
// Coming soon
```
