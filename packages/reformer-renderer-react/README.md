# @reformer/renderer-react

React renderer for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core). Draws the
form bundle built by `createForm` from its form schema: every field node goes to its component,
containers and HTML tags become markup, arrays of sub-forms and parts are expanded. The schema
carries layout only; validation and behavior stay in the same `createForm` call.

## Installation

```bash
npm install @reformer/renderer-react @reformer/core
```

Peers: `@reformer/core`, `react` and `react-dom` 18 or 19. Components usually come from
[`@reformer/ui-kit`](https://www.npmjs.com/package/@reformer/ui-kit) — or your own.

## Quick start

```tsx
import { createForm, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormRenderer, type RenderNode } from '@reformer/renderer-react';
import { Box, FormField, Input } from '@reformer/ui-kit';

type SignUp = { email: string };

// Schema builder: createForm calls it once with the model.
const schema = (model: FormModel<SignUp>): RenderNode<SignUp> => ({
  component: Box,
  children: [{ model: model.$.email, component: Input, componentProps: { label: 'Email' } }],
});

const rules = defineValidation<SignUp>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

export function SignUpPage() {
  const bundle = useFormBundle(() =>
    createForm<SignUp>({ initial: { email: '' }, schema, validation: rules })
  );
  // fieldWrapper draws label → control → error around every field.
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}
```

Submitting is the same as for a hand-written form: `bundle.submission.submit(handler)`. A node
with a `selector` is controlled from the behavior (`hideWhen`, `onComponentEvent`) or through
`bundle.render.node(selector)`.

## Package entries

| Import                     | Contains                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@reformer/renderer-react` | `FormRenderer`, `RenderNodeComponent`; node types (`RenderNode`, `ModelFieldRenderNode`, `ContainerRenderNode`, `ArrayRenderNode`, `PartRenderNode`); `RendererSettings`, `FieldAdapter`, `FieldWrapperProps`; node rules (`hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount`); `createRenderSchema`; `useRenderContext` |

`FormRenderer` props: `form` (the bundle), `settings` — `fieldWrapper` (the frame around each
field) and `resolveFieldAdapter` (binds a third-party control that does not declare the
`reformerAdapter` static: `checked` + `onChange(event)` and the like).

## Links

- Documentation: [renderer-react](https://alexandrbukhtatyy.github.io/ReFormer/docs/packages/renderer-react),
  [validation](https://alexandrbukhtatyy.github.io/ReFormer/docs/validation/overview)
- Recipes for AI assistants: [`docs/llms`](./docs/llms) — `render-schema`, `render-behavior`,
  `cookbook`, [`validation`](./docs/llms/06-validation.md),
  [`form-wizard`](./docs/llms/07-form-wizard.md), `form-bundle`, `troubleshooting`
- MCP server for AI assistants: [`@reformer/mcp`](https://www.npmjs.com/package/@reformer/mcp)

## License

MIT
