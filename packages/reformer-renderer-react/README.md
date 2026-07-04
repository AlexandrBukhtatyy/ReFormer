# @reformer/renderer-react

React renderer for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core). Turns a
reactive `FormModel` + render schema into a React tree, wiring each field to its component and
routing validation state into the UI.

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Features

- Renders a ReFormer form from a declarative render schema
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

## License

MIT
