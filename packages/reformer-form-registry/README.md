# @reformer/form-registry

Form registry for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core): **one bundle
registers a form, another decides where and when to render it.** Built for micro-frontends, where
the team that owns a form and the application that shows it are different deployments.

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## Why

Wiring a form into an application is usually three manual edits — an import, a menu entry, a route.
Nothing keeps those three in sync with the form itself, and nothing lets a remote application
contribute a form at runtime. This package replaces the wiring with a **record**:

```tsx
getFormRegistry().register(checkoutFormEntry);

// anywhere, knowing only the id:
<FormOutlet id="checkout" />;
```

## Features

- **Register / resolve split** — a micro-frontend registers, the host resolves by id, slot, route or tag
- **Permissions and flags are a filter, not a gate per entry point** — a right cannot be bypassed by addressing the form a different way
- **Data / code boundary is enforced by the types** — a schema is `DataSource` (can arrive over the network); a registry, behavior, model factory and render-behavior are `CodeSource` and only ever come from the bundle
- **Persistent cache** with swappable strategies — OPFS, IndexedDB, in-memory; one contract, one test suite
- **Preflight** — five checks before a form is built, four of which nothing else performs
- **Runtime guard** — detects two copies of `@reformer/core` or `@preact/signals-core` in one realm, a failure that is otherwise completely silent
- React-free core: the registry, storage and guard work in a vanilla micro-frontend; React is an optional peer

## Installation

```bash
npm install @reformer/form-registry @reformer/core @reformer/renderer-json @reformer/renderer-react
```

`react` is an optional peer — needed only for `@reformer/form-registry/react`.

## Quick Start

Describe the form once, as data plus code:

```ts
import type { FormEntry } from '@reformer/form-registry';

export const checkoutEntry: FormEntry<CheckoutForm> = {
  id: 'checkout',
  version: '1.0.0',
  owner: 'mfe-orders', // which micro-frontend registered it — used to report id collisions

  // Data: the only part that can be delivered over the network.
  schema: { kind: 'inline', value: checkoutSchema },

  // Code: bundle only. There is deliberately no `kind: 'http'` here.
  registry: { kind: 'inline', value: createCheckoutRegistry() },
  model: { kind: 'inline', value: createCheckoutModel },
  behavior: { kind: 'inline', value: checkoutBehavior },

  placement: { slots: ['sidebar'], routes: ['/orders/:id/checkout'] },
  access: { permissions: ['orders.write'] },
};
```

Register it when the micro-frontend mounts, and unregister when it unmounts:

```ts
import { getFormRegistry } from '@reformer/form-registry';

const off = getFormRegistry().registerAll(myForms);
// on unmount:
off();
```

Mount it in the host:

```tsx
import { FormRegistryProvider, FormOutlet, FormSlot } from '@reformer/form-registry/react';

<FormRegistryProvider baseRegistry={coreComponents} ctx={{ permissions, flags }}>
  <FormOutlet id="checkout" />
  <FormSlot name="sidebar" />
</FormRegistryProvider>;
```

## Subpath exports

| import                             | contains                                                      | needs React |
| ---------------------------------- | ------------------------------------------------------------- | ----------- |
| `@reformer/form-registry`          | registry, resolution, loader, preflight, network, cache       | no          |
| `@reformer/form-registry/react`    | `FormRegistryProvider`, `FormOutlet`, `FormSlot`, `FormRoute` | yes         |
| `@reformer/form-registry/storage`  | OPFS / IndexedDB / memory strategies, `pickStorage`           | no          |
| `@reformer/form-registry/manifest` | schema validation against the meta-schema (**pulls ajv**)     | no          |
| `@reformer/form-registry/guard`    | duplicate-runtime detection (zero dependencies)               | no          |

ajv lives **only** behind `./manifest`; the split is enforced by `scripts/check-ajv-isolation.mjs`
in CI, not by convention.

## Network schemas and cache

```ts
import { createSchemaCache } from '@reformer/form-registry';
import { pickStorage } from '@reformer/form-registry/storage';

const cache = createSchemaCache({ storage: await pickStorage() });
```

Schemas are large (a six-step credit application is ~68 KB), so the cache is two-level: parsed
objects in memory, serialized bodies in persistent storage, revalidated with `ETag`. The cache is
**disposable** — clearing it mid-session is safe, everything is re-fetched.

## License

MIT
