# JSON-схема: формат 2

## Purpose

Формат 2 — запись единого контракта формы данными. Документ собирает та же сборка, что и
TS-схему: `createForm` из `@reformer/core`, рисует тот же `FormRenderer` из
`@reformer/renderer-react`. Отличие от TS-варианта одно: схема — JSON, а компоненты и источники
приходят из реестра.

Полное описание контракта — раздел «Единый контракт формы» в `reformer://docs/core`.

## Документ

```json
{
  "$schema": "./form-schema.schema.json",
  "format": 2,
  "version": "1.0",
  "parts": {
    "address": {
      "component": "$component(Box)",
      "children": [
        {
          "model": "$model(city)",
          "component": "$component(Input)",
          "componentProps": { "label": "Город" }
        },
        { "model": "$model(street)", "component": "$component(Input)" }
      ]
    },
    "coBorrower": { "model": "$model(name)", "component": "$component(Input)" }
  },
  "root": {
    "component": "$component(Box)",
    "children": [
      { "model": "$model(loanType)", "component": "$component(SelectAsync)" },
      { "model": "$model(registrationAddress)", "part": "$part(address)" },
      { "model": "$model(residenceAddress)", "part": "$part(address)" },
      {
        "model": "$model(coBorrowers)",
        "component": "$component(FormArray)",
        "item": "$part(coBorrower)"
      }
    ]
  }
}
```

- `format: 2` обязателен. Документ без поля — прежний формат; его переводит `migrateJsonSchema`.
- `version` — версия содержимого формы (её сверяет реестр форм). К формату документа не относится.
- `parts` — именованные части документа: подформы и шаблоны строк массивов.

## Узлы

Привязка к модели — один ключ `model`. Чем является узел, решают соседние ключи.

| Узел            | Запись                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| поле            | `{ "model": "$model(email)", "component": "$component(Input)" }`          |
| массив под-форм | `{ "model": "$model(items)", "component": "$component(FormArray)", "item" }` |
| подформа        | `{ "model": "$model(address)", "part": "$part(address)" }`                |
| контейнер       | `{ "component": "$component(Box)", "children": [] }`                      |

Порядок распознавания: `item` → `part` → поле → контейнер. Гарды — `isArrayNode`, `isPartNode`,
`isFieldNode`, `isContainerNode`.

Массив без `item` — значение одного поля (мультивыбор, теги), а не массив под-форм:

```json
{ "model": "$model(tags)", "component": "$component(SelectMulti)" }
```

## Именованные части

Часть объявляется один раз в `parts` и подключается оператором `$part(name)`:

- узлом-подформой `{ "model": "$model(group)", "part": "$part(name)" }` — для группы модели;
- шаблоном строки `"item": "$part(name)"` — для каждого элемента массива.

Пути `$model(...)` внутри части относительны под-модели места подключения: `$model(city)` в части
`address` — это `registrationAddress.city` в одном месте и `residenceAddress.city` в другом.

Шаблон строки можно и вписать на месте:

```json
{
  "model": "$model(phones)",
  "component": "$component(FormArray)",
  "item": { "$template": { "model": "$model(number)", "component": "$component(Input)" } }
}
```

Часть может подключать другие части — например, строка массива со вложенным массивом.

`selector` внутри части ищется в области этой части: поведение подформы подключается через
`apply(model.$.group, behavior)`, поведение строки — через `applyEach(model.$.items, behavior)`.
Корневое поведение узлы частей не видит.

## Шаблон нового элемента массива

Шаблон для кнопки «Добавить» живёт в модели — `arrayOf(blank)`:

```typescript
import { arrayOf, createModel } from '@reformer/core';

const blankCoBorrower = () => ({ name: '', phones: arrayOf(blankPhone) });

export const createMyModel = () =>
  createModel<MyForm>({ loanType: 'consumer', coBorrowers: arrayOf(blankCoBorrower) });
```

`initialValue` в узле массива необязателен. Это запасной путь для формы, у которой модель
создаётся из данных без кода; шаблон модели главнее. Если `initialValue` задан, он обязан нести
все ключи строки — это проверяет `validateFormSchema`.

## Шаги визарда

Шаги — обычные дети узла визарда. `selector` шага — ключ его правил в `validation.steps`.

```json
{
  "selector": "wizard",
  "component": "$component(FormWizard)",
  "children": [
    {
      "selector": "loan",
      "component": "$component(Step)",
      "componentProps": { "title": "Кредит" },
      "children": [{ "model": "$model(loanType)", "component": "$component(SelectAsync)" }]
    }
  ]
}
```

Шаг в отдельном файле стоит ссылкой `{ "$ref": "./steps/loan/form.schema.json" }` в `children`.
Перед сборкой формы документ собирает `composeJsonFormSchema(document, stepSchemas)`.

## Сборка и рендер

```tsx
import { createForm, useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import rawSchema from './form.schema.json';
import { registry } from './registry';

const schema = rawSchema as JsonFormSchema<MyForm>;

function MyFormPage() {
  const bundle = useFormBundle(() =>
    createForm<MyForm>({
      model: createMyModel(),
      schema,
      registry,
      behavior: myBehavior,
      validation: myValidation,
    })
  );
  return <FormRenderer form={bundle} />;
}
```

- Дерево из документа строит реестр (`registry.resolveSchema`) — один раз, при сборке. Реестр из
  `defineRegistry` и `composeRegistries` этот метод несёт.
- Обёртка поля — запись `FIELD_WRAPPER` реестра: сборка кладёт её в бандл, `FormRenderer` берёт
  оттуда. Проп `settings.fieldWrapper` её перекрывает.
- Граница ошибок схемы (`SchemaErrorBoundary`) тоже приходит из бандла.
- Несколько реестров объединяет `composeRegistries` — вложенные провайдеры не нужны.
- Поведение — одно: `defineFormBehavior(({ model, form, schema }) => …)`. Правила узлов
  (`hideWhen`, `onComponentEvent`, `onMount`) пишутся в нём, отдельного `renderBehavior` нет.

Проверка документа в dev — явный вызов:

```tsx
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { SchemaErrorPanel } from '@reformer/renderer-json';

const { valid, errors } = validateFormSchema(schema, { registry });
if (!valid) return <SchemaErrorPanel errors={errors} />;
```

Проверяются структура узлов, синтаксис операторов, имена компонентов, источников и функций,
имена частей (`$part(...)`), полнота заданного `initialValue` и несобранные ссылки на шаги.

## Перевод документа прежнего формата

```typescript
import { migrateJsonSchema } from '@reformer/renderer-json';

const schema = migrateJsonSchema(await loadSchema(id)); // документ любого формата
const bundle = createForm({ model, schema, registry });
```

`migrateJsonSchema(document, { stepHosts })`:

- переименовывает ключи привязки: `value` → `model`, `array` → `model`;
- переносит шаги визарда из `componentProps.steps` в `children`;
- ставит `format: 2`.

Что считать визардом, определяется именем компонента. По умолчанию — `DEFAULT_STEP_HOSTS`
(`Wizard`, `RendererFormWizard`, `FormWizard`); свои имена добавляются параметром `stepHosts`.
Имя компонента функция не меняет: на какой компонент оно указывает, решает реестр приложения.

Функция чистая, документ формата 2 возвращает как есть — её можно вызывать на любом документе.
Части (`parts`) она не выделяет: повторяющиеся фрагменты выносятся вручную.

## Прежний формат

Документ без `format` по-прежнему читают `createJsonForm`, `useJsonForm`, `JsonFormRenderer` и
`JsonRendererProvider`; документ формата 2 они отвергают. Типы и гарды прежнего формата носят
суффикс `V1`:

| Формат 2                    | Прежний формат                  |
| --------------------------- | ------------------------------- |
| `JsonFormSchema`            | `JsonFormSchemaV1`              |
| `JsonNode`, `JsonFieldNode` | `JsonNodeV1`, `JsonFieldNodeV1` |
| `JsonArrayNode`             | `JsonArrayNodeV1`               |
| `JsonPartNode`              | —                               |
| `defineJsonSchema`          | `defineJsonSchemaV1`            |
| `isFieldNode`, `isArrayNode` | `isFieldNodeV1`, `isArrayNodeV1` |
| `buildFormSchemaMetaSchema` | `buildFormSchemaMetaSchemaV1`   |
| `convertJsonSchema`         | `convertJsonToM1Tree`           |

`validateFormSchema`, `composeJsonFormSchema`, `collectOperatorNames` и `collectSchemaSelectors`
принимают оба формата.

## Частые ошибки

| Симптом | Причина |
| --- | --- |
| `The document is in the previous JSON schema format` | у документа нет `format: 2` — переведи его `migrateJsonSchema` |
| `createJsonForm: документ схемы — формата 2` | документ формата 2 собирает `createForm({ model, schema, registry })` |
| `Part "x" not found in the document "parts"` | опечатка в `$part(...)` либо часть не объявлена в `parts` |
| `"$model(x)" is not a group of the model` | подформа подключена к полю; `part` ставится на объект модели |
| `"$model(x)" is not an array of the model` | узел с `item` привязан не к массиву либо начальное значение массива — `null` |
| `Step reference … is not resolved` | в `children` осталась ссылка `$ref` — собери документ `composeJsonFormSchema` |
| `unknown property "value"` | ключ прежнего формата в документе формата 2 — должно быть `model` |
| «Добавить» бросает ошибку про шаблон | у массива нет ни `arrayOf(blank)` в модели, ни `initialValue` в узле |
