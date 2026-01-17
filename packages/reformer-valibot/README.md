# @reformer/valibot

Valibot schema adapter for [ReFormer](https://github.com/AlexandrBukhtatyy/ReFormer) forms.

[Valibot](https://valibot.dev/) is a lightweight, type-safe schema validation library with a modular design.

## Installation

```bash
npm install @reformer/valibot valibot
# or
pnpm add @reformer/valibot valibot
```

## Usage

```typescript
import { createForm, type FieldPath } from '@reformer/core';
import { valibot, valibotAsync } from '@reformer/valibot';
import * as v from 'valibot';

interface MyForm {
  email: string;
  age: number;
  password: string;
  username: string;
}

const form = createForm<MyForm>({
  form: {
    email: { value: '' },
    age: { value: 0 },
    password: { value: '' },
    username: { value: '' },
  },
  validation: (path) => {
    // Simple validation
    valibot(path.email, v.pipe(v.string(), v.email()));
    valibot(path.age, v.pipe(v.number(), v.minValue(18), v.maxValue(120)));

    // Complex validation
    valibot(path.password, v.pipe(
      v.string(),
      v.minLength(8, 'Password must be at least 8 characters'),
      v.regex(/[A-Z]/, 'Must contain uppercase letter'),
      v.regex(/[0-9]/, 'Must contain a number')
    ));

    // Async validation with debounce
    valibotAsync(
      path.username,
      v.pipeAsync(
        v.string(),
        v.minLength(3),
        v.checkAsync(
          async (val) => !(await checkUsernameExists(val)),
          'Username already taken'
        )
      ),
      { debounce: 500 }
    );
  },
});
```

## API

### `valibot(fieldPath, schema, options?)`

Apply a Valibot schema for synchronous validation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldPath` | `FieldPathNode` | The field path from ReFormer's FieldPath |
| `schema` | `BaseSchema` | The Valibot schema to validate against |
| `options` | `SchemaAdapterOptions` | Optional configuration |

### `valibotAsync(fieldPath, schema, options?)`

Apply a Valibot schema for asynchronous validation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldPath` | `FieldPathNode` | The field path from ReFormer's FieldPath |
| `schema` | `BaseSchema \| BaseSchemaAsync` | The Valibot schema to validate against |
| `options` | `AsyncSchemaAdapterOptions` | Optional configuration (includes `debounce`) |

### Options

```typescript
interface SchemaAdapterOptions {
  // Custom error mapper function
  errorMapper?: (issues: BaseIssue<unknown>[]) => ValidationError;
  // Override the error code
  code?: string;
  // Override the error message
  message?: string;
  // Additional params for the error
  params?: Record<string, unknown>;
}

interface AsyncSchemaAdapterOptions extends SchemaAdapterOptions {
  // Debounce delay in milliseconds
  debounce?: number;
}
```

## Custom Error Handling

```typescript
import { valibot } from '@reformer/valibot';
import * as v from 'valibot';

validation: (path) => {
  // With custom message
  valibot(path.age, v.pipe(v.number(), v.minValue(18)), {
    message: 'You must be at least 18 years old'
  });

  // With custom error code
  valibot(path.email, v.pipe(v.string(), v.email()), {
    code: 'invalid_email_format'
  });

  // With custom error mapper
  valibot(path.password, v.pipe(v.string(), v.minLength(8)), {
    errorMapper: (issues) => ({
      code: 'weak_password',
      message: issues.map(i => i.message).join(', '),
    })
  });
}
```

## Combining with ReFormer Validators

You can use Valibot schemas alongside ReFormer's built-in validators:

```typescript
import { required } from '@reformer/core/validators';
import { valibot } from '@reformer/valibot';
import * as v from 'valibot';

validation: (path) => {
  // ReFormer built-in validator
  required(path.email);

  // Valibot for complex validation
  valibot(path.email, v.pipe(v.string(), v.email()));
}
```

## Why Valibot?

- **Lightweight**: Valibot is significantly smaller than Zod (~1KB vs ~12KB minified)
- **Modular**: Only import what you need, perfect for tree-shaking
- **Type-safe**: Full TypeScript support with inferred types
- **Fast**: Optimized for performance

## License

MIT
