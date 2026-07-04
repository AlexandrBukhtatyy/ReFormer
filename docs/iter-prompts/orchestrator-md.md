# Orchestrator — paper listing calibration

> Тонкий runner для «бумажной» калибровки MCP. Sub-agent'ы производят **листинги** формы (не код),
> orchestrator скорит их детерминированными текст-проверками + MCP static checkers. Без merge App.tsx,
> без tsc/build, без Playwright, без dev-сервера.
> Родственник (полный code-gen + Playwright): [`orchestrator.md`](./orchestrator.md).
> Baseline (реальный код + tsc): [`orchestrator-clean.md`](./orchestrator-clean.md).
> План: [docs/plans/mcp-staged-moonbeam.md](../plans/mcp-staged-moonbeam.md).
>
> Запуск: пользователь говорит «играй роль orchestrator из docs/iter-prompts/orchestrator-md.md».

---

## Inputs

| variable  | default                                 | описание                            |
| --------- | --------------------------------------- | ----------------------------------- |
| `RUN_ID`  | `iter-md-1`                             | имя прогона (повтор → `iter-md-2`)  |
| `SPEC`    | `docs/specs/credit-application-form.md` | спека формы (read-only — CLAUDE.md) |
| `TARGETS` | `core renderer-react renderer-json`     | какие стеки прогнать                |

### Структурные якоря спеки (backstop для C1/C6)

Из `docs/specs/credit-application-form.md`: **6 шагов** · **8 computed** (`interestRate, monthlyPayment, initialPayment, fullName, age, totalIncome, paymentToIncomeRatio, coBorrowersIncome`) · **3 FormArray** (`properties, existingLoans, coBorrowers`) · **8 conditional-групп** (mortgage / car / employed / selfEmployed / sameAsRegistration / hasProperty / hasExistingLoans / hasCoBorrower) · **~80 leaf-полей**.

---

## Step 0 — pre-flight

```bash
mkdir -p .tmp/iter-artifacts/${RUN_ID}/{core,renderer-react,renderer-json}
mkdir -p .tmp/iter-artifacts/${RUN_ID}/_reference
date -u +%FT%TZ > .tmp/iter-artifacts/${RUN_ID}/.start
git rev-parse HEAD >> .tmp/iter-artifacts/${RUN_ID}/.start
```

Проверь spec untouched: `git status ${SPEC}` должен быть пуст (иначе abort — specs read-only, CLAUDE.md).

**Нет** проверки dev-сервера, **нет** проверки существующего кода-каталога — paper mode ничего не монтирует и не пишет в `projects/`.

**Опционально (рекомендуется): shared reference.** Прогони MCP-prompt `plan-form(specPath=${SPEC}, target=core)` ОДИН раз, сохрани вывод в `.tmp/iter-artifacts/${RUN_ID}/_reference/plan.md`. Это общий инвентарь полей/computed/arrays, переиспользуемый всеми 3 target'ами → sampling-недетерминизм разыгрывается один раз, а не трижды. Из него C1 берёт эталонный список полей; если prompt недоступен — fallback на захардкоженные якоря выше.

---

## Step 1 — launch sub-agents IN PARALLEL

В **одном** сообщении вызови по одному `Agent'у` на каждый target из `TARGETS` (single message, N tool calls):

```
Agent( description="paper listing core",           subagent_type="general-purpose", prompt=<sub-agent-md.md, {TARGET}=core, {RUN_ID}, {SPEC_PATH}> )
Agent( description="paper listing renderer-react", subagent_type="general-purpose", prompt=<sub-agent-md.md, {TARGET}=renderer-react, ...> )
Agent( description="paper listing renderer-json",  subagent_type="general-purpose", prompt=<sub-agent-md.md, {TARGET}=renderer-json, ...> )
```

Перед запуском подставь в каждый промт `{RUN_ID}`, `{TARGET}`, `{SPEC_PATH}=${SPEC}`.

> ⚠️ Если sub-agent зависнет > 30 минут — продолжи с остальными, замарай слот `status=blocked`.

Каждый sub-agent вернёт yaml-summary (последним сообщением). Сохрани его в `.tmp/iter-artifacts/${RUN_ID}/${target}/agent-summary.txt`.

```bash
date -u +%FT%TZ > .tmp/iter-artifacts/${RUN_ID}/.end
```

---

## Step 2 — sandbox audit

По transcript'у каждого sub-agent'а (JSONL session log — на этой машине `.output` файлы в session tasks-каталоге, либо `~/.claude/projects/<slug>/*.jsonl`) grep'ом ищи нарушения. `grep` возвращает только совпадения — контекст не переполнит (в отличие от полного Read транскрипта).

Паттерны (любое совпадение → target `tainted`, его gap-list исключается из агрегации):

```bash
# Read/Glob/Grep по исходникам библиотек
grep -E '"name":"(Read|Glob|Grep)"' <transcript> | grep -E 'packages/'
# Read по любым examples (включая соседние)
grep -E '"name":"(Read|Glob|Grep)"' <transcript> | grep -E 'src/pages/examples/'
# Read по общим helper'ам
grep -E '"name":"(Read|Glob|Grep)"' <transcript> | grep -E 'src/(components|factories|hooks|utils)/'
# node_modules .d.ts peeking (paper-mode специфично)
grep -E '"name":"(Read|Glob|Grep)"' <transcript> | grep -E 'node_modules/@reformer/.*\.d\.ts'
# Write в projects/ (в paper mode кода быть не должно)
grep -E '"name":"(Write|Edit)"' <transcript> | grep -E 'projects/'
# git мутации → не просто tainted, а fail
grep -E '"name":"Bash"' <transcript> | grep -E 'git (commit|push|tag)'
```

Записать результат в `.tmp/iter-artifacts/${RUN_ID}/audit.md` (per-target: packages reads / examples reads / helpers reads / .d.ts peeks / projects writes / git mutations → verdict clean|tainted). Замечание: `.d.ts` peek допустим ТОЛЬКО если sub-agent залогировал его как gap в §3.2 — иначе tainted.

---

## Step 3 — детерминированный скоринг листинга (C1–C9)

Для каждого **не-tainted** target'а прогони объективные проверки по тексту `.tmp/iter-artifacts/${RUN_ID}/${target}/form-listing.md`. **Не доверяй** self-report из §3.3 — считай сам.

| #   | проверка                | метод                                                                                                                                            | verdict            |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| C1  | покрытие полей          | посчитать leaf-записи / `testId:` в §2 vs эталон (`_reference/plan.md` + ~80)                                                                    | coverage %         |
| C2  | наличие testId          | каждый leaf несёт `testId`; `leaves == with_testid`                                                                                              | violations         |
| C3  | конвенция testId        | nested-group leaves с дефис-префиксом (`personalData-…`); array-leaves без префикса                                                              | violations (soft)  |
| C4  | renderer-json compile   | извлечь ```json из §2.1 → `validate_json_schema(schema, componentNames, dataSourceNames)`                                                        | pass/fail + errors |
| C5  | computed/behavior граф  | извлечь dep-map из §3.1 → `check_behaviors(dependencies)`; сверить, что 8 computed присутствуют                                                  | cycles + missing   |
| C6  | структурное присутствие | grep 6 step-заголовков; 3 имени массивов; 8 имён computed; 8 conditional-маркеров                                                                | present N/N        |
| C7  | import-origin lint      | импорты резолвятся в `@reformer/core`, `/core/validators`, `@reformer/ui-kit`, `@reformer/renderer-*`; ни одного из `packages/` или helper-путей | violations         |
| C8  | no-escape-hatch lint    | grep `as any` / `as never` / `@ts-ignore` / `@ts-expect-error` в §2                                                                              | count              |
| C9  | symbol traceability     | каждый нетривиальный API из §2 присутствует в `discovery.md`                                                                                     | untraced-API count |

- **C4/C5** — единственные, приближающие компилятор. Прогоняй их как настоящие MCP-tool вызовы (ты, orchestrator, тоже в MCP-доступе).
- **C1–C3, C6** — полнота спеки. **C7–C9** — lint + детекция галлюцинаций.
- Композитный per-target score = `coverage% · (1 − violation_rate) · paper_compile_pass`. Репортить компоненты, не только скаляр.

Извлечение ```json для C4 и dep-map для C5: если блоки в листинге битые/неполные — отметь C4/C5 как `n/a — listing incomplete` и понизь coverage.

---

## Step 4 — aggregate & dedup gaps

Read §3.2 из каждого не-tainted `form-listing.md`. Дедуплицируй по `gap-id`. Targets, попавшие в один gap — объедини (`targets affected: core, renderer-json`). Держи max severity. Собери один список для Step 5.

Собери также **union type-risk spots** из §3.1 всех target'ов (это то, что paper mode принципиально не может доказать — важный раздел отчёта).

---

## Step 5 — финал-отчёт

Запиши `docs/iter-summaries/${RUN_ID}.md`:

```md
# ${RUN_ID} — paper listing calibration (YYYY-MM-DD)

> Dry-run: sub-agent'ы произвели ЛИСТИНГИ кода (без app-кода, без tsc/build/Playwright).
> Сигнал = корректность дизайна через детерминированные текст-проверки + MCP static checkers
> (`validate_json_schema`, `check_behaviors`). Ограничение: type/overload/prop-flow ошибки НЕ ловятся.

## Run metrics

| target         | mcp calls | coverage (fields) | steps | computed | arrays | json-schema     | behaviors | testId viol | gaps h/m/l |
| -------------- | --------- | ----------------- | ----- | -------- | ------ | --------------- | --------- | ----------- | ---------- |
| core           |           | N/80              | N/6   | N/8      | N/3    | n/a             | none      |             |            |
| renderer-react |           | N/80              | N/6   | N/8      | N/3    | n/a             | none      |             |            |
| renderer-json  |           | N/80              | N/6   | N/8      | N/3    | ok / FAIL(errs) | none      |             |            |

## Deterministic checks per target (C1–C9)

- **core**: C1 …, C2 …, C3 …, C6 …, C7 …, C8 …, C9 …
- **renderer-react**: …
- **renderer-json**: … (+ C4 validate_json_schema результат)

## MCP gaps (aggregated, deduped)

| gap-id | severity | targets affected | evidence | proposed fix (packages/reformer-mcp/) |
| ------ | -------- | ---------------- | -------- | ------------------------------------- |
| …      | …        | …                | …        | …                                     |

## Type-risk spots not provable on paper (union §3.1)

- <target> `<file:≈line>` — <почему может не скомпилироваться>

## Sandbox audit

| target | packages | examples | helpers | .d.ts peek | projects write | git | verdict |
| ------ | -------- | -------- | ------- | ---------- | -------------- | --- | ------- |
| …      | 0        | 0        | 0       | 0          | 0              | 0   | clean   |

## Prompt / runner

- Sub-agent: [docs/iter-prompts/sub-agent-md.md](../iter-prompts/sub-agent-md.md)
- Runner: [docs/iter-prompts/orchestrator-md.md](../iter-prompts/orchestrator-md.md)
- Listing template: [docs/iter-prompts/templates/form-listing.template.md](../iter-prompts/templates/form-listing.template.md)

## Artifacts

- Per-target листинги: `.tmp/iter-artifacts/${RUN_ID}/{target}/form-listing.md`
- Discovery raw: `.tmp/iter-artifacts/${RUN_ID}/{target}/discovery.md`
- Audit: `.tmp/iter-artifacts/${RUN_ID}/audit.md`
```

---

## Step 6 — handoff (НЕ commit, НЕ push)

Выведи пользователю короткий summary:

1. **Summary path**: `docs/iter-summaries/${RUN_ID}.md`
2. **Coverage**: core N/80, renderer-react N/80, renderer-json N/80
3. **Paper-compile**: renderer-json validate_json_schema ✅/❌; behaviors cycles: none/N
4. **Aggregated gaps**: high=N med=N low=N
5. **Type-risk spots** (не доказуемо на бумаге): N
6. **Sandbox**: N/N clean

Опционально token/wall-clock из session JSONL — тем же способом, что `orchestrator-clean.md` Step 2 (адаптируй путь транскриптов под окружение).

**НЕ выполнять** `git commit` / `git push` — только по explicit-запросу пользователя (CLAUDE.md → Git commits — strict authorization).

---

## Failure modes

| failure                            | действие                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Sub-agent timeout (>30 мин)        | mark `status=blocked`, продолжить с остальными                                   |
| Листинг с элизией (`// ...`)       | C1 обнуляет coverage для target'а; отметить в отчёте, gap-list всё равно собрать |
| `validate_json_schema` unavailable | `@reformer/renderer-json` не установлен → C4 `n/a — tool unavailable`, отметить  |
| Spec изменён во время run          | abort, восстановить (`git checkout -- ${SPEC}`), retry                           |
| Все 3 sub-agent tainted            | abort прогона — «sandbox compliance broken», отчёт не пишем                      |
| Транскрипт не найден для аудита    | пометить audit `unknown`, довериться self-attestation §3.2, флаг в отчёте        |
