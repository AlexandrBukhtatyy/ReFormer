# Orchestrator — iter-N MCP regression run

> Главный промт для запуска одной полной итерации MCP regression-цикла.
> Полный план: [docs/plans/proud-pondering-jellyfish.md](../plans/proud-pondering-jellyfish.md).
>
> Запуск: пользователь говорит «играй роль orchestrator'а из docs/iter-prompts/orchestrator.md, iter=N» (или slash-command если настроен).

---

## Inputs

| variable     | default                                  | описание                                |
| ------------ | ---------------------------------------- | --------------------------------------- |
| `ITER`       | (required)                               | номер итерации, integer ≥ 11            |
| `MAX_ITER`   | `5`                                      | максимум вложенных циклов до escalate   |
| `SPEC`       | `docs/specs/credit-application-mcp.md`   | спека формы (read-only — CLAUDE.md)     |
| `DEV_SERVER` | `http://localhost:5173`                  | URL dev-сервера для e2e                 |

---

## Step 0 — pre-flight (sequential, fail-fast)

1. **Validate ITER unique**: проверить `projects/react-playground/src/pages/examples/` — `mcp-credit-application-core-v${ITER}/` не должен существовать. Если существует — abort.
2. **Validate spec**: `test -f ${SPEC}` иначе abort.
3. **Validate spec untouched**: `git status ${SPEC}` должен быть пуст. Иначе — `git diff ${SPEC}` показать пользователю и abort (CLAUDE.md → specs read-only).
4. **Create workspace**:
   ```bash
   mkdir -p .tmp/iter-artifacts/iter-${ITER}/{core,renderer-react,renderer-json}
   mkdir -p .tmp/iter-artifacts/iter-${ITER}/proposed-patches
   mkdir -p projects/react-playground-e2e/screenshots/mcp-credit-v${ITER}
   mkdir -p projects/react-playground-e2e/videos/mcp-credit-v${ITER}
   date -u +%FT%TZ > .tmp/iter-artifacts/iter-${ITER}/.start
   git rev-parse HEAD >> .tmp/iter-artifacts/iter-${ITER}/.start
   ```
5. **Verify dev-server running**: `curl -fsS ${DEV_SERVER} >/dev/null` — иначе попросить пользователя поднять `npm run dev -w react-playground`.
6. **Rotate old videos** (опционально): `find projects/react-playground-e2e/videos -mindepth 1 -maxdepth 1 -type d -name 'mcp-credit-v*' -mtime +14 -exec rm -rf {} +`.

---

## Step 1 — launch sub-agents IN PARALLEL

В **одном** сообщении вызвать **3 Agent'а** одновременно (single message, 3 tool calls):

```
Agent(
  description="iter-${ITER} core sub-agent",
  subagent_type="general-purpose",
  prompt=<содержимое docs/iter-prompts/sub-agent.template.md
          с подставленными {ITER}, target=core, {SPEC} >
)
Agent( ... target=renderer-react ... )
Agent( ... target=renderer-json  ... )
```

Каждый sub-agent вернёт structured summary (status / metrics / gaps-count / report_path).

> ⚠️ Если sub-agent зависнет > 30 минут — продолжай с двумя оставшимися, замарай слот `status=blocked`.

---

## Step 2 — sandbox compliance audit

Для каждого sub-agent transcript (доступ через jsonl session log в `~/.claude/projects/.../<uuid>.jsonl` или через возвращённый summary):

- `grep -E '"name":"(Read|Glob|Grep)".*packages/'` → mark `tainted` если match
- `grep -E '"name":"(Read|Glob|Grep)".*projects/react-playground/src/pages/examples/(?!mcp-credit-application-.*-v${ITER})'` → same
- `grep -E '"name":"(Read|Glob|Grep)".*projects/react-playground/src/(components|factories|hooks|utils)/'` → same
- `grep -E '"name":"Bash".*git (commit|push|tag)'` → fail iter, не just tainted

Записать `.tmp/iter-artifacts/iter-${ITER}/audit.md` с результатами per-target. Tainted-target gap-list игнорируется в Step 4.

---

## Step 3 — App.tsx merge

Read `projects/react-playground/src/App.tsx`. Для каждого target из `{core, renderer-react, renderer-json}` где sub-agent НЕ tainted и `index.tsx` существует:

1. Добавить импорт после последнего `import ... from './pages/examples/...'`:
   ```ts
   import MccaCoreV${ITER} from './pages/examples/mcp-credit-application-core-v${ITER}';
   ```
   (имя компонента: `Mcca{Pascal(target)}V${ITER}`).
2. Расширить `examples` массив:
   ```ts
   {
     id: 'mcca-core-v${ITER}',
     path: '/mcp-credit-application-core-v${ITER}',
     title: `MCP credit (core) v${ITER}`,
     description: 'iter-${ITER} core target',
   }
   ```
3. Добавить `<Route path="/mcp-credit-application-${target}-v${ITER}" element={<Mcca${Pascal(target)}V${ITER} />} />`.

Idempotent — если строка уже есть (по id `mcca-${target}-v${ITER}`), skip.

---

## Step 3.5 — abstract test runs (NEW)

После того как 3 страницы залиты в App.tsx и tsc/build проходят — запусти shared abstract test suite (POM `CreditFormPage` + 9 spec файлов) против каждого target. Это **главный сигнал качества формы**, заменяющий per-target walkthrough'и из старого Step 5 sub-agent'а.

```bash
cd projects/react-playground-e2e
mkdir -p $TMPDIR/iter-${ITER}-results

for target in core renderer-react renderer-json; do
  MCP_ITER_VERSION=${ITER} ITER_MODE=on \
    ITER_OUTPUT_DIR=videos/mcp-credit-v${ITER}/${target}/ \
    npx playwright test --project=iter-${target} \
      --reporter=json 2>"$TMPDIR/iter-${ITER}-results/${target}.err" \
      > "$TMPDIR/iter-${ITER}-results/${target}.json" \
      || true   # не падать на failed tests — собираем все результаты
done
```

`MCP_ITER_VERSION` активирует 3 dynamic projects в `playwright.config.ts` (basePath `/mcp-credit-application-{target}-v${ITER}`). `iter-${target}` reuse'ит testDir `tests/pages/complex-multy-step-form/` — все existing abstract specs (happy-path/arrays/computed-fields/conditional-fields/dependencies/accessibility/loading-error) запускаются автоматически.

Парсинг результатов — выдрать из `${target}.json` per spec pass/fail:

```js
// или Node-скрипт, или jq:
// jq '.suites[].suites[] | { spec: .title, ok: ([.specs[] | select(.ok==true)] | length), total: (.specs | length) }'
```

Результат — таблица per spec × target, добавляется в iter-summary раздел **«Abstract test results»** (Step 4).

**Falure attribution**: если spec упал — категоризируй:
- (a) **MCP gap**: sub-agent не знал нужный паттерн → recipe-issue
- (b) **Sub-agent error**: код корректный по архитектуре, но ошибка в реализации
- (c) **testId convention violation**: sub-agent забыл `componentProps.testId = fieldName` → нашли selector mismatch

Категория (a) → patch draft (Step 6). (b) → flag в next iter prompt. (c) → enforce convention в sub-agent.template.md.

---

## Step 4 — aggregate dev-reports

Read 3× `.tmp/iter-artifacts/iter-${ITER}/${target}/dev-report.md`. Распарсить:

- metrics table → собрать в общий summary
- MCP gaps секция → дедуплицировать по `category` (или по `gap-id` если sub-agent его задал). Targets, попавшие в один gap — объединить через `targets affected: ...`.

**Token-метрика** (3 опции по приоритету):
- A. **Сессионный jsonl**: `~/.claude/projects/$(pwd | tr / -)/$AGENT_UUID.jsonl` — суммировать `usage.output_tokens` + `usage.input_tokens`. Это точно.
- B. **Из dev-report**: sub-agent сам записал «approximate based on N tool calls × Y avg».
- C. **Fallback**: `(unknown — agent meta unavailable)`.

Записать `docs/iter-summaries/iter-${ITER}.md` по шаблону [`templates/iter-summary.template.md`](./templates/iter-summary.template.md).

---

## Step 5 — verify (post-merge)

```bash
cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc-iter-${ITER}.log
npm run lint -w react-playground 2>&1 | tail -50
```

Если errors появились — в summary раздел «Post-merge errors» с цитатами. Не блокирует завершение iter, но влияет на decision (см. Step 7).

Дополнительно — найти leaked screenshots в repo root:
```bash
find . -maxdepth 1 -name 'page-*.png' -newer .tmp/iter-artifacts/iter-${ITER}/.start
```
Если что-то найдено — переместить в `projects/react-playground-e2e/screenshots/mcp-credit-v${ITER}/_leaked/` и **flag в audit.md**.

---

## Step 6 — patch draft (НЕ применять, только драфт)

Для каждого aggregated gap'а с severity ≥ med:

Создать `.tmp/iter-artifacts/iter-${ITER}/proposed-patches/${gap-id}.md`:

```md
# Patch ${gap-id} — ${title}

## Target file
`packages/reformer-mcp/src/...`

## Rationale
1-2 предложения почему gap существует и как fix закроет его.

## Proposed change
```diff
- old line
+ new line
```

(Если diff нетривиален — описание словами + указание места правки.)

## Affected sub-agents
- target=core (severity high): evidence quote
- target=renderer-react (severity med): evidence quote
```

---

## Step 7 — stop check

```
gaps_total = sum aggregated gaps (after dedup, excluding tainted-target gaps)

if gaps_total == 0 AND post-merge errors == 0:
  status = "GREEN"
  decision = "stop (green)"
elif ITER >= MAX_ITER:
  status = "STOP-LIMIT"
  decision = "stop (limit reached)"
else:
  status = "CONTINUE"
  decision = f"continue → /iter {ITER+1}"
```

Записать `decision: ${decision}` в stop-check секции iter-summary.

---

## Step 8 — handoff (НЕ commit, НЕ push)

Вывести пользователю:

1. **Summary path**: `docs/iter-summaries/iter-${ITER}.md`
2. **Patches path**: `.tmp/iter-artifacts/iter-${ITER}/proposed-patches/`
3. **Files changed**: `git status --short -- 'projects/react-playground/src/pages/examples/mcp-credit-application-*-v${ITER}/*' projects/react-playground/src/App.tsx 'projects/react-playground-e2e/tests/iter/mcp-credit-*-v${ITER}.spec.ts' docs/iter-summaries/iter-${ITER}.md`
4. **Counts**: `screenshots: $(find projects/react-playground-e2e/screenshots/mcp-credit-v${ITER} -name '*.png' | wc -l), videos: $(find projects/react-playground-e2e/videos/mcp-credit-v${ITER} -name '*.webm' | wc -l)`
5. **Decision** + **Next steps**:
   - GREEN → «Cycle закрыт. Можно мерджить feature → main, или начать новый цикл с другой спекой.»
   - STOP-LIMIT → «Лимит итераций. Эскалируй: ревьюй summary, реши — стоит ли продолжать вне лимита.»
   - CONTINUE → «Ревьюй patches, применяй вручную к `packages/reformer-mcp/`, валидируй (`cd packages/reformer-mcp && npm run build`), затем `/iter $((ITER+1))`.»

**НЕ выполнять** `git commit` / `git push` — это исключительно по explicit-запросу пользователя (CLAUDE.md → Git commits — strict authorization).

---

## Failure modes — orchestrator-level

| failure                                      | действие                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Sub-agent timeout (>30 мин)                  | mark `status=blocked`, продолжить с остальными                                                            |
| App.tsx merge conflict                       | re-merge только для конфликтующего target после прочистки                                                  |
| Все 3 sub-agent tainted                      | abort iter; вывести «sandbox compliance broken; revise sub-agent.template.md»                              |
| Spec был изменён во время iter               | abort, восстановить (`git checkout -- ${SPEC}`), retry                                                    |
| Disk full на screenshots/videos              | abort step, попросить пользователя освободить и retry                                                     |
| jsonl path не найден (token-метрика fail)    | заполнить `(unknown)` в metrics, продолжить                                                               |
