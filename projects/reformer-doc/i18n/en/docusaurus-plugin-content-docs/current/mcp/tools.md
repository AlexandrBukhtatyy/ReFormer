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
