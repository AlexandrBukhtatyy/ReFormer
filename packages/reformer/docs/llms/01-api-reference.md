## 1. API Reference

### Imports (CRITICALLY IMPORTANT)

| What                                                                                        | Where                       |
| ------------------------------------------------------------------------------------------- | --------------------------- |
| `createForm`, `useFormControl`, `useFormControlValue`, `validateForm`                       | `@reformer/core`            |
| `ValidationSchemaFn`, `BehaviorSchemaFn`, `FieldPath`, `FormProxy`, `FieldNode` | `@reformer/core`            |
| `FormSchema`, `FieldConfig`, `ArrayNode`                                                    | `@reformer/core`            |
| `required`, `min`, `max`, `minLength`, `maxLength`, `email`                                 | `@reformer/core/validators` |
| `pattern`, `url`, `phone`, `number`, `date`                                                 | `@reformer/core/validators` |
| `validate`, `validateAsync`, `validateGroup`, `applyWhen`, `apply`                          | `@reformer/core/validators` |
| `notEmpty`, `validateItems`                                                                 | `@reformer/core/validators` |
| `computeFrom`, `enableWhen`, `disableWhen`, `watchField`, `copyFrom`                        | `@reformer/core/behaviors`  |
| `resetWhen`, `revalidateWhen`, `syncFields`                                                 | `@reformer/core/behaviors`  |
| `transformValue`, `transformers`                                                            | `@reformer/core/behaviors`  |

### Type Values

- Optional numbers: `number | undefined` (NOT `null`)
- Optional strings: `string` (empty string by default)
- Do NOT add `[key: string]: unknown` to form interfaces

### React Hooks Comparison (CRITICALLY IMPORTANT)

| Hook | Return Type | Subscribes To | Use Case |
|------|-------------|---------------|----------|
| `useFormControl(field)` | `{ value, errors, disabled, touched, ... }` | All signals | Full field state, form inputs |
| `useFormControlValue(field)` | `T` (value directly) | Only value signal | Conditional rendering |

**CRITICAL**: Do NOT destructure `useFormControlValue`! It returns `T` directly, NOT `{ value: T }`.

```typescript
// WRONG - will always be undefined!
const { value: loanType } = useFormControlValue(control.loanType);

// CORRECT
const loanType = useFormControlValue(control.loanType);

// CORRECT - useFormControl returns object, destructuring OK
const { value, errors, disabled } = useFormControl(control.loanType);
```
