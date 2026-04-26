# Отчёт: валидация reformer-mcp на форме «Заявка на кредит»

## Контекст

Тест MCP-сервера `@reformer/mcp` через реализацию формы из [credit-application-form.md](credit-application-form.md). Брифинг: [PROMT.md](../../PROMT.md).

Оркестратор — Claude Code Opus 4.7. MCP-сервер — `packages/reformer-mcp/dist/index.js`, к которому оркестратор обращается напрямую через JSON-RPC поверх stdio (helper [scripts/mcp-call.mjs](../../scripts/mcp-call.mjs)). Каждый этап реализуется суб-агентом (`general-purpose` Agent), которому в промт передаются:
- scope этапа (что реализовать, в какой каталог),
- сериализованный вывод соответствующего MCP-prompt'а,
- список запретов из PROMT.md.

Если суб-агент не справился — оркестратор фиксирует пробел через `report_issue`, правит источник MCP (`docs/llms/*.md` или JSDoc), регенерирует `llms.txt`, удаляет файлы провалившегося суб-агента и спавнит нового.

## Сводная таблица

| Страница | Этап | Итераций | MCP-фиксы (коммиты) | Use'd MCP |
|---|---|---:|---|---|
| `mcp-credit-application/` | 1. FormSchema | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application/` | 2. Validation | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application/` | 3. Behaviors | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application/` | 4. FormArray | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application/` | 5. Multi-step | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer/` | 1. FormSchema | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer/` | 2. Validation | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer/` | 3. Behaviors | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer/` | 4. FormArray | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer/` | 5. Multi-step | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer-json/` | 1. FormSchema | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer-json/` | 2. Validation | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer-json/` | 3. Behaviors | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer-json/` | 4. FormArray | _tbd_ | _tbd_ | _tbd_ |
| `mcp-credit-application-renderer-json/` | 5. Multi-step | _tbd_ | _tbd_ | _tbd_ |

## Детали по этапам

_Каждый этап после прогона дополняется блоком ниже._

### `mcp-credit-application/` · 1. FormSchema

_не начато_

### `mcp-credit-application/` · 2. Validation

_не начато_

### `mcp-credit-application/` · 3. Behaviors

_не начато_

### `mcp-credit-application/` · 4. FormArray

_не начато_

### `mcp-credit-application/` · 5. Multi-step

_не начато_

### `mcp-credit-application-renderer/` · 1. FormSchema

_не начато_

### `mcp-credit-application-renderer/` · 2. Validation

_не начато_

### `mcp-credit-application-renderer/` · 3. Behaviors

_не начато_

### `mcp-credit-application-renderer/` · 4. FormArray

_не начато_

### `mcp-credit-application-renderer/` · 5. Multi-step

_не начато_

### `mcp-credit-application-renderer-json/` · 1. FormSchema

_не начато_

### `mcp-credit-application-renderer-json/` · 2. Validation

_не начато_

### `mcp-credit-application-renderer-json/` · 3. Behaviors

_не начато_

### `mcp-credit-application-renderer-json/` · 4. FormArray

_не начато_

### `mcp-credit-application-renderer-json/` · 5. Multi-step

_не начато_

## Финальный smoke-test MCP

_заполняется после трёх страниц_

## Итоги

_заполняется в конце_
