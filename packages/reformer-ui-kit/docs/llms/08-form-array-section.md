# FormArraySection — UI для FormArray

`@reformer/ui-kit/form-array` — стилизованный wrapper поверх headless
`@reformer/cdk/form-array`.

В пакете **два** компонента массива, и путать их нельзя:

| Компонент          | Для чего                                   | Контракт                                                |
| ------------------ | ------------------------------------------ | ------------------------------------------------------- |
| `FormArraySection` | TS-flow и renderer-react RenderSchema      | `control` + `itemComponent` (FC на элемент)             |
| `FormArray`        | **renderer-json**, `$component(FormArray)` | `items`/`onAdd`/`onRemove`/`onMove` — инъектит рендерер |

Этот документ — про `FormArraySection`; про JSON-вариант см. [JSON (renderer-json)](#json-renderer-json).

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

// Generic выводится из control:
<FormArraySection
  control={form.properties}                  // FormArrayProxy<Property>
  itemComponent={PropertyForm}
  title="Имущество"
  addButtonLabel="+ Добавить имущество"
  emptyMessage="Нажмите «Добавить имущество» для добавления записи"
  hasItems={hasProperty}
/>

// Если TS не выводит generic из union-типа control — укажите явно:
<FormArraySection<Property> control={form.properties} itemComponent={PropertyForm} />
```

Новый элемент кнопка «Добавить» берёт из шаблона массива — он объявляется в модели, рядом с
остальными начальными значениями:

```ts
import { arrayOf, createModel } from '@reformer/core';

const blankProperty = (): Property => ({ type: 'apartment', description: '', estimatedValue: 0 });

const model = createModel<CreditApplication>({ properties: arrayOf(blankProperty) });
```

Проп `initialValue` (`Partial<T>`) остаётся запасным путём — для массива, у модели которого
шаблона нет. Передавайте plain-objects по форме элемента, **не** FieldConfig-объекты.

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
  },
}));
```

ui-kit FormArraySection маркирован `__selfManagedChildren = true` — родитель-renderer пробрасывает `form` без рекурсии.

> Основной способ в схеме — узел-массив с компонентом `FormArray`:
> `{ model: model.$.properties, component: FormArray, item: (model) => ({ children: [{ model: model.$.type, component }] }) }`.
> Строка описывается в той же схеме, а не отдельным React-компонентом.

## JSON (renderer-json)

**В renderer-json нужен `FormArray`, а не `FormArraySection`.** Это разные компоненты с разными
контрактами, и подмена стоит дорого: `FormArraySection` требует пропы `control` + `itemComponent`,
которых JSON-конвертер не передаёт (он инъектит `items`/`onAdd`/`onRemove`/`onMove`), поэтому
секция уходит в `return null` — **пустой экран без единой ошибки и предупреждения**.

```ts
// registry.ts
import { FormArray } from '@reformer/ui-kit/form-array';

defineRegistry((reg) => {
  reg.component('FormArray', FormArray); // ← имя из JSON `$component(FormArray)`
});
```

Массив в JSON — это **array-нода**, а не контейнер с `itemComponent`. Обязательны `array` и
`item.$template` (без них `isArrayNode` вернёт false), а `initialValue` нужен кнопке «Добавить»:

```jsonc
{
  "selector": "properties-array",
  "array": "$model(properties)",
  "component": "$component(FormArray)",
  "initialValue": { "type": "apartment", "description": "", "estimatedValue": 0 },
  "componentProps": {
    "title": "Имущество",
    "itemLabel": "Имущество",
    "addButtonLabel": "+ Добавить имущество",
    "emptyMessage": "Нажмите «Добавить имущество»",
  },
  "item": {
    "$template": {
      "component": "$component(Box)",
      "componentProps": { "className": "space-y-3" },
      "children": [
        {
          "value": "$model(type)",
          "component": "$component(Select)",
          "componentProps": { "label": "Тип", "options": "$dataSource(PROPERTY_TYPES)" },
        },
        { "value": "$model(description)", "component": "$component(Textarea)" },
        { "value": "$model(estimatedValue)", "component": "$component(InputNumber)" },
      ],
    },
  },
}
```

Внутри `$template` пути `$model(...)` резолвятся **относительно элемента** (`$model(type)`, а не
`$model(properties[0].type)`). Конвертер конвертирует шаблон в `RenderNode` один раз и оборачивает
в FC, который и рендерит каждую строку.

Чего в этом контракте НЕТ (и не было под M1): пропа `control`, пропа `itemComponent`, листьев
`"model": "type"` и голых строк-ссылок `"options": "PROPERTY_TYPES"` — справочник адресуется
только оператором `$dataSource(...)`.

```jsonc
// ❌ так секция молча не отрисуется: контракт TS-flow в JSON-схеме
{ "component": "FormArraySection", "componentProps": { "control": "properties", "itemComponent": "PropertyForm" } }

// ✅ array-нода + FormArray в реестре
{ "array": "$model(properties)", "component": "$component(FormArray)", "item": { "$template": { } } }
```

## Props (полный список)

| Prop                 | Type                                                         | Default                              | Описание                                                           |
| -------------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------ |
| `control`            | `FormArrayProxy<T> \| ArrayNode<T> \| undefined`             | required                             | Массив для управления (в RenderSchema — `FieldPathNode`)           |
| `itemComponent`      | `ComponentType<{ control: FormProxy<T> }>`                   | required                             | FC для рендера каждого item                                        |
| `title`              | `string`                                                     | —                                    | Заголовок секции (h3)                                              |
| `itemLabel`          | `string \| (control: FormProxy<T>, index: number) => string` | —                                    | Метка над каждым item                                              |
| `addButtonLabel`     | `string`                                                     | `'+ Add'` (локаль)                   | Текст кнопки добавления                                            |
| `removeButtonLabel`  | `string`                                                     | `'Remove'` (локаль)                  | Текст кнопки удаления                                              |
| `emptyMessage`       | `string`                                                     | —                                    | Сообщение при пустом массиве                                       |
| `emptyMessageHint`   | `string`                                                     | —                                    | Подсказка под emptyMessage                                         |
| `hasItems`           | `boolean`                                                    | —                                    | `false` → секция полностью скрыта                                  |
| `initialValue`       | `Partial<T>`                                                 | —                                    | Запасной шаблон нового item; основной — `arrayOf(blank)` в модели  |
| `showRemoveOnSingle` | `boolean`                                                    | `false`                              | Показывать «Удалить» при одном item                                |
| `reorderable`        | `boolean`                                                    | `false`                              | Показывать кнопки ↑/↓ для перестановки элементов                   |
| `maxItems`           | `number`                                                     | —                                    | Максимум items (AddButton скрывается при достижении)               |
| `className`          | `string`                                                     | `'space-y-3 mt-2'`                   | Класс `<section>`-обёртки                                          |
| `cardClassName`      | `string`                                                     | `'mb-4 p-4 bg-white rounded border'` | Класс card-обёртки каждого item                                    |
| `form`               | `FormProxy<unknown>`                                         | авто-инъекция                        | Проброс `form` (RenderNodeComponent через `__selfManagedChildren`) |
| `fieldWrapper`       | `ComponentType<FieldWrapperProps>`                           | авто-инъекция                        | Field wrapper для дочерних полей (по умолчанию — от родителя)      |

## Critical: `initialValue` — PLAIN LEAVES ONLY

```tsx
// ❌ silent corruption (FieldConfig as value)
initialValue={{ type: { value: 'apartment', component: SelectAsync }, ... }}

// ✅ plain primitives matching item shape
initialValue={{ type: 'apartment', description: '', estimatedValue: 0 }}
```

FieldConfig попадает в значение поля → Textarea рендерит `[object Object]`, Checkbox флипается в `true`. Compiler/тесты не ловят.
