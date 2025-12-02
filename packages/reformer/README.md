# @reformer/core

[![npm version](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![npm downloads](https://img.shields.io/npm/dm/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Reactive form state management library for React with signals-based architecture.

## Playground

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx)

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Features

- Signals-based reactive state management
- Declarative form validation
- Dynamic form behaviors
- TypeScript support
- Tree-shakeable exports

## Installation

```bash
npm install @reformer/core
```

## Quick Start

```tsx
import { useMemo } from 'react';
import {
  createForm,
  useFormControl,
  required,
  email,
  validate,
  watchField,
  FieldNode,
} from '@reformer/core';

// 0. Simple FormField component
function FormField({ label, control }: { label: string; control: FieldNode<string> }) {
  const { value, errors } = useFormControl(control);

  return (
    <div>
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {errors.length > 0 && <span className="error">{errors[0].message}</span>}
    </div>
  );
}

// 1. Define form interface
interface RegistrationForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// 2. Form schema
const formSchema = {
  username: { value: '' },
  email: { value: '' },
  password: { value: '' },
  confirmPassword: { value: '' },
};

// 3. Validation schema
validationSchema = (path) => {
  required(path.username);

  required(path.email);
  email(path.email);

  required(path.password);
  required(path.confirmPassword);

  // Cross-field validation: passwords must match
  validate(path.confirmPassword, (value, ctx) => {
    const password = ctx.form.password.value.value;
    if (value && password && value !== password) {
      return { code: 'mismatch', message: 'Passwords do not match' };
    }
    return null;
  });
};

// 4. Behavior schema
behavior = (path) => {
  // Clear confirmPassword when password changes (if not empty)
  watchField(path.password, (_, ctx) => {
    const confirmValue = ctx.form.confirmPassword.value.value;
    if (confirmValue) {
      ctx.form.confirmPassword.setValue('', { emitEvent: false });
    }
  });
};

// 5. Registration form component
function RegistrationFormExample() {
  const form = useMemo(
    () =>
      createForm<RegistrationForm>({
        form: formSchema,
        validation: validationSchema,
        behavior: behaviorSchema,
      }),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.validate();
    if (form.valid.value) {
      console.log('Form data:', form.value.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Username" control={form.username} />
      <FormField label="Email" control={form.email} />
      <FormField label="Password" control={form.password} />
      <FormField label="Confirm Password" control={form.confirmPassword} />
      <button type="submit">Register</button>
    </form>
  );
}
```

## License

MIT
