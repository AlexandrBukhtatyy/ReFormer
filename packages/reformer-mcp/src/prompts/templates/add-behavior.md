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
9. **NEVER combine raw `effect()` from `@preact/signals-core` with signal-write calls** (`schema.node().setHidden()`, `field.setValue()`, `field.disable()`, etc.) **inside the same callback**. setHidden writes the hidden-signal → effect dependency graph re-runs → infinite loop with «Cycle detected» runtime error.

   **For React-side orchestration (B3 setHidden cascade в renderer-json A4 wizard pair, любые JSX-condition реакции на signals):** используй `useFormControlValue(form.X)` для signal→React-state bridge + **отдельный `useEffect` per source/condition**. React deps prevent infinite re-trigger.

   ```tsx
   // ❌ Cycle detected — effect reads signal, setHidden writes signal
   useEffect(() => {
     const dispose = effect(() => {
       const loanType = form.loanType.value.value;
       schema.node('mortgage-section').setHidden(loanType !== 'mortgage');
       schema.node('car-section').setHidden(loanType !== 'car');
     });
     return dispose;
   }, [schema, form]);

   // ✅ React-mediated — signal subscribed via useFormControlValue, useEffect runs on deps change
   const loanType = useFormControlValue(form.loanType as never) as string;
   useEffect(() => {
     schema.node('mortgage-section').setHidden(loanType !== 'mortgage');
     schema.node('car-section').setHidden(loanType !== 'car');
   }, [schema, loanType]);
   ```

   `effect()` raw — только для side-effects вне React (`console.log`, fetch, broadcasting events). Внутри React tree всегда mediate через `useFormControlValue`.

10. **`computeFrom` source-subscription rule** — values-объект, который computeFn получает, строится по **last-segment keys** path-источников. Если computeFn читает `form.<group>.<field>` (nested), подписывайся на **group node** (`[path.<group>]`) — values придёт как `{ <group>: { <field>: ... } }`. Если подписаться на отдельные leaves (`[path.<group>.<fieldA>, path.<group>.<fieldB>]`), values станет flat (`{ <fieldA>, <fieldB> }`) — computeFn получит plain object без вложенности и тихо вернёт пустоту/0/undefined. **`as never` cast в `[...sources] as never` — red flag**: если cast скрывает type error в `computeFrom` — это значит subscription mistyped. Зарефактори: либо подписка на group, либо computeFn перепиши под flat shape.

   ```typescript
   // ❌ silent fail — computeFn видит { lastName, firstName, middleName }, а читает form.personalData.lastName
   computeFrom<MyForm, string>(
     [path.personalData.lastName, path.personalData.firstName, path.personalData.middleName] as never,
     path.fullName,
     (form) => [form.personalData?.lastName, form.personalData?.firstName].filter(Boolean).join(' ')
   );

   // ✅ group node subscription — computeFn получает { personalData: { lastName, firstName, ... } }
   computeFrom(
     [path.personalData],
     path.fullName,
     (values) => {
       const pd = values.personalData;
       return [pd?.lastName, pd?.firstName, pd?.middleName].filter(Boolean).join(' ').trim();
     }
   );
   ```

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
- [ ] `computeFrom` sources subscribe to group node когда computeFn читает nested fields (rule #10); никаких `as never` cast'ов на источниках
- [ ] Никаких raw `effect()` + signal-write комбинаций (rule #9); React orchestration через `useFormControlValue` + `useEffect`
- [ ] Hide-vs-Disable choice documented per conditional field
- [ ] Short risk summary at end