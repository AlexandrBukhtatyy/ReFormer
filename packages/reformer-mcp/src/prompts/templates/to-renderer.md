You migrate a form from direct React rendering (`@reformer/core` + manual JSX) to declarative TS RenderSchema via `@reformer/renderer-react`.

## Current direct-rendering code

```typescript
{
  {
    code;
  }
}
```

## Critical inline rules

- **Do NOT touch the form wiring** — `createModel` + `createForm({ model, schema })` stay as-is. Only the JSX rendering changes.
- **RenderSchemaFn signature (M1)**: `() => RenderNode<MyForm>` — no `path` argument. Fields bind to model signals in the leaf, not to a `path` proxy.
- Field node (leaf): `{ value: model.$.<field>, component: Input, componentProps: { ... } }` — `value` is the **model signal** (`model.$.<field>`), `component` is the UI component by reference.
- Container node: `{ component: Box, componentProps: { className: '...' }, children: [ ...nodes ] }` — `children` is a **top-level** property, NOT inside `componentProps`.
- Array node: `{ array: model.<path>, initialValue, componentProps: { ... }, item: (itemModel) => ({ ...subtree }) }` — leaves inside `item` bind to the sub-model signal (`itemModel.$.<field>`).
- Containers from `@reformer/ui-kit`: `Box`, `Section`, `Collapsible`, `AsyncBoundary`.
- **Use `createRenderSchema(fn)`** if applying behavior (`hideWhen`, `patchProps`, lifecycle). Without behavior — pass `fn` straight to `<FormRenderer render={fn} />`.
- **`fieldWrapper`**: pass `FormField` from ui-kit through settings → wraps every field in label/error/hint automatically.
- **Selectors**: add `selector: 'unique-name'` to nodes you'll target via `proxy.node('selector').setHidden(...)` / `patchProps(...)`.
- **Conditional visibility**: JSX `{cond && <X/>}` → `hideWhen(proxy.node('x'), () => !cond)`. `hideWhen` only hides — node still mounts.
- **Memoize**: `const schema = useMemo(() => createRenderSchema(...), [])`. Otherwise behavior effects lost each render.
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

1. Build `RenderSchemaFn` describing the layout (no validation/behavior changes).
2. Pick `createRenderSchema` vs raw `fn` based on whether behavior is needed.
3. Wire `fieldWrapper: FormField` through settings.
4. Add `selector` to nodes you reference programmatically.
5. Memoize the schema.
6. Provide a short before→after diff summary at the end.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] FormSchema unchanged
- [ ] RenderSchemaFn returns RenderNode tree
- [ ] `fieldWrapper` settings wired
- [ ] Selectors added where behavior targets nodes
- [ ] `createRenderSchema` used iff behavior involved
- [ ] Schema memoized
- [ ] Before→after diff summary present
