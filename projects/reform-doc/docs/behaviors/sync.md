---
sidebar_position: 4
---

# Field Synchronization

Copy values between fields or keep fields in sync.

## copyFrom

Copy value from source to target field.

```typescript
import { copyFrom } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  copyFrom(path.email, path.username),
]
```

### Example: Same Address

```typescript
const form = new GroupNode({
  schema: {
    billingAddress: new GroupNode({
      schema: {
        street: new FieldNode({ value: '' }),
        city: new FieldNode({ value: '' }),
      },
    }),
    shippingAddress: new GroupNode({
      schema: {
        street: new FieldNode({ value: '' }),
        city: new FieldNode({ value: '' }),
      },
    }),
    sameAsBilling: new FieldNode({ value: false }),
  },
  behaviorSchema: (path, ctx) => [
    // Only copy when checkbox is checked
    copyFrom(
      path.billingAddress.street,
      path.shippingAddress.street,
      { when: () => form.controls.sameAsBilling.value }
    ),
    copyFrom(
      path.billingAddress.city,
      path.shippingAddress.city,
      { when: () => form.controls.sameAsBilling.value }
    ),
  ],
});
```

### Example: Initial Value

```typescript
behaviorSchema: (path, ctx) => [
  // Copy only once, on initial load
  copyFrom(path.defaultEmail, path.email, { once: true }),
]
```

## syncFields

Two-way synchronization between fields.

```typescript
import { syncFields } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  syncFields(path.displayName, path.username),
]
```

When either field changes, the other updates:

```typescript
form.controls.displayName.setValue('john');
form.controls.username.value; // 'john'

form.controls.username.setValue('jane');
form.controls.displayName.value; // 'jane'
```

### Example: Bidirectional Conversion

```typescript
const form = new GroupNode({
  schema: {
    celsius: new FieldNode({ value: 0 }),
    fahrenheit: new FieldNode({ value: 32 }),
  },
  behaviorSchema: (path, ctx) => [
    syncFields(
      path.celsius,
      path.fahrenheit,
      {
        toTarget: (c) => (c * 9/5) + 32,
        toSource: (f) => (f - 32) * 5/9,
      }
    ),
  ],
});

form.controls.celsius.setValue(100);
form.controls.fahrenheit.value; // 212

form.controls.fahrenheit.setValue(68);
form.controls.celsius.value; // 20
```

## Conditional Copy

Copy with transformation:

```typescript
behaviorSchema: (path, ctx) => [
  copyFrom(
    path.firstName,
    path.initials,
    {
      transform: (firstName) => {
        const lastName = form.controls.lastName.value;
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
      },
    }
  ),
]
```

## Array Field Copy

Copy array values:

```typescript
const form = new GroupNode({
  schema: {
    templateEmails: new ArrayNode({
      schema: () => new FieldNode({ value: '' }),
      value: ['admin@example.com', 'support@example.com'],
    }),
    recipientEmails: new ArrayNode({
      schema: () => new FieldNode({ value: '' }),
      value: [],
    }),
    useTemplate: new FieldNode({ value: false }),
  },
  behaviorSchema: (path, ctx) => [
    copyFrom(
      path.templateEmails,
      path.recipientEmails,
      { when: () => form.controls.useTemplate.value }
    ),
  ],
});
```

## Next Steps

- [Watch Behaviors](/docs/behaviors/watch) — Custom reactions to changes
- [Validation](/docs/validation/overview) — Combine with validation
