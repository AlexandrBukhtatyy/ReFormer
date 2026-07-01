# Overview

`@reformer/renderer-json` рендерит формы из декларативной **JSON-схемы** (M1, строковый операторный DSL). Схема — чистый JSON: привязки к модели и компонентам кодируются строками-операторами (`$model(...)`, `$component(...)`, `$dataSource(...)`), поэтому одну и ту же схему можно положить в `.json`, принять строкой с сервера/CMS и отрисовать в разных UI-китах через реестр.

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
  convertJsonToM1Tree,
  type JsonFormSchema,
} from '@reformer/renderer-json';
```

## Quick Start

Ключевая идея M1: **модель (`FormModel`) — источник данных, JSON-схема — layout**. Форма строится из той же JSON-схемы через `convertJsonToM1Tree`, а `JsonFormRenderer` получает модель через `JsonRendererProvider` settings (`model`). `JsonFormRenderer` НЕ имеет `form`-пропа — это by-design: JSON статичен, модель runtime.

Минимальный рабочий монтаж:

```tsx
import { useMemo } from 'react';
import { createForm, createModel } from '@reformer/core';
import { Input, Box, FormField } from '@reformer/ui-kit';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  defineRegistry,
  FIELD_WRAPPER,
  convertJsonToM1Tree,
  type JsonFormSchema,
} from '@reformer/renderer-json';

type MyForm = { email: string };

// 1. JSON-схема — чистые данные, операторы-строки, никаких React-импортов.
const jsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      { selector: 'email', value: '$model(email)', component: '$component(Input)',
        componentProps: { label: 'Email' } },
    ],
  },
};

// 2. Реестр: имена из JSON → React-компоненты.
const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component(FIELD_WRAPPER, FormField);
});

function MyFormPage() {
  // 3. Модель + форма строятся ИЗ JSON-схемы (единая схема, без отдельной схемы формы).
  const { model } = useMemo(() => {
    const model = createModel<MyForm>({ email: '' });
    createForm<MyForm>({ model, schema: convertJsonToM1Tree(jsonSchema, registry, model) });
    return { model };
  }, []);

  // 4. Модель прокидывается через провайдер; JsonFormRenderer биндит листья к её сигналам.
  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<MyForm> schema={jsonSchema} />
    </JsonRendererProvider>
  );
}
```

**Почему `model` через провайдер, а не `<JsonFormRenderer form={...}/>`?** Под M1 листья схемы (`value: '$model(path)'`) биндятся к сигналам модели (`model.signalAt(path)`) конвертером. Модель обязательна и передаётся через `JsonRendererProvider` settings — `JsonFormRenderer` без неё бросит `settings.model is required (M1)`. Сам рендерер принимает только `{ schema, renderBehavior?, onSchemaReady?, validate? }`.

Полный эталон с wizard, массивами и behavior — `CreditApplicationFormRendererJson` (monorepo example): модель и форма строятся `convertJsonToM1Tree`, поведение (compute/enableWhen/navigation) — общий `behavior`, а `renderBehavior` инжектит `form` в wizard через `onInit` + `patchProps`.

## Key Concepts

- **JSON-схема** — дерево `JsonNode` (см. [02-json-schema.md](02-json-schema.md)). Узлы: **field** (`value: '$model(...)'`), **array** (`array` + `item.$template`), **container** (`component` + `children`).
- **Операторы** — строки `$model(path)` / `$component(Name)` / `$dataSource(NAME)`. Только они резолвятся; голые строки идут как есть.
- **Модель (`model`)** — `FormModel`, источник данных. Передаётся в `JsonRendererProvider` settings; листья биндятся к её сигналам.
- **Реестр** — карта имени из `$component(...)`/`$dataSource(...)` на React-компонент или source-значение. Без регистрации схема не сконвертируется (ошибка `Component "X" not found in registry`).
- **`FIELD_WRAPPER`** — зарезервированный ключ реестра (`'$fieldWrapper'`) для компонента-обёртки полей (label, error, hint). Обычно `FormField` из `@reformer/ui-kit`.
- **`convertJsonToM1Tree`** — конвертер JSON → RenderNode-дерево для `createForm({ model, schema })`.
- **`renderBehavior`** — TS-функция `RenderBehaviorFn<T>` (hideWhen/patchProps/onInit), применяется поверх готовой схемы; в JSON поведение не выражается.

## Components and exports

| Export                                          | Purpose                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `JsonFormRenderer`                              | Главный компонент-рендерер. Пропы: `{ schema, renderBehavior?, onSchemaReady?, validate? }`. |
| `JsonRendererProvider`                          | Контекст-провайдер: реестр (`registry`), модель (`model`), настройки.       |
| `useJsonRendererSettings`                       | Хук для чтения текущих настроек контекста.                                  |
| `defineRegistry`                                | Builder реестра компонентов и dataSource-значений.                         |
| `FIELD_WRAPPER`                                 | Ключ реестра (`'$fieldWrapper'`) для компонента-обёртки полей.              |
| `JsonFormSchema`, `JsonNode`                    | Типы JSON-схемы (`JsonFieldNode`/`JsonArrayNode`/`JsonContainerNode`).      |
| `isFieldNode`, `isArrayNode`, `isContainerNode` | Type guards для узлов.                                                      |
| `parseOperator`, `isModelOp`, `isComponentOp`, `isDataSourceOp` | Разбор и type-guards строк-операторов.                      |
| `ModelOp`, `ComponentOp`, `DataSourceOp`        | Template-literal типы операторов.                                          |
| `convertJsonToM1Tree`                           | JSON → сырое RenderNode-дерево (для `createForm({ model, schema })`).       |
| `createRenderSchemaFromJsonM1`                  | JSON → `RenderSchemaFn` (низкоуровневый, для `FormRenderer`/`JsonFormRenderer`). |
| `SchemaErrorPanel`                              | Панель ошибок валидации схемы (рисуется при `validate` + невалидной схеме). |
| `formSchemaMetaSchema`, `buildFormSchemaMetaSchema`, `getComponentNames`, `getDataSourceNames` | Мета-схема form-DSL + утилиты (ajv-free). |

> `validateFormSchema` живёт в отдельной точке входа `@reformer/renderer-json/validate` (тянет ajv, не попадает в render-бандл). `JsonFormRenderer` грузит её динамически при `validate={true}`.

## See also

- [02-json-schema.md](02-json-schema.md) — формат `JsonFormSchema`/`JsonNode` и синтаксис операторов.
- [03-registry.md](03-registry.md) — как наполнять реестр.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
- [05-cookbook.md](05-cookbook.md) — массивы, dataSource-функции, миграция из TS RenderSchema.
- Эталонный пример: `CreditApplicationFormRendererJson` (monorepo example).
