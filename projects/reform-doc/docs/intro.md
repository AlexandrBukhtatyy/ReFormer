---
sidebar_position: 1
slug: /
---

# Introduction

**ReFormer** is a reactive forms library built on [Preact Signals](https://preactjs.com/guide/v10/signals/). It provides a declarative way to build complex forms with validation, computed fields, and conditional logic.

## Key Features

- **Reactive State** — Built on Signals for fine-grained reactivity
- **Type-Safe** — Full TypeScript support with inferred types
- **Declarative Validation** — Built-in validators + custom validation support
- **Behaviors** — Computed fields, conditional visibility, field synchronization
- **Nested Forms** — Support for complex nested structures and dynamic arrays
- **Framework Agnostic** — Core library works anywhere, React bindings included

## Quick Example

```typescript
import { GroupNode, FieldNode } from 'reformer';
import { required, email } from 'reformer/validators';

// Define form structure
const form = new GroupNode({
  schema: {
    name: new FieldNode({ value: '' }),
    email: new FieldNode({ value: '' }),
  },
  validationSchema: (path, { validate }) => [
    validate(path.name, required()),
    validate(path.email, required(), email()),
  ],
});

// React to changes
form.value; // { name: '', email: '' }
form.controls.name.setValue('John');
form.value; // { name: 'John', email: '' }
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| [**Nodes**](/docs/core-concepts/nodes) | Building blocks: `FieldNode`, `GroupNode`, `ArrayNode` |
| [**Validation**](/docs/validation/overview) | Built-in validators and custom validation |
| [**Behaviors**](/docs/behaviors/overview) | Reactive logic: computed fields, conditional visibility |

## Next Steps

- [Installation](/docs/getting-started/installation) — Add ReFormer to your project
- [Quick Start](/docs/getting-started/quick-start) — Build your first form
- [API Reference](/docs/api) — Full API documentation
