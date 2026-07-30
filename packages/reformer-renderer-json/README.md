# @reformer/renderer-json

Render [`@reformer/core`](https://www.npmjs.com/package/@reformer/core) forms from a **JSON schema**.
Field bindings, components and data sources are expressed as string operators
(`$model(...)`, `$component(...)`, `$dataSource(...)`), so an entire form can be described as data and
rendered through a component registry — no per-field React code.

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Features

- Describe forms declaratively as JSON (`JsonFormSchema`)
- String operators bind schema leaves to a reactive `FormModel` and to registered components
- Component registry (`defineRegistry`) maps operator names to your React components
- **Raw third-party controls** can be registered by name — the renderer translates the value seam (`value` + `onChange(value)`) to each control's dialect via `settings.resolveFieldAdapter`, so no per-control wrapper is needed (see [Raw controls](#raw-controls-field-adapters))
- JSON carries **layout only** — field validators live in a separate `ValidationSchema` over the model, run by `validateModel` (see [Validation](#validation))
- Optional **structural** schema validation against a meta-schema (ajv, loaded dynamically — dev only)
- TypeScript support, tree-shakable exports

## Installation

```bash
npm install @reformer/renderer-json @reformer/core @reformer/renderer-react
```

`@reformer/ui-kit` is an optional peer — use it (or your own components) to populate the registry.

## Quick Start

```tsx
import { useMemo } from 'react';
import { createModel } from '@reformer/core';
import { Input, Box, FormField } from '@reformer/ui-kit';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  defineRegistry,
  FIELD_WRAPPER,
  type JsonFormSchema,
} from '@reformer/renderer-json';

// Bindings are string operators: '$model(...)', '$component(...)', '$dataSource(...)'.
const schema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
    ],
  },
};

type MyForm = { email: string };

export function MyFormPage() {
  // M1: the model is the source of truth; schema leaves bind to its signals.
  const model = useMemo(() => createModel<MyForm>({ email: '' }), []);
  const registry = useMemo(
    () =>
      defineRegistry((reg) => {
        reg.component('Input', Input);
        reg.component('Box', Box);
        reg.component(FIELD_WRAPPER, FormField); // system field wrapper
      }),
    []
  );

  // The model is provided through the provider (settings.model), not as a renderer prop.
  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<MyForm> schema={schema} validate={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

`JsonFormRenderer` accepts only `{ schema, renderBehavior?, onSchemaReady?, validate? }`. The
`FormModel` is supplied via `JsonRendererProvider` settings (`model`); schema leaves are bound to its
signals by the built-in converter.

## Raw controls (field adapters)

By default the renderer drives each field through a value-based seam — `value` +
`onChange(value)` (plus `disabled` / `onBlur` and a `control` prop). Text-like or already
value-based components work as-is. A **raw** third-party control that speaks a different
dialect (a `Checkbox` reading `checked` and emitting a DOM event, a `Select` emitting
`(value, option)`, a `Radio` emitting `event`) would otherwise write the raw event object
straight into the model.

Register such controls by name and translate the seam with `resolveFieldAdapter` — inherited
from `@reformer/renderer-react`'s `RendererSettings` and passed through the same
`JsonRendererProvider` settings (zero extra API on this package). Returning `undefined` for a
component keeps the default seam, so the change is fully backward compatible.

```tsx
import { Checkbox } from 'some-ui-kit'; // raw control: `checked` + `onChange(event)`

// In the registry the control is mapped by name, exactly like any other component:
reg.component('Checkbox', Checkbox); // schema leaf: { value: '$model(agree)', component: '$component(Checkbox)' }

<JsonRendererProvider
  settings={{
    registry,
    model,
    resolveFieldAdapter: (component) =>
      component === Checkbox
        ? {
            valueProp: 'checked',
            fromEmit: (e) => (e as { target: { checked: boolean } }).target.checked,
            toValue: (v) => v ?? false,
          }
        : undefined, // undefined → default value seam (unchanged)
  }}
>
  <JsonFormRenderer<MyForm> schema={schema} />
</JsonRendererProvider>;
```

The adapter is resolved per field `component`. See the `@reformer/renderer-react`
`FieldAdapter` reference for the full field list (`valueProp` / `changeProp` / `fromEmit` /
`toValue` / `bindBlur` / `strip`).

## Validation

The JSON schema describes **layout only** — a `JsonFieldNode` is `{ value, component?, componentProps?, ... }`
with no `validators` field, and there is no `$validator(...)` operator. Field validation is expressed once
as a plain `ValidationSchema` over the `FormModel` (the same `@reformer/core/validation` contract that
hand-written forms use), so layout and rules stay independent: either can be swapped or fetched from a
server without touching the other.

```tsx
import { type FormModel } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

type MyForm = { email: string };

// Rules over the model — `model.$.path` is the field signal, not a '$model(...)' operator.
const schema = defineValidationSchema<MyForm>(({ model }) => {
  validate(model.$.email, [
    required({ message: 'Email is required' }),
    email({ message: 'Invalid email' }),
  ]);
});

// External runner: routes errors into the form nodes and returns Promise<boolean>
// (`severity: 'warning'` does not block; stale runs of the same (model, schema) are aborted).
export const validateMyForm = (model: FormModel<MyForm>) => () => validateModel(model, schema);
```

Operators come from `@reformer/core/validation`: `validate` / `validateAsync`
(`(value, { signal }) => Promise<…>`), `validateWhen(() => cond, () => { … })`,
`cross(sig, (f) => err | null)` (snapshot via `model.get()`), `each(arr, (im) => { … })`, and
`apply(...schemas)` for composition. Field-rule factories (`required()`, `min()`, `email()`, …) come
from `@reformer/core/validators` and accept nullable values.

Validation is **run externally** by `validateModel(model, schema)` — the form's own `submit()` /
`validate()` no longer run schema validation. Wire the runner into a submit handler, or, for a wizard,
inject the `{ validateStep, validateAll }` callbacks into the wizard node at runtime via `renderBehavior`
(`onInit` + `patchProps`). See the [validation guide](./docs/llms/06-validation.md) for the full wizard
wiring. This is distinct from the `validate` prop above, which only checks the JSON schema's **structure**.

## License

MIT
