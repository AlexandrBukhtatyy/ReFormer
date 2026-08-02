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

Рендеринг: `createJsonForm` собирает форму из схемы за **один проход** (создаёт модель, конвертирует схему в дерево нод, строит форму) и возвращает бандл `{ model, form, schema, registry }`; `useJsonForm` держит его стабильным между ре-рендерами. Реестр (`defineRegistry`) сопоставляет имена из схемы React-компонентам и отдаётся глобально через `JsonRendererProvider`; сам бандл передаётся рендереру пропом `form`:

```tsx
import { Input, Box, FormField } from '@reformer/ui-kit';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  defineJsonSchema,
  defineRegistry,
  FIELD_WRAPPER,
} from '@reformer/renderer-json';

type MyForm = { email: string };

// defineJsonSchema<T> типизирует литерал по форме T: путь $model(...) сужается до Path<MyForm>
// (опечатка `$model(emial)` — ошибка компиляции), и не нужен `as unknown as JsonFormSchema`.
const schema = defineJsonSchema<MyForm>({
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
    ],
  },
});

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component(FIELD_WRAPPER, FormField); // системная обёртка полей
});

export function MyFormPage() {
  // Сборка одним проходом: createJsonForm создаёт модель из `initial`, конвертирует схему и строит
  // форму. useJsonForm вызывает фабрику РОВНО один раз (ленивый useState), поэтому model/form
  // переживают ре-рендеры (useMemo для этого не годится — React вправе сбросить его кэш).
  const jsonForm = useJsonForm(() =>
    createJsonForm<MyForm>({ schema, registry, initial: { email: '' } })
  );

  // Реестр — глобально через провайдер; бандл — пропом `form` (он несёт schema+model).
  return (
    <JsonRendererProvider settings={{ registry }}>
      <JsonFormRenderer<MyForm> form={jsonForm} validateSchema={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

`JsonFormRenderer` принимает `{ form?, schema?, model?, renderBehavior?, onSchemaReady?, validateSchema? }`. Достаточно передать **либо** бандл `form` (из `createJsonForm` — он поставляет `schema` + `model` вместе), **либо** пару `schema` + `model` напрямую как альтернативу. Без того и другого рендерер бросит ``provide a `form` bundle (createJsonForm) or both `schema` and `model` props``.

> **Альтернатива без бандла.** Если модель уже создана отдельно (`createModel`) или нужен низкоуровневый контроль, передавайте `schema` и `model` разными пропами: `<JsonFormRenderer schema={schema} model={model} />`. `createJsonForm` умеет принять готовую модель пропом `model` вместо `initial`, а декларативное поведение — пропом `behavior`.

## Что внутри

- **createJsonForm / useJsonForm** — сборка формы из схемы одним проходом. `createJsonForm<T>({ schema, registry, initial | model, behavior? })` возвращает бандл `{ model, form, schema, registry }`; `useJsonForm(factory)` кэширует его стабильно (ленивый `useState`). Бандл целиком отдаётся рендереру пропом `form` — схема передаётся один раз, вместо прежней двойной передачи (`convertJsonToM1Tree` для `createForm` + отдельный проп `schema`).
- **defineJsonSchema&lt;T&gt;** — идентити-хелпер, типизирующий литерал схемы по форме `T`: пути внутри `$model(...)` сужаются до `Path<T>` (опечатка ловится компилятором), не нужен `as unknown as JsonFormSchema`. Для схемы-строки-с-сервера (тип неизвестен) — `JsonFormSchema` без параметра. Пути внутри `item.$template` относительны элементу и не типизируются.
- **JsonFormRenderer** — главный компонент-рендерер; получает бандл `form` (или пару `schema` + `model`) пропами, реестр — из контекста провайдера. `JsonRendererProvider` задаёт глобальные настройки `{ registry }`, а `useJsonRendererSettings` читает текущие настройки.
- **Операторы** — строки `$model(path)` (привязка листа к сигналу модели), `$component(Name)` (компонент из реестра), `$dataSource(Name)` (значение-источник). Разбираются через `parseOperator` / `isModelOp` / `isComponentOp` / `isDataSourceOp`; голые строки идут как есть.
- **Реестр** — `defineRegistry` строит карту имён на компоненты и dataSource-значения. `FIELD_WRAPPER` (`'$fieldWrapper'`) — зарезервированный ключ для компонента-обёртки полей (label, error, hint), обычно `FormField` из `@reformer/ui-kit`.
- **Валидация схемы** — мета-схема form-DSL (`formSchemaMetaSchema`, `buildFormSchemaMetaSchema`, `getComponentNames`, `getDataSourceNames`, ajv-free). Полный `validateFormSchema` живёт в отдельной точке входа `@reformer/renderer-json/validate` (тянет ajv, не попадает в render-бандл); `JsonFormRenderer` грузит её динамически при `validate={true}`, ошибки рисует `SchemaErrorPanel`.

Для низкоуровневого доступа доступны `convertJsonToM1Tree` (JSON → RenderNode-дерево для `createForm({ model, schema })`) и `createRenderSchemaFromJsonM1` (JSON → `RenderSchemaFn`), а также type guards `isFieldNode` / `isArrayNode` / `isContainerNode`. Обычно эти функции вызывать не нужно: `createJsonForm` инкапсулирует `convertJsonToM1Tree` + `createForm`, а `JsonFormRenderer` — `createRenderSchemaFromJsonM1`. Тяните их напрямую только для ручной сборки.

## Дальше

- [@reformer/renderer-react](./renderer-react) — основа
- [Core API Reference](../api)
