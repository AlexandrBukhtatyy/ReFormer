---
id: renderer-json
title: '@reformer/renderer-json'
sidebar_label: 'renderer-json'
---

# @reformer/renderer-json

> Схема формы как JSON: операторы `$model` / `$component` / `$dataSource` / `$part` + реестр компонентов.

`@reformer/renderer-json` описывает схему формы **документом JSON** (`JsonFormSchema`, формат 2).
Привязки к модели, компонентам и источникам данных кодируются строками-операторами
(`$model(...)`, `$component(...)`, `$dataSource(...)`), поэтому документ — чистые данные: его можно
положить в `.json`, принять строкой с сервера/CMS и отрисовать в разных UI-китах через реестр — без
React-кода на каждое поле.

Сборка у JSON-варианта та же, что у TS-схемы: `createForm` из `@reformer/core`, рисует тот же
`FormRenderer` из `@reformer/renderer-react`. Отличие одно: `schema` — документ, а рядом с ним
`registry`, который превращает документ в дерево узлов. Модель, правила, поведение и поток шагов
пишутся на TypeScript так же, как для любой другой формы.

## Установка

```bash
npm install @reformer/renderer-json @reformer/renderer-react @reformer/core
```

`@reformer/ui-kit` — опциональный peer: используйте его (или свои компоненты) для наполнения реестра.

## Быстрый пример

Документ — чистые данные, операторы-строки, никаких React-импортов:

```json title="form.schema.json"
{
  "format": 2,
  "version": "1.0",
  "root": {
    "component": "$component(Box)",
    "children": [
      {
        "model": "$model(email)",
        "component": "$component(Input)",
        "componentProps": { "label": "Email" }
      }
    ]
  }
}
```

Реестр сопоставляет имена из документа React-компонентам, сборка строит из документа дерево, а
`FormRenderer` его рисует:

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { defineRegistry, FIELD_WRAPPER, type JsonFormSchema } from '@reformer/renderer-json';
import { Box, FormField, Input } from '@reformer/ui-kit';
import rawSchema from './form.schema.json';

type MyForm = { email: string };

// Документ пришёл данными: операторы-строки типизируются как string — приводим к схеме формы.
const schema = rawSchema as unknown as JsonFormSchema<MyForm>;

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component(FIELD_WRAPPER, FormField); // обёртка полей: сборка положит её в бандл
});

export function MyFormPage() {
  // Одна сборка: модель из `initial`, дерево — из документа через реестр.
  const myForm = useFormBundle(() =>
    createForm<MyForm>({ initial: { email: '' }, schema, registry })
  );

  return <FormRenderer form={myForm} />;
}
```

Схему, написанную в TypeScript, типизирует `defineJsonSchema<T>({ format: 2, root: … })`: пути в
`$model(...)` сужаются до путей `T`, опечатка `$model(emial)` — ошибка компиляции. Для документа,
пришедшего строкой (тип неизвестен), — приведение к `JsonFormSchema<T>`, как выше.

## Узлы документа

Привязка к модели — один ключ `model`; чем является узел, решают соседние ключи.

| Узел            | Запись                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| поле            | `{ "model": "$model(email)", "component": "$component(Input)" }`              |
| массив под-форм | `{ "model": "$model(items)", "component": "$component(FieldArray)", "item" }` |
| подформа        | `{ "model": "$model(address)", "part": "$part(address)" }`                    |
| контейнер       | `{ "component": "$component(Box)", "children": [] }`                          |

Именованные части документа (`parts`) объявляются один раз и подключаются оператором `$part(name)` —
подформой к группе модели или шаблоном строки массива (`"item": "$part(name)"`). Пути `$model(...)`
внутри части относительны под-модели места подключения. Шаги визарда — обычные дети узла визарда с
`selector`, который совпадает с `id` шага потока `createForm({ flow })`.

## Что внутри

- **Реестр** — `defineRegistry` строит карту имён на компоненты и source-значения; `composeRegistries`
  объединяет несколько реестров. `FIELD_WRAPPER` (`'$fieldWrapper'`) — зарезервированный ключ
  компонента-обёртки полей (label, error, hint), обычно `FormField` из `@reformer/ui-kit`; проп
  `settings.fieldWrapper` у `FormRenderer` её перекрывает.
- **Операторы** — строки `$model(path)` (привязка к сигналу модели), `$component(Name)` (компонент из
  реестра), `$dataSource(Name)` (значение-источник), `$part(name)` (часть документа), а также `$html`,
  `$fn`, `$locale`. Разбираются через `parseOperator` / `isModelOp` / `isComponentOp` / …; голые
  строки идут как есть.
- **Гарды узлов документа** — `isFieldNode`, `isArrayNode`, `isPartNode`, `isContainerNode`.
- **Правила и поведение** — не в JSON: правила — `validation` и шаги `flow` сборки
  (`defineValidation`), поведение и правила узлов (`hideWhen`, `onComponentEvent`, …) —
  `behavior` сборки (`defineFormBehavior`).
- **Проверка документа** — мета-схема form-DSL (`formSchemaMetaSchema`, `buildFormSchemaMetaSchema`,
  `getComponentNames`, `getDataSourceNames`, без ajv). Полный `validateFormSchema(schema, { registry })`
  живёт в отдельной точке входа `@reformer/renderer-json/validate` (тянет ajv и не попадает в
  render-бандл); ошибки рисует `SchemaErrorPanel`.
- **Шаги в отдельных файлах** — ссылки `{ "$ref": "./steps/<шаг>/form.schema.json" }` в `children`
  визарда; документ собирает `composeJsonFormSchema(document, stepSchemas)` до `createForm`.

:::info Прежний формат документа
Документ без поля `format` (ключи `value` / `array`, шаги в `componentProps.steps`) рантайм не
читает: его переводит в формат 2 функция `migrateJsonSchema(document)`. Реестр форм и конструктор
делают это сами при чтении документа.
:::

## Дальше

- [@reformer/renderer-react](./renderer-react) — основа
- [Core API Reference](../api)
