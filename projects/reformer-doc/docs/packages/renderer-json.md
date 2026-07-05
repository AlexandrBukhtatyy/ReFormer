---
id: renderer-json
title: '@reformer/renderer-json'
sidebar_label: 'renderer-json'
---

# @reformer/renderer-json

> Форма целиком как JSON: операторы $model/$component/$dataSource + реестр компонентов.

`@reformer/renderer-json` описывает всю форму декларативной **JSON-схемой** (`JsonFormSchema`, M1). Привязки к модели, компонентам и источникам данных кодируются строками-операторами (`$model(...)`, `$component(...)`, `$dataSource(...)`), поэтому схема — чистый JSON: её можно положить в `.json`, принять строкой с сервера/CMS и отрисовать в разных UI-китах через реестр — без per-field React-кода.

Пакет строится поверх `@reformer/renderer-react`: JSON-схема конвертируется в RenderNode-дерево и рендерится тем же движком. Ключевая идея M1: **модель (`FormModel`) — источник данных, JSON-схема — layout**. Модель передаётся через провайдер, листья схемы (`value: '$model(path)'`) биндятся к её сигналам.

## Установка

```bash
npm install @reformer/renderer-json @reformer/core @reformer/renderer-react
```

`@reformer/ui-kit` — опциональный peer: используйте его (или свои компоненты) для наполнения реестра.

## Быстрый пример

Схема — чистые данные, операторы-строки, никаких React-импортов:

```json
{
  "version": "1.0",
  "root": {
    "component": "$component(Box)",
    "children": [
      {
        "value": "$model(email)",
        "component": "$component(Input)",
        "componentProps": { "label": "Email" }
      }
    ]
  }
}
```

Рендеринг: реестр (`defineRegistry`) сопоставляет имена из схемы React-компонентам, модель отдаётся через `JsonRendererProvider`:

```tsx
import { useMemo } from 'react';
import { createModel } from '@reformer/core';
import { Input, Box, FormField } from '@reformer/ui-kit';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  defineRegistry,
  FIELD_WRAPPER,
  type JsonFormSchema,
} from '@reformer/renderer-json';

type MyForm = { email: string };

export function MyFormPage() {
  // M1: модель — источник данных; листья схемы биндятся к её сигналам.
  const model = useMemo(() => createModel<MyForm>({ email: '' }), []);
  const registry = useMemo(
    () =>
      defineRegistry((reg) => {
        reg.component('Input', Input);
        reg.component('Box', Box);
        reg.component(FIELD_WRAPPER, FormField); // системная обёртка полей
      }),
    []
  );

  // Модель передаётся через провайдер (settings.model), не как проп рендерера.
  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<MyForm> schema={schema} validate={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

`JsonFormRenderer` принимает только `{ schema, renderBehavior?, onSchemaReady?, validate? }`. `FormModel` обязательна и подаётся через `JsonRendererProvider` settings (`model`) — без неё рендерер бросит `settings.model is required (M1)`.

## Что внутри

- **JsonFormRenderer** — главный компонент-рендерер; получает JSON-схему пропом, модель и реестр — из контекста провайдера. `JsonRendererProvider` задаёт `{ registry, model }`, а `useJsonRendererSettings` читает текущие настройки.
- **Операторы** — строки `$model(path)` (привязка листа к сигналу модели), `$component(Name)` (компонент из реестра), `$dataSource(Name)` (значение-источник). Разбираются через `parseOperator` / `isModelOp` / `isComponentOp` / `isDataSourceOp`; голые строки идут как есть.
- **Реестр** — `defineRegistry` строит карту имён на компоненты и dataSource-значения. `FIELD_WRAPPER` (`'$fieldWrapper'`) — зарезервированный ключ для компонента-обёртки полей (label, error, hint), обычно `FormField` из `@reformer/ui-kit`.
- **Валидация схемы** — мета-схема form-DSL (`formSchemaMetaSchema`, `buildFormSchemaMetaSchema`, `getComponentNames`, `getDataSourceNames`, ajv-free). Полный `validateFormSchema` живёт в отдельной точке входа `@reformer/renderer-json/validate` (тянет ajv, не попадает в render-бандл); `JsonFormRenderer` грузит её динамически при `validate={true}`, ошибки рисует `SchemaErrorPanel`.

Для низкоуровневого доступа доступны `convertJsonToM1Tree` (JSON → RenderNode-дерево для `createForm({ model, schema })`) и `createRenderSchemaFromJsonM1` (JSON → `RenderSchemaFn`), а также type guards `isFieldNode` / `isArrayNode` / `isContainerNode`.

## Дальше

- [@reformer/renderer-react](./renderer-react) — основа
- [Core API Reference](../api)
