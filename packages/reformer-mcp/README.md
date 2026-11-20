# @reformer/mcp

MCP-сервер (Model Context Protocol) для библиотеки `@reformer/*`. ИИ-ассистент (Claude Code, Cursor,
другой MCP-клиент) создаёт и меняет через него формы: сервер ведёт план, собирает модуль формы,
проверяет типы и сам пишет файлы. Набор инструментов `REFORMER_SURFACE=tools` добавляет
документацию пакетов, рецепты, индекс публичных символов и проверку кода.

## Установка

```bash
npm install -g @reformer/mcp   # глобально
npx @reformer/mcp              # или без установки
```

## Подключение

```bash
# Claude Code
claude mcp add --transport stdio reformer -- npx @reformer/mcp
claude mcp list
```

Знания о пакетах сервер берёт из их `llms.txt`, `llms-index.json` и `docs/llms` — эти файлы
публикуются в npm вместе с пакетами.

## Поверхности

Что сервер отдаёт агенту, выбирает переменная окружения `REFORMER_SURFACE`:

| Поверхность                      | Что видит агент                                                         | Когда брать                                                              |
| -------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `code-guided-dsl` (по умолчанию) | два инструмента, `search` и `execute`; оба принимают JavaScript         | создать или изменить форму                                               |
| `tools`                          | набор инструментов ниже, ресурсы и промпты                              | справка по API для своего кода, `validate_form`, свой `form.intent.json` |
| `code`, `guided`, `code-guided`  | эксперименты: Code Mode (один `run_script`) и профили для малых моделей | замеры                                                                   |

На неизвестное значение сервер пишет предупреждение в stderr и поднимает умолчание.

### По умолчанию: `code-guided-dsl`

Работу ведёт сервер. `execute` начинает её вызовом `reformer.formStart` с текстом задания (или
спецификацией) и меняет форму конструктором: цепочки методов записывают правки, `save()` отправляет
их и собирает модуль. Все файлы каталога формы пишет сервер, разметку JSX для `@reformer/core` тоже.

```js
// execute — начало работы
console.log(await reformer.formStart({ dir: 'form', target: 'renderer-react', task: '<задание>' }));

// execute — правки конструктором
const f = reformer.form();
f.add('email', 'Email').required().email();
f.add('company', 'Компания')
  .required()
  .showWhen((m) => m.customerType === 'company');
console.log(await f.save());
```

Каждый ответ кончается строкой `Next:` с готовым кодом для `execute` — до ответа `Done`. `search`
только читает: текущую форму, задание и разбор спецификации, методы конструктора, план. Методы и
ответы — в [docs/llms/02-tools.md](./docs/llms/02-tools.md), раздел «Guided profile».

Почему это умолчание: на замере «с MCP и без» (Claude Sonnet, 10 сценариев на трёх стеках, 270
прогонов) с `code-guided-dsl` все проверки прошли 96% прогонов, с набором инструментов — 81%, без
MCP — 83%; работа шла в 3,5 раза быстрее и стоила в 4,4 раза меньше, чем без сервера. Сводка и
результаты по сценариям — на странице
[«Замеры: с MCP и без»](https://alexandrbukhtatyy.github.io/ReFormer/docs/mcp/benchmark).

### Набор инструментов: `REFORMER_SURFACE=tools`

```bash
claude mcp add --transport stdio reformer -e REFORMER_SURFACE=tools -- npx @reformer/mcp
```

Начинать работу агенту — с ресурса `reformer://guide`: порядок шагов и раскладка файлов формы.
Пример вызова инструмента:

```jsonc
// find_recipe — рецепт по теме из docs/llms пакетов либо @example символа
{ "topic": "copy-from", "package": "core" } // package необязателен: без него — все пакеты
```

| Tool              | Для чего                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `choose_api`      | Какой оператор решает требование, сформулированное своими словами                         |
| `get_context`     | Собранный контекст под один шаг работы: оператор, сигнатура, пример, правила              |
| `get_symbol_docs` | Полный JSDoc публичного символа любого `@reformer/*`                                      |
| `find_recipe`     | Рецепт по теме из `docs/llms/` пакетов либо `@example` символа                            |
| `search_docs`     | Полнотекстовый поиск по документации всех пакетов                                         |
| `list_symbols`    | Публичные символы по виду, пакету или части имени                                         |
| `plan_form`       | Markdown-спека → черновик `<dir>/form.intent.json` на диске                               |
| `form_build`      | `form.intent.json` → модуль формы на диске (пишет сервер); `grammar` — грамматика intent  |
| `validate_form`   | Проверка до запуска: код, JSON-схема, циклы поведения, весь набор, имена файлов модуля    |
| `report_issue`    | Сохранить проблему и её решение JSON-отчётом в `<корень проекта>/.reformer/issue_reports` |
| `debug`           | Только при `REFORMER_DEBUG=true` — внутренний инструмент для разработки самого сервера    |

В этой поверхности 10 инструментов; `debug` добавляется в режиме отладки. Форму создаёт один путь:
грамматика `form_build {"grammar":"base"}` → свой `form.intent.json` → `form_build {"dir":…}`.
Аргументы каждого инструмента — в [docs/llms/02-tools.md](./docs/llms/02-tools.md).

**Ресурсы** (только в `tools`)**:** `reformer://guide` (с чего начать, до 6 КБ), `reformer://status` (что сервер нашёл в
окружении), `reformer://catalog` (карта разделов), `reformer://docs/<пакет>` и
`reformer://docs/<пакет>/<раздел>` — подробно в
[docs/llms/04-resources.md](./docs/llms/04-resources.md). **Промпты** (только в `tools`)**:** `start-here`, `plan-form`, `create-form`,
`add-feature`, `to-renderer`, `review` и другие — [docs/llms/03-prompts.md](./docs/llms/03-prompts.md).

## Входы пакета

| Импорт                                          | Что внутри                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@reformer/mcp`                                 | сервер stdio (`bin`: `reformer-mcp`); для запуска, не для импорта                                                                              |
| `@reformer/mcp/core`                            | `createKnowledge`, `memoize` и типы знаний сервера                                                                                             |
| `@reformer/mcp/browser`                         | `createBrowserKnowledge` — знания из уже загруженных данных, для браузера                                                                      |
| `@reformer/mcp/intent`                          | компилятор описания формы и его судья чистыми функциями: `judgeIntent` (вердикт `form_build`), `readIntent`, `buildBehaviorTs`, `findCycle`, … |
| `@reformer/mcp/build-info`                      | `BUILD_ID` — метка сборки (хэш исходников) и `buildIdOf(version)`: сверка копий MCP, собранных порознь                                         |
| `@reformer/mcp/package.json`, `@reformer/mcp/*` | файлы пакета: `llms.txt`, `docs/llms/*.md`, бандл воркера `dist/worker/server.js`                                                              |

Тот же сервер работает в браузерном Web Worker (`dist/worker/server.js`, корпус знаний вшит) как
справочный канал: только справочные инструменты, без `form_build`, `plan_form`, `report_issue` и
промптов. Версия в его `serverInfo` несёт метку сборки (`6.0.0+<BUILD_ID>`) — конструктор сверяет её
со своей копией `@reformer/mcp/intent`. Подключение воркера и входы для встраивания —
[docs/llms/07-embedding.md](./docs/llms/07-embedding.md).

## Переменные окружения

| Переменная                   | По умолчанию                               | Что делает                                                                                           |
| ---------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `REFORMER_SURFACE`           | `code-guided-dsl`                          | Поверхность сервера: `code-guided-dsl`, `tools`, `code`, `guided`, `code-guided` — см. «Поверхности» |
| `REFORMER_ISSUE_REPORTS_DIR` | `<корень проекта>/.reformer/issue_reports` | Каталог отчётов `report_issue`; абсолютный путь (`~` — домашний каталог), относительный отклоняется  |
| `REFORMER_DEBUG`             | не задана                                  | `true` — режим отладки: инструмент и промпт `debug`, ресурс `reformer://debug`                       |
| `REFORMER_TRACE_FILE`        | не задана                                  | Журнал вызовов для замеров: строка JSON на вызов (номер, размеры, отпечаток и начало аргументов)     |
| `REFORMER_TRACE_FULL`        | не задана                                  | `1` — журнал несёт аргументы целиком и текст ответа; действует только вместе с `REFORMER_TRACE_FILE` |
| `REFORMER_TYPECHECK_ROOT`    | не задана                                  | Запасной корень, откуда `form_build` берёт `@reformer/*` и `typescript` для проверки типов формы     |

Задаются при регистрации (`claude mcp add … -e REFORMER_DEBUG=true`) или в `env` конфига клиента.

## Миграция: поверхность по умолчанию — `code-guided-dsl`

- **Без `REFORMER_SURFACE` сервер отдаёт два инструмента**, `search` и `execute`, а не набор
  `get_context` … `report_issue`. Ресурсов и промптов в этой поверхности нет.
- **Прежнее поведение** — `REFORMER_SURFACE=tools` в `env` конфига клиента или
  `claude mcp add … -e REFORMER_SURFACE=tools`. Он нужен, если агент или своя обвязка зовёт
  `form_build`, `plan_form`, `validate_form` или справочные инструменты, читает `reformer://…` или
  берёт промпты.

## Миграция 6 → 7

- **Форму создаёт один путь.** Агент пишет `<dir>/form.intent.json`, а `form_build` компилирует,
  проверяет типы и пишет модуль сам. Грамматика — `form_build {"grammar":"base"}` и секции по запросу.
- **`generate_form` удалён.** Он печатал файлы, которые агент переписывал руками. Вместо него —
  `form_build`.
- **`plan_form`** принимает только спеку (`specPath`, `dir`, `target`) и пишет черновик intent на
  диск, а не возвращает его текстом; свободное описание (`description`) больше не разбирается.
- **Удалены алиасы** `validate_json_schema` и `check_behaviors` — их давно заменил `validate_form`.
- **Воркер** — справочный канал: без `plan_form`, `form_build` и `report_issue`, со своими
  `instructions` и гайдом; в его корпусе нет документации самого MCP. Версия в `serverInfo` несёт
  метку сборки (`6.0.0+<BUILD_ID>`, экспорт `@reformer/mcp/build-info`).
- **`reformer://guide`** — короткое начало (до 6 КБ); полный текст — `reformer://docs/mcp`. Новый
  ресурс `reformer://status` показывает, какие пакеты сервер нашёл и может ли он проверять типы.
- **renderer-json пишет схему данными** — `form.schema.json` (его открывает ui-builder), а не
  `form.schema.ts`; `index.tsx` импортирует JSON.
- **Страницы, а не только формы:** текст в раскладке — запись `{"text":"…"}` среди детей (заголовок,
  абзац, подпись кнопки); компоненты кита по назначению — `form_build {"grammar":"components"}`.
- **Коды находок** — стабильный контракт: реестр `reformer://docs/mcp/diagnostic-codes`
  ([docs/llms/08-diagnostic-codes.md](./docs/llms/08-diagnostic-codes.md)).

## Разработка

```bash
npm run build -w @reformer/mcp      # llms.txt пакета → tsc → бандл воркера
npm run test -w @reformer/mcp
npm run mcp:evaluate                # замер качества ответов против базовой линии (гейт CI)
npx @modelcontextprotocol/inspector node packages/reformer-mcp/dist/index.js
```

Как устроено тестирование: уровни проверок, строгий режим, снимки, стенды качества и CI — в
[docs/testing.md](./docs/testing.md).

## Ссылки

- Документация: [обзор MCP](https://alexandrbukhtatyy.github.io/ReFormer/docs/mcp/overview),
  [инструменты](https://alexandrbukhtatyy.github.io/ReFormer/docs/mcp/tools),
  [замеры: с MCP и без](https://alexandrbukhtatyy.github.io/ReFormer/docs/mcp/benchmark)
- Справка сервера (`reformer://docs/mcp`, начало — `reformer://guide`): [`docs/llms`](./docs/llms)
- Конвенция документации пакетов: [docs/llms-convention.md](../../docs/llms-convention.md)

## License

MIT
