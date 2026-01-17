# @reformer/zod

Zod schema adapter for [ReFormer](https://github.com/AlexandrBukhtatyy/ReFormer) forms.

## Installation

```bash
npm install @reformer/zod zod
# or
pnpm add @reformer/zod zod
```

## Usage

```typescript
import { createForm, type FieldPath } from '@reformer/core';
import { zod, zodAsync } from '@reformer/zod';
import { z } from 'zod';

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
    zod(path.email, z.string().email());
    zod(path.age, z.number().min(18).max(120));

    // Complex validation with refinements
    zod(path.password, z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
    );

    // Async validation with debounce
    zodAsync(
      path.username,
      z.string().min(3).refine(
        async (val) => !(await checkUsernameExists(val)),
        { message: 'Username already taken' }
      ),
      { debounce: 500 }
    );
  },
});
```

## API

### `zod(fieldPath, schema, options?)`

Apply a Zod schema for synchronous validation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldPath` | `FieldPathNode` | The field path from ReFormer's FieldPath |
| `schema` | `ZodType` | The Zod schema to validate against |
| `options` | `SchemaAdapterOptions` | Optional configuration |

### `zodAsync(fieldPath, schema, options?)`

Apply a Zod schema for asynchronous validation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldPath` | `FieldPathNode` | The field path from ReFormer's FieldPath |
| `schema` | `ZodType` | The Zod schema to validate against |
| `options` | `AsyncSchemaAdapterOptions` | Optional configuration (includes `debounce`) |

### Options

```typescript
interface SchemaAdapterOptions {
  // Custom error mapper function
  errorMapper?: (error: ZodError) => ValidationError;
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
import { zod } from '@reformer/zod';
import { z } from 'zod';

validation: (path) => {
  // With custom message
  zod(path.age, z.number().min(18), {
    message: 'You must be at least 18 years old'
  });

  // With custom error code
  zod(path.email, z.string().email(), {
    code: 'invalid_email_format'
  });

  // With custom error mapper
  zod(path.password, z.string().min(8), {
    errorMapper: (error) => ({
      code: 'weak_password',
      message: error.issues.map(i => i.message).join(', '),
    })
  });
}
```

## Combining with ReFormer Validators

You can use Zod schemas alongside ReFormer's built-in validators:

```typescript
import { required } from '@reformer/core/validators';
import { zod } from '@reformer/zod';
import { z } from 'zod';

validation: (path) => {
  // ReFormer built-in validator
  required(path.email);

  // Zod for complex validation
  zod(path.email, z.string().email());
}
```

## License

MIT
