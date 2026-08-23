# Knowledge-слой ReFormer в браузере: `core` / `platform` и подключение к ассистенту билдера

> Актуализировано 2026-08-22 после переработки `@reformer/mcp` (коммиты `987110c6`, `0d6ce064`,
> `937233cb`, `1fe780e0`). Цифры измерены на HEAD; ссылки — на реальный код.

## Context

`@reformer/mcp` работает **только по stdio** — браузер такой сервер поднять не может. При этом в
`projects/reformer-builder` уже есть зрелый AI-ассистент: BYOK прямо из вкладки, Vercel AI SDK v7,
свой agent-loop и 13 инструментов над layout-JSON, ничего не знающих про API `@reformer/core`.

Задача: сделать так, чтобы знания о библиотеке были доступны ассистенту билдера, **включая канал
GitHub Pages без Node-процесса**.

**Цели (все четыре, подтверждены):** (1) справка по библиотеке, (2) заполнение `validation.ts` /
`form.behavior.ts`, которые codegen эмитит моками, (3) форма целиком по спеке, (4) проверка
технической осуществимости переноса.

**Принятые решения:**

| Развилка | Решение |
| --- | --- |
| Граница «ядро / среда» | `src/core/` + `src/platform/{cli,browser}/` внутри существующего пакета |
| Как ядро получает источники | **Фабрика `createKnowledge(sources)`**, без глобального состояния |
| Корпус в браузере | `llms-index.json` **и** `llms.txt` |
| Набор инструментов для билдера | **Один фасад-инструмент**, каскад `choose_api → find_recipe → search_docs` внутри него. Выбран замером Э0, отчёт — [builder-toolset.md](../mcp-eval/builder-toolset.md) |
| Канал Pages | Обязателен |
| MCP-протокол в браузере | Нет; фасад из тех же `definition` + функция (обоснование — §4) |
| Web worker | По замеру, вторая обёртка над тем же фасадом (§4) |

---

## 1. Что уже сделано — переработка v7 закрыла три этапа прежнего плана

| Прежний этап плана | Статус |
| --- | --- |
| Prebuilt index вместо рантайм-парсинга TS | ✅ `llms-index.json` у каждого пакета, **1167 символов / 79 тем**, `INDEX_SCHEMA_VERSION = 1`, артефакты в git с `1fe780e0` |
| Убрать `typescript` из runtime | ✅ optional peer + ленивый `await import()` с try/catch, [symbols.ts:43-52](packages/reformer-mcp/src/index/symbols.ts#L43-L52). Замер: **17 мс** против 784 мс |
| Подпутевые экспорты в источнике | ✅ `entries` в каждом символе: `defineFormBehavior → ["./behaviors"]`, `validate → ["./validation"]` |
| Агрегирующий инструмент вместо россыпи | ✅ `get_context` с профилями `minimal ~400 / implementation ~1000 / debug ~1800 / full` |

Сверх плана появилось: decision-слой `choose_api` (24 двуязычных правила), `plan_form`/`generate_form`,
`validate_form` с кодами `RF001–RF010` и полем `fix: { tool, arguments }`, BM25 в `search_docs`,
eval-харнесс с baseline, `resources/list` ужат с 350 записей (20 900 токенов) до 8 (520).

**Текущая поверхность:** 10 листящихся инструментов, **8854 символа ≈ 2219 токенов**.
Полная цена подключения — 3737 токенов (tools 2219 + resources 520 + prompts 998).

**Baseline** ([docs/mcp-eval/baseline.json](docs/mcp-eval/baseline.json), стратегия `v6-choose`,
49 задач): hitRate 1.0, firstPassRate **0.939**, tokens/task median 321 / p95 1987, calls median 1.

---

## 2. Что осталось: ядро уже почти изоморфно, граница не проведена

**17 модулей — ноль Node-API:** `index/{search,symbols,types}`, `context/{budget,builder,profiles}`,
`decide/api-decision`, `generate/{builders,cross-check,form-intent,from-spec}`, `validate/{code,codes}`,
`utils/graph`, а также `tools/{search-docs,get-context,choose-api,validate-form,list-symbols,get-symbol-docs,check-behaviors}`.

Это не совпадение: [validate/code.ts](packages/reformer-mcp/src/validate/code.ts) намеренно разбирает
код регэкспами, а не TS-парсером — «тянуть его обратно значило бы отменить выигрыш Фазы 2».
Браузерная совместимость уже была проектным соображением под другим именем.

**Вся Node-зависимость — в 12 файлах, и почти вся это резолв путей:**

| Файл | Что именно |
| --- | --- |
| [index/loader.ts](packages/reformer-mcp/src/index/loader.ts) | `fs`, `path`, `url`, `__dirname`, `process.cwd()` ×2 |
| [utils/docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts) | то же + **`module.createRequire`** (единственное место в `src/`) |
| [tools/find-recipe.ts](packages/reformer-mcp/src/tools/find-recipe.ts) | `readdirSync` по `docs/llms` |
| [utils/prompt-template-loader.ts](packages/reformer-mcp/src/utils/prompt-template-loader.ts) | `node:fs` для 12 Handlebars-шаблонов |
| `utils/symbols-parser.ts` | `import * as ts from 'typescript'` — только фолбэк |
| `tools/report-issue.ts` | `writeFileSync` — **единственная запись на диск во всём сервере** |
| `utils/{project-detector,spec-analyzer}.ts`, `prompts/{plan-form,create-form}.ts`, `index.ts` | чтение проекта, `process.env`, stdio-бутстрап |

Два места, где граница проходит не гладко, и это надо назвать заранее:

- **`generate_form` едет в браузер целиком** — он не пишет на диск, а возвращает манифест файлов
  текстом (обоснование в его шапке: path traversal через `outputDir` от модели). Для билдера это
  прямо ложится на существующий `src/codegen/`.
- **`find_recipe` деградирует.** Первая стадия читает `docs/llms/*.md` через `readdirSync`; в браузере
  остаётся каскад в `search_docs` — он для этого и делался, но потеря должна быть в отчёте, а не
  обнаружиться потом.

---

## 3. Целевая архитектура

```
packages/reformer-mcp/src/
  core/                      ← ноль Node-API; работает в CLI, в браузере, в воркере
    index/{search,symbols,types}       BM25 + ранжирование символов
    context/{budget,builder,profiles}  get_context, дедупликация фактов одним Set
    decide/api-decision                24 правила, двуязычные cues
    generate/{builders,cross-check,form-intent,from-spec}
    validate/{code,codes}              RF001–RF010, регэкспы вместо tsc
    utils/graph                        поиск циклов
    tools/*                            definition + чистая функция
    ports.ts                           IndexSource · DocsSource · RecipeSource ·
                                       TemplateSource · SpecSource · IssueSink
    create-knowledge.ts                фабрика: sources → объект с инструментами

  platform/cli/              ← нынешние загрузчики, перенесены как есть
    index-source · docs-source · recipe-source · template-source
    spec-source · issue-sink · project-detector
    server.ts                          stdio + Server + регистрация

  platform/browser/
    index-source · docs-source         артефакт из бандла / node_modules проекта через FS Access
    spec-source                        File / drag&drop вместо readFileSync
    issue-sink                         IndexedDB вместо ~/.reformer
    index.ts                           фасад: те же definition + функция, async

  index.ts                   ← bin, тонкий: собирает cli-источники и поднимает server.ts
```

### 3.1. `createKnowledge(sources)`

Фабрика вместо модульных синглтонов — решение принято сознательно, ценой правки тестов.
Что она даёт помимо чистоты: **два источника одновременно**. В Mode B билдер имеет папку проекта
через File System Access, а значит может прочитать `node_modules/@reformer/*/llms-index.json`
**пользователя** — то есть версии, реально у него установленные. Это ровно то свойство, ради
которого [loader.ts](packages/reformer-mcp/src/index/loader.ts) читает индекс у пакета, а не из
своего `dist`; глобальный синглтон его бы потерял.

Стоимость честно: сейчас `tools/*` зовут `getMergedIndex()` и `searchSections()` напрямую, а на
пакете 123 теста в 16 файлах. Правка механическая, но широкая — гейт на неё в §5, Э1.

### 3.2. Где живёт корпус в браузере

| Канал | Источник | Свежесть |
| --- | --- | --- |
| Pages / Mode A | артефакт, собранный при сборке билдера из `packages/*` | версия сборки билдера |
| Mode B (папка проекта открыта) | `node_modules/@reformer/*/{llms-index.json,llms.txt}` через FS Access | версии пользователя |

Объём: индекс 1 276 432 B + `llms.txt` 1 266 838 B = **2.54 MB raw**, порядка 600 KB gzip, лениво
отдельным чанком. Для сравнения в билдере уже есть `byok-*.js` 712 KB и App-чанк 1.81 MB.

**OPFS — только для второго случая.** Артефакт из бандла кэширует HTTP по immutable-хэшу бесплатно;
кэшировать между сессиями имеет смысл именно индекс, вычитанный из чужого проекта. Компоненты
готовы: [opfs.ts](packages/reformer-form-registry/src/storage/opfs.ts) + fallback на IndexedDB +
контракт, закреплённый `storage-contract.test.ts`.

---

## 4. Worker и MCP-протокол — почему не сейчас

Два независимых вопроса: worker про то, **где исполняется**, протокол — **как разговаривают**.

**Worker — по замеру.** Критерий RFC-0003: «оправдан бандлом, cold-джанком, отменяемостью — не
скоростью». Померить надо одно: `JSON.parse` 1.28 MB индекса. Порог наступит, когда в браузер поедет
`generate_form` (6 билдеров + кросс-проверка `C1..C9` — сотни мс). Worker — вторая обёртка над тем же
фасадом, не альтернативная архитектура. SharedArrayBuffer запрещён архитектурно (COOP/COEP не
настраиваются на Pages).

**MCP-протокол — нет, и это решение обратимо.** Асимметрия: фасад → протокол стоит ~50 строк поверх
тех же `xToolDefinition` + `xTool`; протокол → фасад стоит переделки всего, что на него оперлось.
Практическое: postMessage-транспорта в SDK нет (stdio / sse / streamableHTTP / websocket / inMemory) —
писать и тестировать самому, без продуктовой ценности. Единственный довод «протокол нужен, чтобы
eval мерил браузерную сборку» проверен и не работает: поверхность та же самая, стратегию `builder`
можно мерить на stdio-сервере с урезанным набором.

---

## 5. Ограничения, которые обязан соблюсти любой этап

1. **`TOOL_SURFACE_BUDGET = 7700`** ([types.ts](projects/reformer-builder/src/agent/core/types.ts)) —
   храповик, занятый на **7684 символа**: свободно шестнадцать (измерено Э0). Комментарий прямой:
   «его СНИЖАЮТ, поднимать нельзя». Единственное историческое повышение было оплачено измеренной
   экономией. Именно эта цифра, а не соображения вкуса, отсекает перенос набора инструментов MCP:
   самый дешёвый набор требует освободить 840 символов, самый качественный — 2858.
2. **`TOOL_DESCRIPTION_BUDGET = 500`.** `choose_api` имеет `description` = 824 — если он поедет,
   описание придётся сжать. Правка полезна и самому MCP: описание уходит в контекст при каждом
   подключении.
3. **`TOOL_TEXT_BUDGET = 1500`** и обрезка `clamp` в
   [registry.ts](projects/reformer-builder/src/agent/core/registry.ts). У `get_context` свой бюджет
   в токенах (`Math.ceil(chars/4)`) — два потолка надо согласовать, иначе `clamp` дорежет уже
   урезанное и собьёт пометку «обрезано».
4. **Юнит-тесты билдера в CI не запускаются** — `test.yml` гоняет только пакеты. Значит храповик
   поверхности сегодня охраняется лишь локально ([registry.test.ts:114](projects/reformer-builder/src/agent/core/registry.test.ts#L114)).
5. **Pages не ломать** — DoD F2 из RFC-0002 требует ещё и «размер начального чанка не вырос».
6. **P4 «No remote code»** (RFC-0001 §3.2): корпус — данные и часть сборки; загрузка кода по сети
   исключена.
7. **`sourcePath` в индексе** считается как `path.relative(process.cwd(), …)` — зависит от каталога
   запуска генератора. Для артефакта, который поедет в бандл, это надо сделать детерминированным.

---

## 6. План работ

### Э0 — измерить, что вообще подключать · ✅ выполнено 2026-08-23

Отчёт: [docs/mcp-eval/builder-toolset.md](../mcp-eval/builder-toolset.md). Сделано: объявление
`export const tools` в стратегиях, подсчёт поверхности набора в `runner.mjs` по формуле билдера,
две новые стратегии — `builder` (набор `choose_api` + `get_context`) и `builder-facade`
(каскад внутри одного инструмента консумента, с обрезкой по `TOOL_TEXT_BUDGET`).

**Результат — оба ожидания не подтвердились:**

| стратегия | поверхность | hit | first-pass | tok med | tok всего |
| --- | ---: | ---: | ---: | ---: | ---: |
| `choose_api` + `get_context` | 2188 | **91.8 %** | 73.5 % | 321 | 40 329 |
| `choose_api` + `find_recipe` + `search_docs` | 2858 | 100 % | 93.9 % | 321 | 34 620 |
| **фасад: один инструмент, каскад внутри** | ~450 | **98.0 %** | **98.0 %** | **294** | **14 184** |

Набор `choose_api` + `get_context` оказался единственным, который **теряет задачи** (validation
8/10, renderers 8/10). Фасад выигрывает у всех по всем метрикам разом и вдобавок делает ровно один
вызов на задачу (p95 = 1) — каскад исполняется кодом, промахи не оплачиваются контекстом.

Поверхность билдера измерена: **7684 из 7700**, свободно шестнадцать символов.

**Что осталось от Э0 и переехало в Э3:** включить `projects/reformer-builder` в матрицу
[test.yml](.github/workflows/test.yml) и освободить ~500 символов под описание фасада сжатием схем
крупных write-инструментов (`set_node_prop` 895, `insert_node` 890, `set_layout` 827,
`move_node` 815).

### Э1 — `core` / `platform` + `createKnowledge` · ✅ выполнено 2026-08-23

**Сделано (2026-08-23), тесты 133/133 и eval-baseline неподвижны на каждом шаге:**

- **Оба загрузчика расщеплены.** `utils/docs-parser.ts` → `core/docs/{packages,sections,corpus}.ts`
  + `platform/cli/docs-source.ts`; `index/loader.ts` → `core/index/merge.ts` +
  `platform/cli/index-source.ts`. Чистые разборщики принимают ТЕКСТ, а не имя пакета, поэтому
  проверяются литералом без диска.
- **Фабрика `createKnowledge(sources)`** (`core/knowledge.ts`) с тремя портами: `DocsSource`,
  `IndexSource`, `SymbolsFallback`. Источники синхронные намеренно — иначе async расползся бы
  по всему ядру ради операции, которая в CLI синхронна; асинхронно только СОЗДАНИЕ источника.
- **Кэши переехали с модулей на экземпляр** (`k.memo`). Модульный кэш был бы общим для двух
  разных `Knowledge` — вшитого артефакта и папки проекта, — и второй молча отвечал бы данными
  первого.
- **23 модуля в `core/`**: docs, index (merge/search/symbols/types), context, decide, generate,
  validate/codes, utils/graph и пять инструментов (`search_docs`, `choose_api`, `get_context`,
  `check_behaviors`, `validate_form`).
- **Гейт изоморфности включён:** `check:no-node-globals` расширен на `dist/core` пакета, обход
  сделан рекурсивным (плоский `readdirSync` проверял бы один уровень и молча пропускал
  `core/docs`, `core/index`, `core/tools`). Сейчас: ✓ 23 файла без node-глобалей.
- **Тесты переведены на явное знание** — 22 вызова в 6 файлах. Временные фасады
  (`utils/docs-parser`, `index/loader`, `index/symbols`) оставлены только для тех потребителей,
  которых ещё не перевели, и все три смотрят в ОДНО знание процесса.

**Портированы все Node-зависимости инструментов.** Ещё три порта поверх первых трёх:

| порт | зачем | заглушка в браузере |
| --- | --- | --- |
| `RecipeSource` | файлы `docs/llms` для первой стадии `find_recipe` | `EMPTY_RECIPE_SOURCE` — топик уходит в каскад по секциям |
| `SpecSource` | текст постановки для `plan_form` | `EMPTY_SPEC_SOURCE` — работает только `description` |
| `IssueSink` | единственная запись во всём сервере (`report_issue`) | `UNAVAILABLE_ISSUE_SINK` — честный отказ вместо тишины |

Ссылка на спеку намеренно строка, а не путь: в CLI это путь на диске, в браузере — имя
брошенного файла, содержимое которого уже в памяти. Инструменту разница не нужна.

**Итог:** `core/` — **36 файлов**, все инструменты, ноль node-глобалей (проверено гейтом);
`platform/cli/` — источники, сток, разбор AST, определение проекта и sampling.

**Осознанно оставлено вне `core/`:**

- `src/index.ts` и `src/prompts/*` — это поверхность MCP-**протокола** (stdio-бутстрап,
  `prompts/list`), а не знание о ReFormer. Браузер их не импортирует, поэтому переносить
  ради симметрии нечего.
- Три фасада (`utils/docs-parser`, `index/loader`, `index/symbols`) — их держат тесты, которые
  проверяют именно прежнюю поверхность. Все три смотрят в одно знание процесса, второго кэша
  не появляется.

**Что поймали гейты по дороге** (обе поломки были невидимы для `tsc`):

1. `check:no-node-globals` нашёл `process.cwd()` в тексте ошибки `plan_form` — знание о рабочем
   каталоге переехало в порт (`SpecSource.describe()`).
2. Тесты поймали сдвиг `__dirname`-пути в `symbols-parser` после переноса на уровень глубже:
   индекс перестал резолвиться, часть тестов молча ушла в skip. Переносчик импортов такие пути
   не видит по построению — они не спецификаторы.

---

#### Исходный замысел этапа

Чистый рефакторинг с **нулевой дельтой поведения**.

- Перенести 17 чистых модулей в `src/core/`, 12 нечистых — в `src/platform/cli/`.
- `core/ports.ts` — интерфейсы источников; `core/create-knowledge.ts` — фабрика.
- `tools/*` перестают звать `getMergedIndex()`/`searchSections()` напрямую и получают источники
  от фабрики. Это самая широкая правка: затрагивает 123 теста в 16 файлах.
- `src/index.ts` худеет до сборки cli-источников и вызова `platform/cli/server.ts`.
- **Гейты:** все 123 теста зелёные; `npm run mcp:evaluate` **не сдвигает baseline** (допуски уже
  заданы в `runner.mjs`: static ±200, tokens p95 ±500, firstPassRate без допуска);
  `npm run check:mcp-render`; `npm run check:packaging -w @reformer/mcp`.
- Расширить [check-no-node-globals.mjs](scripts/check-no-node-globals.mjs) на `src/core/**` — это
  превращает изоморфность из намерения в проверяемое свойство.

### Э2 — `platform/browser` + артефакт корпуса · 🟡 ядро готово, интеграция в билдер осталась

**Сделано (2026-08-23):**

- **`platform/browser`** — источники поверх артефакта (`createBundleDocsSource`,
  `createBundleIndexSource`), спеки из памяти (файл приходит drag&drop, содержимое уже
  загружено), сток отчётов в память вкладки, фасад `createBrowserKnowledge`.
- **Формат артефакта** — `core/bundle.ts`, своя `BUNDLE_SCHEMA_VERSION` (упаковка набора
  меняется по другим поводам, чем содержимое одного `llms-index.json`).
- **Генератор** — `packages/reformer-mcp/scripts/build-knowledge-bundle.mjs`: живёт у владельца
  формата, потребитель говорит только `--out`. Отсутствие источника — ошибка, а не тишина: у
  потребителя это выглядело бы как «в библиотеке нет такого API».
- **`exports`** у пакета: `.` (stdio-сервер), `./core`, `./browser`, `./*` для совместимости.
- **Гейт** расширен на `dist/platform/browser`; `check:exports-dist` научен пропускать
  subpath-паттерны (`"./*"` — правило подстановки, а не путь к файлу).

**Два артефакта вместо одного** — измерено:

| | raw | gzip |
| --- | ---: | ---: |
| `knowledge-index.json` | 1.28 МБ | **264 кБ** |
| `knowledge-docs.json` | 1.51 МБ | 362 кБ |

Индекс питает `get_context`, `choose_api`, `get_symbol_docs`, `list_symbols`, `validate_form`;
проза нужна только `search_docs` и `find_recipe`. Слитые в один файл, они парсились бы вместе
даже когда нужен один — поэтому профиль «только индекс» стоит 264 кБ, а не 626 кБ, и он
покрыт тестом.

**Изоморфность доказана исполнением, а не декларацией.** `tests/browser-knowledge.test.ts`
(9 кейсов) собирает знание ровно так, как это сделает браузер — из объектов в памяти — и
прогоняет через него инструменты. Гейт `check:no-node-globals` доказывает лишь, что ядро
СОБЕРЁТСЯ: источник, молча возвращающий `null`, проходит его идеально. Тест закрывает
вторую половину: инструменты отвечают, а деградации (нет файлов рецептов, нет разбора AST)
видны в ответах, а не выглядят как «в библиотеке такого нет».

**Попутно найдено и исправлено — гейт был декоративным.** `tsc` не удаляет из `dist` файлы,
исчезнувшие из `src`, поэтому после переносов Э1 там лежали ОБЕ копии каждого модуля, и
`check:packaging` месяц бы проверял мёртвый путь `dist/tools/find-recipe.js`, ничего не
замечая. Теперь `build` чистит `dist`, и на чистой сборке гейт сначала честно упал, а потом
был починен.

**`sourcePath` в индексе стал детерминированным** — считается от каталога пакета, а не от
`process.cwd()`. Проверено двумя запусками (из корня и из пакета): артефакт совпадает.

**Осталось (переходит в Э3):** вызов генератора при сборке билдера, запись в
`.size-limit.json`, второй источник — `node_modules` проекта через File System Access (Mode B).

---

#### Исходный замысел этапа

- Реализации источников: `index-source` / `docs-source` поверх динамического `import()` артефакта;
  `spec-source` из `File`; `issue-sink` в IndexedDB (у билдера уже база `reformer-builder` v3 с
  миграциями — [io/idb.ts](projects/reformer-builder/src/io/idb.ts)).
- Сборка артефакта из `packages/*/{llms-index.json,llms.txt}` — скрипт в билдере по образцу
  [gen-kit-catalog.mjs](projects/reformer-builder/scripts/gen-kit-catalog.mjs), вызов в `build`
  рядом с `generate:kit-safelist`.
- Сделать `sourcePath` детерминированным в
  [index-builder.js](scripts/generate-llms-txt/index-builder.js) (сейчас зависит от CWD).
- Второй источник — `node_modules` проекта через FS Access (Mode B); при обоих доступных побеждает
  проектный, версии показываются в ответе инструмента.
- **Гейты:** `check:no-node-globals` на `platform/browser/**`; артефакт не старше источников
  (скрипт по образцу [check-mcp-render.mjs](scripts/check-mcp-render.mjs)); записи в
  [.size-limit.json](.size-limit.json) на чанк артефакта и на начальный чанк билдера с лимитом =
  текущий размер.

### Э3 — цель 1: подключение к ассистенту · ~1.5 дня

- **Один read-only `AgentTool`-фасад** поверх `platform/browser` (решение Э0). Внутри —
  каскад `choose_api → find_recipe → search_docs → resources/read`, воспроизводящий стратегию
  `builder-facade`. Набора инструментов MCP в билдере не будет.
- **Обрезка по приоритету, а не по символам.** Замер дал 98 % на наивной обрезке; единственная
  потеря (`renderer-json/wizard-submit`) — рецепт на 9897 символов, где нужное имя ушло за
  границу 1500. Фасад обязан резать через `assemble()` из `core/context/budget.ts`, который
  роняет «см. также» раньше сигнатуры. Это поднимает нижнюю границу, а не украшает код.
- **Освободить бюджет до, а не после.** Сжать схемы четырёх крупнейших write-инструментов на
  ~500 символов и **снизить** `TOOL_SURFACE_BUDGET` на освобождённое — храповик должен щёлкнуть
  вниз прежде, чем фасад займёт место.
- **Асинхронность без ломки контракта:** `AgentTool.run` остаётся синхронным, источники грузятся при
  сборке реестра. Точка правки одна — `toolRegistry()` в
  [run.ts:26](projects/reformer-builder/src/agent/run.ts#L26); `sendMessage` уже `async`. Это
  избавляет от переписывания ~86 синхронных `registry.invoke(...)` в тестах билдера.
- Согласовать `TOOL_TEXT_BUDGET = 1500` с токен-бюджетом `get_context` (§5.3).
- Одна строка в [prompt.ts](projects/reformer-builder/src/agent/core/prompt.ts) в пределах
  `PROMPT_BUDGET = 4000`, с явным отсечением неверного применения.
- **Проверка:** прогон эталонных вопросов на Ollama (канал уже есть в `providers/byok.ts`) — попадает
  ли инструмент в вызовы, сколько шагов до ответа.

### Э4 — цели 2 и 3 · требует отдельного проектирования

Порядок обязателен.

1. **Спроектировать декларативную модель поведения.** Сегодня
   [collect.ts](projects/reformer-builder/src/codegen/collect.ts) собирает только структуру и
   `requiredPaths`, а `emit-validation` / `emit-form-behavior` эмитят заглушки с TODO. Модели
   поведения в состоянии редактора не существует. Правка текста файлов через FS Access
   отвергается: она вне undo/redo и не работает на Pages.
2. Перевести эмиттеры с «эмитим мок» на «эмитим из модели».
3. Write-инструменты над моделью + `validate_form` как гейт: коды `RF004`/`RF005`/`RF006` ловят ровно
   тот класс ошибок, который `tsc` пропускает, а `fix: { tool, arguments }` даёт агенту готовый
   следующий вызов.
4. **Цель 3** сверху: `plan_form` → `FormIntent` → `generate_form` → манифест файлов → существующий
   `src/codegen/`. Спека приходит через drag&drop (`spec-source`), `.docx`/`.pdf` — ленивыми
   парсерами, как спроектировано в RFC-0002 F4. Честная оговорка `plan_form` про неизвлекаемые
   формулы остаётся в силе.

### Э5 — worker · условный

Триггеры: измеренный `JSON.parse` индекса > 50 мс; переезд `generate_form` в браузер; потребность
отменять ход. Тогда — по проекту RFC-0003: отдельная дорожка с affinity, `new Worker(new URL(...),
{ type: 'module' })` (Vite учтёт `base`), без SharedArrayBuffer.

---

## 7. Верификация

**Гейты пакета:** 123 теста, `npm run mcp:evaluate` против baseline, `check:mcp-render`,
`check:mcp-prompts`, `check:packaging`, `check:no-node-globals` на `core/**` и `platform/browser/**`.

**Гейты билдера:** `registry.test.ts` (поверхность, промпт), `npm test -w @reformer/builder`,
`tsc --noEmit -p projects/reformer-builder/tsconfig.app.json`, `npm run size:check`.

**Три канала — обязательно на Э2 и Э3:**

| Канал | Что проверяем |
| --- | --- |
| `npm run dev:builder` | инструмент виден; чанк корпуса грузится по первому вызову, не при старте |
| `BUILDER_BASE=/ReFormer/builder/ npm run build` + `vite preview` | артефакт резолвится с учётом `base` — типовая точка отказа динамических импортов на Pages |
| `npx reformer-builder` из свежей папки | работает без `runtime.json`, без сети после первой загрузки |
| Mode B | папка проекта с `node_modules/@reformer/*` — индекс берётся оттуда, версии видны в ответе |

---

## 8. Что не делать

1. **Не переносить все 10 инструментов.** Поверхность MCP — 8854 символа при бюджете билдера 7700,
   уже занятом. Набор выбирает Э0 замером.
2. **Не поднимать `TOOL_SURFACE_BUDGET`.** Освобождать сжатием, а не поднимать.
3. **Не поднимать MCP-протокол внутри вкладки** (§4). Дверь оставить открытой, но не входить.
4. **Не заводить второй генератор индекса.** `index-builder.js` — единственный; браузерный артефакт
   собирается **из его выхода**, а не параллельным парсером.
5. **Не тащить `typescript`.** Фолбэк `symbols-parser` в браузере не резолвится и корректно даёт
   пустой массив — это уже обработано try/catch.
6. **Не использовать OPFS для артефакта из бандла.** Только для индекса, вычитанного из проекта.
7. **Не начинать с целей 2–3.** Пока нет модели поведения (Э4.1), знания об API применить нечем.

---

## 9. Допущения, требующие проверки

1. **`llms.txt` + индекс покрывают всё, что нужно в браузере.** `find_recipe` стадии 1 (файлы
   `docs/llms/*.md`) не будет — предполагается, что каскада в `search_docs` достаточно. Проверяется
   на корпусе eval.
2. **Правка `tools/*` под фабрику механическая.** 123 теста в 16 файлах — оценка «широко, но
   механически» не проверена на самом объёмном (`generate-form.test.ts`, 21 кейс).
3. **`JSON.parse` 1.28 MB не даёт заметного джанка** — не измерено; от этого зависит Э5.
4. **Артефакт корпуса собирается из `packages/*` при сборке билдера** — предполагается, что в CI
   билдер собирается после пакетов и `llms-index.json` уже сгенерированы. В
   [deploy-docs.yml](.github/workflows/deploy-docs.yml) порядок такой, но `llms.txt`/`llms-index.json`
   теперь в git, так что зависимость от порядка может оказаться необязательной.
5. **Токен-бюджет `get_context` (`chars/4`) и `TOOL_TEXT_BUDGET` (символы) согласуемы** без потери
   пометки «обрезано» — требует проверки на реальных ответах.
