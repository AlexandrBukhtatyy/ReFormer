# FormArraySection — UI для FormArray

`@reformer/ui-kit/form-array` — стилизованный wrapper поверх headless
`@reformer/cdk/form-array`. Один компонент с единым FC `itemComponent`
для TS-flow, renderer-react и renderer-json.

## Базовое использование (TS-flow)

```tsx
import { FormArraySection } from '@reformer/ui-kit/form-array';
import type { FormProxy } from '@reformer/core';

// ВАЖНО: используйте `type`, не `interface` — иначе тип элемента не
// удовлетворяет constraint `extends FormFields` (FormFields требует
// implicit index signature, который interface не даёт).
type Property = {
  type: 'apartment' | 'house' | 'land';
  description: string;
  estimatedValue: number;
};

const PropertyForm: FC<{ control: FormProxy<Property> }> = ({ control }) => (
  <Section className="space-y-3">
    <FormField control={control.type} />
    <FormField control={control.description} />
    <FormField control={control.estimatedValue} />
  </Section>
);

// Type-safe initialValue — generic выводится из control:
<FormArraySection
  control={form.properties}                  // FormArrayProxy<Property>
  itemComponent={PropertyForm}
  title="Имущество"
  addButtonLabel="+ Добавить имущество"
  emptyMessage="Нажмите «Добавить имущество» для добавления записи"
  hasItems={hasProperty}
  initialValue={{ type: 'apartment', description: '', estimatedValue: 0 }}
/>

// Если TS не выводит generic из union-типа control — укажите явно:
<FormArraySection<Property>
  control={form.properties}
  itemComponent={PropertyForm}
  initialValue={createProperty()}             // Partial<Property> — checked
/>
```

`initialValue` имеет тип `Partial<T>`, где `T` — тип элемента массива.
Передавайте plain-objects по форме элемента, **не** FieldConfig-объекты.

## Renderer-react RenderSchema

M1: схема без аргумента `path` (`createRenderSchema<T>(() => ...)`). `control`
ссылается на массив модели (`model.<arrayField>` — `ModelArray<T>`); `FormArraySection`
резолвит его в `ArrayNode` внутри.

```tsx
import { createRenderSchema } from '@reformer/renderer-react';
import { FormArraySection } from '@reformer/ui-kit/form-array';

const renderSchema = createRenderSchema<CreditApplication>(() => ({
  selector: 'properties-section',
  component: FormArraySection,
  componentProps: {
    control: model.properties, // ModelArray → резолвится в ArrayNode
    itemComponent: PropertyForm, // FC напрямую
    title: 'Имущество',
    addButtonLabel: '+ Добавить имущество',
    initialValue: createBlankProperty(),
  },
}));
```

ui-kit FormArraySection маркирован `__selfManagedChildren = true` — родитель-renderer пробрасывает `form` без рекурсии.

> Альтернатива — нативный array-узел движка `{ array: model.properties, initialValue, item: (im) => ({ children: [ { value: im.$.field, component } ] }) }` (см. эталон `examples/complex-multy-step-form-renderer/render-schema.ts`).

## JSON (renderer-json)

Два варианта `itemComponent`:

### Вариант 1: registry-name (FC зарегистрирован через reg.component)

```ts
// registry.ts
defineRegistry((reg) => {
  reg.component('FormArraySection', FormArraySection);
  reg.component('PropertyForm', PropertyForm);
});
```

```jsonc
{
  "component": "FormArraySection",
  "componentProps": {
    "control": "properties", // строка → FieldPath
    "itemComponent": "PropertyForm", // string → registry lookup → FC
    "title": "Имущество",
    "addButtonLabel": "+ Добавить имущество",
  },
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
          {
            "model": "type",
            "component": "Select",
            "componentProps": { "label": "Тип", "options": "PROPERTY_TYPES" },
          },
          { "model": "description", "component": "Textarea" },
          {
            "model": "estimatedValue",
            "component": "Input",
            "componentProps": { "type": "number" },
          },
        ],
      },
    },
    "title": "Имущество",
  },
}
```

Конвертер обнаруживает `$template`, конвертирует JsonNode шаблона в RenderNode (один раз), и оборачивает в FC `({ control }) => <RenderNodeComponent node={renderNode} form={control} />`. Снаружи это обычный FC.

## Props (полный список)

| Prop                 | Type                                                         | Default                          | Описание                                                  |
| -------------------- | ------------------------------------------------------------ | -------------------------------- | --------------------------------------------------------- |
| `control`            | `FormArrayProxy<T> \| ArrayNode<T> \| undefined`             | required                         | Массив для управления (в RenderSchema — `FieldPathNode`)  |
| `itemComponent`      | `ComponentType<{ control: FormProxy<T> }>`                   | required                         | FC для рендера каждого item                               |
| `title`              | `string`                                                     | —                                | Заголовок секции (h3)                                     |
| `itemLabel`          | `string \| (control: FormProxy<T>, index: number) => string` | —                                | Метка над каждым item                                    |
| `addButtonLabel`     | `string`                                                     | `'+ Добавить'`                   | Текст кнопки добавления                                   |
| `removeButtonLabel`  | `string`                                                     | `'Удалить'`                      | Текст кнопки удаления                                     |
| `emptyMessage`       | `string`                                                     | —                                | Сообщение при пустом массиве                             |
| `emptyMessageHint`   | `string`                                                     | —                                | Подсказка под emptyMessage                               |
| `hasItems`           | `boolean`                                                    | —                                | `false` → секция полностью скрыта                        |
| `initialValue`       | `Partial<T>`                                                 | —                                | Plain-leaf значения для новых items                      |
| `showRemoveOnSingle` | `boolean`                                                    | `false`                          | Показывать «Удалить» при одном item                      |
| `reorderable`        | `boolean`                                                    | `false`                          | Показывать кнопки ↑/↓ для перестановки элементов          |
| `maxItems`           | `number`                                                     | —                                | Максимум items (AddButton скрывается при достижении)     |
| `className`          | `string`                                                     | `'space-y-3 mt-2'`               | Класс `<section>`-обёртки                                |
| `cardClassName`      | `string`                                                     | `'mb-4 p-4 bg-white rounded border'` | Класс card-обёртки каждого item                     |
| `form`               | `FormProxy<unknown>`                                         | авто-инъекция                    | Проброс `form` (RenderNodeComponent через `__selfManagedChildren`) |
| `fieldWrapper`       | `ComponentType<FieldWrapperProps>`                          | авто-инъекция                    | Field wrapper для дочерних полей (по умолчанию — от родителя) |

## Critical: `initialValue` — PLAIN LEAVES ONLY

```tsx
// ❌ silent corruption (FieldConfig as value)
initialValue={{ type: { value: 'apartment', component: Select }, ... }}

// ✅ plain primitives matching item shape
initialValue={{ type: 'apartment', description: '', estimatedValue: 0 }}
```

FieldConfig попадает в значение поля → Textarea рендерит `[object Object]`, Checkbox флипается в `true`. Compiler/тесты не ловят.
