# Overview

`@reformer/renderer-json` рендерит формы из декларативной JSON-схемы. Компоненты подменяются через реестр, поэтому одну и ту же схему можно отрисовать в разных UI-китах.

## Installation

```bash
npm install @reformer/renderer-json @reformer/renderer-react @reformer/core
```

Опционально для готовых UI-компонентов:

```bash
npm install @reformer/ui-kit
```

## Import Patterns

```typescript
// recommended
import {
  JsonFormRenderer,
  JsonRendererProvider,
  defineRegistry,
  FIELD_WRAPPER,
} from '@reformer/renderer-json';
```

## Quick Start

> **CRITICAL gotchas** (renderer-json shares the renderer-react architecture):
>
> 1. `getReformerForm` does NOT exist — use `createForm` from `@reformer/core`.
> 2. `JsonFormRenderer` does NOT accept a `form` prop. `JsonFormRendererProps<T>` is `{ schema, renderBehavior?, onSchemaReady? }`. Field-nodes silently render as null unless the schema's root container is a user-defined component (registered with `__selfManagedChildren = true`) that takes the form via `componentProps` and forwards it down via `RenderNodeComponent`.
> 3. The pattern mirrors renderer-react's FormRoot — see `@reformer/renderer-react/docs/llms/01-overview.md` for the full FormRoot snippet. Same component can be reused; just register it in the JSON registry under any name (e.g. `'FormRoot'`).

Minimal working mount (closure pattern injecting form into the root):

```tsx
import { useMemo } from 'react';
import { createForm, type FormProxy, type FormFields } from '@reformer/core';
import { Input, FormField } from '@reformer/ui-kit';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import {
  defineRegistry,
  FIELD_WRAPPER,
  createRenderSchemaFromJson,
  type JsonFormSchema,
} from '@reformer/renderer-json';

type MyForm = FormFields & { email: string };

// 1. JSON schema — pure data, no React imports.
const jsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'FormRoot', // user-defined, registered below
    children: [
      { selector: 'email', model: 'email', component: 'Input', componentProps: { label: 'Email' } },
    ],
  },
};

// 2. FormRoot — same as renderer-react FormRoot. Forwards form to children.
function FormRoot<T>({ form, children }: { form: FormProxy<T>; children: RenderNode<T>[] }) {
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

// 3. Registry maps string names from JSON to React components.
const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.container('FormRoot', FormRoot);
  reg.container(FIELD_WRAPPER, FormField);
});

// 4. Mount — closure factory wraps the JSON-derived RenderSchemaFn so the root receives form.
function createMyFormSchema(form: FormProxy<MyForm>): RenderSchemaFn<MyForm> {
  return (path) => {
    const baseFn = createRenderSchemaFromJson<MyForm>(jsonSchema, registry);
    const baseRoot = baseFn(path);
    return { ...baseRoot, componentProps: { ...baseRoot.componentProps, form } };
  };
}

function MyFormPage() {
  const form = useMemo(
    () => createForm<MyForm>({ form: { email: { value: '', component: Input } } }),
    []
  );
  const schema = useMemo(() => createRenderSchema<MyForm>(createMyFormSchema(form)), [form]);
  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

**Why this shape and not `<JsonFormRenderer schema={schema}/>`?** `JsonFormRenderer` builds the proxy internally but has no way to inject your live `form` into the root container's `componentProps` — its job is purely the JSON-to-RenderSchema conversion. For any non-trivial form you need to inject `form` yourself, which is exactly what `createMyFormSchema(form)` above does. `JsonFormRenderer` works in demos where the schema's root is `<div>{children}</div>` (no form needed) but not for real form rendering.

## Key Concepts

- **JSON-схема** — дерево `JsonNode`. Узлы делятся на **field** (привязаны к модели через `model`) и **container** (только layout, имеет `children`).
- **Реестр** — карта строкового имени `component` в схеме на React-компонент. Без регистрации компонента схема не отрендерится.
- **`FIELD_WRAPPER`** — специальное имя в реестре для компонента-обёртки полей (label, error). Обычно — `FormField` из `@reformer/ui-kit`.
- **Source values** — именованные константы и функции, на которые можно ссылаться из `componentProps` строкой. Резолвятся реестром.
- **Provider** — пробрасывает реестр и настройки во вложенные `JsonFormRenderer`.

## Components and exports

| Export                           | Purpose                                                             |
| -------------------------------- | ------------------------------------------------------------------- |
| `JsonFormRenderer`               | Главный компонент-рендерер схемы.                                   |
| `JsonRendererProvider`           | Контекст-провайдер: реестр и настройки.                             |
| `useJsonRendererSettings`        | Хук для чтения текущих настроек контекста.                          |
| `defineRegistry`                 | Builder реестра компонентов и source-значений.                      |
| `FIELD_WRAPPER`                  | Ключ реестра для компонента-обёртки полей.                          |
| `JsonFormSchema`, `JsonNode`     | Типы JSON-схемы.                                                    |
| `isFieldNode`, `isContainerNode` | Type guards для работы с узлами.                                    |
| `createRenderSchemaFromJson`     | Низкоуровневый конвертер JSON → render-schema (advanced use cases). |

## See also

- [02-json-schema.md](02-json-schema.md) — формат `JsonFormSchema` и `JsonNode`.
- [03-registry.md](03-registry.md) — как наполнять реестр.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
- Эталонный пример: `CreditApplicationFormRendererJson` (monorepo example).
