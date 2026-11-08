# @reformer/form-registry

Form registry for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core): **one bundle
registers a form, another decides where and when to render it.** Built for micro-frontends, where
the team that owns a form and the application that shows it are different deployments: instead of
an import, a menu entry and a route, the form is a **record** found by id, slot, route or tag.

- **Permissions and flags are a filter**, not a check per entry point — a right cannot be bypassed
  by addressing the form a different way.
- **Data / code boundary in the types**: the schema is `DataSource` (may arrive over the network);
  registry, behavior, validation, step flow and model factory are `CodeSource` — bundle only.
- **Preflight** before a form is built (schema version, registry names, parts, step ids, model
  paths), a persistent **schema cache** (OPFS, IndexedDB, memory) and a **runtime guard** against
  two copies of `@reformer/core` in one page.
- React-free core: the registry, storage and guard work in a vanilla micro-frontend.

## Installation

```bash
npm install @reformer/form-registry @reformer/core @reformer/renderer-json @reformer/renderer-react
```

`react` is an optional peer — needed only for `@reformer/form-registry/react`.

## Quick start

Describe the form once, as data plus code:

```ts
import type { FormEntry } from '@reformer/form-registry';

export const checkoutEntry: FormEntry<CheckoutForm> = {
  id: 'checkout',
  version: '1.0.0',
  owner: 'mfe-orders', // which micro-frontend registered it — reported on id collisions
  // Data: the only part that may come over the network (a format 2 JSON document).
  schema: { kind: 'inline', value: checkoutSchema },
  // Code: bundle only.
  registry: { kind: 'inline', value: createCheckoutRegistry() },
  model: { kind: 'inline', value: createCheckoutModel },
  behavior: { kind: 'inline', value: checkoutBehavior },
  validation: { kind: 'inline', value: { extras: checkoutCrossRules } },
  // Wizard steps: the step id equals the `selector` of the step node in the document.
  flow: {
    kind: 'inline',
    value: { steps: [{ id: 'delivery', rules: deliveryRules }, { id: 'confirm' }] },
  },
  placement: { slots: ['sidebar'], routes: ['/orders/:id/checkout'] },
  access: { permissions: ['orders.write'] },
};
```

Register it when the micro-frontend mounts:

```ts
import { getFormRegistry } from '@reformer/form-registry';

const off = getFormRegistry().registerAll([checkoutEntry]);
// on unmount:
off();
```

Mount it in the host — by id or by slot:

```tsx
import { getFormRegistry } from '@reformer/form-registry';
import { FormRegistryProvider, FormOutlet, FormSlot } from '@reformer/form-registry/react';

<FormRegistryProvider
  registry={getFormRegistry()}
  baseRegistry={coreComponents}
  context={{ permissions, flags }}
>
  <FormOutlet id="checkout" />
  <FormSlot name="sidebar" />
</FormRegistryProvider>;
```

The host builds nothing itself: `FormOutlet` loads the entry, runs preflight, assembles the form
with `createForm` and draws it with `FormRenderer`. Host callbacks go through the `behaviorOptions`
prop into a behavior factory `(options) => defineFormBehavior(…)`.

## Package entries

| Import                             | Contains                                                                                         | React |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ----- |
| `@reformer/form-registry`          | `getFormRegistry`, `createFormRegistry`, `loadForm`, preflight, `fetchJson`, `createSchemaCache` | no    |
| `@reformer/form-registry/react`    | `FormRegistryProvider`, `FormOutlet`, `FormSlot`, `FormRoute`, `MountedForm`, `useFormResource`  | yes   |
| `@reformer/form-registry/storage`  | OPFS / IndexedDB / memory storage, `pickStorage`                                                 | no    |
| `@reformer/form-registry/manifest` | schema check against the meta-schema (`assertSchemaValid`) — **pulls ajv**                       | no    |
| `@reformer/form-registry/guard`    | detection of duplicate runtimes (no dependencies)                                                | no    |

ajv lives only behind `./manifest`; CI enforces the split (`scripts/check-ajv-isolation.mjs`).
Network schemas are cached on two levels — parsed objects in memory, bodies in storage,
revalidated with `ETag`: `createSchemaCache({ storage: await pickStorage() })`.

## Links

- Documentation: [form registry](https://alexandrbukhtatyy.github.io/ReFormer/docs/packages/form-registry),
  [form entry](https://alexandrbukhtatyy.github.io/ReFormer/docs/packages/form-registry/form-entry),
  [mounting](https://alexandrbukhtatyy.github.io/ReFormer/docs/packages/form-registry/mounting)
- Recipes for AI assistants: [`docs/llms`](./docs/llms) — `overview`, `form-entry`, `mounting`,
  `cache-storage`, `preflight`, `guard`, `troubleshooting`
- MCP server for AI assistants: [`@reformer/mcp`](https://www.npmjs.com/package/@reformer/mcp)

## License

MIT
