# @reformer/renderer-json

Describe [`@reformer/core`](https://www.npmjs.com/package/@reformer/core) forms as a **JSON document**.
Field bindings, components and data sources are expressed as string operators
(`$model(...)`, `$component(...)`, `$dataSource(...)`, `$part(...)`), so an entire form layout can be
described as data and rendered through a component registry — no per-field React code.

A format 2 document is built by the same `createForm` as a TypeScript schema and rendered by the same
`FormRenderer` from `@reformer/renderer-react`; this package provides the registry that turns the
document into a tree, the document types, structural validation and migration of the previous format.

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Features

- Describe forms declaratively as JSON (`JsonFormSchema`, `format: 2`) — fields, arrays of sub-forms, named parts (sub-forms reused across groups), containers, HTML tags and text
- String operators bind document nodes to a reactive `FormModel` (`model: '$model(path)'`) and to registered components
- Component registry (`defineRegistry`, `composeRegistries`) maps operator names to your React components; old names of renamed components (`FormArray`, `FormArraySection`) resolve as aliases with a dev warning
- **Raw third-party controls** can be registered by name — the renderer translates the value seam (`value` + `onChange(value)`) to each control's dialect via `settings.resolveFieldAdapter`, so no per-control wrapper is needed (see [Raw controls](#raw-controls-field-adapters))
- JSON carries **layout only** — field rules live in a separate `ValidationDefinition` over the model (see [Validation](#validation))
- Optional **structural** document validation against a meta-schema (`@reformer/renderer-json/validate`, ajv — load it dynamically, dev only)
- `migrateJsonSchema` converts a previous-format document (`value` / `array` keys, wizard steps in `componentProps.steps`) to format 2
- TypeScript support, tree-shakable exports

## Installation

```bash
npm install @reformer/renderer-json @reformer/core @reformer/renderer-react
```

`@reformer/ui-kit` is an optional peer — use it (or your own components) to populate the registry.

## Quick Start

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Input, Box, FormField } from '@reformer/ui-kit';
import { defineRegistry, defineJsonSchema, FIELD_WRAPPER } from '@reformer/renderer-json';

type MyForm = { email: string };

// Bindings are string operators: '$model(...)', '$component(...)', '$dataSource(...)'.
// defineJsonSchema<T> narrows `$model(...)` paths to the model shape.
const schema = defineJsonSchema<MyForm>({
  format: 2,
  root: {
    component: '$component(Box)',
    children: [
      {
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
    ],
  },
});

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component(FIELD_WRAPPER, FormField); // system field wrapper
});

export function MyFormPage() {
  // One call: the registry builds the tree from the document; the field wrapper and the schema
  // error boundary travel in the bundle. useFormBundle keeps the bundle stable between renders.
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ schema, registry, initial: { email: '' } })
  );

  return <FormRenderer form={bundle} />;
}
```

The registry goes into `createForm` explicitly, not through React context, so a host provider and a
remote renderer may live in different bundles. A previous-format document (no `format: 2`) is still
built by `createJsonForm` + `useJsonForm` and rendered by `JsonFormRenderer` inside
`JsonRendererProvider` (types with the `V1` suffix); `migrateJsonSchema(document)` moves it to format 2.

## Raw controls (field adapters)

The renderer drives each field through a value-based seam — `value` + `onChange(value)`
(plus `disabled` / `onBlur`) — translated into the control's own dialect by its
`FieldAdapter`. A component declares the adapter as the static `reformerAdapter`
(`defineFieldControl(C, { adapter })` from `@reformer/ui-kit/fields`); `@reformer/ui-kit`
components already do, so they are registered as-is. Components without the static get the
seam unchanged — already value-based components work as-is. A **raw** third-party control that speaks a different
dialect (a `Checkbox` reading `checked` and emitting a DOM event, a `Radio` emitting `event`) would
otherwise write the raw event object straight into the model.

Register such controls by name and translate the seam with `resolveFieldAdapter` — a field of
`@reformer/renderer-react`'s `RendererSettings`. The resolver takes precedence over the static;
returning `undefined` falls back to the component's `reformerAdapter`, then to the plain seam.

```tsx
import { Checkbox } from 'some-ui-kit'; // raw control: `checked` + `onChange(event)`

// In the registry the control is mapped by name, exactly like any other component:
reg.component('Checkbox', Checkbox); // document leaf: { model: '$model(agree)', component: '$component(Checkbox)' }

<FormRenderer
  form={bundle}
  settings={{
    resolveFieldAdapter: (component) =>
      component === Checkbox
        ? {
            valueProp: 'checked',
            fromEmit: (e) => (e as { target: { checked: boolean } }).target.checked,
            toValue: (v) => v ?? false,
          }
        : undefined, // undefined → the component's reformerAdapter static, else the plain seam
  }}
/>;
```

On the previous path the same resolver is passed through `JsonRendererProvider` settings. See the
`@reformer/renderer-react` `FieldAdapter` reference for the full field list (`valueProp` /
`changeProp` / `fromEmit` / `toValue` / `bindBlur` / `strip`).

## Validation

The JSON document describes **layout only** — a `JsonFieldNode` is `{ model, component?, componentProps?, ... }`
with no `validators` field, and there is no `$validator(...)` operator. Field validation is expressed once
as a plain `ValidationDefinition` over the `FormModel` (the same `@reformer/core/validation` contract that
hand-written forms use), so layout and rules stay independent: either can be swapped or fetched from a
server without touching the other.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineIssueMessages } from '@reformer/core/i18n';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';

// Rules over the model — `model.$.path` is the field handle, not a '$model(...)' operator.
// A rule carries a code; the text comes from the form dictionary.
const rules = defineValidation<MyForm>(({ model }) => {
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
});
const messages = defineIssueMessages({ 'email.required': 'Enter your email' });

function MyFormPage() {
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ schema, registry, initial: { email: '' }, validation: rules })
  );
  // bundle.validate(), bundle.submit(handler) — one run of the rules, issues land on the nodes.
  return (
    <ValidationMessagesProvider messages={messages}>
      <FormRenderer form={bundle} />
    </ValidationMessagesProvider>
  );
}
```

For a wizard, step rules go into the step flow — `createForm({ flow: { steps: [{ id: 'loan', rules:
loanRules }] } })`, where the step `id` equals the `selector` of the `$component(Step)` node in the
document. The wizard takes the form, the flow and submission from the bundle — nothing has to be
injected into the document. See the [validation guide](./docs/llms/06-validation.md) and the
[wizard guide](./docs/llms/07-form-wizard.md). This is distinct from `validateFormSchema`, which only
checks the document's **structure**.

## License

MIT
