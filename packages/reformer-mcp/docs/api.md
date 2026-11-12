# API Reference

The surface of `@reformer/mcp` 7.0 in one page. Arguments, answers and examples live in the
server's self-documentation (`docs/llms/`, served as `reformer://docs/mcp`); this page names what
exists and where it is described, so it does not drift from the code.

## Tools

Ten tools; an eleventh, `debug`, exists only with `REFORMER_DEBUG=true`. The browser worker has only
the first seven — it builds no forms and writes no files.

| Tool              | What it does                                                                       | Worker |
| ----------------- | ---------------------------------------------------------------------------------- | ------ |
| `get_context`     | Context for one step: operator, signature, example, rules, anti-patterns           | ✓      |
| `choose_api`      | Which operator meets a requirement stated in words; its form in `form.intent.json` | ✓      |
| `get_symbol_docs` | Full JSDoc of one public symbol                                                    | ✓      |
| `find_recipe`     | A worked example for a scenario keyword                                            | ✓      |
| `search_docs`     | Full-text search over every documentation section                                  | ✓      |
| `list_symbols`    | Public symbols by kind, package, name                                              | ✓      |
| `validate_form`   | Checks by `kind`: `code`, `json-schema`, `behaviors`, `bundle`, `layout`           | ✓      |
| `plan_form`       | A markdown spec → a draft `<dir>/form.intent.json` on disk                         | —      |
| `form_build`      | `<dir>/form.intent.json` → the form module on disk; or the intent grammar          | —      |
| `report_issue`    | A problem and its fix → a JSON report on disk                                      | —      |

Details: [docs/llms/02-tools.md](./llms/02-tools.md). The codes of findings:
[docs/llms/08-diagnostic-codes.md](./llms/08-diagnostic-codes.md).

## Resources

| URI                            | Content                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `reformer://guide`             | Start here (≤ 6 KB): the one path to a form; in the worker — the map of its reference tools |
| `reformer://catalog`           | JSON map: package → documentation sections (slug, title)                                    |
| `reformer://status`            | JSON: packages found, type-checking, kit catalog, build id and corpus hash                  |
| `reformer://docs/<pkg>`        | The whole `llms.txt` of a package (`core`, `cdk`, `ui-kit`, …, `mcp`)                       |
| `reformer://docs/<pkg>/<slug>` | One section; slugs come from `reformer://catalog` or `search_docs`                          |
| `reformer://debug`             | Debug stats — only with `REFORMER_DEBUG=true`                                               |

Details: [docs/llms/04-resources.md](./llms/04-resources.md). The worker has no
`reformer://docs/mcp`: its corpus leaves out the docs of the server itself.

## Prompts

Node server only — prompts are rendered from template files.

| Prompt             | Arguments (\* required)                    |
| ------------------ | ------------------------------------------ |
| `start-here`       | —                                          |
| `discover-context` | `description`\*, `projectPath`             |
| `plan-form`        | `specPath`\*, `target`, `projectPath`      |
| `create-form`      | `description`\*, `target`, `projectPath`   |
| `add-feature`      | `feature`\*, `requirements`\*, `code`      |
| `to-renderer`      | `code`, `target`                           |
| `review`           | `code`\*                                   |
| `debug`            | `code`\* — only with `REFORMER_DEBUG=true` |

Details: [docs/llms/03-prompts.md](./llms/03-prompts.md).

## Entry points

| Import                     | Content                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `@reformer/mcp`            | The stdio server (`bin`: `reformer-mcp`); run it, do not import it                  |
| `@reformer/mcp/core`       | `createKnowledge(sources)`, `memoize`, knowledge types                              |
| `@reformer/mcp/browser`    | `createBrowserKnowledge(input)` — knowledge from data already loaded                |
| `@reformer/mcp/intent`     | The intent compiler and its judge as pure functions: `readIntent`, `judgeIntent`, … |
| `@reformer/mcp/build-info` | `BUILD_ID` (hash of the sources) and `buildIdOf(version)`                           |
| `@reformer/mcp/*`          | Package files: `llms.txt`, `docs/llms/*.md`, `dist/worker/server.js`                |

Details: [docs/llms/07-embedding.md](./llms/07-embedding.md).

## Environment variables

| Variable                     | Effect                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- |
| `REFORMER_ISSUE_REPORTS_DIR` | Directory of `report_issue` reports; an absolute path (`~` allowed)     |
| `REFORMER_DEBUG`             | `true` — the `debug` tool and prompt, the `reformer://debug` resource   |
| `REFORMER_TRACE_FILE`        | A JSON line per call, for measurements                                  |
| `REFORMER_TRACE_FULL`        | `1` — the trace keeps full arguments and answer text                    |
| `REFORMER_TYPECHECK_ROOT`    | A fallback root where `form_build` finds `@reformer/*` and `typescript` |

Register with a variable: `claude mcp add --transport stdio reformer -e REFORMER_DEBUG=true -- npx -y @reformer/mcp`.
