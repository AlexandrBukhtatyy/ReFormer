# @reformer/renderer-json

Describe [`@reformer/core`](https://www.npmjs.com/package/@reformer/core) forms as a **JSON
document**. Bindings, components and data are string operators (`$model(...)`,
`$component(...)`, `$dataSource(...)`, `$part(...)`), so the layout of a form can be stored in a
database, sent from a server or edited in a builder. A component registry turns the names into
React components; the document is built by the same `createForm` and drawn by the same
`FormRenderer` from `@reformer/renderer-react`. JSON carries layout only — rules and behavior
stay in TypeScript.

## Installation

```bash
npm install @reformer/renderer-json @reformer/renderer-react @reformer/core
```

Peers: `@reformer/core`, `@reformer/renderer-react`, `react` and `react-dom` 18 or 19. Components
for the registry come from [`@reformer/ui-kit`](https://www.npmjs.com/package/@reformer/ui-kit) or
your own.

## Quick start

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { defineJsonSchema, defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Box, FormField, Input } from '@reformer/ui-kit';

type SignUp = { email: string };

// The document — plain JSON (format 2). defineJsonSchema<T> checks `$model(...)` paths.
const document = defineJsonSchema<SignUp>({
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

// The registry: names from the document → components. FIELD_WRAPPER — the frame of every field.
const registry = defineRegistry((reg) => {
  reg.component('Box', Box);
  reg.component('Input', Input);
  reg.component(FIELD_WRAPPER, FormField);
});

export function SignUpPage() {
  const bundle = useFormBundle(() =>
    createForm<SignUp>({ initial: { email: '' }, schema: document, registry })
  );
  return <FormRenderer form={bundle} />;
}
```

The registry goes into `createForm`, not into React context, so the host and a remote form may
live in different bundles. Validation is a `defineValidation` over the model passed as
`createForm({ validation })`; for a wizard, step rules go to `flow: { steps: [{ id, rules }] }`,
where `id` is the `selector` of the step node in the document.

## Package entries

| Import                             | Contains                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@reformer/renderer-json`          | `defineJsonSchema`, `defineRegistry`, `composeRegistries`, `FIELD_WRAPPER`, `LOCALE_SERVICE`; document types (`JsonFormSchema`, `JsonFieldNode`, `JsonArrayNode`, `JsonPartNode`, …); `migrateJsonSchema`, `composeJsonFormSchema`; operators (`parseOperator`, `isModelOp`, …); meta-schema helpers (`formSchemaMetaSchema`, `buildFormSchemaMetaSchema`); `SchemaErrorBoundary`, `SchemaErrorPanel`; `I18n`, `LocaleProvider` |
| `@reformer/renderer-json/validate` | `validateFormSchema` — structural check of a document against the meta-schema. Pulls **ajv**: load it dynamically, in development or in a builder                                                                                                                                                                                                                                                                               |

A document of the previous format (no `format: 2`) is not read at runtime — convert it on load
with `migrateJsonSchema(document)`.

## Links

- Documentation: [renderer-json](https://alexandrbukhtatyy.github.io/ReFormer/docs/packages/renderer-json),
  [document format](https://alexandrbukhtatyy.github.io/ReFormer/docs/packages/renderer-json/document-format),
  [registry](https://alexandrbukhtatyy.github.io/ReFormer/docs/packages/renderer-json/registry)
- Recipes for AI assistants: [`docs/llms`](./docs/llms) — [`json-schema`](./docs/llms/02-json-schema.md),
  [`registry`](./docs/llms/03-registry.md), `cookbook`, [`validation`](./docs/llms/06-validation.md),
  [`form-wizard`](./docs/llms/07-form-wizard.md), `i18n`, `format-2`, `troubleshooting`
- MCP server for AI assistants: [`@reformer/mcp`](https://www.npmjs.com/package/@reformer/mcp)
  (`validate_form` with `kind: "json-schema"` checks a document before rendering)

## License

MIT
