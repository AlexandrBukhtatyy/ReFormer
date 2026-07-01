You add validation to an existing `@reformer/core` form (architecture M1).

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{
  {
    code;
  }
}
```

## Critical inline rules

- **Validators live on the leaf node** — `validators: [...]` inside the field node of the schema, NOT in a separate `(path) => {}` callback. The path-based validation engine (`ValidationSchemaFn` / `validate(path.field, ...)` / `validation: (path) => {...}`) has been **removed**. A validator is either a built-in factory (`required()`, `min(10)`, …) or a `ModelValidator` function `(value, scope, root) => ValidationError | null`.
- **Every** `required`/`min`/`max`/`minLength`/`maxLength`/`pattern`/`email` MUST take `{ message: 'осмысленный русский текст' }`. Default `"Поле обязательно для заполнения"` is unacceptable — UX bug.
- **Conditional validation** — a `ModelValidator` reads `root` and returns `null` when its condition is off (e.g. `(_v, _s, root) => root.loanType !== 'mortgage' ? null : min(1000000)(_v)`), OR wrap a conditional sub-tree in a `{ when, children }` node so the engine skips it entirely when the condition is false. There is no `applyWhen`-in-validators anymore.
- **Custom / cross-field rule = `ModelValidator<TField, TScope, TRoot>`**. Signature `(value, scope, root) => null | { code, message }`. **Cross-field validations** read sibling fields via the typed `root` (whole form) or `scope` (enclosing sub-model for array items), and are attached to the field that should carry the error. Do NOT reach into node internals (`ctx.form.X.value.value` is implementation detail, not public API).
- **Async**: an `async ModelValidator` (returns a `Promise`). Debounce network calls and guard against stale results; never `await fetch` unconditionally on every keystroke — short-circuit with `if (!value || value.length < 3) return null;` first.
- **Re-validation on dependency change** — a cross-field rule only re-runs when its host field changes. To re-run it when a _dependency_ changes, add `revalidateWhen([model.$.dependency], () => validateFormModel(model, schema))`.
- **TS2589 on 70+ field forms** — annotate the model/schema types rather than casting validators. Prefer fixing the field type in `types.ts` (`number | null` → `number | undefined` if a `min`/`max` complains) over an `as never` cast; if a cast is unavoidable, narrow it to the single call-site, not the whole schema.
- **Extract named rules for anything non-trivial**. Inline is fine for a 1-line check (`(v) => v === true ? null : {...}`). Extract module-level, typed as `ModelValidator<TField, TScope, TRoot>`, for: bodies >5 lines, cross-field rules with branching, async validators with try/catch, reused checks. Name by semantics, not by operator (`passwordsMatch`, `initialPaymentVsProperty` — not `validateField1`).

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing validators. Skipping = wrong validators or wrong import paths.**

- `reformer://docs/core/api-signatures` (built-in validators API)
- `reformer://docs/core/common-patterns` (cross-field via `root`, conditional, `revalidateWhen`)
- `reformer://docs/core/common-mistakes`
- `reformer://docs/core/extended-common-mistakes`
- `reformer://docs/core/async-watchfield-critically-important` (async validation pattern)
- `reformer://docs/core/api-reference` (full validator catalogue)

## Task

1. Map each requirement to a built-in (`required`, `email`, `minLength`, `pattern`, `min`, `max`, `url`, `phone`, `isNumber`, `integer`, `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`) and add it to the field's `validators: [...]` array.
2. Custom rules → a `ModelValidator` `(value, scope, root) => ...` in the same `validators` array.
3. Async → an `async ModelValidator` with a debounce + stale-result guard.
4. Cross-field → a `ModelValidator` reading sibling values via `root`, attached to the error-carrying field. Add `revalidateWhen` if it must re-run on a dependency change.
5. Conditional → a `ModelValidator` that returns `null` when off, or a `{ when, children }` sub-tree.
6. Imports: `import { required, email, min, max, ... } from '@reformer/core/validators'` (built-in factories) and `import { validateFormModel, type ModelValidator } from '@reformer/core'`. Don't reinvent built-ins.
7. Don't change the schema structure — only add `validators` to leaf nodes (and, if needed, named `ModelValidator` functions above the schema).
8. Run validation on submit/step with `validateFormModel(model, schema)` — it routes errors into the form nodes; read `result.valid` / `result.errors`.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Every built-in validator carries `{ message: '...' }`
- [ ] Validators live in the leaf node's `validators: [...]` array (NOT a `(path) => {}` callback)
- [ ] Cross-field rules are `ModelValidator`s reading `root`, attached to the error-carrying field (NOT `ctx.form.Y.value.value`)
- [ ] Conditional rules return `null` when off, or use a `{ when, children }` sub-tree
- [ ] Async validators (if any) have debounce + stale-result guard
- [ ] No default «Поле обязательно для заполнения» messages reach UI
- [ ] Validation runs via `validateFormModel(model, schema)`
- [ ] **Non-trivial callbacks (>5 lines) extracted module-level** as typed `ModelValidator<TField, TScope, TRoot>` functions; inline OK only for short single-line checks
