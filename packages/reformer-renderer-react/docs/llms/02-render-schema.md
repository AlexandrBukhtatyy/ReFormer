# Render Schema

## Key Concepts

- **`RenderSchemaFn<T>`** — `(path: FormPathProxy<T>) => RenderNode<T>`. Принимает прокси типизированных путей формы, возвращает корневой узел.
- **`FieldRenderNode`** — узел поля. В `component` лежит `path.<field>` (узел из `path`-прокси), `componentProps` — пропсы для UI-компонента поля.
- **`ContainerRenderNode`** — узел-контейнер. В `component` — React-компонент, в `componentProps.children` — массив дочерних `RenderNode`.

Type guards:

```typescript
import { isFieldRenderNode, isContainerRenderNode } from '@reformer/renderer-react';

if (isFieldRenderNode(node)) { /* node.component — FieldPathNode */ }
if (isContainerRenderNode(node)) { /* node.componentProps.children — RenderNode[] */ }
```

## Examples

Двухколоночная форма с секцией:

```tsx
import { Box, Section } from '@reformer/ui-kit';

const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'grid grid-cols-2 gap-4',
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Личные данные',
          children: [
            { component: path.firstName },
            { component: path.lastName },
          ],
        },
      },
    ],
  },
});
```

## Programmatic API

`createRenderSchema(fn)` оборачивает функцию в `RenderSchemaProxy`, который позволяет адресовать узлы по имени и навешивать на них поведение/lifecycle:

```tsx
import { createRenderSchema } from '@reformer/renderer-react';

const proxy = createRenderSchema(renderSchema);
proxy.node('email').hideWhen((form) => !form.subscribeNewsletter.value);

<FormRenderer render={proxy} form={form} />;
```

## Anti-patterns

- **Возвращать React-element вместо `RenderNode`** — `RenderSchemaFn` должна возвращать описание (`{ component, componentProps }`), а не JSX. Сам JSX строит `FormRenderer`.
- **Хранить `RenderSchemaFn` внутри компонента без `useMemo`** — на каждом ререндере создаётся новый proxy, что ломает lifecycle хуков.
- **Передавать `path.field` как функцию** — `path.field` это узел/прокси, передаётся в `component` как есть.

## See also

- [03-render-behavior.md](03-render-behavior.md) — `hideWhen`, `patchProps`, lifecycle.
- [04-troubleshooting.md](04-troubleshooting.md).
