# Overview

`@reformer/form-registry` решает одну задачу: **какая форма рендерится, где и когда**, в приложении
из нескольких микрофронтов. Один бандл регистрирует форму, другой решает, показывать ли её и в каком
месте.

## Проблема

Связка «id формы → модуль» обычно набирается руками: импорт, пункт меню, маршрут. Три правки, ничем
не связанные ни между собой, ни с самой формой. Приложение, собранное отдельно, добавить форму не
может вовсе — оно не участвует в сборке хоста.

Реестр заменяет проводку записью:

```ts
getFormRegistry().register(checkoutEntry);
// дальше достаточно id:
// <FormOutlet id="checkout" />
```

## Установка

```bash
npm install @reformer/form-registry @reformer/core @reformer/renderer-json @reformer/renderer-react
```

`react` — опциональный peer: он нужен только для `@reformer/form-registry/react`. Ядро реестра,
хранилище и guard React не требуют и работают в vanilla-микрофронте.

## Точки входа

| импорт | что внутри | React |
| --- | --- | --- |
| `@reformer/form-registry` | реестр, разрешение, загрузчик, preflight, сеть, кэш | нет |
| `@reformer/form-registry/react` | `FormRegistryProvider`, `FormOutlet`, `FormSlot`, `FormRoute` | да |
| `@reformer/form-registry/storage` | стратегии OPFS / IndexedDB / память, `pickStorage` | нет |
| `@reformer/form-registry/manifest` | валидация схемы мета-схемой (**тянет ajv**) | нет |
| `@reformer/form-registry/guard` | обнаружение дубля рантайма (ноль зависимостей) | нет |

Разделение не косметическое: ajv тяжелее, чем всё ядро реестра вместе взятое, поэтому он живёт
только за `./manifest`. Инвариант держится проверкой `scripts/check-ajv-isolation.mjs` в CI, а не
договорённостью.

## Главная идея: форма — это не только схема

Канонический пакет формы состоит из десяти файлов, и только один из них — данные:

- `renderer.schema.json` — **данные**, сериализуемо, может приехать по сети;
- `validation.ts`, `form.behavior.ts`, `renderer.behavior.ts`, `api.ts`, `registry.ts`,
  `data-sources.ts`, `model.ts`, `types.ts` — **код**.

Отсюда следует то, что закреплено в типах: `DataSource` умеет `kind: 'http'`, а `CodeSource` — нет.
Это не «пока не реализовано». Загружать код по сети означало бы исполнять то, что отдал сервер.

Поэтому по сети едет схема, которая обращается к коду **по имени** — через операторы
`$component(...)`, `$dataSource(...)`, `$fn(...)`, `$locale(...)`. Код должен быть в бандле заранее;
если имени в реестре нет, это ловит preflight (см. `05-preflight.md`).

## Поток

```
FormEntry (запись)
   │
   ├─ resolveForms(query, ctx) ──→ отбор по id/slot/route/tag + права и флаги
   │
   ├─ loadForm(entry, baseRegistry, opts)
   │     ├─ схема: inline / module / http (через кэш)
   │     ├─ код: inline / module
   │     ├─ composeRegistries(base, own)   ← расширение записи перекрывает базу
   │     └─ preflight — 5 проверок
   │
   └─ MountedForm → createJsonForm → JsonFormRenderer
```

Разделение загрузки и монтирования обязательное, а не стилистическое: `useJsonForm` — ленивый
`useState`, его фабрика вызывается ровно один раз. Строить форму, пока не приехали схема, реестр и
поведение, нельзя — первый вызов зафиксировал бы неполный набор навсегда.

## Что читать дальше

- `02-form-entry.md` — из чего состоит запись и почему именно так
- `03-mounting.md` — `FormOutlet`, `FormSlot`, `FormRoute`, права и флаги
- `04-cache-storage.md` — сеть, двухуровневый кэш, стратегии хранения
- `05-preflight.md` — пять проверок до сборки формы
- `06-guard.md` — двойной рантайм в микрофронтах
- `07-troubleshooting.md` — симптом → причина
