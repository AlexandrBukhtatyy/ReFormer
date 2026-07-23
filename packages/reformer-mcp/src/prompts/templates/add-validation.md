You add validation to an existing `@reformer/core` form (architecture M1).

Validation is a **separate** contract from layout and behavior: an ambient function
`defineValidationSchema<T>(({ model }) => { … })` fed to the runner `validateModel(model, schema)`.
Layout (`RenderNode` / JSON DSL) carries **no** validators — the rules live in this standalone
schema function and are injected at the runner. You author the schema; you do not touch the layout tree.

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

- **Validation is a standalone schema, not leaf metadata** — rules live in `defineValidationSchema<T>(({ model }) => { … })` and are wired to fields with the ambient operator `validate(sig, [rules])` (sig = `model.$.field`). The path-based engine (`ValidationSchemaFn` / `validate(path.field, …)` / `validation: (path) => {…}`), the leaf-node `validators: [...]` array, the `ModelValidator (value, scope, root)` shape, and the whole-model runner `validateFormModel(model, schema)` have all been **removed**. A rule is either a built-in factory (`required()`, `min(10)`, …) or a `Rule<T>` — an inline `(value) => ValidationError | null`.
- **Every** `required`/`min`/`max`/`minLength`/`maxLength`/`pattern`/`email` MUST take `{ message: 'осмысленный русский текст' }`. Default `"Поле обязательно для заполнения"` is unacceptable — UX bug.
- **Conditional validation** — wrap the branch in `validateWhen(() => cond, () => { … })`: the rules inside are active only while `cond` is true, and a field that leaves an off branch is auto-cleared (`setErrors([])`). There is no `{ when, children }` node and no `applyWhen`-in-validators anymore. A single check that returns `null` when off is still fine, but a whole conditional sub-tree belongs in `validateWhen`.
- **Cross-field rule = `cross(sig, fn)`**. `fn` receives the **snapshot** of the current scope's model (`model.get()`, typed as the whole form / enclosing sub-model), returns `ValidationError | null`, and the error lands on `sig` — the field that should carry it. Read siblings straight off that snapshot (`f.password`, `f.propertyValue`); do NOT reach into node internals (`ctx.form.X.value.value` is implementation detail, not public API). Extract the body as a plain `(f: Root) => ValidationError | null`.
- **Async = `validateAsync(sig, [asyncRules])`**. An `AsyncRule<T>` is `(value, { signal }) => Promise<ValidationError | null>`. The runner awaits it, hands it an `AbortSignal`, and cancels stale progs itself — you do NOT hand-roll a debounce. Still short-circuit cheap cases first (`if (!value || value.length < 3) return null;`), forward `signal` to `fetch`, and on a network error return `null` (a failed request must not block submit).
- **Re-validation on dependency change** — `validateModel` re-evaluates every `cross` on each prog (submit/step). To re-run a cross rule reactively when a _dependency_ field changes (before the next submit), bridge from behavior: `revalidateWhen([model.$.dependency], () => void validateModel(model, schema))` (`revalidateWhen` is a behavior operator, imported from `@reformer/core/behaviors`).
- **Arrays & composition** — per-item rules go through `each(model.arrayField, (im) => { … })` (`im` is the item `FormModel`); reuse a sub-model schema by calling it directly (`addressSchema({ model: model.registrationAddress })`, a `ValidationSchema<Address>` is just a function); compose several schemas over the same model with `apply(...schemas)`.
- **TS2589 on 70+ field forms** — annotate the model/schema types rather than casting rules. Prefer fixing the field type in `types.ts` (`number | null` → `number | undefined` if a `min`/`max` complains) over an `as never` cast; the built-in factories already accept nullable fields, so a cast is rarely needed — if unavoidable, narrow it to the single call-site, not the whole schema.
- **Extract named rules for anything non-trivial**. Inline is fine for a 1-line check (`(v) => v === true ? null : {...}` typed as a `Rule<T>`). Extract module-level — typed `Rule<T>` (value-level), `AsyncRule<T>` (async), or `(f: Root) => ValidationError | null` (cross-field) — for: bodies >5 lines, cross-field rules with branching, async validators with try/catch, reused checks (e.g. a `ruName(label)` helper returning `Rule<string>[]`). Name by semantics, not by operator (`passwordsMatch`, `initialPaymentVsProperty` — not `validateField1`).

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing validators. Skipping = wrong validators or wrong import paths.**

- `reformer://docs/core/api-signatures` (built-in validators API)
- `reformer://docs/core/common-patterns` (cross-field via the `cross` snapshot, conditional `validateWhen`, `revalidateWhen` bridge)
- `reformer://docs/core/common-mistakes`
- `reformer://docs/core/extended-common-mistakes`
- `reformer://docs/core/async-watchfield-critically-important` (async validation pattern)
- `reformer://docs/core/api-reference` (full validator catalogue)

## Task

1. Map each requirement to a built-in (`required`, `email`, `minLength`, `pattern`, `min`, `max`, `url`, `phone`, `isNumber`, `integer`, `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`) and wire it with `validate(model.$.field, [built-in])` inside the schema.
2. Custom value rules → a `Rule<T>` `(value) => ValidationError | null` placed in the same `validate(sig, [...])` array.
3. Async → `validateAsync(model.$.field, [asyncRule])` where the rule is `(value, { signal }) => Promise<…>`; short-circuit cheap cases, forward `signal` to `fetch`, return `null` on a network error.
4. Cross-field → `cross(model.$.field, (f) => …)` reading siblings off the snapshot `f`, attached to the error-carrying field. Add `revalidateWhen([model.$.dep], () => void validateModel(model, schema))` in the form's behavior if it must re-run on a dependency change before submit.
5. Conditional → wrap the branch in `validateWhen(() => cond, () => { … })`. Do NOT use a `{ when, children }` sub-tree.
6. Arrays / reuse / composition → per-item rules via `each(model.arrayField, (im) => { … })`; reuse a nested-group schema by direct call (`addressSchema({ model: model.registrationAddress })`); compose step schemas with `apply(...schemas)`.
7. Imports: `import { validate, validateAsync, validateWhen, cross, each, apply, defineValidationSchema, validateModel, type Rule, type AsyncRule, type ValidationSchema } from '@reformer/core/validation'` (operators + types), `import { required, email, min, max, … } from '@reformer/core/validators'` (built-in factories), `import { type FormModel, type ValidationError } from '@reformer/core'`, and — only for the re-validation bridge — `import { revalidateWhen } from '@reformer/core/behaviors'`. Don't reinvent built-ins.
8. Do NOT touch the layout tree — validation is a separate `ValidationSchema<T>`, wrapped in `defineValidationSchema<T>(({ model }) => { … })` (keep the schema in a stable module-level `const`). Run it on submit/step with `validateModel(model, schema)` → `Promise<boolean>` (`true` = no blocking errors). It routes errors into the form nodes (`getNodeForSignal(sig).setErrors(...)`), clears fields that became valid, and `severity:'warning'` never blocks. For a wizard, expose `makeValidationConfig(model) → { validateStep: (n) => validateModel(model, STEP_SCHEMAS[n-1]), validateAll: () => validateModel(model, fullSchema) }`.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Every built-in validator carries `{ message: '...' }`
- [ ] Rules live in a standalone `defineValidationSchema<T>(({ model }) => …)` wired via `validate(sig, [...])` — NOT `validators: [...]` on layout nodes, NOT a `(path) => {}` callback
- [ ] Cross-field rules use `cross(sig, (f) => …)` reading the snapshot `f`, attached to the error-carrying field (NOT `ctx.form.Y.value.value`)
- [ ] Conditional rules are wrapped in `validateWhen(() => cond, () => …)` (no `{ when, children }`)
- [ ] Async validators use `validateAsync(sig, [ (value, { signal }) => … ])`, short-circuit + forward `signal`, return `null` on network error
- [ ] No default «Поле обязательно для заполнения» messages reach UI
- [ ] Validation runs via `validateModel(model, schema)` (returns `Promise<boolean>`), NOT `validateFormModel`
- [ ] **Non-trivial callbacks (>5 lines) extracted module-level** as typed `Rule<T>` / `AsyncRule<T>` / `(f: Root) => ValidationError | null` functions; inline OK only for short single-line checks
