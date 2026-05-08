# Orchestrator — clean baseline run

> Минимальный runner для baseline-замера. Без sandbox audit, без abstract tests, без patches.
> Полный план: [docs/plans/proud-pondering-jellyfish.md](../plans/proud-pondering-jellyfish.md).
>
> Запуск: пользователь говорит «играй роль orchestrator из docs/iter-prompts/orchestrator-clean.md».

---

## Inputs

| variable | default                                 | описание                                         |
| -------- | --------------------------------------- | ------------------------------------------------ |
| `RUN_ID` | `iter-clean-1`                          | имя замера (если делаем повтор — `iter-clean-2`) |
| `SPEC`   | `docs/specs/credit-application-form.md` | спека формы (read-only — CLAUDE.md)              |

---

## Step 0 — pre-flight

```bash
mkdir -p .tmp/iter-artifacts/${RUN_ID}/{core,renderer-react,renderer-json}
date -u +%FT%TZ > .tmp/iter-artifacts/${RUN_ID}/.start
git rev-parse HEAD >> .tmp/iter-artifacts/${RUN_ID}/.start
```

Проверь что не существует `projects/react-playground/src/pages/examples/mcp-credit-application-*-clean/` (если есть — abort, попроси пользователя удалить или переименовать `RUN_ID`).

Проверь spec untouched: `git status ${SPEC}` должен быть пуст.

---

## Step 1 — launch 3 sub-agents IN PARALLEL

В **одном** сообщении вызови **3 Agent'а** одновременно (single message, 3 tool calls):

```
Agent(
  description="clean baseline core",
  subagent_type="general-purpose",
  prompt=<содержимое docs/iter-prompts/sub-agent-clean.md с подставленным {TARGET}=core>
)
Agent( description="clean baseline renderer-react", ... target=renderer-react )
Agent( description="clean baseline renderer-json",  ... target=renderer-json )
```

Перед запуском в каждом промте подставь `{TARGET}` (3 места: title, table-row выбора, hard-rules не меняются).

> ⚠️ Если sub-agent зависнет > 30 минут — продолжи с двумя оставшимися, замарай слот `status=blocked`.

Каждый sub-agent вернёт yaml-summary. Сохрани его в `.tmp/iter-artifacts/${RUN_ID}/${target}/agent-summary.txt`.

---

## Step 2 — collect timestamps & tokens

После завершения **всех 3** sub-agent'ов:

```bash
date -u +%FT%TZ > .tmp/iter-artifacts/${RUN_ID}/.end
```

**Token sourcing** (per-agent):

JSONL session логи лежат в `~/.claude/projects/-Users-aleksandrbuhtatyj-Work-My-ReFormer/<uuid>.jsonl`. Найди файлы созданные/изменённые в окне `[.start; .end]`:

```bash
find ~/.claude/projects/-Users-aleksandrbuhtatyj-Work-My-ReFormer -name '*.jsonl' \
  -newer .tmp/iter-artifacts/${RUN_ID}/.start \
  ! -newer .tmp/iter-artifacts/${RUN_ID}/.end
```

Это должно быть 3 файла (по одному на каждый sub-agent). Если 4+ — фильтруй по содержимому: ищи строку с `prompt` совпадающую с `description` Agent'а.

Для каждого jsonl:

```bash
jq -s '
  [.[] | .message.usage // empty | .input_tokens + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0)] | add as $in
  | [.[] | .message.usage // empty | .output_tokens] | add as $out
  | { input_tokens: $in, output_tokens: $out, total: ($in + $out) }
' < /path/to/session.jsonl
```

(jq-выражение на 1 строку, можно адаптировать под фактический shape jsonl — см. [orchestrator.md:144](./orchestrator.md#L144) для существующего паттерна.)

**MCP calls counter** per agent:

```bash
jq -r 'select(.message.content[]?.type == "tool_use") | .message.content[] | select(.name? | startswith("mcp__reformer__")) | .name' \
  < /path/to/session.jsonl | wc -l
```

**Wall-clock per agent**: парси первое и последнее `timestamp` из jsonl, разность в минутах.

---

## Step 3 — quality check (tsc + build)

```bash
cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc-${RUN_ID}.log
npm run build -w react-playground 2>&1 | tee /tmp/build-${RUN_ID}.log | tail -10
```

Pass/fail per target определи через grep по логу:

```bash
for t in core renderer-react renderer-json; do
  if grep -q "mcp-credit-application-${t}-clean" /tmp/tsc-${RUN_ID}.log; then
    echo "${t}: tsc FAIL"
  else
    echo "${t}: tsc OK"
  fi
done
```

(аналогично для `/tmp/build-${RUN_ID}.log`)

**LOC per target**:

```bash
for t in core renderer-react renderer-json; do
  total=$(find projects/react-playground/src/pages/examples/mcp-credit-application-${t}-clean -type f \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' \) -exec wc -l {} + | tail -1 | awk '{print $1}')
  echo "${t}: ${total} LOC"
done
```

---

## Step 4 — App.tsx merge

Read `projects/react-playground/src/App.tsx`. Для каждого target где `mcp-credit-application-{target}-clean/index.tsx` существует:

1. **Импорт** после последнего `import ... from './pages/examples/...'`:

   ```ts
   import MccaCoreClean from './pages/examples/mcp-credit-application-core-clean';
   import MccaRendererReactClean from './pages/examples/mcp-credit-application-renderer-react-clean';
   import MccaRendererJsonClean from './pages/examples/mcp-credit-application-renderer-json-clean';
   ```

2. **Расширь `examples` массив** записями:

   ```ts
   {
     id: 'mcca-core-clean',
     path: '/mcp-credit-application-core-clean',
     title: 'MCP credit (core) clean',
     description: 'baseline experiment — minimal prompt',
   },
   // ... renderer-react, renderer-json
   ```

3. **Добавь Routes** перед `<Route path="/" ...>`:

   ```tsx
   <Route path="/mcp-credit-application-core-clean" element={<MccaCoreClean />} />
   <Route path="/mcp-credit-application-renderer-react-clean" element={<MccaRendererReactClean />} />
   <Route path="/mcp-credit-application-renderer-json-clean" element={<MccaRendererJsonClean />} />
   ```

4. **Idempotent**: если строка с id `mcca-${target}-clean` уже есть — skip.

5. После правки повтори tsc один раз — убедись что App.tsx компилируется (если упал sub-agent — его route не добавляй).

---

## Step 5 — aggregate dev-reports

Read 3× `.tmp/iter-artifacts/${RUN_ID}/${target}/dev-report.md`. Извлеки секцию **MCP gaps** из каждого. Дедуплицируй по `gap-id`. Targets, попавшие в один gap — объедини через `targets affected: core, renderer-react`.

Сохрани aggregated список в memory для Step 6.

---

## Step 6 — финал-отчёт

Запиши `docs/iter-summaries/${RUN_ID}.md`:

```md
# ${RUN_ID} — baseline measurement (YYYY-MM-DD)

> Чистый эксперимент: минимальный sub-agent промт без MCP discovery checklist, без convention rules за исключением testId.

## Run metrics

| target         | wall-clock (мин) | input tokens | output tokens | total tokens | mcp calls | tsc | build | LOC |
| -------------- | ---------------- | ------------ | ------------- | ------------ | --------- | --- | ----- | --- |
| core           |                  |              |               |              |           |     |       |     |
| renderer-react |                  |              |               |              |           |     |       |     |
| renderer-json  |                  |              |               |              |           |     |       |     |
| **total**      | **max(...)**     | **sum**      | **sum**       | **sum**      | **sum**   |     |       | sum |

(wall-clock total = max, потому что 3 sub-agent'а параллельно)

## Notes per target

- **core**: ...
- **renderer-react**: ...
- **renderer-json**: ...

## MCP gaps (aggregated)

| gap-id | severity | targets affected | evidence | proposed fix |
| ------ | -------- | ---------------- | -------- | ------------ |
| ...    | ...      | ...              | ...      | ...          |

## Что промт содержал

См. [docs/iter-prompts/sub-agent-clean.md](../iter-prompts/sub-agent-clean.md)

## Раннер

См. [docs/iter-prompts/orchestrator-clean.md](../iter-prompts/orchestrator-clean.md)
```

---

## Step 7 — handoff (НЕ commit, НЕ push)

Выведи пользователю короткий summary:

1. **Summary path**: `docs/iter-summaries/${RUN_ID}.md`
2. **Total tokens**: N (sum input+output по 3 sub-agent'ам)
3. **Total wall-clock**: N мин (max из 3)
4. **Quality**: tsc N/3 ✅, build N/3 ✅
5. **Aggregated gaps**: high=N med=N low=N

**НЕ выполнять** `git commit` / `git push` — только по explicit-запросу пользователя (CLAUDE.md → Git commits — strict authorization).

---

## Failure modes

| failure                     | действие                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Sub-agent timeout (>30 мин) | mark `status=blocked`, продолжить с остальными                                                      |
| App.tsx merge conflict      | re-merge только для конфликтующего target                                                           |
| Spec изменён во время run   | abort, восстановить (`git checkout -- ${SPEC}`), retry                                              |
| jsonl path не найден        | заполнить `(unknown)` в metrics, продолжить                                                         |
| Все 3 sub-agent fail tsc    | финал-отчёт всё равно пишем — это валидный baseline-сигнал «без обвязки sub-agent'ы не справляются» |
