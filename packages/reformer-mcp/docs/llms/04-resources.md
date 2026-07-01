# Resources

Documentation the server serves as MCP resources (use ListResources to enumerate, ReadResource
to fetch). All are `text/markdown`.

## URI scheme

- `reformer://guide` — this server's full self-doc (workflow + tools + prompts + resources). The entry point in resource form (mirrors the `start-here` prompt).
- `reformer://docs/<pkg>` — the full `llms.txt` of one library package (every section concatenated).
- `reformer://docs/<pkg>/<section-slug>` — a single `##` section of a package, by slug.

`<pkg>` is a short name: `core`, `cdk`, `ui-kit`, `renderer-react`, `renderer-json`, `mcp`.

## Self-documentation (this server)

- `reformer://guide` — the whole self-doc in one document (guide + tools + prompts + resources + workflow).
  Equivalent to `reformer://docs/mcp` (the full mcp `llms.txt`).
- Individual sections are addressable, but their slug is derived from the section's H2 heading, not the
  filename. Enumerate exact URIs with ListResources. Examples of real slugs:
  `reformer://docs/mcp/validate-json-schema`, `reformer://docs/mcp/schema-field-leaves`,
  `reformer://docs/mcp/checklist-before-you-finish`.

## Library docs (the 5 packages)

Each package's sections come from its `docs/llms/*.md`. Discover exact slugs with ListResources.
Examples:

- `reformer://docs/core` — model, schema, validators, behaviors, arrays, multi-step, common mistakes (~50 sections).
- `reformer://docs/cdk/form-array`, `reformer://docs/cdk/form-navigation` — FormArray / FormWizard compounds.
- `reformer://docs/ui-kit/form-field-integration`, `reformer://docs/ui-kit/choice-fields` — components.
- `reformer://docs/renderer-react/render-schema`, `.../render-behavior` — RenderSchema.
- `reformer://docs/renderer-json/json-schema`, `.../registry` — JSON DSL + registry.

## How this relates to tools

`find_recipe` reads the same `docs/llms/*.md` directly (with alias resolution); resources give
you the raw sections when you want to browse or read a whole package. When you know the scenario,
`find_recipe` is faster; when you want the full section text, read the resource.
