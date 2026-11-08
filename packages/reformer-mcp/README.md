# @reformer/mcp

MCP-сервер (Model Context Protocol) для библиотеки `@reformer/*`. Даёт ИИ-ассистентам (Claude Code,
Cursor и другим MCP-клиентам) документацию пакетов, рецепты, индекс публичных символов, проверку
кода формы и сборку модуля формы из описания.

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
публикуются в npm вместе с пакетами. Начинать работу агенту — с ресурса `reformer://guide`:
порядок шагов и раскладка файлов формы.

Пример вызова инструмента:

```jsonc
// find_recipe — рецепт по теме из docs/llms пакетов либо @example символа
{ "topic": "copy-from", "package": "core" } // package необязателен: без него — все пакеты
```

## Инструменты

| Tool              | Для чего                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `choose_api`      | Какой оператор решает требование, сформулированное своими словами                         |
| `get_context`     | Собранный контекст под один шаг работы: оператор, сигнатура, пример, правила              |
| `get_symbol_docs` | Полный JSDoc публичного символа любого `@reformer/*`                                      |
| `find_recipe`     | Рецепт по теме из `docs/llms/` пакетов либо `@example` символа                            |
| `search_docs`     | Полнотекстовый поиск по документации всех пакетов                                         |
| `list_symbols`    | Публичные символы по виду, пакету или части имени                                         |
| `plan_form`       | Спека или описание → `FormIntent`                                                         |
| `generate_form`   | `FormIntent` → файлы формы (манифест; пишет клиент)                                       |
| `form_build`      | `form.intent.json` → модуль формы на диске (пишет сервер)                                 |
| `validate_form`   | Проверка до запуска: код, JSON-схема, циклы поведения, весь набор, имена файлов модуля    |
| `report_issue`    | Сохранить проблему и её решение JSON-отчётом в `<корень проекта>/.reformer/issue_reports` |
| `debug`           | Только при `REFORMER_DEBUG=true` — внутренний инструмент для разработки самого сервера    |

По умолчанию — 11 инструментов; `debug` добавляется в режиме отладки. Аргументы каждого — в
[docs/llms/02-tools.md](./docs/llms/02-tools.md).

**Ресурсы:** `reformer://guide` (самодокументация сервера), `reformer://catalog` (карта разделов),
`reformer://docs/<пакет>` и `reformer://docs/<пакет>/<раздел>` — подробно в
[docs/llms/04-resources.md](./docs/llms/04-resources.md). **Промпты:** `start-here`, `plan-form`, `create-form`,
`add-feature`, `to-renderer`, `review` и другие — [docs/llms/03-prompts.md](./docs/llms/03-prompts.md).

## Входы пакета

| Импорт                                          | Что внутри                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@reformer/mcp`                                 | сервер stdio (`bin`: `reformer-mcp`); для запуска, не для импорта                                               |
| `@reformer/mcp/core`                            | `createKnowledge`, `memoize` и типы знаний сервера                                                              |
| `@reformer/mcp/browser`                         | `createBrowserKnowledge` — знания из уже загруженных данных, для браузера                                       |
| `@reformer/mcp/intent`                          | компилятор описания формы чистыми функциями: `readIntent`, `normalizeIntent`, `buildBehaviorTs`, `findCycle`, … |
| `@reformer/mcp/package.json`, `@reformer/mcp/*` | файлы пакета: `llms.txt`, `docs/llms/*.md`, бандл воркера `dist/worker/server.js`                               |

Тот же сервер работает в браузерном Web Worker (`dist/worker/server.js`, корпус знаний вшит; нет
`form_build`, `report_issue` и промптов). Подключение воркера и входы для встраивания —
[docs/llms/07-embedding.md](./docs/llms/07-embedding.md).

## Переменные окружения

| Переменная                   | По умолчанию                               | Что делает                                                                                          |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `REFORMER_ISSUE_REPORTS_DIR` | `<корень проекта>/.reformer/issue_reports` | Каталог отчётов `report_issue`; абсолютный путь (`~` — домашний каталог), относительный отклоняется |
| `REFORMER_FORM_LAYOUT`       | `minimalist`                               | Раскладка файлов формы в промпте `create-form`: `minimalist` или `folders`                          |
| `REFORMER_DEBUG`             | не задана                                  | `true` — режим отладки: инструмент и промпт `debug`, ресурс `reformer://debug`                      |
| `REFORMER_TRACE_FILE`        | не задана                                  | Журнал вызовов для замеров: строка JSON на вызов (размеры, отпечаток аргументов, начало ответа)     |
| `REFORMER_TYPECHECK_ROOT`    | не задана                                  | Откуда `validate_form` и `form_build` берут `@reformer/*` и `typescript` для проверки типов         |

Задаются при регистрации (`claude mcp add … -e REFORMER_DEBUG=true`) или в `env` конфига клиента.

## Разработка

```bash
npm run build -w @reformer/mcp      # llms.txt пакета → tsc → бандл воркера
npm run test -w @reformer/mcp
npm run mcp:evaluate                # замер качества ответов против базовой линии (гейт CI)
npx @modelcontextprotocol/inspector node packages/reformer-mcp/dist/index.js
```

## Ссылки

- Документация: [обзор MCP](https://alexandrbukhtatyy.github.io/ReFormer/docs/mcp/overview),
  [инструменты](https://alexandrbukhtatyy.github.io/ReFormer/docs/mcp/tools)
- Справка сервера (она же `reformer://guide`): [`docs/llms`](./docs/llms)
- Конвенция документации пакетов: [docs/llms-convention.md](../../docs/llms-convention.md)

## License

MIT
