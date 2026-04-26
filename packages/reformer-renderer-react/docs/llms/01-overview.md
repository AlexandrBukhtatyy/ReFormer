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

```tsx
import { useMemo } from 'react';
import { getReformerForm } from '@reformer/core';
import { FormRenderer, type RenderSchemaFn } from '@reformer/renderer-react';
import { Box, Input, FormField } from '@reformer/ui-kit';

type MyForm = { email: string; password: string };

const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
  component: Box,
  componentProps: {
    children: [
      { component: path.email, componentProps: { label: 'Email' } },
      { component: path.password, componentProps: { label: 'Password', type: 'password' } },
    ],
  },
});

function MyForm() {
  const form = useMemo(() => getReformerForm<MyForm>({ email: '', password: '' }), []);
  return <FormRenderer form={form} render={renderSchema} settings={{ fieldWrapper: FormField }} />;
}
```

## Key Concepts

- **`RenderSchemaFn<T>`** — функция, превращающая `path` (typed proxy полей формы) в дерево `RenderNode`.
- **`RenderNode`** — узел дерева. Бывает **field** (`FieldRenderNode`, у узла есть `component: path.<field>`) или **container** (`ContainerRenderNode`, есть `componentProps.children`).
- **`fieldWrapper`** — общая обёртка вокруг каждого поля (label, error). Передаётся через `settings`.
- **`createRenderSchema(fn)`** — превращает `RenderSchemaFn` в `RenderSchemaProxy` для программного управления узлами (`hideWhen`, `patchProps`, lifecycle).
- **`RenderBehaviorFn<T>`** — декларативные хелперы (`hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount`), которые применяются к `RenderSchemaProxy`.

## Components and exports

| Export                                | Purpose                                                           |
| ------------------------------------- | ----------------------------------------------------------------- |
| `FormRenderer`                        | Главный React-компонент, отрисовывающий форму.                    |
| `RenderNodeComponent`                 | Низкоуровневый рендер одного узла (для расширений).               |
| `RenderContextProvider`, `useRenderContext` | Контекст: `form`, `settings`, текущий узел.                  |
| `createRenderSchema`, `isRenderSchemaProxy` | Программное управление схемой.                              |
| `isFieldRenderNode`, `isContainerRenderNode` | Type guards для `RenderNode`.                              |
| `hideWhen`, `renderEffect`, `onComponentEvent`, `onInit`, `onMount`, `onUnmount` | Декларативные обёртки behavior. |

## See also

- [02-render-schema.md](02-render-schema.md) — формат `RenderSchemaFn` и `RenderNode`.
- [03-render-behavior.md](03-render-behavior.md) — hideWhen и lifecycle.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
