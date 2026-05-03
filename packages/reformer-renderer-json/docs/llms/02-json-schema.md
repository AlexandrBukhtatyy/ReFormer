# JSON Schema

## Key Concepts

- **`JsonFormSchema`** — корневой документ. Содержит `version` и единственный корневой узел `root`.
- **`JsonNode`** — узел дерева. Различаются два вида:
  - **field-node** — имеет `model` (путь до поля в форме) и `component` (имя в реестре). Не имеет `children`.
  - **container-node** — имеет `component` и `children`. Не имеет `model`.
- **`selector`** — необязательный ID узла. Используется только для адресации в `RenderBehavior` (`hideWhen`, `patchProps`). Не путать с путём поля.
- **`componentProps`** — что прокидывается в React-компонент. Поддерживает строки-ссылки на source-значения из реестра.

## Type Guards

```typescript
import { isFieldNode, isContainerNode, type JsonNode } from '@reformer/renderer-json';

function inspect(node: JsonNode) {
  if (isFieldNode(node)) {
    // node.model: string, node.component: string
  }
  if (isContainerNode(node)) {
    // node.children: JsonNode[]
  }
}
```

## Examples

Минимальная схема с одним полем:

```typescript
const schema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'Box',
    children: [
      { selector: 'email', model: 'email', component: 'Input', componentProps: { label: 'Email' } },
    ],
  },
};
```

Вложенный путь к полю:

```typescript
{ model: 'personalData.firstName', component: 'Input' }
```

Массив с шаблоном для каждого элемента (`$template`):

```typescript
{
  selector: 'properties',
  model: 'properties',
  component: 'PropertyArray',
  componentProps: {
    itemComponent: {
      $template: {
        component: 'Box',
        children: [
          { selector: 'name', model: 'name', component: 'Input' },
        ],
      },
    },
  },
}
```

## Anti-patterns

- **Смешивать `model` и `children` в одном узле** — `model` приоритетнее, `children` будут проигнорированы.
- **Использовать `selector` как путь к полю** — `selector` это ID для behavior, путь задаётся только через `model`.
- **Опускать `version`** — обязательно `'1.0'`.
- **Регистрировать source как обычный компонент** — source-ссылки строкой работают только если значение зарегистрировано через `reg.source(...)`.

## See also

- [03-registry.md](03-registry.md) — какие компоненты можно зарегистрировать.
- [Типы JsonFormSchema/JsonNode](../../src/types/json-schema.ts).
