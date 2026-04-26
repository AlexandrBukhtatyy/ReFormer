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
| `mcp-credit-application/` | 1. FormSchema | 2 | core: add `## Import Patterns` section + `FormFields` constraint callout in `07-complete-import.md` and `10-arrays.md` (commit pending) | prompt `create-form` (target=core) |
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

**Итерации: 2.**

**Итерация 1 — провал.** Суб-агент нарушил запрет: прочитал `packages/reformer/dist/index.d.ts`, чтобы найти `FormFields` и канонические импорты. Корневая причина — `create-form` prompt вызывает `getSection('Import Patterns', ...)`, но в `packages/reformer/docs/llms/` нет секции с таким именем (есть только `## 6. COMPLETE IMPORT EXAMPLE` в `07-complete-import.md`). Также `FormFields = Record<string, FormValue>` constraint нигде не упомянут — а он обязателен для `ArrayNode<T>`/`GroupNode<T>`. `report_issue` зарегистрировал этот пробел.

**MCP-фикс между итерациями.** Переписан `packages/reformer/docs/llms/07-complete-import.md`: новый заголовок `## Import Patterns`, расширенный список импортов (`FormFields`, `FormValue`, `FormSchema`, `FieldConfig`, `useArrayLength`, `useHiddenCondition`, `validateForm` и т. д.), отдельный callout «Constraint to remember» с двумя паттернами (`extends FormFields` и inline index signature). В `packages/reformer/docs/llms/10-arrays.md` добавлена ремарка про тот же constraint. `npm run generate:llms` идемпотентно перегенерировал `llms.txt` всех пакетов.

**Итерация 2 — успех.** Суб-агент с обновлённым prompt создал три файла:
- `types.ts` (151 строка) — `CreditApplicationForm` + 6 step-интерфейсов + 3 array-item интерфейса (`PropertyItem`, `ExistingLoanItem`, `CoBorrowerItem`), все extend `FormFields`.
- `schema.ts` (148 строк) — `createForm<CreditApplicationForm>({ form: { step1, …, step6 } })`, FormArray через tuple `[itemSchema]`.
- `index.tsx` (569 строк) — компонент `McpCreditApplication` рендерит все поля плюс add/remove для FormArrays.

`cd projects/react-playground && npx tsc -b --noEmit` → `EXIT:0`. Запретов не нарушено.

**Новые MCP gaps (зарегистрированы через `report_issue`, фикс отложен до повторного попадания):**
1. `FieldConfig` требует `component: ComponentType` — нет guidance для scaffold-режима без UI; пришлось делать `Noop = () => null`. (severity:minor)
2. `createForm<T>` на 6-уровневой вложенной схеме даёт TS2589 «Type instantiation is excessively deep». Workaround — функциональный cast. (severity:major)
3. ArrayNode API (push / removeAt / at / `useArrayLength`) явно не задокументирован в `create-form` prompt — суб-агент собрал его по `imports`-списку. (severity:major)

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
