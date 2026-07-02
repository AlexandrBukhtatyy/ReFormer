# API Reference

Complete API documentation for the ReFormer MCP server.

## Tools

### report_issue

Report an issue encountered while working with ReFormer and its solution.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `error` | string | Yes | The error message or problem description |
| `solution` | string | Yes | The solution or fix that resolved the issue |
| `tags` | string[] | No | Tags for categorization (e.g., `category:behavior`, `agent:claude`, `severity:critical`) |
| `context` | object | No | Additional context with `examples`, `relatedFiles`, `notes` |

**Returns:** Confirmation of successful report

**Example:**

```json
{
  "error": "Infinite loop in computeFrom when effect depends on target",
  "solution": "Use peek() instead of .value to read target without dependency",
  "tags": ["category:behavior", "agent:claude", "severity:critical"],
  "context": {
    "examples": [
      { "description": "Wrong", "code": "const v = targetNode.value.value;" },
      { "description": "Correct", "code": "const v = targetNode.value.peek();" }
    ],
    "relatedFiles": ["packages/reformer/src/core/behavior/behaviors/compute-from.ts"]
  }
}
```

**Storage:** Reports are saved to `~/.reformer/issues.jsonl` in JSONL format.

---

### debug (Debug Mode Only)

Debug tool for MCP server development. Only available when `REFORMER_DEBUG=true`.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `section` | string | No | Optional section to return |

**Returns:** Debug information and documentation stats

---

## Resources

### reformer://docs

Complete ReFormer library documentation.

**MIME Type:** `text/markdown`

**Content:** Full llms.txt documentation including:

- Installation
- Quick Start
- Architecture
- Form Schema
- Node Types
- Validation
- Behaviors
- React Integration
- API Reference
- Common Patterns
- FAQ

---

### reformer://docs/<pkg>/<section>

A single H2 section of a package, addressed by slug (enumerate exact URIs via ListResources).

**MIME Type:** `text/markdown`

> Public symbols/signatures and recipes are **tools**, not resources: use `list_symbols`,
> `get_symbol_docs`, `find_recipe`.

---

### reformer://debug (Debug Mode Only)

Debug information for MCP server development.

**MIME Type:** `text/markdown`

**Content:** Debug stats and information

---

## Prompts

### debug (Debug Mode Only)

Analyze ReFormer form code for issues. Only available when `REFORMER_DEBUG=true`.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | ReFormer form code to analyze |

**Returns:** Analysis with documentation context

---

## Debug Mode

To enable debug features, set the environment variable:

```bash
REFORMER_DEBUG=true node dist/index.js
```

Or when registering with Claude Code:

```bash
claude mcp add --transport stdio reformer -e REFORMER_DEBUG=true -- node /path/to/dist/index.js
```

Debug mode enables:

- `debug` tool
- `debug` prompt
- `reformer://debug` resource
