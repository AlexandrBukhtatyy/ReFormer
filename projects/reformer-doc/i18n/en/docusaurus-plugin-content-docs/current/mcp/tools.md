---
sidebar_position: 3
---

# Tools

The MCP server provides a set of tools that AI calls automatically when performing tasks.

## Code Generation

### generate_schema

Get template and rules for creating FormSchema.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `formType` | string | Form type: "registration", "checkout", "settings", etc. |

**Returns:**

- Type to component mapping (string → Input, boolean → Checkbox, etc.)
- Document masks for Russian documents (phone, INN, SNILS, passport)
- Schema structure rules
- Real project examples

---

### generate_types

Get template and rules for TypeScript form types.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `formType` | string | Form type for context |

**Returns:**

- Interface naming rules
- Typing rules (undefined instead of null, no index signatures)
- Type examples

---

### generate_validation

Get template and rules for ValidationSchema.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `formType` | string | Form type for context |

**Returns:**

- List of all built-in validators
- Usage syntax
- Import rules (`@reformer/core/validators`)
- Validation examples

---

### generate_behavior

Get template and rules for BehaviorSchema.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `formType` | string | Form type for context |

**Returns:**

- List of all behaviors (computeFrom, enableWhen, etc.)
- Usage syntax
- Import rules (`@reformer/core/behaviors`)
- Behavior examples

---

## Quality Checking

### check_code

Analyze form code for errors and quality issues.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | Yes | TypeScript code to analyze |

**Returns:**

- Quality score (0-100 points)
- List of errors with explanations
- Warnings
- Fix recommendations

**Checked rules:**

- Correct validator and behavior imports
- Presence of `value` in every field
- Use of `useMemo` for `createForm`
- Call to `markAsTouched` on blur
- Type checking before submission

---

## Development Assistance

### explain_error

Explain a ReFormer error with fix examples.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `error` | string | Yes | Error text or problem description |

**Recognized issues:**

- Field not updating on input
- Validation not triggering
- TypeScript type errors
- Form recreated on every render
- Cannot read property / undefined
- Array index out of bounds

---

### get_pattern

Get usage pattern example.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | Yes | Pattern name |

**Available patterns:**

- `conditional-fields` — conditional field display
- `computed-fields` — computed fields
- `cross-field-validation` — cross-field validation
- `async-validation` — async validation
- `array-fields` — working with arrays
- `multi-step-form` — multi-step forms
- `form-submission` — form submission

---

### get_recommended_structure

Get recommended project file structure.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `complexity` | string | Complexity: "simple", "medium", "complex" |

**Returns:**

- Folder structure
- File separation (types, schema, validation, behavior)
- Naming conventions

---

## Feedback Collection

### report_issue

Report an error and its solution for feedback collection.

**Parameters:**

| Parameter  | Type     | Required | Description                           |
| ---------- | -------- | -------- | ------------------------------------- |
| `error`    | string   | Yes      | Error message or problem description  |
| `solution` | string   | Yes      | Solution or fix                       |
| `tags`     | string[] | No       | Tags for categorization and analytics |
| `context`  | object   | No       | Additional context (see below)        |

**Structure of `context`:**

| Field                    | Type     | Description                     |
| ------------------------ | -------- | ------------------------------- |
| `examples`               | array    | Code examples with descriptions |
| `examples[].description` | string   | Example description             |
| `examples[].code`        | string   | Example code                    |
| `relatedFiles`           | string[] | Paths to related files          |
| `notes`                  | string   | Additional notes                |

**Recommended tags:**

| Format             | Example                                    | Description                                                 |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------- |
| `category:<type>`  | `category:behavior`, `category:validation` | Category: schema, validation, behavior, react, types, other |
| `agent:<name>`     | `agent:claude`, `agent:cursor`             | AI agent name                                               |
| `severity:<level>` | `severity:critical`, `severity:minor`      | Issue severity                                              |

**Returns:**

Confirmation of successful report submission.

**How it works:**

1. AI encounters an error while working with ReFormer
2. AI solves the problem
3. AI calls `report_issue` with error description and solution
4. Data is saved locally to `~/.reformer/issues.jsonl`

**Example usage:**

```
AI found error: "Cycle detected in computeFrom"
AI identified cause: effect depends on target field
AI calls report_issue:
  - error: "Infinite loop in computeFrom when effect depends on target"
  - solution: "Use peek() instead of .value to read target without dependency"
  - tags: ["category:behavior", "agent:claude", "severity:critical"]
  - context:
      examples:
        - description: "Wrong - creates dependency"
          code: "const current = targetNode.value.value;"
        - description: "Correct - no dependency"
          code: "const current = targetNode.value.peek();"
      relatedFiles: ["packages/reformer/src/core/behavior/behaviors/compute-from.ts"]
```

**Storage format (JSONL):**

```json
{"timestamp":"2025-01-15T10:30:00Z","error":"...","solution":"...","tags":["category:behavior"],"context":{"examples":[...],"notes":"..."}}
```

Each line is a separate JSON object. This allows easy appending and data analysis.

## Why collect feedback?

Issue reports help:

- Identify common user problems
- Improve documentation
- Find library bugs
- Understand which patterns cause difficulties

All data is stored **locally** on your computer.
