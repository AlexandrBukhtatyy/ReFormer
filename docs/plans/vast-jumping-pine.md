# Унификация терминологии: `source` → `dataSource` в реестре renderer-json

## Context

В JSON-DSL пакета `@reformer/renderer-json` один и тот же концепт назван двумя словами:

- **Сторона операторов** говорит `dataSource`: строковый токен `$dataSource(NAME)`, тип `DataSourceOp`, guard `isDataSourceOp`, `ParsedOperator.op: 'dataSource'`, `resolveDataSource`, текст ошибки `unknown dataSource`.
- **Сторона реестра** говорит `source`: `reg.source()`, `RegistryBuilder.source`, `ComponentMetadata.type: 'source'`, `getSource()`, `getSourceNames()`, опция `ValidateFormSchemaOptions.sourceNames`.

Это создаёт когнитивный раскол: консумент пишет `$dataSource(LOAN_TYPES)` в JSON, но регистрирует значение через `reg.source('LOAN_TYPES', …)`. **Проверка (сделана статически): аргументы всех операторов `$component`/`$dataSource` в `json-schema.json` уже совпадают с именами реестра — жёсткого рассинхрона аргументов нет; CI-гейт [gen-form-json-schema.ts](../../projects/react-playground/scripts/gen-form-json-schema.ts) это гарантирует.** Задача — устранить именно терминологический раскол.

**Решение (выбрано пользователем): унифицировать на `dataSource`, меняя сторону реестра.** Сериализованный JSON-DSL токен `$dataSource(...)` и все `.json`-файлы остаются нетронутыми (формат данных стабилен, ничего не ломаем для CMS/сервера) — переименовываются только TypeScript-идентификаторы реестра.

## Rename map

| Старое (`source`) | Новое (`dataSource`) | Тип |
|---|---|---|
| `RegistryBuilder.source(name, value, desc)` | `RegistryBuilder.dataSource(...)` | публичный метод builder-а |
| `ComponentRegistry.getSource<T>(name)` | `getDataSource<T>(name)` | публичный метод реестра |
| `ComponentMetadata.type` значение `'source'` | `'dataSource'` | дискриминатор записи |
| `getSourceNames(registry)` | `getDataSourceNames(registry)` | экспортируемая функция |
| `ValidateFormSchemaOptions.sourceNames` | `dataSourceNames` | публичное поле опций |
| локальные `sourceNames` (в `validate.ts`/`walkOperatorNames`) | `dataSourceNames` | внутреннее |
| сообщение `Entry "x" is a 'source' …` | `… is a 'dataSource' …` | текст ошибки |

Токен/операторы (`$dataSource`, `DataSourceOp`, `isDataSourceOp`, `op:'dataSource'`, `resolveDataSource`) **уже** в целевой терминологии — не трогаем.

## Изменения по файлам

### 1. Пакет `packages/reformer-renderer-json/src`

- [registry/types.ts](../../packages/reformer-renderer-json/src/registry/types.ts): в `ComponentMetadata.type` union `'source'`→`'dataSource'` (строка 23); в `ComponentRegistry` метод `getSource`→`getDataSource` (43); в `RegistryBuilder` метод `source`→`dataSource` (63); поправить JSDoc-примеры (`reg.source('LOAN_TYPES', …)`→`reg.dataSource(...)`).
- [registry/component-registry.ts](../../packages/reformer-renderer-json/src/registry/component-registry.ts): переименовать метод класса `getSource`→`getDataSource` и внутри `meta.type !== 'source'`→`!== 'dataSource'` (17–21); в `defineRegistry` builder `source(...)`→`dataSource(...)` и `type: 'source'`→`type: 'dataSource'` (87–89); поправить JSDoc-пример (63–72).
- [schema/index.ts](../../packages/reformer-renderer-json/src/schema/index.ts): `getSourceNames`→`getDataSourceNames` (28) и фильтр `=== 'source'`→`=== 'dataSource'` (29); поправить `{@link getSourceNames}` в шапке (6).
- [validate.ts](../../packages/reformer-renderer-json/src/validate.ts): импорт `getSourceNames`→`getDataSourceNames` (20); поле опций `sourceNames`→`dataSourceNames` (35); параметр и локали `sourceNames`→`dataSourceNames` (43, 50, 57, 63, 83–84, 98). Условие в `walkOperatorNames` остаётся на `op?.op === 'dataSource'`.
- [converter/json-to-render-schema.ts](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts): в `resolveComponent` проверка `meta.type === 'source'`→`=== 'dataSource'` и текст ошибки `is a 'source'`→`is a 'dataSource'` (39–40). `resolveDataSource` уже назван корректно — оставить.
- [index.ts](../../packages/reformer-renderer-json/src/index.ts): реэкспорт `getSourceNames`→`getDataSourceNames` (73).
- [validate.test.ts](../../packages/reformer-renderer-json/src/validate.test.ts): ключ опции `sourceNames`→`dataSourceNames` (6). Ассерты уже проверяют `dataSource.*MISSING` — не меняются.

### 2. Консумент — пример кредитной заявки

- [registry.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts): 13 вызовов `reg.source(...)`→`reg.dataSource(...)` (строки 95–122). Строковые **ключи** (`'LOAN_TYPES'`, `'PROPERTY_ITEM_LABEL_SOURCE_FN'` и т.д.) и `json-schema.json` НЕ меняются. Опционально — поправить прозаические комментарии («Source-функции», «Source-компоненты») на «dataSource-…».

### 3. Документация (не править `llms.txt` руками)

`llms.txt` каждого пакета **генерируется** из JSDoc + рукописных `docs/llms/*.md` через `scripts/generate-llms-txt`. Поэтому:

- Обновить исходные markdown-доки, где встречаются `reg.source(...)`, `getSource`, `getSourceNames`, `type: 'source'`, «source value»: [docs/llms/03-registry.md](../../packages/reformer-renderer-json/docs/llms/03-registry.md), [05-cookbook.md](../../packages/reformer-renderer-json/docs/llms/05-cookbook.md), [04-troubleshooting.md](../../packages/reformer-renderer-json/docs/llms/04-troubleshooting.md), [02-json-schema.md](../../packages/reformer-renderer-json/docs/llms/02-json-schema.md). Проверить также `packages/reformer-ui-kit/docs/llms/*` на упоминания `reg.source`.
- Регенерировать: `npm run generate:llms --workspaces --if-present` (или `npm run build` пакета). `llms.txt` перезапишется из обновлённых источников.

## Явно НЕ трогаем

- `json-schema.json` — токены `$dataSource(...)` остаются (это сериализованный DSL/данные).
- `form-schema.schema.json` (и базовая, и сгенерированная) — в мета-схеме нет `dataSourceOp`, так что правки не требуются.
- `operators.ts` — вся операторная сторона уже в терминах `dataSource`.
- `types/json-schema.ts` — комментарий уже ссылается на `$dataSource(NAME)`.

## Verification

Прогнать после правок (из корня, если не указан пакет):

1. **Типы + генерация доков пакета:** `cd packages/reformer-renderer-json && npm run build` (включает `generate:llms` и typecheck). Либо быстрый `npx tsc --noEmit`.
2. **Юнит-тесты рендерера:** `cd packages/reformer-renderer-json && npx vitest run` — `validate.test.ts` должен проходить с `dataSourceNames`.
3. **Типы консумента:** `cd projects/react-playground && npx tsc --noEmit` — `registry.ts` компилируется с `reg.dataSource`.
4. **CI-гейт схемы (ключевая проверка end-to-end):** `cd projects/react-playground && npm run gen:form-schema` (или `npx tsx scripts/gen-form-json-schema.ts`). Должно вывести `✓ json-schema.json is valid …` — это прогоняет `validateFormSchema(raw, { registry })`, которая внутри вызывает переименованный `getDataSourceNames`, подтверждая, что `$dataSource(...)`-имена по-прежнему резолвятся против реестра.
5. **Линт/knip:** `npm run lint` (проект недавно подключил knip — убедиться, что нет висячих старых экспортов).
6. **Опционально e2e-smoke** формы renderer-json: options в Select/RadioGroup рендерятся, AsyncBoundary отрабатывает loading/error, itemLabel в массивах корректен — подтверждает рантайм-резолв `dataSource` после переименования.

## Notes / risks

- Это **ломающее** переименование публичного API пакета (`getSourceNames`, `RegistryBuilder.source`, `ComponentRegistry.getSource`, `ValidateFormSchemaOptions.sourceNames`). Приемлемо: все пакеты на `6.0.0`, в истории регулярные `!`-коммиты. Если нужна обратная совместимость — можно оставить deprecated-алиасы, но «унификация» подразумевает чистое переименование (рекомендуется чистый ренейм без алиасов).
- Blast radius внутри репозитория мал: единственный внешний консумент реестра — пример `complex-multy-step-form-renderer-json`; `getSource` внутри рантайма нигде не вызывается (только объявление/реализация), `getSourceNames`/`reg.source` — только в `validate.ts`/примере/доках.
