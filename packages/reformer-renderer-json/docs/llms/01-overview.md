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
  defineJsonSchema,
  createJsonForm,
  useJsonForm,
  FIELD_WRAPPER,
  type JsonFormSchema,
} from '@reformer/renderer-json';
```

## Quick Start

Ключевая идея M1: **модель (`FormModel`) — источник данных, JSON-схема — layout**. Сборка формы — ОДНИМ проходом через `createJsonForm`; результат (`{ model, form, schema, registry }`) отдаётся рендереру пропом `form`.

Минимальный рабочий монтаж:

```tsx
import { Input, Box, FormField } from '@reformer/ui-kit';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  defineRegistry,
  defineJsonSchema,
  createJsonForm,
  useJsonForm,
  FIELD_WRAPPER,
} from '@reformer/renderer-json';

type MyForm = { email: string };

// 1. JSON-схема — чистые данные, операторы-строки, никаких React-импортов. defineJsonSchema<T>
//    типизирует пути $model(...) по форме модели (опечатка $model(emial) — ошибка компиляции).
const jsonSchema = defineJsonSchema<MyForm>({
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      { selector: 'email', value: '$model(email)', component: '$component(Input)',
        componentProps: { label: 'Email' } },
    ],
  },
});

// 2. Реестр: имена из JSON → React-компоненты (глобальная настройка).
const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component(FIELD_WRAPPER, FormField);
});

function MyFormPage() {
  // 3. Сборка формы ОДНИМ проходом. useJsonForm (ленивый useState) держит model/form стабильными
  //    между рендерами — useMemo не годится: React вправе сбросить кэш и потерять введённое.
  const jsonForm = useJsonForm(() =>
    createJsonForm<MyForm>({ schema: jsonSchema, registry, initial: { email: '' } })
  );

  // 4. Реестр — глобально через провайдер; собранная форма — пропом `form`.
  return (
    <JsonRendererProvider settings={{ registry }}>
      <JsonFormRenderer<MyForm> form={jsonForm} />
    </JsonRendererProvider>
  );
}
```

**Сборка один раз (`createJsonForm`).** Раньше схема шла дважды — в `convertJsonToM1Tree` (сборка формы) и пропом `schema` (рендер). `createJsonForm({ schema, registry, initial | model, behavior? })` инкапсулирует сборку и возвращает бандл `{ model, form, schema, registry }`. `useJsonForm(factory)` гарантирует единственную сборку (ленивый `useState`). Низкоуровневые `convertJsonToM1Tree`/`createRenderSchemaFromJsonM1` остаются для особых случаев.

**Registry — глобально, форма — per-form.** `registry`/`fieldWrapper` общие на всё поддерево форм и живут в `JsonRendererProvider`; модель/форма per-form — приходят пропом (бандлом `form`, либо парой `schema`+`model`). Под одним провайдером можно рендерить несколько форм. Полный набор пропов — `{ form? | (schema + model), renderBehavior?, onSchemaReady?, validateSchema? }` (задаётся ЛИБО `form`, ЛИБО `schema`+`model`).

**Схема строкой с сервера.** Если схема приходит `.json`-строкой (тип формы неизвестен), используй `JsonFormSchema` без параметра — типобезопасность путей отключается by-design (два сценария выглядят в коде по-разному). Такую схему приводят `raw as unknown as JsonFormSchema<MyForm>` и передают в `createJsonForm`/рендерер как обычно.

## Key Concepts

- **JSON-схема** — дерево `JsonNode` (см. [02-json-schema.md](02-json-schema.md)). Узлы: **field** (`value: '$model(...)'`), **array** (`array` + `item.$template`), **container** (`component` + `children`).
- **Операторы** — строки `$model(path)` / `$component(Name)` / `$dataSource(NAME)`. Только они резолвятся; голые строки идут как есть.
- **Модель (`model`)** — `FormModel`, источник данных. Передаётся пропом `model` в `JsonFormRenderer` (per-form состояние); листья биндятся к её сигналам.
- **Реестр** — карта имени из `$component(...)`/`$dataSource(...)` на React-компонент или source-значение. Без регистрации схема не сконвертируется (ошибка `Component "X" not found in registry`).
- **`FIELD_WRAPPER`** — зарезервированный ключ реестра (`'$fieldWrapper'`) для компонента-обёртки полей (label, error, hint). Обычно `FormField` из `@reformer/ui-kit`.
- **Адаптеры контролов (`resolveFieldAdapter`)** — `JsonRendererSettings extends RendererSettings`, поэтому в `JsonRendererProvider` settings можно передать `resolveFieldAdapter(component) => FieldAdapter | undefined`. Value-based контролы (`Input` и пр.) регистрируются как есть; СЫРОЙ контрол чужого диалекта (Checkbox `checked` + `onChange(event)`, Select `onChange(value, option)`, Radio `onChange(event)`) регистрируется по имени в реестре, а адаптер переводит seam `value` + `onChange(value)` на его диалект — без обёртки на каждый контрол. Детали — [03-registry.md](03-registry.md).
- **`createJsonForm` / `useJsonForm`** — сборка формы одним проходом: `createJsonForm({ schema, registry, initial | model, behavior? })` → `{ model, form, schema, registry }`; `useJsonForm(factory)` держит бандл стабильным (ленивый `useState`). Отдаётся рендереру пропом `form`. См. [05-cookbook.md](05-cookbook.md).
- **`defineJsonSchema<T>`** — идентити-хелпер, типизирующий литерал схемы по форме `T`: пути `$model(...)` сужаются до `Path<T>` (опечатка — ошибка компиляции), не нужен `as unknown as JsonFormSchema`. См. [02-json-schema.md](02-json-schema.md).
- **`convertJsonToM1Tree`** — низкоуровневый конвертер JSON → RenderNode-дерево для `createForm({ model, schema })` (обычно скрыт за `createJsonForm`).
- **`renderBehavior`** — TS-функция `RenderBehaviorFn<T>` (hideWhen/patchProps/onInit), применяется поверх готовой схемы; в JSON поведение не выражается. Должна быть **стабильной по ссылке** (иначе dev-warn + пересборка дерева).

## Components and exports

| Export                                          | Purpose                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `JsonFormRenderer`                              | Главный компонент-рендерер. Пропы: `{ form? }` ЛИБО `{ schema, model }`, + `renderBehavior?, onSchemaReady?, validateSchema?`. |
| `createJsonForm` / `useJsonForm`                | Сборка формы одним проходом → бандл `{ model, form, schema, registry }` (проп `form`); `useJsonForm` — стабильная сборка (ленивый `useState`). |
| `defineJsonSchema<T>`                           | Типизирует литерал схемы по форме `T` (пути `$model(...)` → `Path<T>`).      |
| `JsonRendererProvider`                          | Контекст-провайдер глобальных настроек: реестр (`registry`), `fieldWrapper`, `resolveFieldAdapter`. |
| `useJsonRendererSettings`                       | Хук для чтения текущих настроек контекста.                                  |
| `defineRegistry`                                | Builder реестра компонентов и dataSource-значений.                         |
| `FIELD_WRAPPER`                                 | Ключ реестра (`'$fieldWrapper'`) для компонента-обёртки полей.              |
| `JsonFormSchema`, `JsonNode`                    | Типы JSON-схемы (`JsonFieldNode`/`JsonArrayNode`/`JsonContainerNode`).      |
| `isFieldNode`, `isArrayNode`, `isContainerNode` | Type guards для узлов.                                                      |
| `parseOperator`, `isModelOp`, `isComponentOp`, `isDataSourceOp` | Разбор и type-guards строк-операторов.                      |
| `ModelOp`, `ComponentOp`, `DataSourceOp`        | Template-literal типы операторов.                                          |
| `convertJsonToM1Tree`                           | JSON → сырое RenderNode-дерево (для `createForm({ model, schema })`).       |
| `createRenderSchemaFromJsonM1`                  | JSON → `RenderSchemaFn` (низкоуровневый, для `FormRenderer`/`JsonFormRenderer`). |
| `SchemaErrorPanel`                              | Панель ошибок валидации схемы (рисуется при `validateSchema` + невалидной схеме). |
| `formSchemaMetaSchema`, `buildFormSchemaMetaSchema`, `getComponentNames`, `getDataSourceNames` | Мета-схема form-DSL + утилиты (ajv-free). |

> `validateFormSchema` живёт в отдельной точке входа `@reformer/renderer-json/validate` (тянет ajv, не попадает в render-бандл). `JsonFormRenderer` грузит её динамически при `validateSchema={true}`.

## See also

- [02-json-schema.md](02-json-schema.md) — формат `JsonFormSchema`/`JsonNode` и синтаксис операторов.
- [03-registry.md](03-registry.md) — как наполнять реестр.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
- [05-cookbook.md](05-cookbook.md) — массивы, dataSource-функции, миграция из TS RenderSchema.
