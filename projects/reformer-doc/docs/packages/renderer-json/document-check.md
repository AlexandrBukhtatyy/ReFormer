---
title: 'Проверка документа'
sidebar_label: 'Проверка документа'
---

# Проверка документа

Ошибка в документе — опечатка в имени компонента, необъявленная часть, голая строка вместо
оператора — всплывает при сборке формы. Сборка бросает исключение на первом же промахе и про
остальные молчит. `validateFormSchema` проверяет документ целиком и возвращает список всех ошибок.

## Когда это нужно

- Документ приходит с сервера, из CMS или из конструктора форм.
- Нужна проверка в CI: все документы согласованы с реестром.
- В разработке вместо падения формы нужна понятная панель ошибок.

## Пример

```tsx
import { SchemaErrorPanel, type JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';

// LoanForm — компонент, который собирает форму: createForm({ schema: document, registry }).
export function LoanFormPage({ document }: { document: unknown }) {
  // Проверяем до сборки: сборка с неизвестным компонентом бросает исключение.
  const check = validateFormSchema(document, { registry: loanRegistry });
  if (!check.valid) return <SchemaErrorPanel errors={check.errors} />;

  return <LoanForm document={document as JsonFormSchema<LoanForm>} />;
}
```

`validateFormSchema` возвращает `{ valid, errors }`. Каждая ошибка — строка «путь + что не так»,
например `root.children[2].component: unknown component "Selct"`. `SchemaErrorPanel` рисует список с
`role="alert"`.

`validateFormSchema` лежит в отдельном входе `@reformer/renderer-json/validate`: он тянет ajv, а
рендеру ajv не нужен. Если документы из бандла уже проверены в CI, в рабочую сборку этот вход можно не
включать. Документам из сети проверка нужна и в рабочей сборке.

## Что проверяется

| Проверка                                         | Пример ошибки                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| структура узлов и допустимые ключи               | `has unknown property "value"`                                        |
| синтаксис операторов                             | `model must match pattern "^\$model\(.+\)$"` — голая строка `"email"` |
| имена `$component`, `$dataSource`, `$fn`         | `unknown component "Selct"`, `unknown dataSource "LOAN_TYPE"`         |
| вид записи: `$fn` указывает на данные и наоборот | ошибка с именем записи                                                |
| ключи `$locale` — если у сервиса есть `keys`     | ошибка с неизвестным ключом                                           |
| теги `$html` — всегда, по разрешённому списку    | запрещённый или неизвестный тег                                       |
| имена `$part` — объявлены в `parts`              | ошибка с именем части                                                 |
| полнота `initialValue` массива                   | ключи строки, которых в нём нет                                       |
| несобранные ссылки на шаги                       | `step reference "…" is not resolved`                                  |
| пропсы компонентов — если задан `propSchemas`    | `has unknown property "lable"`                                        |
| документ без `format: 2`                         | одна ошибка с отсылкой к `migrateJsonSchema`                          |

Что **не** проверяется:

- **Значения, которые вводит пользователь.** Это правила формы — см.
  [Обзор валидации](/docs/validation/overview).
- **Пути `$model(...)`.** Проверяется только синтаксис. Пути проверяет типизация документа в коде
  (`defineJsonSchema<T>`) и проверка реестра форм перед сборкой.

## Параметры

| Параметр                                                     | Что делает                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `registry`                                                   | имена компонентов, данных, функций и ключи локализации берутся из реестра |
| `componentNames`, `dataSourceNames`, `fnNames`, `localeKeys` | явные списки вместо реестра; главнее того, что дал реестр                 |
| `propSchemas`                                                | схемы пропсов по имени компонента — проверка `componentProps`             |

Без реестра и без списков имена не проверяются — только структура и синтаксис. `valid: true` тогда
не значит, что все компоненты есть.

### Проверка пропсов компонентов

У компонентов `@reformer/ui-kit` есть описания пропсов во входе `@reformer/ui-kit/meta`. Описание
поля нужно дополнить пропсами обёртки (`label`, `description`, …) — это делает
`mergeFieldPropsSchema`:

```ts
import { defaultPropSchemas, mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { validateFormSchema } from '@reformer/renderer-json/validate';

const kitPropSchemas = Object.fromEntries(
  Object.entries(defaultPropSchemas).map(([name, schema]) => [name, mergeFieldPropsSchema(schema)])
);

validateFormSchema(document, { registry, propSchemas: kitPropSchemas });
```

- Ключи карты — имена в реестре по соглашению кита: `Input`, `Select`, `InputNumber`… Компонент,
  зарегистрированный под другим именем, проверку пропсов пропускает.
- Строки-операторы (`$dataSource(...)`, `$locale(...)`) допустимы на месте любого пропа.
- Структурную запись `{ "$locale": "key", "params": { … } }` эта проверка сейчас отклоняет как
  не-строку, хотя сборка её понимает.

## В тестах

Проверка документов против реестра — дешёвый тест, который ловит расхождения до выкладки:

```ts
import { describe, expect, it } from 'vitest';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { loanDocument } from './form.schema';
import { loanRegistry } from './registry';

describe('документ кредитной заявки', () => {
  it('согласован с реестром', () => {
    expect(validateFormSchema(loanDocument, { registry: loanRegistry }).errors).toEqual([]);
  });
});
```

## Ошибки при отрисовке

Реестр кладёт в сборку границу ошибок `SchemaErrorBoundary`, и `FormRenderer` оборачивает ею форму.
Ошибка при отрисовке дерева показывает `SchemaErrorPanel`, а не белый экран.

Ошибку сборки граница не ловит: неизвестный `$component` бросает исключение ещё в `createForm`, до
рендера. Поэтому документ проверяют до сборки, как в примере выше.

## Подсказки в редакторе

Ключ `$schema` в документе — путь к мета-схеме. Редактор с поддержкой JSON Schema (например,
VS Code) подсветит лишние ключи и неверные операторы прямо при наборе.

- `formSchemaMetaSchema` — базовая мета-схема без привязки к реестру.
- `buildFormSchemaMetaSchema({ componentNames })` — с перечнем имён: редактор подскажет
  `$component(...)` из вашего реестра.
- `buildFormStepMetaSchema(...)` — для файлов отдельных шагов мастера (ключ `node`).

```ts title="scripts/write-form-meta-schema.ts"
import { writeFileSync } from 'node:fs';
import { buildFormSchemaMetaSchema, getComponentNames } from '@reformer/renderer-json';
import { loanRegistry } from '../src/forms/loan/registry';

const metaSchema = buildFormSchemaMetaSchema({ componentNames: getComponentNames(loanRegistry) });
writeFileSync('src/forms/form-schema.schema.json', JSON.stringify(metaSchema, null, 2));
```

```json
{ "$schema": "../form-schema.schema.json", "format": 2, "root": { "component": "$component(Box)" } }
```

Сборка ключ `$schema` пропускает. Подсказки редактора не заменяют `validateFormSchema`: имена
`$dataSource` и ключи `$locale` мета-схема не проверяет.

## Подводные камни

- **`valid: true`, а форма падает** — не передан ни `registry`, ни списки имён: имена не проверялись.
- **Проверка на каждый рендер** — каждый вызов заново компилирует мета-схему. Проверяйте документ
  один раз при загрузке. Реестр форм кэширует результат сам — `validateSchemaCached` из
  `@reformer/form-registry/manifest`.
- **Документ мастера со ссылками на шаги** проверяйте после `composeJsonFormSchema`.

## См. также

- [Формат документа](./document-format.md) — что считается правильным документом.
- [Реестр](./registry.md) — откуда проверка берёт имена.
- [Проверки реестра форм](../form-registry/checks.md) — проверка формы перед сборкой в микрофронтендах.
