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

- **Do NOT touch FormSchema** — `createForm` stays as-is. Only the JSX rendering changes.
- **RenderSchemaFn signature**: `(path: FieldPath<MyForm>) => RenderNode<MyForm>`.
- Field node: `{ component: path.<field>, componentProps: { ... } }`.
- Container node: `{ component: Box, componentProps: { className: '...', children: [ ...nodes ] } }` — children inside `componentProps`.
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
