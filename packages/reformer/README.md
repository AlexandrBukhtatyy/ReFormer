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

A reactive `FormModel` owns the values, a form schema — a tree of nodes — binds field config
(component / props) to the model's handles (`model.$.<field>`), and
`createFormFromModel({ model, schema })` wires them into a typed form. Validation is a **separate**
contract — `defineValidationSchema`, run on demand by `validateModel(model, schema)` — so the form
schema carries no validators.

```tsx
import { useMemo } from 'react';
import {
  createModel,
  createFormFromModel,
  useFormControl,
  type FieldNode,
  type FormSchemaNode,
  type ValidationError,
} from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
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

// 3. Form schema — a tree of nodes. A field node binds field config (component / props)
//    to a model handle (`model: model.$.<field>`); nested nodes live in `children`.
//    The schema carries NO validators; rules live in the validation schema below.
const schema: FormSchemaNode = {
  children: [
    { model: model.$.username, component: Input },
    { model: model.$.email, component: Input },
    { model: model.$.password, component: Input },
    { model: model.$.confirmPassword, component: Input },
  ],
};

// 4. Validation schema — a separate contract from `@reformer/core/validation`,
//    run on demand (not reactive). Field rules go through `validate(sig, [rules])`;
//    cross-field rules through `cross(sig, snapshot => error | null)` taken from the schema
//    argument — the snapshot is the model value, its type is inferred. Rule factories
//    (`required()`/…) come from `@reformer/core/validators`.
const passwordsMatch = (form: RegistrationForm): ValidationError | null =>
  form.confirmPassword && form.password && form.confirmPassword !== form.password
    ? { code: 'mismatch', message: 'Passwords do not match' }
    : null;

const validationSchema = defineValidationSchema<RegistrationForm>(({ model, cross }) => {
  validate(model.$.username, [required(), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch);
});

// 5. Behavior — declarative reactive logic, run by `createForm({ behavior })`.
//    Validation runs on demand, so the stale cross-field error on `confirmPassword`
//    is cleared the moment `password` changes — a behavior→validation bridge.
const behavior = defineFormBehavior<RegistrationForm>(({ model, form }) => {
  onChange(model.$.password, () => {
    form.confirmPassword.clearErrors();
  });
});

// 6. Registration form component
function RegistrationFormExample() {
  const form = useMemo(
    () => createFormFromModel<RegistrationForm>({ model, schema, behavior }),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    // Validate the whole model against the validation schema (sync + async) on demand;
    // errors route into the form nodes, so the UI highlights the offending fields.
    // `true` only when nothing blocks: a failed async rule blocks as well.
    const valid = await validateModel(model, validationSchema);
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
