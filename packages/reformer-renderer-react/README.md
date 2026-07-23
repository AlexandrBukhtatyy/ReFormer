# @reformer/renderer-react

React renderer for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core). Turns a
reactive `FormModel` + render schema into a React tree, wiring each field to its component and
routing validation state into the UI.

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Features

- Renders a ReFormer form from a declarative render schema
- Render schema carries **layout only** — field validators live in a separate `ValidationSchema` over the model, run by `validateModel` (see [Validation](#validation))
- Reactive: fields update from the model's signals with no manual wiring
- Pluggable field wrapper (label + control + error) via `settings.fieldWrapper`
- `createRenderSchema` proxy for programmatic node control and render behaviors
- TypeScript support, tree-shakable exports

## Installation

```bash
npm install @reformer/renderer-react @reformer/core
```

## Quick Start

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
import { FormField, Input } from '@reformer/ui-kit';

interface MyForm {
  email: string;
}

function buildSchema(model: ReturnType<typeof createModel<MyForm>>) {
  return {
    children: [{ value: model.$.email, component: Input, componentProps: { label: 'Email' } }],
  };
}

export function MyFormPage() {
  const { model, schema } = useMemo(() => {
    const model = createModel<MyForm>({ email: '' });
    createForm<MyForm>({ model, schema: buildSchema(model) });
    // Render schema (a plain builder, or a `createRenderSchema` proxy for behaviors)
    const schema = createRenderSchema<MyForm>(() => buildSchema(model));
    return { model, schema };
  }, []);

  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

## Validation

A `RenderNode` describes **layout only** — none of the node kinds (`ModelFieldRenderNode`,
`ArrayRenderNode`, `ContainerRenderNode`) has a `validators` field, so `validators: [...]` on a leaf
is a type error. Field validation is expressed once as a plain `ValidationSchema` over the
`FormModel` (the same `@reformer/core/validation` contract that hand-written forms use), so layout
and rules stay independent and one validation covers every render target (React, JSON, hand-written
JSX).

```tsx
import { type FormModel } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

type MyForm = { email: string };

// Rules over the model — `model.$.path` is the field signal, kept separate from the render schema.
const validationSchema = defineValidationSchema<MyForm>(({ model }) => {
  validate(model.$.email, [
    required({ message: 'Email is required' }),
    email({ message: 'Invalid email' }),
  ]);
});

// External runner: routes errors into the form nodes (FormRenderer highlights them) and returns
// Promise<boolean> (`severity: 'warning'` does not block; stale runs of the same (model, schema)
// are aborted).
export const validateMyForm = (model: FormModel<MyForm>) => () =>
  validateModel(model, validationSchema);
```

Operators come from `@reformer/core/validation`: `validate` / `validateAsync`
(`(value, { signal }) => Promise<…>`), `validateWhen(() => cond, () => { … })`,
`cross(sig, (f) => err | null)` (snapshot via `model.get()`), `each(arr, (im) => { … })`, and
`apply(...schemas)` for composition. Field-rule factories (`required()`, `min()`, `email()`, …) come
from `@reformer/core/validators` and accept nullable values.

Validation is **run externally** by `validateModel(model, schema)` — the form's own `submit()` /
`validate()` no longer run schema validation; `FormRenderer` only displays the errors a run sets on
the nodes (via `getNodeForSignal(sig).setErrors(...)`). Call the runner from a submit handler, or,
for a wizard, inject the `{ validateStep, validateAll }` callbacks into the wizard node at runtime
via a render behavior (`onInit` + `patchProps`); to re-validate on a dependency change, bridge from
behavior with `revalidateWhen([model.$.dep], () => void validateModel(model, validationSchema))`.
See the [validation guide](./docs/llms/06-validation.md) for the full wizard wiring.

## License

MIT
