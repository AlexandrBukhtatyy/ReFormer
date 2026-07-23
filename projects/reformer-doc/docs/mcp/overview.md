---
sidebar_position: 1
---

# Обзор

`@reformer/mcp` — MCP-сервер (Model Context Protocol) для библиотеки `@reformer/*`. Он снабжает
AI-ассистентов (Claude Code, Cursor, другие MCP-клиенты) per-package документацией, JSDoc-индексом
публичных символов и эталонными примерами форм — прямо в контексте диалога.

Идея в том, что ассистенту достаточно самого сервера, чтобы собрать форму на ReFormer: не нужно
читать исходники библиотеки. Сервер отдаёт документацию как **ресурсы**, справочные
**инструменты** для поиска символов и валидации, и workflow-**промпты** — по одному на каждый шаг
сборки формы (model → schema → validation → behaviors → arrays → wizard → render).

## Что такое MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) — открытый стандарт от Anthropic для
интеграции AI-ассистентов с внешними инструментами и данными. MCP-сервер объявляет клиенту:

- **Resources** — доступ к документации и данным
- **Tools** — инструменты, которые AI может вызывать
- **Prompts** — готовые workflow-сценарии

## Установка / подключение

```bash
# Глобально
npm install -g @reformer/mcp

# Или через npx без установки
npx @reformer/mcp
```

Бинарь называется `reformer-mcp`. Регистрация в Claude Code:

```bash
# Глобальный install
claude mcp add --transport stdio reformer -- reformer-mcp

# Через npx
claude mcp add --transport stdio reformer -- npx @reformer/mcp
```

Проверить подключение — `claude mcp list`. Настройка других IDE (Cursor, Windsurf, Cline) — в
[Быстром старте](./quick-start). Debug-режим включается переменной окружения
`REFORMER_DEBUG=true` (добавляет tool `debug`, ресурс `reformer://debug` и одноимённый промпт).

## Инструменты (tools)

| Tool                   | Роль                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `get_symbol_docs`      | Полный JSDoc публичного символа любого `@reformer/*` (signature, params, returns, все `@example`, source). |
| `find_recipe`          | Найти рецепт по `topic`: имя файла `docs/llms/` → `## `-секция → имя символа (fallback в `@example`).      |
| `list_symbols`         | API surface по kind/package, когда имя символа неизвестно.                                                 |
| `validate_json_schema` | Проверить JSON-схему `renderer-json` перед рендерингом.                                                    |
| `check_behaviors`      | Объявить зависимости `computeFrom`/`copyFrom` и получить обнаружение циклов.                               |
| `report_issue`         | Сохранить найденную проблему и её решение в `~/.reformer/issues.jsonl`.                                    |
| `debug`                | Только при `REFORMER_DEBUG=true` — внутренний tool для разработки самого сервера.                          |

## Промпты (prompts)

Промпты делятся на **assist** (создают/меняют код) и **analyze** (проверяют существующий). Каждый
подгружает только релевантные секции документации, чтобы не тянуть её целиком.

Assist:

- `create-form` — спроектировать и сгенерировать форму по описанию (`description`, `target`: `core` / `renderer-react` / `renderer-json`).
- `add-validation` — подобрать built-in / кастомные / async / cross-field валидаторы под требования.
- `add-behavior` — встроить behavior (`computeFrom`, `enableWhen`, `watchField`, `copyFrom`, `syncFields`, `resetWhen`, `transformValue`, `revalidateWhen`).
- `add-form-array` — превратить поле в массив через `array(...)` + `FormArray` UI.
- `add-wizard` — превратить single-form в multi-step `FormWizard`.
- `to-renderer` — миграция `@reformer/core` + ручной JSX → TS RenderSchema (`renderer-react`).
- `to-renderer-json` — миграция TS RenderSchema → JsonFormSchema + Registry.

Analyze:

- `review` — кросс-пакетный чек-лист код-ревью (state setup, React integration, CDK/UI-kit/renderers, ошибки).
- `debug` — только при `REFORMER_DEBUG=true`, анализ кода формы по troubleshooting из `@reformer/core`.

Стартовые промпты для ориентации: `start-here` (M1-workflow и карта сервера), `plan-form`
(проектирование по спеке), `discover-context` (определение целевого стека).

## Ресурсы (resources)

URI-шаблон: `reformer://docs[/<short-package>][/<section-slug>]` плюс `reformer://guide`.
`<short-package>` — без префикса `@reformer/`: `core`, `cdk`, `ui-kit`, `renderer-react`,
`renderer-json`, `mcp`. Без пакета возвращается агрегированная документация по всем.

- `reformer://guide` — полная самодокументация сервера (workflow + tools + prompts + resources; mirror `reformer://docs/mcp`).
- `reformer://docs` — документация всех `@reformer/*` пакетов, склеенная.
- `reformer://docs/<pkg>` — например `reformer://docs/cdk`, `reformer://docs/renderer-json`.
- `reformer://docs/<pkg>/<section>` — отдельная H2-секция по slug'у (точные URI — через ListResources).

> Списка символов и сигнатур в ресурсах нет — используй `list_symbols` / `get_symbol_docs`; для рецептов по сценарию — `find_recipe`.

## Дальше

- [Быстрый старт](./quick-start) — установка и настройка IDE за 2 минуты.
- [Инструменты](./tools) — подробно о каждом tool.
- [Промпты](./prompts) — workflow-сценарии.
- [Примеры](./examples) — сценарии использования.
