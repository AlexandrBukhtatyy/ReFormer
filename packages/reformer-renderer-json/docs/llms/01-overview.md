# Overview

`@reformer/renderer-json` описывает форму **JSON-документом** (строковый операторный DSL). Документ — чистый JSON: привязки к модели и компонентам кодируются строками-операторами (`$model(...)`, `$component(...)`, `$dataSource(...)`, `$part(...)`), поэтому один и тот же документ можно положить в `.json`, принять строкой с сервера/CMS и отрисовать в разных UI-китах через реестр.

Документ формата 2 собирает та же единая сборка, что и TS-схему: `createForm` из `@reformer/core`, а рисует тот же `FormRenderer` из `@reformer/renderer-react`. Пакет даёт реестр компонентов (он строит дерево из документа), типы и гарды документа, проверку документа мета-схемой, перевод прежнего формата и локализацию.

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
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import {
  defineRegistry,
  defineJsonSchema,
  FIELD_WRAPPER,
  type JsonFormSchema,
} from '@reformer/renderer-json';
```

## Quick Start

Ключевая идея: **модель (`FormModel`) — источник данных, JSON-документ — layout**. Сборка — ОДНИМ вызовом `createForm({ model | initial, schema, registry })`; результат (бандл) отдаётся `FormRenderer` пропом `form`.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { Input, Box, FormField } from '@reformer/ui-kit';
import { defineRegistry, defineJsonSchema, FIELD_WRAPPER } from '@reformer/renderer-json';

type MyForm = { email: string };

// 1. Документ — чистые данные, операторы-строки, никаких React-импортов. defineJsonSchema<T>
//    типизирует пути $model(...) по форме модели (опечатка $model(emial) — ошибка компиляции).
const jsonSchema = defineJsonSchema<MyForm>({
  format: 2,
  root: {
    component: '$component(Box)',
    children: [
      { selector: 'email', model: '$model(email)', component: '$component(Input)',
        componentProps: { label: 'Email' } },
    ],
  },
});

// 2. Реестр: имена из JSON → React-компоненты. FIELD_WRAPPER — обёртка каждого поля.
const registry = defineRegistry((reg) => {
  reg.component('Input', Input); // компонент кита как есть: диалект — в его статике reformerAdapter
  reg.component('Box', Box);
  reg.component(FIELD_WRAPPER, FormField);
});

function MyFormPage() {
  // 3. Сборка ОДНИМ проходом. useFormBundle (ленивый useState) держит бандл стабильным между
  //    рендерами — useMemo не годится: React вправе сбросить кэш и потерять введённое.
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ schema: jsonSchema, registry, initial: { email: '' } })
  );

  // 4. Обёртку поля и границу ошибок схемы сборка взяла из реестра и положила в бандл.
  return <FormRenderer form={bundle} />;
}
```

**Реестр уходит в сборку явно.** `createForm` зовёт `registry.resolveSchema(document, model)`: дерево строится один раз, при сборке, вместе с обёрткой поля (запись `FIELD_WRAPPER`) и границей ошибок (`SchemaErrorBoundary`). React-контекст для этого не нужен, поэтому провайдер хоста и рендерер ремоута могут жить в разных бандлах. Несколько реестров объединяет `composeRegistries`.

**Схема строкой с сервера.** Если документ приходит `.json`-строкой (тип формы неизвестен), используй `JsonFormSchema` без параметра — типобезопасность путей отключается by-design. Такой документ приводят `raw as unknown as JsonFormSchema<MyForm>` и передают в `createForm` как обычно. Документ прежнего формата сначала переводят: `migrateJsonSchema(document)`.

**Прежний формат.** Рантайм читает только документ формата 2. Документ без `format: 2` (ключи `value` / `array`) переводят при загрузке — `migrateJsonSchema(document)`; сборка и `validateFormSchema` отвечают на него ошибкой с отсылкой к переводу. API, который читал прежний формат, удалён — замены в таблице [10-format-2.md](10-format-2.md#removed-api).

## Key Concepts

- **JSON-документ** — `{ format: 2, root, parts? }` (см. [02-json-schema.md](02-json-schema.md)). Узлы: **field** (`model: '$model(...)'`), **array** (`model` + `item`), **part** (`model` + `part: '$part(name)'`), **container** (`component` + `children`).
- **Операторы** — строки `$model(path)` / `$component(Name)` / `$html(tag)` / `$dataSource(NAME)` / `$fn(name)` / `$locale(key)` / `$part(name)`. Только они резолвятся; голые строки идут как есть.
- **Модель** — `FormModel`, источник данных. Задаётся сборке (`model` либо `initial`); листья документа привязываются к её ручкам (`model.signalAt(path)`).
- **Реестр** — карта имени из `$component(...)`/`$dataSource(...)`/`$fn(...)` на React-компонент, source-значение или функцию. Без регистрации документ не соберётся (ошибка `Component "X" not found in registry`). Прежние имена переименованных компонентов (`FormArray`, `FormArraySection`) реестр понимает как псевдонимы `FieldArray` / `FieldArraySection` с dev-предупреждением.
- **`FIELD_WRAPPER`** — зарезервированный ключ реестра (`'$fieldWrapper'`) для компонента-обёртки полей (label, error, hint). Обычно `FormField` из `@reformer/ui-kit`.
- **Поведение формы** — TS-функция `defineFormBehavior(({ model, form, schema, flow }) => …)`: значения модели (compute/enableWhen/onChange) и правила узлов (hideWhen/onComponentEvent/onMount по `schema.node(selector)`). В JSON поведение не выражается.
- **Валидация** — TS-схема над моделью (`defineValidation`), поля сборки `validation` и `flow.steps[].rules`. В JSON её нет — см. [06-validation.md](06-validation.md).
- **Адаптеры контролов (`resolveFieldAdapter`)** — `<FormRenderer form={bundle} settings={{ resolveFieldAdapter }} />`. Компоненты `@reformer/ui-kit` регистрируются как есть — свой диалект они объявляют статикой `reformerAdapter`; СЫРОЙ контрол чужой библиотеки без статики регистрируется по имени, а адаптер переводит seam `value` + `onChange(value)` на его диалект. Детали — [03-registry.md](03-registry.md).
- **`defineJsonSchema<T>`** — идентити-хелпер, типизирующий литерал документа по форме `T`: пути `$model(...)` сужаются до `Path<T>`. См. [02-json-schema.md](02-json-schema.md).

## Components and exports

| Export                                          | Purpose                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `defineRegistry`, `composeRegistries`           | Реестр компонентов, source-значений и функций; композиция реестров.         |
| `FIELD_WRAPPER`, `LOCALE_SERVICE`               | Служебные ключи реестра: обёртка поля, сервис локализации.                  |
| `defineJsonSchema<T>`                           | Типизирует литерал документа по форме `T` (пути `$model(...)` → `Path<T>`). |
| `JsonFormSchema`, `JsonNode`, `JsonFieldNode`, `JsonArrayNode`, `JsonPartNode`, `JsonContainerNode` | Типы документа формата 2.          |
| `isArrayNode`, `isPartNode`, `isFieldNode`, `isContainerNode` | Гарды JSON-узлов (порядок проверки: массив → подформа → поле → контейнер). |
| `schemaFormatOf`, `migrateJsonSchema`, `DEFAULT_STEP_HOSTS` | Формат документа и перевод прежнего формата в формат 2.          |
| `composeJsonFormSchema`, `isJsonStepRef`        | Сборка документа визарда, разбитого по файлам шагов.                       |
| `parseOperator`, `isModelOp`, `isComponentOp`, `isDataSourceOp`, `isPartOp`, … | Разбор и гарды строк-операторов.                     |
| `convertJsonSchema`                             | Документ формата 2 → дерево узлов (обычно его зовёт реестр при сборке).     |
| `SchemaErrorPanel`, `SchemaErrorBoundary`       | Панель ошибок документа и граница ошибок рендера.                          |
| `formSchemaMetaSchema`, `buildFormSchemaMetaSchema`, `getComponentNames`, `getDataSourceNames` | Мета-схема form-DSL + утилиты (ajv-free). |

> `validateFormSchema` живёт в отдельной точке входа `@reformer/renderer-json/validate` (тянет ajv, не попадает в render-бандл). Грузи её динамически и только в dev; ошибки показывает `SchemaErrorPanel`.

## See also

- [02-json-schema.md](02-json-schema.md) — формат `JsonFormSchema`/`JsonNode` и синтаксис операторов.
- [03-registry.md](03-registry.md) — как наполнять реестр.
- [04-troubleshooting.md](04-troubleshooting.md) — частые ошибки.
- [05-cookbook.md](05-cookbook.md) — массивы, dataSource-функции, миграция из TS-схемы.
- [07-form-wizard.md](07-form-wizard.md) — многошаговая форма.
- [10-format-2.md](10-format-2.md) — формат 2, части документа, перевод прежнего формата.
