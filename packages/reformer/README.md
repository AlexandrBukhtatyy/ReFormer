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
npm install @reformer/core@beta # Active development is underway, so you can try beta
```

## Quick Start

ReFormer is built around the **M1 architecture**: a reactive `FormModel` owns the values, a single
schema binds field config (component / validators) to the model's signals, and `createForm({ model, schema })`
wires them into a typed form.

```tsx
import { useMemo } from 'react';
import {
  createModel,
  createForm,
  validateFormModel,
  useFormControl,
  type FieldNode,
} from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

// 0. Simple FormField component
function FormField({ label, control }: { label: string; control: FieldNode<string> }) {
  const { value, errors, shouldShowError } = useFormControl(control);

  return (
    <div>
      <label>{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && <span className="error">{errors[0].message}</span>}
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

// 2. Reactive model — the source of truth for values
const model = createModel<RegistrationForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
});

// 3. Single schema — binds field config to model signals (`model.$.<field>`).
//    Validators are inline factories from `@reformer/core/validators`.
//    Cross-field validation is a ModelValidator `(value, model) => error | null`.
const schema = {
  children: [
    { value: model.$.username, component: Input, validators: [required(), minLength(2)] },
    { value: model.$.email, component: Input, validators: [required(), email()] },
    { value: model.$.password, component: Input, validators: [required(), minLength(8)] },
    {
      value: model.$.confirmPassword,
      component: Input,
      validators: [
        required(),
        (value, m) =>
          value && m.password && value !== m.password
            ? { code: 'mismatch', message: 'Passwords do not match' }
            : null,
      ],
    },
  ],
};

// 4. Behavior — declarative reactive logic, run by `createForm({ behavior })`.
//    Clear confirmPassword whenever password changes.
const behavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  onChange(model.$.password, () => {
    if (model.confirmPassword) model.confirmPassword = '';
  });
});

// 5. Registration form component
function RegistrationFormExample() {
  const form = useMemo(() => createForm<RegistrationForm>({ model, schema, behavior }), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.touchAll();
    // Validate the whole model against the schema (sync + async); errors route into the form.
    const { valid } = await validateFormModel(model, schema);
    if (valid) {
      console.log('Form data:', model.get());
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
