# @reformer/mcp

MCP (Model Context Protocol) server для библиотеки `@reformer/*`. Снабжает ИИ-ассистентов (Claude Code, Cursor, другие MCP-клиенты) per-package документацией, JSDoc-индексом публичных символов и эталонными примерами форм.

См. сопутствующие документы:

- [docs/llms-convention.md](../../docs/llms-convention.md) — конвенция документации.
- [AGENTS.md](../../AGENTS.md) — инструкции для агентов.

## Installation

```bash
# Глобально
npm install -g @reformer/mcp

# Или через npx без установки
npx @reformer/mcp
```

## Регистрация в Claude Code

```bash
# Глобальный install
claude mcp add --transport stdio reformer -- reformer-mcp

# Через npx
claude mcp add --transport stdio reformer -- npx @reformer/mcp

# Локальная сборка из монорепо (для разработки сервера)
claude mcp add --transport stdio reformer -- node /absolute/path/to/ReFormer/packages/reformer-mcp/dist/index.js

# Локальная сборка с debug-режимом
claude mcp add --transport stdio reformer -e REFORMER_DEBUG=true -- node /absolute/path/to/ReFormer/packages/reformer-mcp/dist/index.js
```

Проверить:

```bash
claude mcp list
```

## Available Tools

| Tool              | Always                           | Description                                                                                                                                                                                        |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_symbol_docs` | ✅                               | Полный JSDoc публичного символа любого `@reformer/*` (description, signature, params, type params, returns, все `@example`, deprecated, see, source).                                              |
| `find_recipe`     | ✅                               | Найти рецепт по `topic` в библиотечной документации (`docs/llms/` всех `@reformer/*`) или fallback в `@example` JSDoc публичного символа. Поиск каскадный: имя файла → `## ` секция → имя символа. |
| `report_issue`    | ✅                               | Сохранить найденную проблему и её решение в `~/.reformer/issues.jsonl` для последующего анализа.                                                                                                   |
| `debug`           | под флагом `REFORMER_DEBUG=true` | Внутренний инструмент для разработки самого сервера.                                                                                                                                               |

### `get_symbol_docs`

```jsonc
{
  "symbol": "useFormControl",
  "package": "@reformer/core", // optional: '*' (default) — поиск во всех пакетах
}
```

### `find_recipe`

```jsonc
{
  "topic": "copy-from", // имя файла docs/llms/, заголовок секции, или имя символа
  "package": "@reformer/core", // optional, '*' (default) — все пакеты
}
```

Возвращает markdown с источником: `## Source: <pkg> · <file>` + содержимое рецепта/секции/`@example`. Если ничего не найдено — fallback со списком всех доступных рецептов и публичных символов.

### `report_issue`

Параметры: `error` (required), `solution` (required), `tags` (e.g. `category:behavior`, `agent:claude`, `severity:critical`), `context` (`examples`, `relatedFiles`, `notes`).

## Available Resources

URI-шаблон: `reformer://docs[/<short-package>][/<section-slug>]` (плюс `reformer://guide` и `reformer://debug`).

`<short-package>` — без префикса `@reformer/`: `core`, `cdk`, `ui-kit`, `renderer-react`, `renderer-json`, `mcp`. Опционален — без него возвращается агрегированное по всем пакетам.

| URI                               | Что внутри                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `reformer://guide`                | Полная самодокументация сервера (workflow + tools + prompts + resources).                                       |
| `reformer://docs`                 | Документация всех `@reformer/*` пакетов, склеенная.                                                             |
| `reformer://docs/cdk`             | Только `@reformer/cdk`: overview, FormArray, FormWizard, FormField, recipes, troubleshooting.                   |
| `reformer://docs/ui-kit`          | Только `@reformer/ui-kit`: text-fields, choice-fields, layout/buttons, form-field-integration, troubleshooting. |
| `reformer://docs/renderer-json`   | Только `@reformer/renderer-json`: JSON schema, registry, cookbook, troubleshooting.                             |
| `reformer://docs/<pkg>/<section>` | Отдельная H2-секция пакета по slug'у (точные URI — через ListResources).                                        |
| `reformer://debug`                | Только в debug-режиме.                                                                                          |

> Списка символов и сигнатур в ресурсах нет — используй инструменты `list_symbols` / `get_symbol_docs`; для рецептов по сценарию — `find_recipe`.

## Available Prompts

Промпты делятся на **assist** (помогают создавать/менять код) и **analyze** (проверяют существующий код). Каждый подгружает только релевантные секции из `docs/llms/` через `getSection()` — агенту не нужно тянуть всю документацию.

### Assist (всегда доступны)

| Prompt             | Аргументы                                                                                        | Что делает                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-form`      | `description` (required), `target` (`core` / `renderer-react` / `renderer-json`, default `core`) | Спроектировать и сгенерировать новую форму по описанию полей. Подгружает quick-start, FormSchema, импорты + при `target=renderer-*` соответствующий обвязочный пакет.                                      |
| `add-validation`   | `code` (required), `requirements` (required)                                                     | Подобрать built-in/кастомные/async/cross-field валидаторы под требования. Подгружает справочник валидаторов, async-watchfield, common-mistakes.                                                            |
| `add-behavior`     | `code` (required), `requirements` (required)                                                     | Выбрать и встроить behavior (`computeFrom`/`enableWhen`/`watchField`/`copyFrom`/`syncFields`/`resetWhen`/`transformValue`/`revalidateWhen`). Подгружает все рецепты + cycle-detection.                     |
| `add-form-array`   | `code` (required), `requirements` (required)                                                     | Превратить поле в массив через `array(...)` + `FormArray` UI. Подгружает array-operations, array-cleanup, FormArray compound API.                                                                          |
| `add-wizard`       | `code` (required), `steps` (required)                                                            | Превратить single-form в multi-step `FormWizard`. Подгружает multi-step стратегию из core + FormWizard compound API + recipes.                                                                             |
| `to-renderer`      | `code` (required)                                                                                | Мигрировать форму с прямого React-рендеринга (`@reformer/core` + ручной JSX) на TS RenderSchema через `@reformer/renderer-react`. Подгружает quick-start, RenderSchema формат, behavior helpers, cookbook. |
| `to-renderer-json` | `code` (required)                                                                                | Мигрировать TS RenderSchema → JsonFormSchema + Registry. Подгружает migration cookbook, JSON-format, registry rules.                                                                                       |

### Analyze

| Prompt   | Always                           | Аргументы         | Что делает                                                                                                                                                   |
| -------- | -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `review` | ✅                               | `code` (required) | Кросс-пакетный чек-лист код-ревью: state setup, React integration, CDK/UI-kit/renderers, errors. Подгружает anti-patterns и troubleshooting из всех пакетов. |
| `debug`  | под флагом `REFORMER_DEBUG=true` | `code` (required) | Анализ кода формы по чек-листу из `@reformer/core` troubleshooting.                                                                                          |

## Development

Из корня монорепо:

```bash
# Установить зависимости
npm install

# Собрать только MCP-сервер (включает npm run generate:llms перед tsc)
npm run build -w @reformer/mcp

# Регенерировать llms.txt всех пакетов вручную
npm run generate:llms

# Аудит JSDoc-покрытия пакета
node scripts/generate-llms-txt packages/reformer --audit
node scripts/generate-llms-txt packages/reformer-cdk --audit
# ... и т.д. для остальных пакетов

# Запустить сервер локально
node packages/reformer-mcp/dist/index.js
```

`build` пакета сначала вызывает `npm run generate:llms` (свой `llms.txt`), затем `tsc`. На свежем checkout этого достаточно — отдельно `npm run generate:llms` запускать не нужно.

## Debug Mode

Активируется переменной окружения `REFORMER_DEBUG=true`:

```bash
REFORMER_DEBUG=true node packages/reformer-mcp/dist/index.js
```

Что добавляется:

| Type     | Name               | Description                                                          |
| -------- | ------------------ | -------------------------------------------------------------------- |
| Tool     | `debug`            | Внутренний tool для тестирования сервера (читает любую секцию docs). |
| Resource | `reformer://debug` | Список доступных пакетов (что нашёл парсер).                         |
| Prompt   | `debug`            | Чек-лист анализа кода форм.                                          |

В обычном режиме эти три отсутствуют в `listTools` / `listResources` / `listPrompts`.

## Verification: MCP Inspector

После сборки можно визуально проверить сервер через официальный Inspector:

```bash
# Из корня монорепо
npm run build -w @reformer/mcp

# Запустить Inspector с нашим сервером
npx @modelcontextprotocol/inspector node packages/reformer-mcp/dist/index.js

# Опционально с debug-режимом
REFORMER_DEBUG=true npx @modelcontextprotocol/inspector node packages/reformer-mcp/dist/index.js
```

В терминале появится URL вида `http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=…`. Открой в браузере — три вкладки.

### Чек-лист ручной проверки

**Resources** (`guide` + `docs` aggregated + per-package + per-section):

- `reformer://docs` — длинный markdown с разделителями `# ===== @reformer/<pkg> =====`.
- `reformer://docs/cdk` — содержит `FormArray` и новые секции `04-form-field`, `05-recipes`, `06-troubleshooting`.
- `reformer://docs/ui-kit` — содержит `02-text-fields` … `06-troubleshooting`.
- `reformer://guide` — самодокументация сервера (mirror `reformer://docs/mcp`).

**Tools:**

- `get_symbol_docs` → `{ "symbol": "copyFrom" }` → ответ содержит ≥ 2 блока `@example`.
- `find_recipe` → `{ "topic": "copy-from" }` → ответ содержит секцию из `@reformer/core` `23-copy-from.md`.
- `find_recipe` → `{ "topic": "wizard" }` → возвращает рецепт wizard'а из `@reformer/cdk` (по имени файла либо секции).
- `find_recipe` → `{ "topic": "useFormControl" }` → JSDoc-`@example` из `@reformer/core`.
- `find_recipe` → `{ "topic": "unknown-xyz" }` → fallback со списком доступных рецептов.
- `report_issue` → можно отправить тестовый — запишется в `~/.reformer/issues.jsonl`.

**Prompts:**

- `review` → render с любым кодом → messages с кросс-пакетным чек-листом.
- `debug` (только в debug-режиме) → render с кодом формы → анализ по `@reformer/core` troubleshooting.

Закрытие — `Ctrl+C` в терминале.

## License

MIT
