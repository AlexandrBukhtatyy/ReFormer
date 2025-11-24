---
sidebar_position: 1
---

# Nodes

Nodes are the building blocks of ReFormer forms. There are three types:

| Node | Purpose | Example |
|------|---------|---------|
| `FieldNode` | Single value (string, number, etc.) | Text input, checkbox |
| `GroupNode` | Object with named fields | Form section, address |
| `ArrayNode` | Dynamic list of items | Phone numbers, addresses |

## FieldNode

The simplest node — holds a single value.

```typescript
import { FieldNode } from 'reformer';

const name = new FieldNode({ value: '' });
const age = new FieldNode({ value: 0 });
const active = new FieldNode({ value: false });

// Get/set value
name.value; // ''
name.setValue('John');
name.value; // 'John'
```

### FieldNode Properties

| Property | Type | Description |
|----------|------|-------------|
| `value` | `T` | Current value |
| `valid` | `boolean` | No validation errors |
| `invalid` | `boolean` | Has validation errors |
| `touched` | `boolean` | User has interacted |
| `dirty` | `boolean` | Value changed from initial |
| `errors` | `Record<string, any>` | Validation errors |
| `disabled` | `boolean` | Field is disabled |
| `visible` | `boolean` | Field is visible |

### FieldNode Methods

| Method | Description |
|--------|-------------|
| `setValue(value)` | Set new value |
| `reset()` | Reset to initial value |
| `markAsTouched()` | Mark as touched |
| `markAsDirty()` | Mark as dirty |
| `disable()` / `enable()` | Toggle disabled state |
| `show()` / `hide()` | Toggle visibility |

## GroupNode

Groups multiple fields into an object.

```typescript
import { GroupNode } from 'reformer';

const form = new GroupNode({
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
    address: {
      street: { value: '' },
      city: { value: '' },
    },
  },
});

// Access controls
form.controls.firstName.setValue('John');
form.controls.address.controls.city.setValue('NYC');

// Get full value
form.value;
// { firstName: 'John', lastName: '', address: { street: '', city: 'NYC' } }
```

### GroupNode Properties

Inherits all FieldNode properties plus:

| Property | Type | Description |
|----------|------|-------------|
| `controls` | `{ [key]: Node }` | Child nodes |

### GroupNode Methods

| Method | Description |
|--------|-------------|
| `markAllAsTouched()` | Mark all children as touched |
| `resetAll()` | Reset all children |

## ArrayNode

Dynamic list of items.

```typescript
import { GroupNode } from 'reformer';

const form = new GroupNode({
  form: {
    phones: [
      { type: { value: 'home' }, number: { value: '123-456' } },
    ],
  },
});

// Access items
form.controls.phones.controls[0].controls.number.value; // '123-456'

// Add item
form.controls.phones.push({ type: 'work', number: '' });

// Remove item
form.controls.phones.removeAt(0);

// Get all values
form.controls.phones.value; // [{ type: 'work', number: '' }]
```

### ArrayNode Methods

| Method | Description |
|--------|-------------|
| `push(value)` | Add item to end |
| `insert(index, value)` | Insert at position |
| `removeAt(index)` | Remove item at position |
| `move(from, to)` | Move item |
| `clear()` | Remove all items |

## Type Inference

ReFormer infers types automatically:

```typescript
const form = new GroupNode({
  form: {
    name: { value: '' },
    age: { value: 0 },
  },
});

// TypeScript knows the types
form.value.name; // string
form.value.age; // number
form.controls.name; // FieldNode<string>
```

## Next Steps

- [Reactive State](/docs/core-concepts/reactive-state) — How reactivity works
- [Validation](/docs/validation/overview) — Add validation rules
