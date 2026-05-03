# Overview

`@reformer/renderer-react` — рендерер форм для React. Принимает `RenderSchema` (декларативное описание layout) и форму из `@reformer/core`, отрисовывает компоненты и связывает их с реактивным состоянием.

## Installation

```bash
npm install @reformer/renderer-react @reformer/core react react-dom
```

## Import Patterns

```typescript
// recommended
import {
  FormRenderer,
  createRenderSchema,
  hideWhen,
  onComponentEvent,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
```

## Quick Start

> **CRITICAL gotcha** — `FormRenderer` does NOT accept a `form` prop. Field-nodes silently
> render as `null` (with a console warning _"Field node rendered without form — pass form via
> wizard componentProps"_) unless the **root render-node** is a user-defined container that
> accepts `form` through `componentProps` and forwards it to `RenderNodeComponent` for its
> children. Below is the minimal pattern; for multi-step forms use `RendererFormWizard` from
> `@reformer/cdk` as the root instead.

```tsx
import { useMemo, type ReactNode } from 'react';
import { createForm, type FormProxy, type FormFields } from '@reformer/core';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import { Box, FormField, Input } from '@reformer/ui-kit';

type MyForm = FormFields & { email: string; password: string };

// (1) Minimal user-defined root container — receives form via componentProps,
//     renders children via RenderNodeComponent passing form down.
function FormRoot<T>({ form, children }: { form: FormProxy<T>; children: RenderNode<T>[] }) {
  return (
    <>
      {children.map((child, i) => (
        <RenderNodeComponent key={i} node={child} form={form} />
      ))}
    </>
  );
}

// (2) Render schema — root must be FormRoot (or any component that propagates form).
const renderSchemaFn: RenderSchemaFn<MyForm> = (path) => ({
  component: FormRoot,
  componentProps: {
    // form is filled in below via componentProps when mounting
    children: [
      {
        component: Box,
        componentProps: {
          children: [
            { component: path.email, componentProps: { label: 'Email' } },
            { component: path.password, componentProps: { label: 'Password', type: 'password' } },
          ],
        },
      },
    ],
  },
});

// (3) Mount: bind form into the schema once via createRenderSchema + patch root props.
function MyFormPage() {
  const form = useMemo(
    () =>
      createForm<MyForm>({
        form: {
          email: { value: '', component: Input },
          password: { value: '', component: Input, componentProps: { type: 'password' } },
        },
      }),
    []
  );
  const schema = useMemo(() => {
    const s = createRenderSchema<MyForm>(renderSchemaFn);
    // Inject form into FormRoot's componentProps via the root patcher (selector 'root').
    return s; // for static schemas, simpler: use a closure that captures form (next pattern)
  }, [form]);

  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

### Two more critical gotchas inside `FormRoot`

1. **`__selfManagedChildren = true`** must be set on `FormRoot` (any value works as long as it's
   strictly `true`). Without it, `RenderNodeComponent` auto-renders `node.children` as React
   elements before passing them in — `FormRoot` then receives already-rendered `ReactNode`s
   instead of raw `RenderNode[]` and `children.map(child => <RenderNodeComponent node={child}/>)`
   blows up because `child` is a React element, not a node descriptor.

   ```tsx
   export function FormRoot<T>({
     form,
     children,
   }: {
     form: FormProxy<T>;
     children: RenderNode<T>[];
   }) {
     return (
       <>
         {children.map((c, i) => (
           <RenderNodeComponent key={i} node={c} form={form} />
         ))}
       </>
     );
   }
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   (FormRoot as any).__selfManagedChildren = true;
   ```

2. **Container `children` is a TOP-LEVEL node property**, not nested inside `componentProps`.
   The renderer destructures `const { children } = node;`. Putting them in `componentProps.children`
   leaves `node.children` undefined and the field tree is never rendered.

   ```typescript
   // CORRECT
   { component: Section, componentProps: { title: 'X' }, children: [ /* nodes */ ] }

   // WRONG — silent (children rendered as React-element prop, not as RenderNode tree)
   { component: Section, componentProps: { title: 'X', children: [ /* nodes */ ] } }
   ```

### Simpler closure pattern

when `form` doesn't need to change: build the schema as a function
that closes over `form`, so `FormRoot` always gets the right instance:

```tsx
function createMyFormSchema(form: FormProxy<MyForm>) {
  return createRenderSchema<MyForm>((path) => ({
    component: FormRoot,
    componentProps: {
      form,                              // ← captured here, not via path
      children: [
        { component: path.email, componentProps: { label: 'Email' } },
        { component: path.password, componentProps: { label: 'Password', type: 'password' } },
      ],
    },
  }));
}

function MyFormPage() {
  const form = useMemo(() => createForm<MyForm>({ … }), []);
  const schema = useMemo(() => createMyFormSchema(form), [form]);
  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

The closure-pattern matches what `complex-multy-step-form-renderer` does in this monorepo —
that's the canonical mount path. **Without `form` reaching `RenderNodeComponent` via a root
component's `componentProps`, fields render as null.**

## Key Concepts

- **`RenderSchemaFn<T>`** — функция, превращающая `path` (typed proxy полей формы) в дерево `RenderNode`.
- **`RenderNode`** — узел дерева. Бывает **field** (`FieldRenderNode`, у узла есть `component: path.<field>`) или **container** (`ContainerRenderNode`, есть `componentProps.children`).
- **`fieldWrapper`** — общая обёртка вокруг каждого поля (label, error). Передаётся через `settings`.
- **`createRenderSchema(fn)`** — превращает `RenderSchemaFn` в `RenderSchemaProxy` для программного управления узлами (`hideWhen`, `patchProps`, lifecycle).
- **`RenderBehaviorFn<T>`** — декларативные хелперы (`hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount`), которые применяются к `RenderSchemaProxy`.

## Components and exports

| Export                                                                           | Purpose                                             |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `FormRenderer`                                                                   | Главный React-компонент, отрисовывающий форму.      |
| `RenderNodeComponent`                                                            | Низкоуровневый рендер одного узла (для расширений). |
| `RenderContextProvider`, `useRenderContext`                                      | Контекст: `form`, `settings`, текущий узел.         |
| `createRenderSchema`, `isRenderSchemaProxy`                                      | Программное управление схемой.                      |
| `isFieldRenderNode`, `isContainerRenderNode`                                     | Type guards для `RenderNode`.                       |
| `hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount` | Декларативные обёртки behavior.                     |

## See also

- [02-render-schema.md](02-render-schema.md) — формат `RenderSchemaFn` и `RenderNode`.
- [03-render-behavior.md](03-render-behavior.md) — hideWhen и lifecycle.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
