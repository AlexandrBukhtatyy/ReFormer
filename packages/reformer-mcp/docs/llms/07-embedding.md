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
| `@reformer/mcp/intent`  | the form-intent compiler and its judge as pure functions — no server, no disk                    |
| `@reformer/mcp/build-info` | `BUILD_ID` (hash of the sources), `buildIdOf(version)` — to match copies built apart         |
| `@reformer/mcp/package.json`, `@reformer/mcp/*` | raw files of the package (`llms.txt`, `docs/llms/*.md`, `dist/worker/server.js`) |

`core/` holds no Node globals (`npm run check:no-node-globals` guards it), so `./core`,
`./browser` and `./intent` load in a browser.

## `@reformer/mcp/intent` — compile and judge a form intent in-process

The pipeline of `form_build` as pure functions, for a host that keeps its own form document (the
ReFormer Builder assistant uses it in its `build_form` tool). Start with `judgeIntent`: it gives the
verdict of `validate_form kind="bundle"` and of `form_build` before its type check, so the host,
the terminal and the validator call the same things errors.

| Function                                                  | What it does                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `judgeIntent(raw, catalogs, options?)`                    | the verdict on an untrusted JSON value → `{ ok, intent, errors, warnings, bundle? }`; never throws  |
| `readIntent(raw, options?)`                               | the reading step alone → `{ intent, problems, notices }`                                             |
| `normalizeIntent(partial, { uiKit? })`                    | fill the defaults of a partial `FormIntent`                                                          |
| `buildSchemaLayout(intent)`, `collectSteps`, `stepKeyOf`  | the schema layout and wizard steps of the intent                                                     |
| `buildValidationSchemaTs(rules, options)`, `buildBehaviorTs(intent)` | print `form.validation.ts` / `form.behavior.ts` source                                    |
| `mergeFieldChecks`, `inspectLayoutRefs`, `inspectSteps`, `modelPaths` | merge per-field checks, cross-check layout references, find steps mixed with other nodes or nested in a step (C13), list model paths |
| `findCycle(deps)`                                         | a cycle in `{ target, reads }[]` dependencies, or `null` (as `validate_form kind="behaviors"`)       |
| `uiKitFromCatalog`, `uiKitPropsFromCatalog`, `normalizeFieldComponent`, `NO_UI_KIT` | component names and props schemas from a kit catalog                       |
| `coreOperatorsFromIndex`, `NO_CORE_OPERATORS`             | operators of the installed `@reformer/core`, from a knowledge index                                  |
| `MODULE_ONLY_WARNINGS`                                    | codes of the warnings about printing a module — a form document does not need them                  |
| `intentGrammar(catalogs, { profile: 'document' })`        | the intent grammar of a form document: no target, JSX, initial values or module code; at most `DOCUMENT_GRAMMAR_LIMIT` characters |
| `DOCUMENT_GRAMMAR_EXAMPLE`                                | the intent the document grammar is printed from — build it with your own builder to check the grammar holds on your kit |
| `documentCapabilities(intent)`                            | what a form document cannot hold (`not-in-document`) and will not keep (`not-kept`); `judgeIntent` with `forDocument` includes it |
| `INTENT_CONTRACT_VERSION`                                 | the version of the intent contract — records, finding codes, the document grammar; grows on an incompatible change |

Types: `FormIntent`, `FieldIntent`, `ArrayIntent`, `WizardIntent`, `ValidationRuleIntent`,
`BehaviorIntent`, `VisibilityIntent`, `NodeRuleIntent`, `DataSourceIntent`, `FieldType`,
`LayoutNode`, `SchemaDocument`, `SchemaDocNode`, `SchemaLayout`; reading — `ReadIntentOptions`,
`IntentReading`, `IntentProblem`, `IntentProblemCode`, `IntentWarning`, `IntentWarningCode`; the
verdict — `IntentVerdict`, `JudgeFinding`, `JudgeCode`, `JudgeWarningCode`, `JudgeOptions`;
catalogs — `FormCatalogs`, `UiKitComponents`, `UiKitPropSchemas`, `CoreOperators`, `CoreRule`;
`Dependency` of `findCycle`.

### The verdict — `judgeIntent`

The verdict matches the build's only with the catalogs the build checks names against:

- `uiKit` and `uiKitProps` — both from the kit catalog, the JSON of `@reformer/ui-kit/catalog`.
  Without the props schemas reading does not know which props a component lacks: `min` written on
  an `Input` is moved into `componentProps` where the build reports `prop-unsupported`, and unknown
  keys inside `componentProps` get no `component-props` warning.
- `core` — `coreOperatorsFromIndex(knowledge.index)`, the knowledge of `@reformer/mcp/core` or
  `@reformer/mcp/browser`. With `NO_CORE_OPERATORS` rule names are not checked against the core.

Options:

- `forDocument: true` — judge a form document, not a module: no environment is required, no module
  is built (`bundle` is absent), the target's rules and the notes about printing a module are left
  out. What a document has no place for is an error `not-in-document` — own operators, `call`,
  `severity` and `params` of a check, node hooks other than `onComponentEvent`; what it will not keep
  is a warning `not-kept` — initial values, starting rows, a data source without values.
- `requireEnvironment: false` — judge a module even without the catalogs (as `validate_form` does):
  a missing catalog turns its checks off instead of the error `environment`.
- `schema`, `componentNames`, `dataSourceNames` — cross-check a schema of your own against the intent
  (as `validate_form kind="bundle"` with `schema`).

A finding is `{ code, message, at?, hint? }`: `at` is the place in the intent (`fields[2].lable`),
`hint` is what to do. The `code` is stable: reading problems (`unknown-key`, `key-conflict`,
`invalid-value`, …), `C1`–`C13` of the cross-check and the judge's own (`unplaced`, `lost-message`,
`unknown-component`, `environment`, `not-on-target`, `not-in-document`). The `message` is English, written for a
model, and may change: a host with its own language picks its text by the code. Reading problems
stop the verdict — further checks would only echo the records that were not read. Warnings come
ranked: those that change the meaning go first.

```typescript
import {
  coreOperatorsFromIndex,
  judgeIntent,
  uiKitFromCatalog,
  uiKitPropsFromCatalog,
  type FormCatalogs,
} from '@reformer/mcp/intent';

// kitCatalog — the JSON of `@reformer/ui-kit/catalog`; knowledge — from `@reformer/mcp/browser`
const catalogs: FormCatalogs = {
  uiKit: uiKitFromCatalog(kitCatalog),
  uiKitProps: uiKitPropsFromCatalog(kitCatalog),
  core: coreOperatorsFromIndex(knowledge.index),
};

const verdict = judgeIntent(JSON.parse(text), catalogs, { forDocument: true });
for (const { code, at, message, hint } of verdict.errors) {
  console.log(`${code}${at ? ` at ${at}` : ''}: ${message}${hint ? ` → ${hint}` : ''}`);
}
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

- only the reference tools: no `form_build` and `plan_form` (they write into a project, and there is
  none), no `report_issue` (a report in worker memory would be lost), no `debug`. A host builds the
  form itself from an intent — with `@reformer/mcp/intent`, as the Builder assistant's `build_form`;
- no prompts: they are rendered from template files and ask the client for sampling;
- its own `instructions` and `reformer://guide` — a map of the reference tools; the corpus has no
  docs of `@reformer/mcp` itself (they describe `form_build`).

The version in `serverInfo` carries the build: `6.0.0+<BUILD_ID>`. A host that also bundles
`@reformer/mcp/intent` compares it with its own `BUILD_ID` — different builds judge one form
differently. `reformer://status` names `buildId` and the `corpusHash` of the built-in corpus.

The corpus is built once, into `dist/knowledge` (with `knowledge-manifest.json`); the worker embeds
that copy. Rebuild only the worker bundle: `npm run build:worker -w @reformer/mcp` (`-- --out <dir>`
also copies it there) — it stops if `dist` is older than the sources.
