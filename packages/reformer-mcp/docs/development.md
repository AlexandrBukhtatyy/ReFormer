# Development Guide

How the ReFormer MCP server is built and how to extend it. Testing — [testing.md](./testing.md);
the surface it exposes — [api.md](./api.md).

## Project Structure

```
packages/reformer-mcp/
├── src/
│   ├── index.ts           # stdio entry: the Node server over stdin/stdout
│   ├── build-info.ts      # BUILD_ID — stamped into dist by scripts/stamp-build.mjs
│   ├── core/              # platform-free core: no Node globals (check:no-node-globals)
│   │   ├── knowledge.ts   # Knowledge — what the server knows; the platform gives the sources
│   │   ├── server/        # tool catalog (profiles node | browser), resource catalog, mount
│   │   ├── tools/         # one module per tool: definition + handler
│   │   ├── generate/      # the intent: reading, judge, grammar, cross-checks, module printing
│   │   ├── decide/        # choose_api rules and their form in the intent
│   │   ├── context/       # get_context assembly
│   │   ├── docs/ index/   # the llms.txt corpus and the merged symbol index
│   │   ├── validate/      # validate_form checks and RF codes
│   │   ├── workspace/     # FormWorkspace — where form_build writes
│   │   └── intent.ts      # entry @reformer/mcp/intent
│   ├── platform/
│   │   ├── cli/           # Node: disk sources, form workspace and type-check, prompts, sampling, trace
│   │   ├── browser/       # knowledge from data already loaded (@reformer/mcp/browser)
│   │   └── worker/        # Web Worker server over postMessage — the reference profile
│   ├── prompts/           # prompt modules + templates/*.md
│   ├── index/             # the symbol index loader (Node)
│   └── utils/             # docs-parser, prompt-template-loader
├── scripts/               # build: stamp, knowledge bundle, worker bundle, copies, packaging check
├── docs/llms/             # self-documentation → llms.txt, served as reformer://docs/mcp
├── eval/                  # quality stands: evaluate, calibration, scenarios, verify
└── tests/                 # vitest; __golden__ snapshots of the surface and the module
```

## Setting Up

```bash
npm install                        # from the repository root
npm run build -w @reformer/mcp     # generate:llms → tsc → stamp → templates → corpus → worker
npm run test -w @reformer/mcp
npm run dev -w @reformer/mcp       # tsc --watch: fast, but dist has no build id
```

`npm run build` is the full build: the build id (`dist/build-info.js`), the knowledge corpus with its
manifest (`dist/knowledge`) and the worker bundle (`dist/worker/server.js`). A bare `tsc` or
`npm run dev` resets the build id to `dev`; the Builder's `mcp:build` and `plugins:build` then stop
and ask for the full build — a copy from such a `dist` would judge forms differently from the
sources.

## Architecture

### One core, three platforms

The core works over `Knowledge` (`createKnowledge(sources)`): docs, the symbol index, recipes, specs,
an issue sink, the form workspace, the kit catalog and the status. The platform gives the sources:
`platform/cli` reads the disk, `platform/browser` takes data already loaded, `platform/worker` runs
the same core inside a Web Worker over a built-in corpus. `core/` holds no Node globals, so
`./core`, `./browser` and `./intent` load in a browser.

### Tool catalog and profiles

`createToolCatalog(knowledge, { profile })` (`core/server/tool-catalog.ts`) is the one list of tools.
Profile `node` has all ten (plus `debug` with `REFORMER_DEBUG=true`), profile `browser` — the seven
reference tools: the worker builds no forms. A text that names a tool must hold in both profiles:
`validate_form` and the judge take a `formBuild` option, the worker has its own `instructions` and
guide (`core/server/reference-guide.ts`), and `tests/worker-texts.test.ts` fails on a worker text
that names a build tool.

`mountReformerServer(server, { tools, resources })` (`core/server/mount.ts`) wires the catalogs to
the SDK; the Node server (`platform/cli/server.ts`) adds the prompts and the call trace.

### Resources

`createResourceCatalog` (`core/server/resource-catalog.ts`): `reformer://guide`, `catalog`, `status`,
`docs/<pkg>`, `docs/<pkg>/<slug>`. Sections are not listed in `resources/list` — every client pays
for that list on connect; `reformer://catalog` and `search_docs` give the URIs.

### The form path

`form_build` reads the intent and judges it (`judgeIntent`, `core/generate/judge.ts`), prints the
module (`core/generate/builders.ts`), type-checks it in the workspace and only then writes. The judge
is shared: `validate_form kind="bundle"` and the Builder's `build_form` (through
`@reformer/mcp/intent`) give the same verdict. The lines of the answer and the codes of findings are
contracts: [02-tools.md](./llms/02-tools.md) § form_build and
[08-diagnostic-codes.md](./llms/08-diagnostic-codes.md), both held by tests.

## Adding a New Tool

1. `src/core/tools/my-tool.ts` — the definition and the handler `(args, knowledge) => result`.
   Texts the model reads are in English; a finding gets a stable code.
2. Register it in `src/core/server/tool-catalog.ts`: the definition in `list()` (decide the
   profile — does the worker have it?), the call in `call()`.
3. Describe it in `docs/llms/02-tools.md` and run `npm run generate:llms`; new codes go into
   `docs/llms/08-diagnostic-codes.md` and the site mirror.
4. Update the surface snapshots: `npx vitest run tests/surface-golden.test.ts -u`, review the diff;
   the surface ceilings in that test must hold.

## Sampling

The server does not declare `sampling` — it is a capability of the client. When the client has it,
the server asks it through `server.createMessage(...)` via `requestSampling()`
(`src/platform/cli/sampling.ts`): the prompts `create-form` and `plan-form` infer the target when
`target` is missing, `plan-form` analyses the spec deeper, `discover-context` asks for a stack
recommendation. The result is a discriminated union: without sampling every call falls back to
deterministic logic, never to an exception.

### Snapshot-based regression check

`scripts/snapshot-prompts.mjs` writes the rendered output of every prompt to `.tmp/<dir>/<name>.txt`
(without sampling, so always the deterministic path):

```bash
npm run build -w @reformer/mcp
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/before
# … make changes …
npm run build -w @reformer/mcp
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/after
diff -r .tmp/before .tmp/after
```

## Adding a New Prompt

Prompts are split into two files: a TypeScript module that holds the definition and the variables,
and a markdown template that holds the prose with `{{placeholder}}` slots. See **Prompt Templates
Architecture** below for the rationale.

1. Create `src/prompts/templates/my-prompt.md`:

   ```markdown
   You are doing X. Context:

   ## Task

   {{task}}
   ```

2. Create `src/prompts/my-prompt.ts`:

   ```typescript
   import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

   export const myPromptDefinition = {
     name: 'my-prompt',
     description: 'Description',
     arguments: [{ name: 'task', description: 'Task description', required: true }],
   };

   export function getMyPrompt(args: { task: string }) {
     const text = renderPromptTemplate('my-prompt', { task: args.task });
     return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
   }
   ```

3. Export it from `src/prompts/index.ts`.
4. Register it in `src/platform/cli/server.ts`: the definition in `listedPrompts()`, the call in
   `getPrompt()`.
5. `npm run build` — `copy-templates.mjs` copies the `.md` into `dist/`; `npm run check:mcp-prompts`
   checks that no template teaches removed API.

## Prompt Templates Architecture

### Why split TS and markdown

Prompt bodies grew to hundreds of lines of template-literal text mixed with
`getSection()` calls and ternaries. Splitting them keeps each concern in its
natural file:

- **`src/prompts/<name>.ts`** owns the _definition_ (name/description/arguments),
  variable assembly (`getSection`/`detectProjectStack`/precomputed conditional
  blocks) and the MCP message envelope.
- **`src/prompts/templates/<name>.md`** owns the _content_ — markdown with
  `{{name}}` placeholders, readable in IDE preview and diff-friendly.

`renderPromptTemplate(name, vars)` takes the template file name without `.md`.
Several prompts may share one template: `add-feature` picks one of four by
`feature`, both `to-renderer` targets render `to-renderer.md`.

### Loader (`src/utils/prompt-template-loader.ts`)

There is no template engine — the loader does plain substitution. Public API:

```typescript
renderPromptTemplate(name: string, vars: Record<string, unknown>): string; // load + fill
fillTemplate(template: string, vars: Record<string, unknown>, label?: string): string;
templatePlaceholders(template: string): string[];
staleTemplateSyntax(template: string): Array<{ line: number; text: string }>;
```

Behaviour:

- **Placeholder** — exactly `{{name}}`: letters, digits and `_`, no spaces.
  Anything else in braces is plain text, so JSX such as
  `settings={{ fieldWrapper: FormField }}`, object literals and JSON in code
  samples need no escaping.
- **Missing variable** — a placeholder whose name is not an own key of `vars`
  throws `Prompt template "<name>.md" missing variables: … Provided: …`.
  `null`/`undefined` under a present key render as an empty string; any other
  value goes through `String()`.
- **Single pass** — substituted values are never scanned again, so `{{…}}`
  inside user code stays as is. Replacement is done by a function, so `$&` or
  `$1` in a value stay literal.
- **Path resolution** — three candidates:
  1. `dist/prompts/templates/<name>.md` (runtime after build).
  2. `src/prompts/templates/<name>.md` (monorepo dev under `tsc --watch`).
  3. `<cwd>/packages/reformer-mcp/src/prompts/templates/<name>.md` (cwd fallback).
- **Cache** — template text keyed by name, for the life of the process.

Tests: `tests/prompt-template-loader.test.ts`.

### Why not Handlebars

Until ReFormer-bx95 the loader used Handlebars, and only for `{{name}}`
substitution. Its delimiters collide with JSX: in strict mode
`settings={{ fieldWrapper: FormField }}` was parsed as an expression, and
`start-here` — the documented entry point of the server — answered every client
with JSON-RPC -32603. Keeping Handlebars safe took a hand-written pre-lexer, a
`raw` helper, `\{{` escapes and a CI step. Plain substitution removes that class
of failures together with a runtime dependency (handlebars and its four
transitive packages).

### Authoring conventions

#### Placeholders are precomputed values

Templates have **no logic** — no conditions, loops or helpers. Every conditional
fragment is computed in the TS module and passed in as a ready-made string.
From `create-form.ts`:

```typescript
const text = renderPromptTemplate('create-form', {
  target,
  targetLabel: targetLabelFor(target),
  description: args.description,
  stackBlock: await renderStackDetectionBlockAsync(stack, server),
  targetNote: TARGET_NOTE[target],
});
```

The template sees them as `{{target}}`, `{{targetLabel}}`, `{{description}}`,
`{{stackBlock}}` and `{{targetNote}}`.

#### No leftover Handlebars syntax

`\{{` escapes, `{{#if}}` / `{{else}}` / `{{/if}}` blocks, `{{! comments }}`,
`{{> partials}}`, triple braces and `{{{{raw}}}}` are not syntax anymore.
Rendering does not fail on them — they would reach the client as literal text.
`staleTemplateSyntax` finds them, and both `npm run check:mcp-render` (CI) and
`tests/prompt-template-loader.test.ts` fail on any template that contains them.

#### `getSection` / `getFullDocs` always stay in TS

Documentation lookups are runtime calls into the cached `llms.txt` parsers and
have no business in markdown. Compute them in the TS module and feed the
resulting strings to the template.

#### Prettier does not touch templates

`packages/reformer-mcp/src/prompts/templates/` is listed in `.prettierignore`:
prettier formats code fences inside markdown and would turn `{{code}}` in a
TypeScript fence into `{ { code; } }`, silently breaking the placeholder.

### Build pipeline

Templates are not TypeScript, so `tsc` does not emit them. `npm run build` runs
`node scripts/copy-templates.mjs` after `tsc`; it copies
`src/prompts/templates/*.md` into `dist/prompts/templates/`.

`npm run dev` runs `tsc --watch` only and does not copy templates. If
`dist/prompts/templates/` exists from an earlier build, it wins: re-run
`node scripts/copy-templates.mjs` after editing a template. Otherwise the loader
falls back to `src/prompts/templates/`. Templates are cached per process, so
restart the server either way.

`package.json` `files` includes `dist`, which covers the templates —
`npm pack --dry-run` lists `dist/prompts/templates/*.md` in the tarball.

## Debug Mode

```bash
REFORMER_DEBUG=true node packages/reformer-mcp/dist/index.js
REFORMER_DEBUG=true npx @modelcontextprotocol/inspector node packages/reformer-mcp/dist/index.js
```

It adds the `debug` tool and prompt and the `reformer://debug` resource.

## Debugging

- **stderr only.** stdout carries the MCP protocol; log with `console.error`.
- **Call trace.** `REFORMER_TRACE_FILE=<file>` writes a JSON line per call (number, sizes, a digest
  of the arguments); `REFORMER_TRACE_FULL=1` adds the full arguments and answer text. The scenario
  stand reads it into `dialog.md` (`npm run mcp:log -- latest`).
- **Client logs:** `~/Library/Logs/Claude/mcp*.log` (macOS), `%APPDATA%\Claude\logs\mcp*.log`
  (Windows), `~/.config/Claude/logs/mcp*.log` (Linux).

## Best Practices

1. **One path to a form.** A new capability goes into the intent grammar and `form_build`, not into
   text that tells the agent to write module files by hand.
2. **Texts for the model are English**, texts of a form are in the user's language; a finding has a
   stable code, the text may change.
3. **Every text holds in every profile** — the worker has no `form_build`, `plan_form` or
   `report_issue`.
4. **The surface is a budget.** Every client pays for `tools/list` on connect: keep descriptions
   short, the ceilings in `tests/surface-golden.test.ts` hold them.
5. **A contract has a test.** The answer lines stands parse, the codes, the grammar ceilings — change
   them together with their test and the docs.
