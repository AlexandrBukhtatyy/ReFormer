# FieldArraySection — UI для FieldArray

`@reformer/ui-kit/field-array` — стилизованные компоненты массива под-форм поверх headless
`@reformer/cdk/field-array`.

> Прежние имена — `FormArraySection`, `FormArray`, сабпат `@reformer/ui-kit/form-array`, ключи
> локали `kit.formArray.*` — больше не экспортируются: теперь `FieldArraySection`, `FieldArray`,
> `@reformer/ui-kit/field-array`, `kit.fieldArray.*`. В JSON-документе `$component(FormArray)`
> продолжает работать: реестр renderer-json разрешает прежнее имя в запись `FieldArray`
> (с предупреждением в dev).

В пакете **два** компонента массива, и путать их нельзя:

| Компонент           | Для чего                                                  | Контракт                                                |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| `FieldArraySection` | разметка в JSX («React руками»)                           | `control` (`FormArray<T>`) + `itemComponent` (FC на строку) |
| `FieldArray`        | узел-массив схемы: TS-схема и JSON (`$component(FieldArray)`) | `items`/`onAdd`/`onRemove`/`onMove` — инъектит рендерер |

## FieldArraySection — разметка в JSX

```tsx
import type { FC } from 'react';
import type { FormGroup } from '@reformer/core';
import { useFormControlValue } from '@reformer/core/react';
import { FormField, Section } from '@reformer/ui-kit';
import { FieldArraySection } from '@reformer/ui-kit/field-array';

type Property = {
  type: 'apartment' | 'house' | 'land';
  description: string;
  estimatedValue: number;
};

const PropertyForm: FC<{ control: FormGroup<Property> }> = ({ control }) => (
  <Section className="space-y-3">
    <FormField control={control.type} />
    <FormField control={control.description} />
    <FormField control={control.estimatedValue} />
  </Section>
);

function PropertiesStep({ control }: { control: FormGroup<CreditApplication> }) {
  const hasProperty = useFormControlValue(control.hasProperty);
  return (
    // Generic выводится из control (`FormArray<Property>`):
    <FieldArraySection
      control={control.properties}
      itemComponent={PropertyForm}
      title="Имущество"
      addButtonLabel="+ Добавить имущество"
      emptyMessage="Нажмите «Добавить имущество» для добавления записи"
      hasItems={hasProperty}
    />
  );
}

// Если TS не выводит generic из union-типа control — укажите явно:
<FieldArraySection<Property> control={form.properties} itemComponent={PropertyForm} />;
```

`control` — нода массива под-форм `FormArray<T>` (`form.<массив>`): у неё `length` — число,
строка — `at(i)` (`FormGroup<T>`), стабильный ключ строки — `keyAt(i)`. Value-фасад модели
(`model.properties`) — не нода формы: секции нужен именно `form.properties`. Чтобы строки
`FormArray` вообще появились, массив подключается в схеме сборки узлом
`{ model: model.$.properties, item: (row) => … }` — иначе формы строк не строятся.

Новый элемент кнопка «Добавить» берёт из шаблона массива — он объявляется в модели, рядом с
остальными начальными значениями:

```ts
import { arrayOf, createModel } from '@reformer/core';

const blankProperty = (): Property => ({ type: 'apartment', description: '', estimatedValue: 0 });

const model = createModel<CreditApplication>({ properties: arrayOf(blankProperty) });
```

Проп `initialValue` (`Partial<T>`) остаётся запасным путём — для массива, у модели которого
шаблона нет. Передавайте plain-objects по форме элемента, **не** конфиг поля.

## FieldArray — узел-массив схемы

В схеме формы массив — узел `{ model: model.$.<массив>, component: FieldArray, item }`. Строка
описывается в той же схеме функцией `item`: она получает под-модель строки и строит её разметку.
Рендерер сам перебирает строки, держит ключи и отдаёт компоненту готовые `items` и колбэки
`onAdd`/`onRemove`/`onMove`, поэтому `FieldArray` ничего не знает ни про модель, ни про рендерер.

```tsx
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, FieldArray, InputNumber, SelectAsync, Textarea } from '@reformer/ui-kit';

const propertyRow = (row: FormModel<Property>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    { model: row.$.type, component: SelectAsync, componentProps: { label: 'Тип', options: PROPERTY_TYPES } },
    { model: row.$.description, component: Textarea, componentProps: { label: 'Описание' } },
    { model: row.$.estimatedValue, component: InputNumber, componentProps: { label: 'Стоимость' } },
  ],
});

// в схеме сборки createForm:
{
  selector: 'properties-array',
  model: model.$.properties,
  component: FieldArray,
  componentProps: {
    title: 'Имущество',
    itemLabel: 'Имущество',
    addButtonLabel: '+ Добавить имущество',
    emptyMessage: 'Нажмите «Добавить имущество»',
    reorderable: true,
  },
  item: propertyRow,
}
```

Операции над массивом из кода — на модели (`model.properties.push()`, `removeAt(i)`) либо на ноде
формы (`form.properties.push()`, `move(a, b)`, `clear()`); интерфейс подхватит их сам.

### JSON (renderer-json)

**В renderer-json нужен `FieldArray`, а не `FieldArraySection`.** Это разные компоненты с разными
контрактами, и подмена стоит дорого: `FieldArraySection` требует пропы `control` + `itemComponent`,
которых рендерер не передаёт (он инъектит `items`/`onAdd`/`onRemove`/`onMove`), поэтому
секция уходит в `return null` — в dev с предупреждением в консоли, но **без единой ошибки на экране**.

```ts
// registry.ts
import { defineRegistry } from '@reformer/renderer-json';
import { FieldArray } from '@reformer/ui-kit/field-array';

defineRegistry((reg) => {
  reg.component('FieldArray', FieldArray); // ← имя из JSON `$component(FieldArray)`
});
```

Массив в JSON — это **узел-массив**: `model` указывает на массив модели, а `item` — шаблон строки
(`{ "$template": узел }`) либо именованная часть документа (`"$part(property)"`). `initialValue`
нужен кнопке «Добавить», только если у массива модели нет шаблона `arrayOf(blank)`:

```jsonc
{
  "selector": "properties-array",
  "model": "$model(properties)",
  "component": "$component(FieldArray)",
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
          "model": "$model(type)",
          "component": "$component(Select)",
          "componentProps": { "label": "Тип", "options": "$dataSource(PROPERTY_TYPES)" },
        },
        { "model": "$model(description)", "component": "$component(Textarea)" },
        { "model": "$model(estimatedValue)", "component": "$component(InputNumber)" },
      ],
    },
  },
}
```

Внутри `$template` (и внутри части `$part`) пути `$model(...)` резолвятся **относительно строки**
(`$model(type)`, а не `$model(properties[0].type)`).

Чего в этом контракте НЕТ: пропа `control`, пропа `itemComponent`, ключей узла `value` / `array`
(прежний формат документа — его переводит `migrateJsonSchema`) и голых строк-ссылок
`"options": "PROPERTY_TYPES"` — справочник адресуется только оператором `$dataSource(...)`.

```jsonc
// ❌ так секция молча не отрисуется: контракт JSX-секции в JSON-схеме
{ "component": "$component(FieldArraySection)", "componentProps": { "control": "properties", "itemComponent": "PropertyForm" } }

// ✅ узел-массив + FieldArray в реестре
{ "model": "$model(properties)", "component": "$component(FieldArray)", "item": { "$template": { } } }
```

## Props `FieldArraySection` (полный список)

| Prop                 | Type                                                         | Default                              | Описание                                                           |
| -------------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------ |
| `control`            | `FormArray<T> \| undefined`                                  | required                             | Нода массива формы (`form.<массив>`)                               |
| `itemComponent`      | `ComponentType<{ control: FormGroup<T> }>`                   | required                             | FC для рендера каждого item                                        |
| `title`              | `string`                                                     | —                                    | Заголовок секции (h3)                                              |
| `itemLabel`          | `string \| (control: FormGroup<T>, index: number) => string` | —                                    | Метка над каждым item                                              |
| `addButtonLabel`     | `string`                                                     | `'+ Add'` (локаль)                   | Текст кнопки добавления                                            |
| `removeButtonLabel`  | `string`                                                     | `'Remove'` (локаль)                  | Текст кнопки удаления                                              |
| `emptyMessage`       | `string`                                                     | —                                    | Сообщение при пустом массиве                                       |
| `emptyMessageHint`   | `string`                                                     | —                                    | Подсказка под emptyMessage                                         |
| `hasItems`           | `boolean`                                                    | —                                    | `false` → секция полностью скрыта                                  |
| `initialValue`       | `Partial<T>`                                                 | —                                    | Запасной шаблон нового item; основной — `arrayOf(blank)` в модели  |
| `showRemoveOnSingle` | `boolean`                                                    | `false`                              | Показывать «Удалить» при одном item                                |
| `reorderable`        | `boolean`                                                    | `false`                              | Показывать кнопки ↑/↓ для перестановки элементов                   |
| `maxItems`           | `number`                                                     | —                                    | Максимум items (кнопка «Добавить» отключается при достижении)      |
| `className`          | `string`                                                     | `'space-y-3 mt-2'`                   | Класс `<section>`-обёртки                                          |
| `cardClassName`      | `string`                                                     | `'mb-4 p-4 bg-card text-card-foreground rounded border'` | Класс card-обёртки каждого item                                    |
| `form`               | `FormGroup<unknown>`                                         | авто-инъекция                        | Проброс `form` (RenderNodeComponent через `__selfManagedChildren`) |
| `fieldWrapper`       | `ComponentType<FieldWrapperProps>`                           | авто-инъекция                        | Field wrapper для дочерних полей (по умолчанию — от родителя)      |

Пропы `FieldArray` (узел схемы) — те же `title`, `itemLabel` (строка либо
`(rowModel, index) => string`), `addButtonLabel`, `removeButtonLabel`, `emptyMessage`,
`emptyMessageHint`, `reorderable`, `showRemoveOnSingle`, `className`, `cardClassName`; `items` и
колбэки передаёт рендерер.

## Critical: `initialValue` — PLAIN LEAVES ONLY

```tsx
// ❌ silent corruption (конфиг поля как значение)
initialValue={{ type: { model: model.$.type, component: SelectAsync }, ... }}

// ✅ plain primitives matching item shape
initialValue={{ type: 'apartment', description: '', estimatedValue: 0 }}
```

Конфиг поля попадает в значение поля → Textarea рендерит `[object Object]`, Checkbox флипается в
`true`. Compiler/тесты не ловят.
