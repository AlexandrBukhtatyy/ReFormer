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
- Optional schema validation against a meta-schema (ajv, loaded dynamically — dev only)
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

## License

MIT
