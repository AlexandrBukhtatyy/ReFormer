# API Reference

Complete API documentation for the ReFormer MCP server.

## Tools

### get_reformer_docs

Get the complete ReFormer documentation.

**Parameters:** None

**Returns:** Full documentation text in markdown format

**Example:**
```typescript
// In Claude Code, this is called automatically when asking about ReFormer
```

---

### search_docs

Search ReFormer documentation for specific topics.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search term to find in documentation |

**Returns:** Matching sections from documentation

**Example queries:**
- "validation"
- "ArrayNode"
- "useFormControl"
- "behaviors"

---

### get_api_reference

Get API reference for ReFormer methods and types.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `method` | string | No | Specific method/type to look up |

**Returns:**
- If `method` provided: Documentation for that method
- If not provided: Full API reference section

**Example methods:**
- "createForm"
- "FieldNode"
- "GroupNode"
- "ArrayNode"
- "useFormControl"
- "useFormControlValue"

---

### get_examples

Get code examples from ReFormer documentation.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `topic` | string | No | Topic to get examples for |

**Supported topics:**
- `validation` - Validation examples
- `behavior` / `behaviors` - Behavior examples
- `array` / `arrays` - Array handling examples
- `form` - Form schema examples
- `react` - React integration examples
- `hook` / `hooks` - React hooks examples

**Returns:** Code examples for the specified topic

---

### explain_error

Explain a ReFormer error or issue.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `error` | string | Yes | Error message or issue description |

**Returns:**
- Problem explanation
- Solution
- Related documentation

**Recognized error patterns:**
- Field not updating / not re-rendering
- Validation not triggering
- TypeScript type errors
- Form recreated every render
- Cannot read property / undefined
- Array index out of bounds

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

### reformer://api

API reference section only.

**MIME Type:** `text/markdown`

**Content:**
- createForm
- Node properties and methods
- SetValueOptions
- ValidationError
- FieldStatus
- Type guards

---

### reformer://examples

Code examples from documentation.

**MIME Type:** `text/markdown`

**Content:** First 10 code blocks from documentation

---

## Prompts

### reformer-help

Get help with ReFormer library.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | string | Yes | Question about ReFormer |

**Behavior:**
- Includes full documentation as context
- Provides accurate answers based on documentation
- Includes code examples where appropriate

---

### create-form

Generate a ReFormer form from description.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `description` | string | Yes | Description of the form to create |

**Generated output:**
1. TypeScript type definition
2. Form schema with `createForm<T>()`
3. Validation rules
4. React component with hooks

---

### manage-validation

Add, modify, or remove validation rules.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task` | string | Yes | Validation task description |

**Capabilities:**
- Add built-in validators (required, email, minLength, etc.)
- Create custom sync validators
- Create async validators
- Set up cross-field validation
- Remove existing validators

---

### manage-behavior

Add, modify, or remove reactive behaviors.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task` | string | Yes | Behavior task description |

**Capabilities:**
- computeFrom - Calculated fields
- enableWhen / disableWhen - Conditional fields
- watchField - React to changes
- copyFrom - Copy values between fields
- syncFields - Two-way sync
- resetWhen - Conditional reset
- revalidateWhen - Trigger revalidation

---

### debug-form

Help debug issues with a ReFormer form.

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Form code that has issues |

**Analysis performed:**
- Identify issues and anti-patterns
- Explain root causes
- Provide fixed code
- Suggest best practices

**Common checks:**
- useMemo for createForm
- useFormControl usage
- Type/schema matching
- Validator imports
- markAsTouched on blur
- Validation before submission
- Signal access patterns
