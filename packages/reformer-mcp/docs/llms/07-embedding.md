# Embedding — package entries and the browser worker

How to use `@reformer/mcp` without spawning the CLI server: the package entries for a host
application (an editor, a builder plugin, a test) and the self-contained Web Worker bundle.
An agent that only calls the server's tools does not need this file.

## Package entries

| Entry                 | Contents                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `@reformer/mcp`       | the stdio server (`bin`: `reformer-mcp`); not meant to be imported                                 |
| `@reformer/mcp/core`  | `createKnowledge(sources)`, `memoize`; types `Knowledge`, `KnowledgeSources`, `SymbolsFallback`, `UiKitCatalogSource` |
| `@reformer/mcp/browser` | `createBrowserKnowledge(input)` → `{ knowledge, issues }` — knowledge from already loaded data   |
| `@reformer/mcp/intent`  | the form-intent compiler as pure functions — no server, no disk                                  |
| `@reformer/mcp/package.json`, `@reformer/mcp/*` | raw files of the package (`llms.txt`, `docs/llms/*.md`, `dist/worker/server.js`) |

`core/` holds no Node globals (`npm run check:no-node-globals` guards it), so `./core`,
`./browser` and `./intent` load in a browser.

## `@reformer/mcp/intent` — compile a form intent in-process

The same pipeline that `generate_form` and `form_build` run, for a host that keeps its own form
document (the ReFormer Builder assistant uses it in its `build_form` tool):

| Function                                         | What it does                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `readIntent(raw, options?)`                      | parse an untrusted JSON value → `{ intent, problems, notices }`                 |
| `normalizeIntent(partial, { uiKit? })`           | fill the defaults of a partial `FormIntent`                                     |
| `buildSchemaLayout(intent)`, `collectSteps`, `stepKeyOf` | the schema layout and wizard steps of the intent                        |
| `buildValidationSchemaTs(rules, options)`, `buildBehaviorTs(intent)` | print `form.validation.ts` / `form.behavior.ts` source      |
| `mergeFieldChecks`, `inspectLayoutRefs`, `modelPaths` | merge per-field checks, cross-check layout references, list model paths    |
| `findCycle(deps)`                                | a cycle in `{ target, reads }[]` dependencies, or `null` (as `check_behaviors`) |
| `uiKitFromCatalog`, `normalizeFieldComponent`, `NO_UI_KIT` | component names from a kit catalog                                   |
| `coreOperatorsFromIndex`, `NO_CORE_OPERATORS`    | operators of the installed `@reformer/core`, read from its `llms-index.json`    |

Types: `FormIntent`, `FieldIntent`, `ArrayIntent`, `WizardIntent`, `ValidationRuleIntent`,
`BehaviorIntent`, `VisibilityIntent`, `NodeRuleIntent`, `LayoutNode`, `SchemaDocument`,
`IntentProblem`, `IntentWarning`.

```typescript
import { findCycle, readIntent } from '@reformer/mcp/intent';

const { intent, problems } = readIntent(JSON.parse(text));
if (problems.length > 0) throw new Error(problems.map((p) => p.message).join('\n'));

const cycle = findCycle([
  { target: 'total', reads: ['price', 'quantity'] },
  { target: 'price', reads: ['total'] },
]); // ['total', 'price', 'total']
```

## Browser worker

`dist/worker/server.js` is one self-contained script (about 4.5 MB) with the knowledge corpus
built in. The host starts it as a Web Worker and speaks MCP over `postMessage`: one message —
one JSON-RPC frame, no envelope. The corpus is parsed on the first call that needs it;
`initialize` and `tools/list` answer immediately.

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createPortTransport } from '@reformer/mcp/dist/platform/worker/port-transport.js';

const worker = new Worker(serverScriptUrl);
const client = new Client({ name: 'my-host', version: '1.0.0' });
await client.connect(createPortTransport(worker, { onClose: () => worker.terminate() }));
```

Differences from the Node server:

- no `form_build` and `report_issue` — they write to disk; no `debug`;
- `plan_form` has no `specPath` — the plan is built from `description`;
- no prompts: they are rendered from template files and ask the client for sampling;
- the same resources: `reformer://guide`, `reformer://catalog`, `reformer://docs/…`.

Rebuild only the worker bundle (needs a built `dist`): `npm run build:worker -w @reformer/mcp`;
`-- --out <dir>` also copies it there.
