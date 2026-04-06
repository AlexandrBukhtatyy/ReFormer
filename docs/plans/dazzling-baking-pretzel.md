# Plan: read settings from context instead of prop drilling

## Context

After introducing `RendererSettings`, the `settings` object was being both stored in `RenderContextProvider` AND prop-drilled through the entire component tree (`RenderNodeComponent` → `ArrayRenderer` → `SelectorNodeRenderer` → `ItemSelectorRenderer`). Since the context is already available everywhere inside `FormRenderer`, the prop is redundant. The goal is to remove `settings` from all component props and have each component that needs `fieldWrapper` read it directly from `useRenderContext()`.

## Changes

### `packages/reformer-renderer-react/src/core/render-node.tsx`

1. Add `useRenderContext` import from `./render-context`
2. Remove `RendererSettings` from the import of `./types` (no longer needed as a type here)
3. Remove `settings` from `RenderNodeComponentProps`
4. In `RenderNodeComponent`: call `useRenderContext()` to get `settings`, extract `fieldWrapper = settings?.fieldWrapper`
5. `ArrayRenderer`: remove `fieldWrapper` prop, call `useRenderContext()` inside to get it
6. `SelectorNodeRenderer`: remove `fieldWrapper` prop, call `useRenderContext()` inside to get it
7. `ItemSelectorRenderer`: remove `fieldWrapper` prop, call `useRenderContext()` inside to get it
8. Remove all `fieldWrapper={fieldWrapper}` prop passing between these internal components
9. Remove the `{ fieldWrapper }` wrapper objects used when calling `RenderNodeComponent` from `SelectorNodeRenderer`/`ItemSelectorRenderer`

### `packages/reformer-renderer-react/src/core/form-renderer.tsx`

Remove `settings={settings}` from the `RenderNodeComponent` call — only the context needs it:

```tsx
<RenderContextProvider value={{ form, path, settings }}>
  <RenderNodeComponent node={rootNode} form={form as FormProxy<T>} path={path} />
</RenderContextProvider>
```

## Verification

TypeScript compilation should produce no errors. Visually confirm in the playground that `fieldWrapper` still works correctly.

