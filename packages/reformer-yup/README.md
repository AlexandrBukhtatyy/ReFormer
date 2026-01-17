# @reformer/yup

Yup schema adapter for [ReFormer](https://github.com/AlexandrBukhtatyy/ReFormer) forms.

## Installation

```bash
npm install @reformer/yup yup
# or
pnpm add @reformer/yup yup
```

## Usage

```typescript
import { createForm, type FieldPath } from '@reformer/core';
import { yup, yupAsync } from '@reformer/yup';
import * as y from 'yup';

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
    yup(path.email, y.string().email().required());
    yup(path.age, y.number().min(18).max(120));

    // Complex validation
    yup(path.password, y.string()
      .min(8, 'Password must be at least 8 characters')
      .matches(/[A-Z]/, 'Must contain uppercase letter')
      .matches(/[0-9]/, 'Must contain a number')
    );

    // Async validation with debounce
    yupAsync(
      path.username,
      y.string().min(3).test(
        'unique',
        'Username already taken',
        async (val) => !(await checkUsernameExists(val))
      ),
      { debounce: 500 }
    );
  },
});
```

## API

### `yup(fieldPath, schema, options?)`

Apply a Yup schema for synchronous validation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldPath` | `FieldPathNode` | The field path from ReFormer's FieldPath |
| `schema` | `Schema` | The Yup schema to validate against |
| `options` | `SchemaAdapterOptions` | Optional configuration |

### `yupAsync(fieldPath, schema, options?)`

Apply a Yup schema for asynchronous validation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldPath` | `FieldPathNode` | The field path from ReFormer's FieldPath |
| `schema` | `Schema` | The Yup schema to validate against |
| `options` | `AsyncSchemaAdapterOptions` | Optional configuration (includes `debounce`) |

### Options

```typescript
interface SchemaAdapterOptions {
  // Custom error mapper function
  errorMapper?: (error: YupValidationError) => ValidationError;
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
import { yup } from '@reformer/yup';
import * as y from 'yup';

validation: (path) => {
  // With custom message
  yup(path.age, y.number().min(18), {
    message: 'You must be at least 18 years old'
  });

  // With custom error code
  yup(path.email, y.string().email(), {
    code: 'invalid_email_format'
  });

  // With custom error mapper
  yup(path.password, y.string().min(8), {
    errorMapper: (error) => ({
      code: 'weak_password',
      message: error.message,
    })
  });
}
```

## Combining with ReFormer Validators

You can use Yup schemas alongside ReFormer's built-in validators:

```typescript
import { required } from '@reformer/core/validators';
import { yup } from '@reformer/yup';
import * as y from 'yup';

validation: (path) => {
  // ReFormer built-in validator
  required(path.email);

  // Yup for complex validation
  yup(path.email, y.string().email());
}
```

## License

MIT
