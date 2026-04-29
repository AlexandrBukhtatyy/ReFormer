# FormArraySection — UI для FormArray

`@reformer/ui-kit/form-array` — стилизованный wrapper поверх headless
`@reformer/cdk/form-array`. Один компонент с единым FC `itemComponent`
для TS-flow, renderer-react и renderer-json.

## Базовое использование (TS-flow)

```tsx
import { FormArraySection } from '@reformer/ui-kit/form-array';
import type { FormProxy } from '@reformer/core';

interface Property {
  type: 'apartment' | 'house' | 'land';
  description: string;
  estimatedValue: number;
}

const PropertyForm: FC<{ control: FormProxy<Property> }> = ({ control }) => (
  <Section className="space-y-3">
    <FormField control={control.type} />
    <FormField control={control.description} />
    <FormField control={control.estimatedValue} />
  </Section>
);

<FormArraySection
  control={form.properties}                  // FormArrayProxy
  itemComponent={PropertyForm}                // FC<{ control: FormProxy<Property> }>
  title="Имущество"
  addButtonLabel="+ Добавить имущество"
  emptyMessage="Нажмите «Добавить имущество» для добавления записи"
  hasItems={hasProperty}
  initialValue={{ type: 'apartment', description: '', estimatedValue: 0 }}
/>
```

## Renderer-react RenderSchema

`control` принимает `FieldPathNode` (`path.<arrayField>`) — резолвится автоматически через `FieldPathNavigator`.

```tsx
const renderSchema = (path) => ({
  selector: 'properties-section',
  component: FormArraySection,
  componentProps: {
    control: path.properties,            // FieldPath → ArrayNode
    itemComponent: PropertyForm,          // FC напрямую
    title: 'Имущество',
    addButtonLabel: '+ Добавить имущество',
  },
});
```

ui-kit FormArraySection маркирован `__selfManagedChildren = true` — родитель-renderer пробрасывает `form` без рекурсии. Резолв `FieldPathNode → ArrayNode` происходит внутри.

## JSON (renderer-json)

Два варианта `itemComponent`:

### Вариант 1: registry-name (FC зарегистрирован как container)

```ts
// registry.ts
defineRegistry((reg) => {
  reg.container('FormArraySection', FormArraySection);
  reg.container('PropertyForm', PropertyForm);
});
```

```jsonc
{
  "component": "FormArraySection",
  "componentProps": {
    "control": "properties",                  // строка → FieldPath
    "itemComponent": "PropertyForm",          // string → registry lookup → FC
    "title": "Имущество",
    "addButtonLabel": "+ Добавить имущество"
  }
}
```

Конвертер видит string в `*Component` слоте → ищет в registry → подставляет FC.

### Вариант 2: inline `$template`

```jsonc
{
  "component": "FormArraySection",
  "componentProps": {
    "control": "properties",
    "itemComponent": {
      "$template": {
        "component": "Section",
        "componentProps": { "className": "space-y-3" },
        "children": [
          { "model": "type", "component": "Select", "componentProps": { "label": "Тип", "options": "PROPERTY_TYPES" } },
          { "model": "description", "component": "Textarea" },
          { "model": "estimatedValue", "component": "Input", "componentProps": { "type": "number" } }
        ]
      }
    },
    "title": "Имущество"
  }
}
```

Конвертер обнаруживает `$template`, конвертирует JsonNode шаблона в RenderNode (один раз), и оборачивает в FC `({ control }) => <RenderNodeComponent node={renderNode} form={control} />`. Снаружи это обычный FC.

## Props (полный список)

| Prop | Type | Default | Описание |
|---|---|---|---|
| `control` | `FormArrayProxy<T> \| ArrayNode<T> \| FieldPathNode` | required | Массив для управления |
| `itemComponent` | `ComponentType<{ control: FormProxy<T> }>` | required | FC для рендера каждого item |
| `title` | `string` | — | Заголовок секции (h3) |
| `itemLabel` | `string \| (control, index) => string` | — | Метка над каждым item |
| `addButtonLabel` | `string` | `'+ Добавить'` | Текст кнопки добавления |
| `removeButtonLabel` | `string` | `'Удалить'` | Текст кнопки удаления |
| `emptyMessage` | `string` | — | Сообщение при пустом массиве |
| `emptyMessageHint` | `string` | — | Подсказка под emptyMessage |
| `hasItems` | `boolean` | — | `false` → секция полностью скрыта |
| `initialValue` | `Partial<FormFields>` | — | Plain-leaf значения для новых items |
| `maxItems` | `number` | — | Максимум items (AddButton отключается) |
| `showRemoveOnSingle` | `boolean` | `false` | Показывать «Удалить» при одном item |

## Critical: `initialValue` — PLAIN LEAVES ONLY

```tsx
// ❌ silent corruption (FieldConfig as value)
initialValue={{ type: { value: 'apartment', component: Select }, ... }}

// ✅ plain primitives matching item shape
initialValue={{ type: 'apartment', description: '', estimatedValue: 0 }}
```

FieldConfig попадает в значение поля → Textarea рендерит `[object Object]`, Checkbox флипается в `true`. Compiler/тесты не ловят.
