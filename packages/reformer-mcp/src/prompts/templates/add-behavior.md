You add behaviors to a `@reformer/core` form.

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{{code}}
```

## ⛔ Critical inline rules — CYCLE PREVENTION (do not skip)

A reactive cycle hangs the browser at mount. These rules are non-negotiable:

1. **Start with declarative only**: `enableWhen` / `disableWhen` / `copyFrom`. NO `watchField` / `computeFrom` on iteration 1. Verify mount works, then add computed.
2. **Every `watchField` MUST take `{ immediate: false }`**. No exceptions.
3. **`watchField` accepts ONE path** (signature: `watchField(path, callback, options)`). Array-of-paths is NOT supported — runtime breaks (`Cannot read properties of undefined (reading 'startsWith')`). For multiple triggers — multiple `watchField` calls on different paths, all calling a shared compute function.
4. **Guard every `setValue`**: compare with current value, abort if equal (for arrays — compare `length`).
5. **Guard `enable`/`disable`**: check `field.disabled.value` first — re-disable triggers spurious signal.
6. **Don't use `revalidateWhen` if `copyFrom` + validators on target already cover it.**
7. **`computeFrom` only same-level** — for cross-level use `watchField`.
8. **NEVER `enableWhen` on a whole `ArrayNode` with `resetOnDisable: true`** — verified browser-hang. For conditional array visibility use JSX-conditional (`{form.flag.value && <ArrayUI/>}`).

## 🎯 Hide vs Disable

- **Hide** (JSX-conditional / `hideWhen` / `setHidden`) → field disappears from DOM. Use for type/status conditions (`loanType=mortgage`, `employmentStatus=employed`).
- **Disable** (`enableWhen`) → field stays visible, control greyed out. Use only for progressive disclosure (`confirmPassword` after `password`).

For type/status conditional fields **default = Hide, NOT Disable**.

## TS2589 workaround (deeply nested forms)

```typescript
// useFormControlValue with deep path
const v = useFormControlValue(form.step1.foo as never) as string;
// validateForm root cast
await validateForm(form as unknown as GroupNode<MyForm>, STEP_VALIDATIONS[step]);
// validation/behavior callbacks
const behavior = (path: any): void => { ... };
```

Don't cast on simple forms — only when TS2589 actually appears.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing behaviors. Skipping = browser hang risk.**

- `reformer://docs/core/cycle-detection-prevention-checklist` (КРИТИЧНО — full checklist)
- `reformer://docs/core/cycle-detected-error` (how the runtime reports it)
- `reformer://docs/core/compute-from-vs-watch-field` (which to choose)
- `reformer://docs/core/async-watchfield-critically-important` (async, debounce, guards)
- `reformer://docs/core/common-patterns` (apply, copyFrom recipes)
- `reformer://docs/core/common-mistakes`
- `reformer://docs/core/extended-common-mistakes`
- `reformer://docs/core` (aggregator — for `copyFrom` / `syncFields` / `resetWhen` / `transformValue` / `revalidateWhen` per-behavior sections)

## Task

1. Map each requirement to a behavior (`computeFrom` / `watchField` / `enableWhen` / `disableWhen` / `copyFrom` / `syncFields` / `resetWhen` / `transformValue` / `revalidateWhen`).
2. Use `apply([...paths], schema)` if a behavior repeats across multiple fields/groups.
3. Walk the cycle-prevention checklist for each `watchField`/`computeFrom` you add.
4. Don't duplicate existing `watchField` callbacks — extend them.
5. `computeFrom` only same-level.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Every `watchField` has `{ immediate: false }`
- [ ] Every `setValue` has equality guard
- [ ] No `enableWhen` on whole ArrayNode
- [ ] `computeFrom` not used cross-level
- [ ] Hide-vs-Disable choice documented per conditional field
- [ ] Short risk summary at end