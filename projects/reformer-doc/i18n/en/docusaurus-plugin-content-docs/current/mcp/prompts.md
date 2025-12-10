---
sidebar_position: 4
---

# Prompts

Prompts are pre-built templates for common tasks. AI uses them to perform complex operations.

## create-form

Generate a form from a text description.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `description` | Yes | Form description in natural language |

**Example request:**

```
Create a registration form with email, password, and confirm password
```

**What gets generated:**
1. TypeScript interface for the form
2. Form schema (FormSchema) with components
3. Validation rules (ValidationSchema)
4. React component with hooks

**Workflow:**

AI sequentially uses tools:
1. `get_recommended_structure` — project structure
2. `generate_types` — TypeScript types
3. `generate_schema` — form schema
4. `generate_validation` — validation
5. `generate_behavior` — behaviors (if needed)
6. `check_code` — quality check

---

## generate-step-form

Generate a multi-step form.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `description` | Yes | Description of form steps |

**Example request:**

```
Create a credit application form with steps:
1. Personal info (name, date of birth)
2. Contact info (phone, email)
3. Documents (passport, SSN)
4. Confirmation
```

**Features:**
- Separation into steps with individual schemas
- Navigation between steps
- Validation of each step separately

---

## generate-array-form

Generate a form with dynamic arrays.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `description` | Yes | Description of form with arrays |

**Example request:**

```
Create an order form with a dynamic list of items (name, quantity, price) and automatic total calculation
```

**Features:**
- Using ArrayNode
- Adding/removing elements
- Computed fields (subtotal, total)

---

## manage-validation

Manage validation rules.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `task` | Yes | Task description |

**Example requests:**

```
Add email validation to the userEmail field
```

```
Make the phone field required only if contact method is "phone"
```

```
Add a check that password and confirmation match
```

**Capabilities:**
- Add built-in validators
- Create custom validators
- Async validation
- Cross-field validation

---

## manage-behavior

Manage form behaviors.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `task` | Yes | Task description |

**Example requests:**

```
Add automatic calculation total = price * quantity
```

```
Hide the companyName field if userType !== "company"
```

```
Copy billingAddress to shippingAddress when sameAddress checkbox is checked
```

**Capabilities:**
- `computeFrom` — computed fields
- `enableWhen` / `disableWhen` — conditional enabling
- `watchField` — react to changes
- `copyFrom` — copy values
- `syncFields` — two-way sync
- `resetWhen` — reset on condition

---

## debug-form

Debug form issues.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `code` | Yes | Form code with the issue |

**Example request:**

```
Why doesn't my form show validation errors?

[form code]
```

**What gets checked:**
- Use of `useMemo` for `createForm`
- Correct `useFormControl` and `useFormControlValue` usage
- Type and schema matching
- Validator imports
- Call to `markAsTouched` on blur
- Call to `validate()` before submission

---

## reformer-help

General ReFormer help.

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `question` | Yes | Question about the library |

**Example requests:**

```
How does reactivity work in ReFormer?
```

```
What validators are available out of the box?
```

```
How do I make conditional field display?
```

AI answers based on up-to-date ReFormer documentation.
