# @reformer/renderer-react

React renderer for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core). Turns the bundle
built by `createForm` (model + form + compiled schema) into a React tree, wiring each field to its
component and routing validation state into the UI.

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Features

- Renders a ReFormer form from a declarative schema — one tree of nodes bound to the model with `model: model.$.field`
- Renders by the compiled schema (`bundle.render.tree`): field, array of sub-forms, sub-form (`part`), container, text; a container without `component` renders only its children
- The schema carries **layout only** — field rules live in a separate `ValidationDefinition` over the model, wired into `createForm` via `validation` and `flow` (see [Validation](#validation))
- Node rules (`hideWhen`, `onComponentEvent`, `renderEffect`, `onMount`, …) are written in the form behavior (`defineFormBehavior(({ model, form, schema, flow }) => …)`) and executed by the renderer
- Reactive: fields update from the model's signals with no manual wiring
- Pluggable field wrapper (label + control + error) via `settings.fieldWrapper`
- Binds each field itself: the value-based seam (`value` + `onChange(value)`) is translated into the control's own dialect (`checked` + `onChange(event)`, `value` + `onChange(value, option)`) by the component's `reformerAdapter` static (declared by `@reformer/ui-kit` components) — put the component itself into `component`, no per-control wrapper needed; **raw third-party controls** without the static (Checkbox, Select, Radio…) are adapted via `settings.resolveFieldAdapter`
- TypeScript support, tree-shakable exports

## Installation

```bash
npm install @reformer/renderer-react @reformer/core
```

## Quick Start

```tsx
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer, type RenderNode } from '@reformer/renderer-react';
import { FormField, Input } from '@reformer/ui-kit';

interface MyForm {
  email: string;
}

// Schema builder: called once by createForm with the model.
const mySchema = (model: FormModel<MyForm>): RenderNode<MyForm> => ({
  component: 'div',
  children: [{ model: model.$.email, component: Input, componentProps: { label: 'Email' } }],
});

export function MyFormPage() {
  // One call builds the model, the form, the compiled schema and the form level
  // (validate / submission / step flow). useFormBundle keeps the bundle stable between renders.
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ initial: { email: '' }, schema: mySchema })
  );

  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}
```

`createReactForm` / `useReactForm` and `createRenderSchema` remain available as the previous and the
low-level paths.

## Validation

A schema node describes **layout only** — none of the node kinds (field, array, part, container) has a
`validators` field, so `validators: [...]` on a leaf is a type error. Field validation is expressed once
as a plain `ValidationDefinition` over the `FormModel` (the same `@reformer/core/validation` contract
that hand-written forms use), so layout and rules stay independent and one validation covers every
render target (React, JSON, hand-written JSX).

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineIssueMessages } from '@reformer/core/i18n';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';

// Rules over the model — `model.$.path` is the field handle. A rule carries a code, not a text.
const rules = defineValidation<MyForm>(({ model }) => {
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
});

// Texts by code — the form dictionary (falls back to the locale dictionary, then to the code).
const messages = defineIssueMessages({ 'email.required': 'Enter your email' });

function MyFormPage() {
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ initial: { email: '' }, schema: mySchema, validation: rules })
  );
  const send = async () => {
    // One run of all rules, then the handler.
    const outcome = await bundle.submission.submit(api.save);
    if (outcome.status === 'invalid') showHint('Check the form');
  };
  return (
    <ValidationMessagesProvider messages={messages}>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
      <button onClick={send}>Send</button>
    </ValidationMessagesProvider>
  );
}
```

Operators come from `@reformer/core/validation`: `validate` / `validateAsync`,
`validateWhen(() => cond, () => { … })`, `cross(handle, (snapshot) => issue | null)` from the schema
scope, `applyEach(model.$.items, rowRules)` and `apply(...schemas)` for composition. Rule factories
(`required()`, `min()`, `email()`, …) come from `@reformer/core/validators` and take `{ code?, params? }`.

For a wizard, step rules go into the step flow: `createForm({ flow: { steps: [{ id: 'loan', rules:
loanRules }] } })` — the step `id` equals the `selector` of the step node. The wizard's "Next" runs
`flow.next()`, its submit button runs `bundle.submission.submit`. Live validation is chosen with
`validation: { rules, strategy: 'blur' | 'change' | 'afterFirstSubmit' }`; the live phase of
`afterFirstSubmit` starts only with a submit attempt (`bundle.submission.submit`), not with
`bundle.validate()`, `validateStep` or `flow.next()`. See the
[validation guide](./docs/llms/06-validation.md) and the [wizard guide](./docs/llms/07-form-wizard.md).

## License

MIT
