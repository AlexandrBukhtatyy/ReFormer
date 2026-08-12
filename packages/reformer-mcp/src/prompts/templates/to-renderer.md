You migrate a form from direct React rendering (`@reformer/core` + manual JSX) to declarative TS RenderSchema via `@reformer/renderer-react`.

## Current direct-rendering code

```typescript
{{code}}
```

## Critical inline rules

- **Do NOT touch the data layer** — the model factory, `behavior` and the validation schema stay as-is; the layout tree carries **no** validators. What changes is the rendering and the assembly call: it becomes `createReactForm({ model, schema: buildTree, behavior, validation, renderBehavior })`, whose `schema` is a builder `(model, form?) => RenderNode<T>`. The factory calls that builder twice — without the form (the tree that wires the nodes) and with it (the tree that renders) — so never write that pair by hand: a tree containing a `FormProxy` blows the node harvest up.
- **Validation stays a separate layer, never in the layout** — rules live in a standalone `defineValidationSchema<T>(({ model }) => …)` run by the external runner `validateModel(model, schema)` (`Promise<boolean>`). The `RenderSchemaFn` you build describes layout only and carries **no** `validators` — there is no leaf-node `validators: [...]` array. Do NOT fold validation onto leaves or into `createForm`; layout and validation are different contracts. For a wizard, the `{ validateStep, validateAll }` config is injected into the wizard node (see below), not embedded in the tree.
- **RenderSchemaFn signature (M1)**: `() => RenderNode<MyForm>` — no `path` argument. Fields bind to model signals in the leaf, not to a `path` proxy.
- Field node (leaf): `{ value: model.$.<field>, component: Input, componentProps: { ... } }` — `value` is the **model signal** (`model.$.<field>`), `component` is the UI component by reference.
- Container node: `{ component: Box, componentProps: { className: '...' }, children: [ ...nodes ] }` — `children` is a **top-level** property, NOT inside `componentProps`.
- Array node: `{ array: model.<path>, component: FormArray, initialValue, componentProps: { ... }, item: (itemModel) => ({ ...subtree }) }` — leaves inside `item` bind to the sub-model signal (`itemModel.$.<field>`). `component` is required for add/remove/reorder UI: the renderer ships no array markup, it only iterates and hands the component ready-made `items` plus `onAdd`/`onRemove`/`onMove`. Use `FormArray` (editable) or `List` (display-only) from `@reformer/ui-kit`, or your own component implementing `ArrayComponentProps`.
- Containers from `@reformer/ui-kit`: `Box`, `Section`, `Collapsible`, `AsyncBoundary`.
- **Render the bundle**: `<FormRenderer form={reactForm} settings={{ fieldWrapper: FormField }} />`. `createReactForm` already wrapped the tree in `createRenderSchema` and applied the render behavior; the raw `render={fn}` prop stays only for trees assembled by hand.
- **Wizard config injection** — if the source form is a wizard, keep the wizard runtime out of the layout: add `selector: 'wizard'` to the wizard node and inject via behavior — `onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ form, config: makeValidationConfig(model) }))` (`onInit` from `@reformer/renderer-react`). `makeValidationConfig(model)` returns `{ validateStep, validateAll }`, both built on `validateModel(model, stepSchema)` (NOT the removed `validateFormModel`).
- **`fieldWrapper`**: pass `FormField` from ui-kit through settings → wraps every field in label/error/hint automatically.
- **Selectors**: add `selector: 'unique-name'` to nodes you'll target via `proxy.node('selector').setHidden(...)` / `patchProps(...)`.
- **Conditional visibility**: JSX `{cond && <X/>}` → `hideWhen(proxy.node('x'), () => !cond)`. `hideWhen` only hides — node still mounts.
- **Stable assembly**: `const reactForm = useReactForm(() => createReactForm({ … }))` — a lazy `useState`, so the factory runs once. `useMemo` is wrong here: React may drop its cache, rebuilding the form and losing behavior effects together with typed input.
- **Don't migrate trivial forms** — for < 5 fields direct JSX stays cleaner.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing the schema. Skipping = wrong API or missing helpers.**

- `reformer://docs/renderer-react/quick-start`
- `reformer://docs/renderer-react/key-concepts`
- `reformer://docs/renderer-react/components-and-exports`
- `reformer://docs/renderer-react/key-concepts-2`
- `reformer://docs/renderer-react/programmatic-api`
- `reformer://docs/renderer-react/helpers`
- `reformer://docs/renderer-react/custom-fieldwrapper`
- `reformer://docs/renderer-react/programmatic-node-manipulation`
- `reformer://docs/renderer-react/combining-behaviors-on-one-node`
- `reformer://docs/renderer-react/anti-patterns`

## Task

1. Build `RenderSchemaFn` describing the layout **only** — no `validators` on leaves, no behavior/validation logic baked in. Validation stays its own `defineValidationSchema` run by `validateModel`.
2. Assemble with `createReactForm` (it wraps `createRenderSchema` and applies the render behavior itself).
3. Wire `fieldWrapper: FormField` through settings.
4. Add `selector` to nodes you reference programmatically (e.g. `selector: 'wizard'` on the wizard node, so behavior can inject `{ form, config: makeValidationConfig(model) }`).
5. Wrap the factory in `useReactForm`.
6. Provide a short before→after diff summary at the end.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] FormSchema + validation schema unchanged (render migration touches layout only)
- [ ] RenderSchemaFn returns RenderNode tree
- [ ] Layout carries no `validators` — validation stays a separate `ValidationSchema` + `validateModel` (NOT `validateFormModel`)
- [ ] `fieldWrapper` settings wired
- [ ] Selectors added where behavior targets nodes
- [ ] Wizard (if any): `{ form, config: makeValidationConfig(model) }` injected into the `wizard` node via `patchProps`, not embedded in the layout
- [ ] Assembly is one `createReactForm` call; the schema builder takes `(model, form?)` and is never called by hand
- [ ] Factory wrapped in `useReactForm` (lazy useState), not `useMemo`
- [ ] Before→after diff summary present
