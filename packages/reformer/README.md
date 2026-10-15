# @reformer/core

[![npm version](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![npm downloads](https://img.shields.io/npm/dm/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Reactive form state management on signals: a UI-agnostic core with React bindings in
`@reformer/core/react`.

## Playground

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx)

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Features

- Signals-based reactive state management
- Declarative form validation with typed rules and status results
- Validation issues without text: codes and params, texts from a form dictionary and the locale
- Dynamic form behaviors
- Multi-step flows: step rules, transitions, `submit` with a result object
- TypeScript support
- Tree-shakeable exports; the root entry has no React dependency

## Installation

```bash
npm install @reformer/core@beta # Active development is underway, so you can try beta
```

## Quick Start

A reactive `FormModel` owns the values, a form schema — a tree of nodes — binds field config
(component / props) to the model's handles (`model.$.<field>`), and `createForm` assembles the
model, the form and the form level (`validate`, `submission`, step flow) in one call. Validation is a
**separate** contract — `defineValidation` — so the form schema carries no validators. A rule
reports a code, not a text: the text comes from a form dictionary (`defineIssueMessages`) on top of
the locale.

```tsx
import {
  createForm,
  type FormControl,
  type FormModel,
  type FormSchemaNode,
  type ValidationIssue,
} from '@reformer/core';
import { useFormBundle, useFormControl, useIssueMessage } from '@reformer/core/react';
import { defineIssueMessages } from '@reformer/core/i18n';
import { validate, defineValidation } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

// 1. Form data type — `interface` or `type`, both work
interface RegistrationForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// 2. Issue texts by code — the form dictionary (built-in codes fall back to the locale)
const messages = defineIssueMessages({
  'username.required': 'Enter a username',
  'confirmPassword.mismatch': 'Passwords do not match',
});

// 3. Simple FormField component: the issue text comes from the resolver
function FormField({ label, control }: { label: string; control: FormControl<string> }) {
  const { value, issues, shouldShowError } = useFormControl(control);
  const message = useIssueMessage(messages);

  return (
    <div>
      <label>{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && issues[0] && <span className="error">{message(issues[0])}</span>}
    </div>
  );
}

// 4. Form schema — a tree of nodes. A field node binds field config (component / props)
//    to a model handle (`model: model.$.<field>`); nested nodes live in `children`.
//    The schema carries NO validators; rules live in the validation schema below.
const schema = (model: FormModel<RegistrationForm>): FormSchemaNode => ({
  children: [
    { model: model.$.username, component: 'input' },
    { model: model.$.email, component: 'input' },
    { model: model.$.password, component: 'input' },
    { model: model.$.confirmPassword, component: 'input' },
  ],
});

// 5. Validation schema — a separate contract from `@reformer/core/validation`.
//    Field rules go through `validate(sig, [rules])`; cross-field rules through
//    `cross(sig, snapshot => issue | null)` taken from the schema argument — the snapshot is the
//    model value, its type is inferred. Rule factories come from `@reformer/core/validators`.
const passwordsMatch = (form: RegistrationForm): ValidationIssue | null =>
  form.confirmPassword && form.password && form.confirmPassword !== form.password
    ? { code: 'confirmPassword.mismatch' }
    : null;

const validation = defineValidation<RegistrationForm>(({ model, cross }) => {
  validate(model.$.username, [required({ code: 'username.required' }), minLength(2)]);
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch);
});

// 6. Behavior — declarative reactive logic, run by `createForm({ behavior })`.
//    Validation runs on demand, so the stale cross-field issue on `confirmPassword`
//    is cleared the moment `password` changes.
const behavior = defineFormBehavior<RegistrationForm>(({ model, form }) => {
  onChange(model.$.password, () => {
    form.confirmPassword.clearIssues();
  });
});

// 7. One assembly: model, form, behavior, validation and the form level
const createRegistration = () =>
  createForm<RegistrationForm>({
    initial: { username: '', email: '', password: '', confirmPassword: '' },
    schema,
    behavior,
    validation,
  });

function RegistrationFormExample() {
  // useFormBundle calls the factory exactly once and keeps the bundle stable between renders
  const bundle = useFormBundle(createRegistration);
  const { form } = bundle;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // One run of all the rules (sync + async). Issues land on the form nodes and, on a refusal,
    // the whole form is marked touched; the handler is called only when the status is 'valid'.
    const outcome = await bundle.submission.submit((values) => console.log('Form data:', values));
    if (outcome.status === 'error') console.warn('Could not check the form, try again');
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

Submission is a separate object of the bundle: `bundle.submission.submit(handler)` returns a
`SubmitResult`: `submitted` (with the handler's result), `invalid` / `error` / `cancelled` (with
the validation result; the handler was not called) or `failed` (the handler threw). The handler
receives the whole model, disabled fields included; `bundle.submission.submitting` is `true` while
it runs. Multi-step forms declare their steps in the same call —
`createForm({ flow: { steps: [{ id, rules }] } })` — and navigate with `bundle.flow.next()`.
Outside React, the owner of the bundle releases it with `bundle.dispose()` when the form is no
longer needed: the behavior, the node subscriptions and the live validation stop, the model keeps
its values.

## License

MIT
