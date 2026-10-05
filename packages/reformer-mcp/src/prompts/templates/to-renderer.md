You move a form from markup written by hand in JSX to markup drawn by `FormRenderer` (`@reformer/renderer-react`) from the schema.

## Current code

```typescript
{{code}}
```

## What changes and what does not

The contract of the form is the same for both ways of drawing: `model.ts`, `form.validation.ts`, the model part of `form.behavior.ts` and the assembly call `createForm` stay **as they are**. What changes:

1. the schema grows **containers** — the markup that used to be JSX (sections, grids, the wizard) becomes nodes around the same field nodes;
2. conditions that used to be JSX (`{cond && <X />}`) become **rules for schema nodes** in the same `form.behavior.ts`;
3. the JSX is replaced by one `<FormRenderer form={bundle} … />`.

## Critical inline rules

- **Do NOT touch the data layer** — the model factory, the validation schema and the model links of the behavior stay as-is. The schema carries **no** validators: there is no leaf `validators: [...]` array (the old shape), validation stays a standalone `defineValidationSchema<T>(({ model }) => …)`.
- **One schema, not two.** There is no separate «render schema» next to a «form schema»: the tree you already have (`(model) => node`) is the tree the renderer draws. Add containers to it; do not write a second file that describes the same fields again.
- Field node: `{ model: model.$.<field>, component: Input, componentProps: { ... } }` — the binding key is `model`, the value is the handle `model.$.<field>`, `component` is the UI component by reference. The keys `value:` / `array:` are the former contract — ❌ do not emit.
- Container node: `{ component: Box, componentProps: { className: '...' }, children: [ ...nodes ] }` — `children` is a **top-level** property, NOT inside `componentProps`. Containers from `@reformer/ui-kit`: `Box`, `Section`, `Collapsible`, `AsyncBoundary`; an HTML tag is allowed as `component: 'div'`.
- Array node: `{ model: model.$.<path>, component: FormArray, componentProps: { ... }, item: itemRow }` — `itemRow = (model: FormModel<Item>) => node`, leaves inside bind to the row's own handles (`model.$.<field>`). `component` is required for add/remove/reorder UI: the renderer ships no array markup, it only iterates and hands the component ready-made `items` plus `onAdd`/`onRemove`/`onMove`. Use `FormArray` (editable) or `List` (display-only) from `@reformer/ui-kit`. The template of a new row lives in the model (`arrayOf(blankItem)`); the node needs no `initialValue`, and the `initialValue` prop of a JSX array section goes away with the JSX.
- Sub-form: `{ model: model.$.<group>, part: groupPart }` — a part declared once and mounted wherever needed; a repeated JSX sub-component (`<AddressForm control={…} />` used twice) becomes one part used twice.
- **The builder takes the model only**: `(model: FormModel<T>) => FormSchemaNode`. No `(model, form?)` second parameter, no `RenderSchemaFn`, no `createRenderSchema` call by hand — `createForm` builds the tree once and the bundle carries it.
- **Draw the bundle**: `<FormRenderer form={bundle} settings=\{{ fieldWrapper: FormField }} />`. `fieldWrapper: FormField` (ui-kit) wraps every field in label/error/hint automatically.
- **Wizard** — if the source form is a wizard, it becomes a schema node: `{ selector: 'wizard', component: FormWizard, children: [ …step nodes… ] }`, each step `{ selector: 'loan', component: Step, componentProps: { title, icon }, children }` (`Step` from `@reformer/cdk/form-wizard`). The step `selector` is the key of its rules in `validation.steps`. The wizard takes the form and the validation from the assembly itself: there is NO `onInit`/`patchProps({ form, config })` injection and no `makeValidationConfig(model)` — both are the former contract. Submit becomes `onComponentEvent(schema.node('wizard'), 'onSubmit', handler)` in the behavior.
- **Selectors**: add `selector: 'unique-name'` to every node a rule addresses.
- **Conditional visibility**: JSX `{cond && <X/>}` → `hideWhen(schema.node('x'), () => !cond)` inside the SAME `defineFormBehavior<T>(({ model, form, schema }) => …)`, next to the model links. The condition reads the model (`model.loanType`), so one constant can serve both `enableWhen` and `hideWhen`. `hideWhen` only hides — the field stays in the model and is still validated; pair it with `enableWhen` when it must stop participating.
- **There is ONE behavior.** No `form.render.ts`, no `renderBehavior` field, no `RenderBehaviorFn` factory `(form, model, validation) => (schema) => …` — those are the former contract. Operators for nodes (`hideWhen`, `onComponentEvent`, `renderEffect`, `onInit`, `onMount`, `onUnmount`) are imported from `@reformer/core/behaviors`, the same module as `compute` and `enableWhen`.
- **Scopes are isolated**: `schema.node(selector)` in the root behavior sees the root tree only. Nodes inside an array `item` or a sub-form `part` are reached from the sub-behavior given to `applyEach(model.$.items, itemBehavior)` / `apply(model.$.group, groupBehavior)` — it receives its own `schema`.
- **Stable assembly**: `const bundle = useFormBundle(() => createForm({ … }))` — a lazy `useState`, so the factory runs once. `useMemo` is ❌ wrong here: React may drop its cache, rebuilding the form and losing behavior effects together with typed input.
- **Don't migrate trivial forms** — for < 5 fields direct JSX stays cleaner.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing the schema. Skipping = wrong API or missing helpers.**

- `find_recipe unified-contract`
- `reformer://docs/renderer-react/quick-start`
- `reformer://docs/renderer-react/key-concepts`
- `reformer://docs/renderer-react/components-and-exports`
- `reformer://docs/renderer-react/custom-fieldwrapper`
- `reformer://docs/renderer-react/anti-patterns`

## Task

1. Extend the existing schema builder with containers so that the tree describes the whole markup; keep every field node as it is.
2. Move JSX conditions into node rules of `form.behavior.ts` (`hideWhen` by `selector`), submit and data loading into `onComponentEvent` / `onMount`.
3. Leave the `createForm` call unchanged; replace the JSX with `<FormRenderer form={bundle} settings=\{{ fieldWrapper: FormField }} />`.
4. Add `selector` to the nodes the rules address.
5. Provide a short before→after diff summary at the end.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Model, validation and model links of the behavior unchanged
- [ ] One schema: containers added to the existing builder `(model) => node`, no second description of the fields
- [ ] Nodes carry no `validators`; binding key is `model`, not `value` / `array`
- [ ] `fieldWrapper` settings wired
- [ ] Selectors added where rules target nodes
- [ ] Node rules live in `form.behavior.ts`, in the same `defineFormBehavior` — no `form.render.ts`, no `renderBehavior` (the former contract)
- [ ] Wizard (if any): library `FormWizard` node with steps in `children`; nothing injected via `patchProps`
- [ ] Assembly is one `createForm` call wrapped in `useFormBundle`, not `useMemo`
- [ ] Before→after diff summary present
