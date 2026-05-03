# Development Guide

This guide covers how to develop and extend the ReFormer MCP server.

## Project Structure

```
packages/reformer-mcp/
├── package.json
├── tsconfig.json
├── scripts/
│   ├── copy-templates.mjs    # Copies prompts/templates/*.md into dist/ on build
│   └── snapshot-prompts.mjs  # Dev-only regression snapshot for prompt outputs
├── src/
│   ├── index.ts              # Server entry point (registers tools/prompts/resources)
│   ├── tools/                # MCP tools
│   │   ├── index.ts
│   │   ├── debug.ts          # Debug tool (REFORMER_DEBUG only)
│   │   └── report-issue.ts   # Issue reporting tool
│   ├── prompts/              # MCP prompts — TS modules pair with .md templates
│   │   ├── index.ts          # Re-exports all *PromptDefinition / get*Prompt pairs
│   │   ├── create-form.ts    # Each module: definition + getter that renders its template
│   │   ├── add-validation.ts
│   │   ├── …                 # 10 prompts total
│   │   └── templates/        # Prompt bodies as markdown with {{var}} placeholders
│   │       ├── create-form.md
│   │       ├── add-validation.md
│   │       └── …
│   └── utils/
│       ├── docs-parser.ts            # Loads/sections @reformer/* llms.txt
│       ├── project-detector.ts       # Detects ui-kit / Tailwind in target package.json
│       └── prompt-template-loader.ts # Handlebars renderer for prompt templates
├── docs/
└── README.md
```

## Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/AlexandrBukhtatyy/ReFormer.git
cd ReFormer

# Install dependencies
npm install

# Navigate to MCP package
cd packages/reformer-mcp

# Build
npm run build

# Watch mode for development
npm run dev
```

## Understanding MCP Architecture

### Server Setup (index.ts)

The server uses `@modelcontextprotocol/sdk`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'reformer-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);
```

### Feature Flags

Debug features are hidden behind the `REFORMER_DEBUG` environment variable:

```typescript
const isDebugMode = process.env.REFORMER_DEBUG === 'true';

// Only expose debug tools in debug mode
if (isDebugMode) {
  tools.push(debugToolDefinition);
}
```

### Tools

Tools are functions that Claude can call:

```typescript
// Definition
const toolDefinition = {
  name: 'my_tool',
  description: 'What the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter description' },
    },
    required: ['param'],
  },
};

// Handler
async function myTool(args: { param: string }) {
  return {
    content: [{ type: 'text', text: 'Result' }],
  };
}
```

### Resources

Resources are passive data sources:

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'my://resource',
      name: 'My Resource',
      description: 'Description',
      mimeType: 'text/markdown',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [{ uri: request.params.uri, text: 'Content' }],
}));
```

### Prompts

Prompts are pre-built templates:

```typescript
const promptDefinition = {
  name: 'my-prompt',
  description: 'What the prompt does',
  arguments: [{ name: 'input', description: 'Input description', required: true }],
};

function getMyPrompt(args: { input: string }) {
  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `Context...\n\n${args.input}` },
      },
    ],
  };
}
```

## Adding a New Tool

1. Create `src/tools/my-tool.ts`:

```typescript
export const myToolDefinition = {
  name: 'my_tool',
  description: 'Description',
  inputSchema: { type: 'object', properties: {}, required: [] },
};

export async function myTool() {
  return { content: [{ type: 'text', text: 'Result' }] };
}
```

2. Export from `src/tools/index.ts`
3. Register in `src/index.ts`

## Resources & Sampling Architecture (2.0)

Starting in `2.0.0-beta.1` the server uses a **fine-grained resource model**
plus **sampling** to keep prompt messages small.

### Fine-grained resources

Every level-2 section (`## `) of every package's `llms.txt` is exposed as
its own MCP resource:

- `reformer://docs/<pkg-short>` — full `llms.txt` for one package (aggregator).
- `reformer://docs/<pkg-short>/<section-slug>` — single section.

Where `<pkg-short>` ∈ `{core, cdk, ui-kit, renderer-react, renderer-json}`
and `<section-slug>` is `slugify(title)` after stripping leading numeric
prefixes (`## 1. Foo` → slug `foo`).

`resources/list` is generated at runtime from `listSections()` —
~213 resources total (208 sections + 5 aggregators). Use the MCP Inspector's
Resources tab to browse the catalogue.

### Slim+ prompts

Prompt messages contain only:

- args (description, code, requirements, …);
- a 5–10 line **Critical inline rules** block — API names + signatures the
  model commonly hallucinates, plus 1-line anti-patterns;
- a **Prerequisites** block — list of resource URIs the model MUST read via
  `ReadMcpResourceTool` before writing code;
- the task and output checklist.

Full code examples, discussion-style sections, and behavior-recipe deep-dives
live in resources, not in the prompt. Compression vs the 1.x format: between
**2× and 7×** depending on the prompt (`add-behavior` is the largest win:
28 KB → 4 KB).

### Sampling capability

The server declares `sampling: {}` and uses it in four places:

| Where                                             | When it fires                                                 | Purpose                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `create-form`, `plan-form`                        | `args.target` is missing                                      | classify `core` / `renderer-react` / `renderer-json` from description + deps                                  |
| `project-detector.renderStackDetectionBlockAsync` | `projectRoot` found but no `@reformer/ui-kit` and no Tailwind | guess UI library + styling system from `package.json` deps                                                    |
| `plan-form`                                       | always (when sampling supported)                              | extract complex spec patterns the regex parser misses (cross-step cascades, conditional groups, hidden steps) |
| `discover-context` prompt                         | always                                                        | one batched call returning a JSON `{ target, uiKit, styling, validation, async }` recommendation              |

Each call routes through `requestSampling()` in
[src/utils/sampling.ts](../src/utils/sampling.ts) which:

1. Checks `isSamplingSupported(server)` via `getClientCapabilities()`.
2. Calls `server.createMessage(...)` with sane defaults
   (`claude-3-5-sonnet`, 512 tokens, intelligencePriority 0.7).
3. Returns a discriminated-union result so callers must handle
   `{ ok: false, reason }` explicitly — graceful degradation is the rule,
   never a thrown exception.

When the client doesn't support sampling, every call falls back to
deterministic logic — `inferTarget` returns the first detected renderer
(or `'core'`), `discoverUnknownStack` returns `null`, `deepAnalyzeSpec`
returns `null` (and the corresponding template block is empty).

### Snapshot-based regression check

`scripts/snapshot-prompts.mjs` writes the rendered output of every prompt
to `.tmp/<dir>/<name>.txt` (without MCP-client sampling, so it always uses
the deterministic fallback path). Use it to compare two states:

```bash
npm run build
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/before
# … make changes …
npm run build
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/after
diff -r .tmp/before .tmp/after
```

## Adding a New Prompt

Prompts are split into two files: a TypeScript module that holds the
definition + variable assembly, and a markdown template that holds the
prose with `{{placeholder}}` slots. See **Prompt Templates Architecture**
below for the rationale.

1. Create `src/prompts/templates/my-prompt.md`:

   ```markdown
   You are doing X. Context:

   ## Task

   {{task}}

   ## Reference

   {{referenceDocs}}
   ```

2. Create `src/prompts/my-prompt.ts`:

   ```typescript
   import { getSection } from '../utils/docs-parser.js';
   import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

   export const myPromptDefinition = {
     name: 'my-prompt',
     description: 'Description',
     arguments: [{ name: 'task', description: 'Task description', required: true }],
   };

   export function getMyPrompt(args: { task: string }): {
     messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
   } {
     const text = renderPromptTemplate('my-prompt', {
       task: args.task,
       referenceDocs: getSection('Quick Start', '@reformer/core'),
     });
     return {
       messages: [{ role: 'user', content: { type: 'text', text } }],
     };
   }
   ```

3. Export from `src/prompts/index.ts`.
4. Register in `src/index.ts` (`ListPromptsRequestSchema` array + `GetPromptRequestSchema` switch).
5. Run `npm run build` — `copy-templates.mjs` copies the `.md` into `dist/`.

### Verifying with snapshot

`scripts/snapshot-prompts.mjs` writes the rendered output of every prompt to
`.tmp/<dir>/<name>.txt` so you can `diff -r` two states (e.g. before/after a
refactor). It is a dev tool, not part of the published package.

```bash
npm run build
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/before
# … make changes …
npm run build
node packages/reformer-mcp/scripts/snapshot-prompts.mjs .tmp/after
diff -r .tmp/before .tmp/after
```

## Prompt Templates Architecture

### Why split TS and markdown

Prompt bodies grew to hundreds of lines of template-literal text mixed with
`getSection()` calls and ternaries. Splitting them keeps each concern in its
natural file:

- **`src/prompts/<name>.ts`** owns the _definition_ (name/description/arguments),
  variable assembly (`getSection`/`detectProjectStack`/precomputed conditional
  blocks) and the MCP message envelope.
- **`src/prompts/templates/<name>.md`** owns the _content_ — markdown with
  syntax highlighting in IDE preview, prettier-friendly, diff-friendly.

The template name passed to `renderPromptTemplate(name, vars)` matches the
`*PromptDefinition.name` (kebab-case), so lookup is `name → name.md`.

### Loader (`src/utils/prompt-template-loader.ts`)

Public API:

```typescript
renderPromptTemplate(name: string, vars: Record<string, unknown>): string;
clearPromptTemplateCache(): void; // mainly for tests
```

Behaviour:

- **Path resolution** — three candidates, mirrors `docs-parser.ts`:
  1. `dist/prompts/templates/<name>.md` (runtime after build).
  2. `src/prompts/templates/<name>.md` (monorepo dev under `tsc --watch`).
  3. `<cwd>/packages/reformer-mcp/src/prompts/templates/<name>.md` (cwd fallback).
- **Caches** — raw text and compiled `Handlebars.TemplateDelegate`, both keyed
  by template name.
- **Compile options** — `{ noEscape: true, strict: true }`. `noEscape` because
  every value is markdown/code (HTML-escape would corrupt `<`, `&`). `strict`
  because Handlebars otherwise silently inserts an empty string for an unknown
  variable.
- **Pre-validation** — before rendering, the loader regex-scans the template
  for top-level `{{var}}` references and throws if any are missing from `vars`,
  with both lists in the error message. This catches typos earlier than the
  Handlebars compile error and gives a friendlier message.
- **Raw helper** — `Handlebars.registerHelper('raw', …)` is registered so that
  literal `{{` / `}}` inside code blocks can be wrapped in `{{{{raw}}}}…{{{{/raw}}}}`
  without tripping `strict` mode (see «Handling `{{` collisions» below).

### Authoring conventions

#### Placeholders are precomputed values

Templates have **no logic** — no `{{#if}}`, no `{{#each}}`, no helpers beyond
`raw`. All conditional fragments are computed in the TS module and passed in as
ready-made strings. Examples from `create-form.ts`:

```typescript
const targetLabel =
  target === 'core'           ? '(только @reformer/core …)' :
  target === 'renderer-react' ? '(@reformer/renderer-react …)' :
                                '(@reformer/renderer-json …)';

const rendererBlock = target === 'renderer-react'
  ? `\n\n## RenderSchema (TS)\n\n${getSection('Quick Start', …)}…`
  : '';
```

Both end up in the template as `{{targetLabel}}` and `{{rendererBlock}}`.
Pushing the conditional into TS keeps the template scannable and the loader’s
pre-validation simple (it only counts top-level names).

#### Handling `{{` collisions

If a template contains literal `{{` outside a placeholder — typically in JSX
spread (`settings={{ fieldWrapper: FormField }}`) or Vue/Liquid examples in a
fenced code block — Handlebars in strict mode will treat it as an undefined
helper invocation and throw. Wrap the offending line(s) in a raw block:

````markdown
```tsx
{{{{raw}}}}<FormRenderer settings={{ fieldWrapper: FormField }} />{{{{/raw}}}}
```
````

````

Before adding a new prompt, grep its TS source for literal `{{` (anything not
inside a `${…}` interpolation) and decide which lines to wrap. Top files to
inspect: anything containing JSX, JSON examples, or generated config snippets.

#### `getSection` / `getFullDocs` always stay in TS

Documentation lookups are runtime calls into the cached `llms.txt` parsers and
have no business in markdown. Compute them in the TS module and feed the
resulting strings to the template:

```typescript
const text = renderPromptTemplate('add-behavior', {
  cycleDetection: getSection('Cycle', '@reformer/core'),
  watchField:     getSection('Async', '@reformer/core'),
  // …
});
````

### Build pipeline

`npm run build` chains:

1. `npm run generate:llms` — emits `llms.txt` for every workspace package.
2. `tsc` — compiles `src/` into `dist/` (TypeScript only).
3. `node scripts/copy-templates.mjs` — `fs.cpSync` of `src/prompts/templates/*.md`
   into `dist/prompts/templates/` (`tsc` does not copy non-TS assets).

`npm run dev` runs `tsc --watch` only; the loader’s second path candidate
reads `.md` directly from `src/`, so editing a template during `dev` reflects
immediately without re-running the copy step.

`package.json` `files: ["dist", "README.md"]` already covers the templates —
`npm pack --dry-run` lists `dist/prompts/templates/*.md` in the tarball.

## Debug Mode

Enable debug mode for development:

```bash
REFORMER_DEBUG=true node dist/index.js
```

Or with MCP Inspector:

```bash
REFORMER_DEBUG=true npx mcp-inspector node ./dist/index.js
```

## Debugging

### Logging

Use `console.error` for logging (stdout is reserved for MCP):

```typescript
console.error('Debug:', data);
```

### View MCP logs

```bash
# Windows
Get-Content ~\AppData\Roaming\Claude\logs\mcp.log -Tail 50 -Wait

# macOS
tail -f ~/Library/Logs/Claude/mcp.log

# Linux
tail -f ~/.config/Claude/logs/mcp.log
```

## Best Practices

1. **Use stderr for logging** - stdout is for MCP communication
2. **Validate inputs** - Always check tool arguments
3. **Handle errors gracefully** - Return helpful error messages
4. **Keep responses concise** - Large responses slow down Claude
5. **Cache when possible** - Documentation doesn't change often
6. **Use feature flags** - Hide debug/development features from production
