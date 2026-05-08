# Чистый эксперимент: минимальный sub-agent промт vs full orchestrator

## Context

Текущий iter-цикл (orchestrator + 3 sub-agent'а) достиг ~590k tokens на iter-18 при тяжёлой обвязке: ~330-строчный `sub-agent.template.md` с MCP discovery checklist, schema-driven UI rules, testId convention, type-safety recipes, sandbox compliance, smoke spec, dev-report шаблоном.

Пользователь хочет **чистый baseline эксперимент**: дать 3 sub-agent'ам максимально минимальный промт (только спека + краткий hint про MCP) и замерить **tokens / wall-clock / качество** без всей обвязки. Цель — понять, **сколько в реальности тратится на саму генерацию**, а сколько съедает orchestrator-инфраструктура.

Сравнения с iter-18 в отчёте делать **не надо** — отдельный standalone замер.

## Что создаём (файлы)

### 1. `docs/iter-prompts/sub-agent-clean.md` (новый, ~40 строк)

Минимальный промт sub-agent'у. Содержит **только**:

- **Цель**: реализуй форму по `docs/specs/credit-application-mcp.md` (read-only)
- **Target** (один из `core`, `renderer-react`, `renderer-json`)
- **Куда писать**: `projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-clean/`
- **Файлы** (per target):
  - `core` → `schema.ts`, `index.tsx`
  - `renderer-react` → `schema.ts`, `index.tsx`
  - `renderer-json` → `schema.json`, `index.tsx`
- **MCP hint** (3-4 строки, **директивно**): «У тебя есть MCP-сервер `@reformer/mcp` с tools `find_recipe` / `get_symbol_docs` / `report_issue`. **Используй его по максимуму** — это первоисточник recipes/symbol-docs для всех `@reformer/*` пакетов. Если перед написанием кода для механизма (валидация, computed-fields, FormArray, async, masks, и т.д.) ты не вызвал MCP — это пробел. Если recipe не подошёл — попробуй другой keyword. Если MCP вообще ничего не дал — это сигнал к `report_issue`.»
- **testId convention** (короткий блок, ~10 строк):
  - Каждое поле формы ОБЯЗАНО иметь `componentProps.testId` равный имени поля (camelCase).
  - Top-level: `loanAmount` → `testId: 'loanAmount'`.
  - Nested groups: `parentField-childField` через дефис (например `personalData.lastName` → `testId: 'personalData-lastName'`).
  - Array items: `testId` per item-leaf БЕЗ префикса массива (POM ставит индекс сам).
  - Пример (в схеме):
    ```ts
    loanAmount: { value: null, component: Input, componentProps: { label: '...', testId: 'loanAmount' } },
    personalData: {
      lastName: { value: '', component: Input, componentProps: { label: 'Фамилия', testId: 'personalData-lastName' } },
    },
    ```
  - Зачем: единая convention для consumer'ов (POM, abstract tests). Даже без запуска тестов в этом эксперименте — convention остаётся ожидаемой нормой.
- **Hard-rules** (3 пункта, не относятся к функционалу):
  - НЕ редактируй `docs/specs/`
  - НЕ делай `git commit/push`
  - НЕ трогай `App.tsx` (orchestrator решит сам после)
- **Verification (минимальная)**: `npx tsc --noEmit -p tsconfig.app.json` должен пройти
- **Dev-report (обязательная секция в промте)**: sub-agent после генерации пишет короткий `dev-report.md` в `.tmp/iter-artifacts/iter-clean-1/{TARGET}/dev-report.md` со структурой:
  ```md
  # dev-report — target={TARGET}

  ## Status
  ok | partial | blocked

  ## Files written
  - projects/react-playground/src/pages/examples/.../schema.ts (LOC: N)
  - ...

  ## MCP calls
  Кол-во вызовов: N. Какие recipes/symbols пригодились (список).

  ## MCP gaps
  Каждый gap — список:
  - **gap-id**: короткий slug (например `g-find_recipe-async-fail`)
  - **severity**: high | med | low
  - **evidence**: цитата ответа MCP или «MCP returned no recipe for X»
  - **proposed fix**: что добавить в MCP (новый recipe / extra example)

  ## Notes
  Особенности, blocker'ы, что не получилось.
  ```
- **Return**: одна строка структурированного summary `status: ok|fail, files_written: [...], report_path: .tmp/iter-artifacts/iter-clean-1/{TARGET}/dev-report.md`

Что **НЕ включено** (явно убрано vs текущий sub-agent.template.md):

- MCP discovery checklist (~15 явно перечисленных recipes/symbols) — **MCP используется, но какие именно recipes искать sub-agent решает сам** через директиву «использовать по максимуму»
- Schema-driven UI rule с примерами (sub-agent должен вытащить через MCP)
- Type-safety recipes (Recipe 8, ValidationSchemaFn import path, и т.д.) — sub-agent должен вытащить через MCP
- Sandbox compliance rules (read-only ограничения на `packages/`, sibling examples)
- Smoke spec template

Что **ВКЛЮЧЕНО** (минимум для consistency с consumer'ами):

- testId convention — короткий блок ~10 строк (см. выше)
- Dev-report шаблон с **MCP gaps секцией** — главный output эксперимента

**Важная разница vs «совсем чистый baseline»**: MCP не отключаем и не делаем «опциональным» — наоборот, директивно требуем использовать. Это замер сценария «sub-agent вооружён MCP, но без orchestrator-обвязки». Если bare MCP даёт качественный результат — это сильный сигнал в пользу инвестиции в MCP recipes vs orchestrator infrastructure.

### 2. `docs/iter-prompts/orchestrator-clean.md` (новый, ~50 строк)

Минимальный runner — описание шагов для оркестратора без сбора gap'ов / patches / abstract tests.

Шаги:

1. **Pre-flight**:
   ```bash
   mkdir -p .tmp/iter-artifacts/iter-clean-1/{core,renderer-react,renderer-json}
   date -u +%FT%TZ > .tmp/iter-artifacts/iter-clean-1/.start
   git rev-parse HEAD >> .tmp/iter-artifacts/iter-clean-1/.start
   ```
2. **Launch 3 sub-agents** параллельно (single message, 3 `Agent` tool calls), `subagent_type=general-purpose`, `prompt=` содержимое `sub-agent-clean.md` с подставленным `{TARGET}`. Каждый sub-agent пишет в `.tmp/iter-artifacts/iter-clean-1/{target}/start.txt` и `end.txt` свои timestamps **первым и последним действием** для замера wall-clock per agent.
3. **После завершения всех 3** (или таймаута 30 мин per agent):
   - `date -u +%FT%TZ > .tmp/iter-artifacts/iter-clean-1/.end`
   - Найти session jsonl каждого sub-agent'а: `~/.claude/projects/-Users-aleksandrbuhtatyj-Work-My-ReFormer/<uuid>.jsonl` (по timestamp)
   - Просуммировать `usage.input_tokens` + `usage.output_tokens` per agent через `jq` или `node`
4. **Quality check** per target:
   ```bash
   cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc-clean.log
   npm run build -w react-playground 2>&1 | tail -10
   ```
   (запускается **один раз** — все 3 страницы в одном `tsc` проходе; pass/fail per target определяется через `grep` по путям в логе)
5. **Подсчитать LOC** сгенерированного кода per target:
   ```bash
   for t in core renderer-react renderer-json; do
     wc -l projects/react-playground/src/pages/examples/mcp-credit-application-${t}-clean/*.{ts,tsx,json} 2>/dev/null
   done
   ```
6. **App.tsx merge** — после успешной компиляции (или даже если tsc упал, но `index.tsx` существует) — orchestrator сам добавляет 3 routes для визуальной верификации. Аналогично существующему [orchestrator.md Step 3](../iter-prompts/orchestrator.md#L74), но с suffix `-clean` вместо `-v{N}`:
   - Импорт: `import MccaCoreClean from './pages/examples/mcp-credit-application-core-clean';` (имя компонента: `Mcca{Pascal(target)}Clean`)
   - Запись в `examples` массив:
     ```ts
     {
       id: 'mcca-core-clean',
       path: '/mcp-credit-application-core-clean',
       title: 'MCP credit (core) clean',
       description: 'baseline experiment — minimal prompt',
     }
     ```
   - Route: `<Route path="/mcp-credit-application-core-clean" element={<MccaCoreClean />} />`
   - Idempotent: если запись уже есть (по id) — skip.
7. **Прочитать 3 dev-report'а** (`.tmp/iter-artifacts/iter-clean-1/{target}/dev-report.md`), агрегировать **MCP gaps** с дедупликацией по `gap-id`. Targets, попавшие в один gap — объединить через `targets affected: ...`.
8. **Записать финал-отчёт** в `docs/iter-summaries/iter-clean-1.md` с таблицей метрик + секцией aggregated MCP gaps (см. формат ниже).

**НЕТ** в orchestrator-clean.md:

- Sandbox compliance audit (grep по transcript'у на запрещённые Read/Glob)
- Smoke spec runs / abstract test runs / playwright вообще
- Patch drafts (`.tmp/.../proposed-patches/`) — gap'ы только агрегируются в отчёт, фикс-патчи не пишем (это можно делать отдельным циклом если эксперимент даст полезный список)
- Stop-check / continue-decision

### 3. Сгенерированные артефакты (output эксперимента)

- `.tmp/iter-artifacts/iter-clean-1/{target}/{start,end}.txt` — timestamps для wall-clock
- `.tmp/iter-artifacts/iter-clean-1/{target}/agent-summary.txt` — return от Agent'а
- `projects/react-playground/src/pages/examples/mcp-credit-application-{target}-clean/` — сгенерированный код (3 каталога, по target)
- `docs/iter-summaries/iter-clean-1.md` — финал-отчёт

## Формат финал-отчёта (`iter-clean-1.md`)

Один документ. Главная таблица — метрики per target + total:

```markdown
# iter-clean-1 — baseline measurement

> Чистый эксперимент: минимальный промт без MCP discovery checklist, без convention rules.

| target          | wall-clock (мин) | input tokens | output tokens | total tokens | tsc  | build | LOC |
| --------------- | ---------------- | ------------ | ------------- | ------------ | ---- | ----- | --- |
| core            | N                | N            | N             | N            | ✅/❌ | ✅/❌ | N   |
| renderer-react  | N                | N            | N             | N            | ✅/❌ | ✅/❌ | N   |
| renderer-json   | N                | N            | N             | N            | ✅/❌ | ✅/❌ | N   |
| **total**       | **max(...)**     | **sum**      | **sum**       | **sum**      |      |       | sum |

(wall-clock total = max, потому что 3 sub-agent'а параллельно)

## Notes per target
- core: что бросилось в глаза (ошибки tsc, **сколько MCP-вызовов** по их digest'у в jsonl, какие recipes пригодились, особенности)
- renderer-react: ...
- renderer-json: ...

## MCP usage stats
Из jsonl агентов — сколько вызовов `mcp__reformer__*` суммарно и per target. Это сам по себе сигнал: если sub-agent вызвал MCP мало — либо промт не убедил, либо MCP не помог.

## MCP gaps (aggregated)

Из 3× `.tmp/iter-artifacts/iter-clean-1/{target}/dev-report.md`, дедуп по `gap-id`:

| gap-id | severity | targets affected | evidence | proposed fix |
| ------ | -------- | ---------------- | -------- | ------------ |
| g-... | high | core, renderer-react | «MCP returned no recipe for X» | добавить recipe Y в Z |
| ...    | ...      | ...              | ...      | ...          |

## Что промт содержал
(копия `sub-agent-clean.md`)

## Раннер
(копия команд из `orchestrator-clean.md`)
```

**Важно**: «качество результата» — это _только_ tsc + build pass/fail + LOC. Без smoke, без abstract tests (по решению пользователя «без тестов»). Если sub-agent смог скомпилировать страницу — считаем «качественным» по grep-уровню.

## Existing utilities to reuse

- **Token sourcing pattern** — описан в [docs/iter-prompts/orchestrator.md:144](../iter-prompts/orchestrator.md#L144) (Step 4): jsonl файлы лежат в `~/.claude/projects/-Users-aleksandrbuhtatyj-Work-My-ReFormer/<uuid>.jsonl`. Просуммировать `usage.input_tokens` + `usage.output_tokens` через jq.
- **Spec read-only enforcement** — CLAUDE.md → «Specs are read-only». Промт sub-agent'а ссылается, не дублирует.
- **Existing 3-target naming** — `core` / `renderer-react` / `renderer-json`, такие же как в текущем cycle. Suffix `-clean` вместо `-v{N}` чтобы не путать с iter-N.

## Verification (как проверить план end-to-end после реализации)

1. **Файлы созданы**: `docs/iter-prompts/sub-agent-clean.md`, `docs/iter-prompts/orchestrator-clean.md` существуют.
2. **Запуск эксперимента** (отдельным сообщением от пользователя): «играй роль orchestrator из orchestrator-clean.md». Orchestrator должен:
   - Развернуть рабочую директорию `.tmp/iter-artifacts/iter-clean-1/`
   - Запустить 3 Agent'а параллельно (видно в UI как 3 одновременных subagent'а)
   - Дождаться завершения, собрать timestamps, jsonl-метрики
   - Прогнать tsc + build
   - Сгенерировать `docs/iter-summaries/iter-clean-1.md` с заполненной таблицей
3. **Output expectation**:
   - 3 каталога `mcp-credit-application-{target}-clean/` с файлами
   - tsc может **не пройти** — это валидный сигнал baseline'а (без convention'ов sub-agent'ы могут сделать typing errors)
   - Wall-clock total ожидаемо < полный iter-18 (нет smoke runs, нет dev-report'ов с MCP gaps анализом)
4. **Cleanup после эксперимента**: каталоги `mcp-credit-application-{target}-clean/` можно удалить аналогично iter-N cleanup'у. Отчёт `iter-clean-1.md` сохраняется в repo (history).

## Open question (не блокирующее)

- **Если sub-agent захочет писать в `App.tsx`** (хотя промт это запрещает) — orchestrator должен заметить и откатить, либо просто игнорировать (страницы без route не помешают tsc). Решение: **игнорировать** — измерение поведения без orchestrator-полиции и есть смысл baseline'а.
