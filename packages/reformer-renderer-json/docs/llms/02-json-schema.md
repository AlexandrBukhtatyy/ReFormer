# JSON Schema

Схема — **чистый JSON** (M1, строковый операторный DSL): все привязки кодируются строками-операторами (`$model(...)`, `$component(...)`, `$dataSource(...)`), поэтому схему можно положить в `.json` или принять строкой с сервера/CMS. Голые строки (`label`, `placeholder`) резолвятся как есть.

## Key Concepts

- **`JsonFormSchema`** — корневой документ: `version` (для миграций), опциональный `$schema` (путь к мета-схеме для IDE), единственный корневой узел `root`.
- **`JsonNode`** — узел дерева. Дискриминированный union по строке-оператору, которую он несёт:
  - **field-node** (`JsonFieldNode`) — лист: `value: '$model(path)'` + опциональный `component: '$component(Name)'` (дефолт — Input). Не имеет `children`.
  - **array-node** (`JsonArrayNode`) — массив: `array: '$model(path)'` + `item: { $template: <JsonNode> }` + опциональный `initialValue` (литерал нового элемента для кнопки «Добавить»).
  - **container-node** (`JsonContainerNode`) — контейнер (Box/Section/Wizard/Step): `component: '$component(Name)'` + опциональные `children`.
- **Операторы** — единственный способ привязки (см. [`operators.ts`](../../src/operators.ts)):
  - `'$model(path)'` — путь к полю/массиву модели (лист → `model.signalAt(path)`, массив → value-прокси массива).
  - `'$component(Name)'` — имя компонента в реестре (`reg.field`/`reg.container`).
  - `'$dataSource(NAME)'` — имя registry-source (`reg.dataSource`): options, itemLabel, константы, loading-компоненты.
- **`selector`** — plain-строка, id узла для render-behavior (`schema.node('…')`, `hideWhen`, `patchProps`). **Не** путь модели.
- **`componentProps`** — что прокидывается в React-компонент. Значения могут содержать строки-операторы (`'$dataSource(NAME)'`, `'$model(...)'`, `'$component(...)'`) или вложенные `JsonNode` — конвертер резолвит их рекурсивно. Обычные значения (числа, инлайн-массивы options, `label`) идут как есть.

## Type Guards

Порядок важен: `isArrayNode` проверяй **первым** (array-node тоже несёт `$model`, но в поле `array`).

```typescript
import { isArrayNode, isFieldNode, isContainerNode, type JsonNode } from '@reformer/renderer-json';

function inspect(node: JsonNode) {
  if (isArrayNode(node)) {
    // node.array: '$model(...)', node.item.$template: JsonNode
  } else if (isFieldNode(node)) {
    // node.value: '$model(...)', node.component?: '$component(...)'
  } else if (isContainerNode(node)) {
    // node.component: '$component(...)', node.children?: JsonNode[]
  }
}
```

## Examples

Минимальная схема с одним полем (лист `value` + контейнер `Box`):

```typescript
import type { JsonFormSchema } from '@reformer/renderer-json';

const schema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        selector: 'email',
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
    ],
  },
};
```

Вложенный путь к полю и ссылка на dataSource-константу в `componentProps`:

```typescript
{
  value: '$model(personalData.firstName)',
  component: '$component(Input)',
}

{
  value: '$model(loanType)',
  component: '$component(Select)',
  componentProps: { label: 'Тип кредита', options: '$dataSource(LOAN_TYPES)' },
}
```

Массив с шаблоном элемента (`array` + `item.$template` + `initialValue`). Внутри `$template` пути `$model(...)` резолвятся **относительно элемента** массива:

```typescript
{
  selector: 'properties-array',
  array: '$model(properties)',
  initialValue: { type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false },
  componentProps: {
    title: 'Имущество',
    addButtonLabel: '+ Добавить имущество',
    itemLabel: '$dataSource(PROPERTY_ITEM_LABEL_SOURCE_FN)',
  },
  item: {
    $template: {
      component: '$component(Box)',
      componentProps: { className: 'space-y-3' },
      children: [
        { value: '$model(type)', component: '$component(Select)',
          componentProps: { label: 'Тип', options: '$dataSource(PROPERTY_TYPES)' } },
        { value: '$model(estimatedValue)', component: '$component(Input)',
          componentProps: { label: 'Стоимость', type: 'number' } },
      ],
    },
  },
}
```

## Anti-patterns

- **Голые строки вместо операторов** — `component: 'Input'` или `value: 'email'` не резолвятся. Нужны операторы: `component: '$component(Input)'`, `value: '$model(email)'`. Template-literal типы (`ModelOp`/`ComponentOp`) отловят это на этапе компиляции.
- **Использовать `selector` как путь к полю** — `selector` это id для behavior; путь задаётся только через `value`/`array` оператором `$model(...)`.
- **Забыть `item.$template` у массива** — array-node требует `array` **и** `item: { $template }`. Без `$template` `isArrayNode` вернёт false и узел не отрендерится как массив.
- **`initialValue` как FieldConfig** — это plain-литерал по форме элемента (`{ field: value }`), а не `{ value, component }`. Клонируется через `JSON.parse(JSON.stringify(...))`, поэтому только сериализуемые значения.
- **Ссылаться на `$dataSource(NAME)` без регистрации** — при `validate` неизвестное имя даст ошибку; без валидации строка просто прокинется как есть (молчаливый баг).

## See also

- [01-overview.md](01-overview.md) — как схема монтируется через `model` + `JsonRendererProvider`.
- [03-registry.md](03-registry.md) — какие компоненты и source можно зарегистрировать.
- [05-cookbook.md](05-cookbook.md) — `$template`, dataSource-функции, миграция из TS RenderSchema.
- [Типы JsonFormSchema/JsonNode](../../src/types/json-schema.ts) и [операторы](../../src/operators.ts).
