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

```tsx
import { useMemo } from 'react';
import { getReformerForm, useFormControl } from '@reformer/core';
import { Input, FormField } from '@reformer/ui-kit';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  defineRegistry,
  FIELD_WRAPPER,
  type JsonFormSchema,
} from '@reformer/renderer-json';

const schema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'Box',
    children: [
      { selector: 'email', model: 'email', component: 'Input',
        componentProps: { label: 'Email' } },
    ],
  },
};

const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.container('Box', ({ children }) => <div>{children}</div>);
  reg.container(FIELD_WRAPPER, FormField);
});

function MyForm() {
  const form = useMemo(() => getReformerForm({ email: '' }), []);
  return (
    <JsonRendererProvider settings={{ registry }}>
      <JsonFormRenderer schema={schema} form={form} />
    </JsonRendererProvider>
  );
}
```

## Key Concepts

- **JSON-схема** — дерево `JsonNode`. Узлы делятся на **field** (привязаны к модели через `model`) и **container** (только layout, имеет `children`).
- **Реестр** — карта строкового имени `component` в схеме на React-компонент. Без регистрации компонента схема не отрендерится.
- **`FIELD_WRAPPER`** — специальное имя в реестре для компонента-обёртки полей (label, error). Обычно — `FormField` из `@reformer/ui-kit`.
- **Source values** — именованные константы и функции, на которые можно ссылаться из `componentProps` строкой. Резолвятся реестром.
- **Provider** — пробрасывает реестр и настройки во вложенные `JsonFormRenderer`.

## Components and exports

| Export                      | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `JsonFormRenderer`          | Главный компонент-рендерер схемы.                                      |
| `JsonRendererProvider`      | Контекст-провайдер: реестр и настройки.                                |
| `useJsonRendererSettings`   | Хук для чтения текущих настроек контекста.                             |
| `defineRegistry`            | Builder реестра компонентов и source-значений.                         |
| `FIELD_WRAPPER`             | Ключ реестра для компонента-обёртки полей.                             |
| `JsonFormSchema`, `JsonNode`| Типы JSON-схемы.                                                        |
| `isFieldNode`, `isContainerNode` | Type guards для работы с узлами.                                  |
| `createRenderSchemaFromJson`| Низкоуровневый конвертер JSON → render-schema (advanced use cases).    |

## See also

- [02-json-schema.md](02-json-schema.md) — формат `JsonFormSchema` и `JsonNode`.
- [03-registry.md](03-registry.md) — как наполнять реестр.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
- Эталонный пример: `CreditApplicationFormRendererJson` (monorepo example).
