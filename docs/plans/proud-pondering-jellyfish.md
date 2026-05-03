# Orchestrator + sub-agent prompt system для итеративного MCP regression-testing

## Context

После ручных циклов H/I/J/K/L/M/N1-4/O1-3 ясно: правки MCP приходят из реальных попыток сгенерировать форму через MCP, обнаружить gap, дописать prompt/recipe/tool. Делать это вручную для трёх target-стеков (`core` / `renderer-react` / `renderer-json`) дорого и невоспроизводимо.

Нужен механизм, в котором:

- **Главный агент (orchestrator)** запускает на одной итерации `iter-N` три **sub-agent**'а параллельно — по одному на каждый target.
- **Sub-agent имитирует консумента MCP**: у него НЕТ доступа к каталогу `projects/`, нет права смотреть существующие `mcp-credit-application-*` примеры, нет права читать исходники `packages/`. Единственные источники правды — MCP-сервер (`mcp__reformer__*`-tools, prompts, resources) и `docs/specs/`. Это критично — мы проверяем **качество MCP**, а не способность Claude скопировать предыдущую итерацию.
- Каждый sub-agent: discovery через MCP → план → код → tsc/lint/build → Playwright walkthrough с full-page скриншотами на каждом шаге + видео → `dev-report.md` с метриками и MCP gaps.
- Orchestrator агрегирует три `dev-report.md` в `iter-summary.md` с метриками (tokens, time, errors, version), список patches для MCP, и решение stop/continue.
- Цикл: пользователь ревьюит patches, применяет к MCP вручную, заново запускает orchestrator с `iter+1`. Авто-применение patches — out of scope (риск порчи MCP без аудита).

Цель — превратить N→N+1 цикл из «3 часа ручной работы» в `/iter 12` + ревью summary.

---

## Архитектура (high-level)

```
[orchestrator: docs/iter-prompts/orchestrator.md]
  ├─ pre-flight: создать .tmp/iter-artifacts/iter-N/ + bd issues
  ├─ launch IN PARALLEL (one Agent message, 3 calls):
  │     ├─ sub-agent #1 — target=core             (Agent + general-purpose)
  │     ├─ sub-agent #2 — target=renderer-react   (Agent + general-purpose)
  │     └─ sub-agent #3 — target=renderer-json    (Agent + general-purpose)
  ├─ post-merge: обновить App.tsx routes (3 новых импорта)
  ├─ aggregate: 3× dev-report.md → docs/iter-summaries/iter-N.md
  ├─ verify: единый tsc/lint по playground
  ├─ patch-draft: предложить MCP-patches как git-ready diffs (НЕ применять)
  └─ stop check: gaps==0 OR iter>=MAX_ITER → finish, else handoff к юзеру
```

---

## Жёсткое правило для sub-agent'а (Sandboxed MCP-only)

Sub-agent работает **только** со следующими источниками:

**Можно**:
- `mcp__reformer__find_recipe`, `mcp__reformer__get_symbol_docs`, `mcp__reformer__report_issue`
- Любые prompts/resources, экспонированные MCP-сервером (load via slash-commands если есть)
- Чтение спеки: `docs/specs/<spec>.md` (read-only, см. CLAUDE.md)
- Чтение собственного `.tmp/iter-artifacts/iter-N/<target>/` (свой workspace)
- Запись кода в **новый** каталог `projects/react-playground/src/pages/examples/mcp-credit-application-{target}-v{N}/`
- Запись e2e-теста в `projects/react-playground-e2e/tests/mcp-credit-{target}-v{N}.spec.ts`
- Запуск tsc / eslint / playwright через Bash
- node_modules/@reformer/* (потому что это то, что видит реальный консумент через `npm install`) — но желательно избегать, спрашивать через MCP

**Нельзя** (orchestrator аудирует через grep по transcript'у):
- Read/Glob/Grep по `packages/` (исходники библиотек)
- Read/Glob/Grep по `projects/react-playground/src/pages/examples/` кроме своего нового каталога (нельзя смотреть на предыдущие итерации `v1..v{N-1}` или родственные `mcp-credit-application-*`)
- Read/Glob/Grep по `projects/react-playground/src/components/`, `projects/react-playground/src/factories/` и подобным «общим» helper'ам
- Любая правка `docs/specs/`
- `git commit` / `git push`

Если sub-agent понимает, что MCP не отвечает на нужный вопрос — он фиксирует gap в `dev-report.md` и продолжает с best-effort решением (или помечает блокер).

---

## Файлы для создания

### `docs/iter-prompts/orchestrator.md`
Промт главного агента. Принимает `{iter, max_iter?, spec?}`. Содержит:
- pre-flight checklist (folder, bd, App.tsx baseline)
- блок `Launch sub-agents in parallel` с 3 готовыми Agent-вызовами (target подставляется)
- alg агрегации dev-report → iter-summary
- алгоритм stop-check
- ссылка на template iter-summary

### `docs/iter-prompts/sub-agent.template.md`
Промт sub-agent'а. Принимает `{target, iter, spec_path}`. Шаги:
1. Sandbox-acknowledgement (распечатать что можно/нельзя — strict)
2. Discovery: вызвать `find_recipe` под ключевые сценарии формы (validation, computed, form-array, wizard, async-validator), `get_symbol_docs` для top-level символов
3. Планирование: dev-plan.md
4. Code generation: schema + index (или schema.json для renderer-json)
5. Validation loop: tsc → lint → build (max 3 self-fix attempts на каждом)
6. E2E: Playwright spec, 6 full-page скриншотов, video walkthrough
7. dev-report.md: metrics + MCP gaps + recipe usage + screenshot index

### `docs/iter-prompts/templates/dev-plan.template.md`
Шаблон dev-plan с разделами Discovery / Architecture / Open questions.

### `docs/iter-prompts/templates/dev-report.template.md`
Шаблон dev-report:
```md
# dev-report — target={target}, iter={N}

## Metrics
| metric | value |
|---|---|
| iter version | v{N} |
| target | {target} |
| tokens used | {orchestrator parses from agent meta} |
| wall time (min) | {start..end} |
| tsc errors (initial) | N |
| tsc errors (final) | N |
| lint errors (final) | N |
| runtime errors (e2e) | N |
| status | ok / partial / blocked |

## MCP gaps encountered
- gap-id: ... severity: high/med/low
  evidence: <quote from MCP response or absence>
  proposed fix: <patch direction>

## Recipes used
- find_recipe(...) → ...

## Screenshots
- screenshots/mcp-credit-v{N}/{target}/page1-initial.png
- ...

## Video
- videos/mcp-credit-v{N}/{target}/walkthrough.webm

## Blockers
- ...
```

### `docs/iter-prompts/templates/iter-summary.template.md`
Шаблон агрегатного отчёта.

### `docs/iter-summaries/.keep`
Каталог для агрегатных отчётов.

> Каталог `.tmp/iter-artifacts/` orchestrator'ом наполняется per-iter (`iter-{N}/{target}/dev-{plan,report}.md` + scratch). Сам `.tmp/` уже в корневом `.gitignore` (см. CLAUDE.md → File output locations), отдельный `.gitignore` не нужен.

---

## Файлы для изменения

### `projects/react-playground-e2e/playwright.config.ts`
- `use.video: 'on'` (или `'retain-on-failure'`, лучше `on` для walkthrough demo)
- `use.viewport: { width: 1440, height: 900 }` зафиксировать
- Принять env `ITER_OUTPUT_DIR` → `outputDir` (e.g. `screenshots/mcp-credit-v11/core/`)
- `reporter: [['html', { outputFolder: '.tmp/playwright-html' }], ['list']]`

### `projects/react-playground/src/App.tsx`
- Orchestrator пишет туда автоматически после успеха sub-agent'ов: 3 импорта + 3 route + 3 nav-item для текущего iter
- Старые iter (v1..v{N-1}) НЕ удаляются (история регрессии)
- Naming: `mcp-credit-application-{target}-v{N}` → route `/mcp-credit-application-{target}-v{N}`

### `.gitignore` (root)
```
+ projects/react-playground-e2e/videos/  # опционально — если не хотим пушить webm
```
(`.tmp/` уже в `.gitignore`, отдельная строка под iter-artifacts не нужна.)

### `CLAUDE.md`
Добавить раздел «Iter prompt system»:
- ссылка на orchestrator.md
- напоминание что sub-agent — sandboxed MCP-only
- запрет на правку iter-prompts промтов внутри iter-цикла (правки через отдельный PR)

---

## Логика orchestrator'а (детальная)

```pseudo
inputs: iter: number, max_iter?: number = 5, spec?: string = "credit-application-mcp.md"

# 1. pre-flight
assert iter > последнего существующего mcp-credit-application-core-v{N}
assert spec exists in docs/specs/
mkdir -p .tmp/iter-artifacts/iter-{iter}/{core,renderer-react,renderer-json}
mkdir -p projects/react-playground-e2e/screenshots/mcp-credit-v{iter}
mkdir -p projects/react-playground-e2e/videos/mcp-credit-v{iter}
bd create epic "iter-{iter} MCP regression"

# 2. launch in parallel — single message, 3 Agent calls
Agent(subagent_type="general-purpose",
      prompt=fill(sub-agent.template.md, target="core",
                                          iter=iter,
                                          spec_path=spec))
Agent(subagent_type="general-purpose",
      prompt=fill(sub-agent.template.md, target="renderer-react", iter, spec))
Agent(subagent_type="general-purpose",
      prompt=fill(sub-agent.template.md, target="renderer-json",  iter, spec))

# 3. wait all → каждый возвращает structured summary в return string

# 4. audit sandbox compliance
for each transcript:
   grep -q "Read.*packages/" → fail iter, mark sub-agent as "tainted"
   grep -q "Read.*projects/react-playground/src/pages/examples/.*v[0-9]" → same

# 5. App.tsx merge
inject 3 new examples + routes + nav-items (idempotent — если уже есть, skip)

# 6. aggregate
parse 3× dev-report.md → metrics table + gap list
write docs/iter-summaries/iter-{iter}.md from template

# 7. verify
cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json
npm run lint -w react-playground
# (e2e уже выполнен sub-agent'ами; тут — только sanity build)

# 8. patch draft
для каждого gap'а в summary с severity≥med:
   написать «proposed patch» — путь к файлу MCP, краткий diff
сохранить в .tmp/iter-artifacts/iter-{iter}/proposed-patches/

# 9. stop check
if (sum(gaps) == 0): print "iter-{iter} GREEN — MCP стабилен на этой спеке"
elif (iter >= max_iter): print "iter-{iter} STOP — лимит итераций, escalate"
else: print "iter-{iter} done. Review summary + patches, then run /iter {iter+1}"

# 10. handoff (НЕ commit)
print список изменённых файлов
print «следующие шаги для пользователя»
```

---

## Логика sub-agent'а (детальная)

```pseudo
inputs: target ∈ {core, renderer-react, renderer-json}, iter, spec_path

# step 0 — sandbox ack
print «Working in MCP-only sandbox. Forbidden: Read/Grep on packages/, projects/.../examples/<other>/»

# step 1 — discovery (NO file reads beyond spec)
spec = Read(spec_path)
recipes = []
for kw in [validation, computed, form-array, wizard, async-validator, target-specific]:
   recipes += mcp__reformer__find_recipe(topic=kw)
symbols = []
for sym in [createForm, FormProxy, FieldPath, ValidationSchemaFn, applyWhen, computeFrom, renderSchema (если target!=core)]:
   symbols += mcp__reformer__get_symbol_docs(symbol=sym)

# step 2 — planning
write .tmp/iter-artifacts/iter-{N}/{target}/dev-plan.md
   sections: form structure (из spec), planned files, recipes referenced, open questions

# step 3 — code gen
mkdir projects/react-playground/src/pages/examples/mcp-credit-application-{target}-v{N}/
case target:
  core: Write schema.ts (createForm, FormProxy, computeFrom, applyWhen) + index.tsx (FormWizard, FormArray, hooks)
  renderer-react: schema.ts (renderSchema) + index.tsx (<Renderer schema=...>)
  renderer-json: schema.json + index.tsx (<JsonRenderer schema=jsonSchema>)

# step 4 — validation
loop max 3:
   tsc → if errors:
      proceed: для каждой ошибки use MCP find_recipe / get_symbol_docs (NOT Read packages/)
      apply fix
      retry tsc
   lint similarly
   build similarly

# step 5 — e2e
write projects/react-playground-e2e/tests/mcp-credit-{target}-v{N}.spec.ts
test "walk through 6 steps":
   for page in 1..6:
      navigate / fill / next
      page.screenshot({ path: `screenshots/mcp-credit-v${N}/${target}/page${page}-{stage}.png`, fullPage: true })
   submit
playwright config выставит video на этот run в videos/mcp-credit-v{N}/{target}/walkthrough.webm

run: ITER_OUTPUT_DIR=screenshots/mcp-credit-v{N}/{target}/ \
     npx playwright test mcp-credit-{target}-v{N}.spec.ts

# step 6 — report
write .tmp/iter-artifacts/iter-{N}/{target}/dev-report.md
   metrics (tokens self-report N/A — orchestrator парсит из run-meta)
   MCP gaps section с конкретными цитатами «искал X через find_recipe — вернулось Y, не закрыло вопрос»
   recipes used / symbols queried
   screenshots index с ссылками
   video link
   blockers если есть

# step 7 — exit
return short structured summary для orchestrator'а:
   status / metrics-shorthand / gaps-count
```

---

## iter-summary.md схема

```md
# iter-{N} summary — {ISO date}

## Run metrics
| target | tokens | time (min) | tsc final | lint final | runtime | status |
|---|---|---|---|---|---|---|
| core | X | Y | 0 | 0 | 0 | ok |
| renderer-react | X | Y | 2 | 0 | 0 | partial |
| renderer-json | X | Y | 0 | 0 | 1 | ok |

## Aggregated MCP gaps (deduplicated by category)

### G1 [high] {category}
- targets affected: core, renderer-react
- evidence:
  > quote from sub-agent dev-report
- proposed patch direction: {short}

## Proposed patches (drafts)
- patch-iter{N}-1 → packages/reformer-mcp/src/prompts/templates/{file}.md
  rationale: ...
  diff: ```diff
  ...
  ```

## Verification
- npx tsc playground: PASS
- npm run lint -w react-playground: PASS
- App.tsx routes added: 3
- screenshots: 18 (6 × 3 targets)
- videos: 3

## Stop check
- gaps after dedup: N
- iter: {N} / {MAX}
- decision: continue → /iter {N+1} | stop (green) | stop (limit)

## Next session
- Review patches in .tmp/iter-artifacts/iter-{N}/proposed-patches/
- Apply manually to packages/reformer-mcp/
- Validate: cd packages/reformer-mcp && npm run build
- Re-run: /iter {N+1}
```

---

## Edge cases

| case | handling |
|------|----------|
| Sub-agent читает запрещённый путь (нарушает sandbox) | Orchestrator в шаге 4 grep'ом находит, mark dev-report как `status=tainted`, gap-list игнорируется (нечестные данные) |
| Sub-agent застрял в tsc-loop (3 try fails) | dev-report `status=blocked`, blocker в summary, screenshots пропускаются |
| App.tsx merge conflict (две одновременных модификации) | Orchestrator выполняет merge **после** всех 3 sub-agent'ов, sub-agent'ы App.tsx не трогают |
| Видеозапись забивает диск | `.gitignore`-ed videos/ + ротация: `find videos/ -mtime +14 -delete` в pre-flight |
| Скриншот случайно ушёл в repo root | Pre-flight + post-flight: `find . -maxdepth 1 -name 'page-*.png' -newer .tmp/iter-artifacts/iter-{N}/.start` → fail iter |
| Один и тот же gap из iter-{N-1} | В summary помечается `regression: true`, severity escalated |
| Спека была изменена между iter'ами | Orchestrator в pre-flight: `git diff HEAD~5 -- docs/specs/` → если spec менялся, в summary раздел «Spec drift» |
| MCP сервер недоступен | Sub-agent fail-fast в step 1, dev-report `status=blocked, reason="MCP unreachable"` |
| Sub-agent попытался commit | Sub-agent prompt запрещает; orchestrator проверяет `git log --since=<start>` → если новые коммиты от sub-agent → fail iter |
| Юзер вызвал /iter N + сразу /iter N+1 не ревьюя | Pre-flight: если iter-summaries/iter-{N-1}.md помечен `decision: continue` И patches в `proposed-patches/` не были применены (heuristic: ни один MCP файл не менялся между двумя iter'ами) → warn «MCP без правок — iter может зациклиться» |

---

## Verification (как проверить что система работает)

1. **Smoke (dry-run)**: создать только `docs/iter-prompts/*.md` файлы (без запуска), убедиться что промты внятные — `cat docs/iter-prompts/orchestrator.md | wc -l` ~150 строк, читается за 2 минуты.

2. **Mini-run (1 target)**:
   - Вручную (не через orchestrator) запустить sub-agent.template.md для target=core, iter=11
   - Проверить артефакты:
     - `.tmp/iter-artifacts/iter-11/core/dev-plan.md`, `dev-report.md` существуют
     - `projects/react-playground/src/pages/examples/mcp-credit-application-core-v11/{schema.ts, index.tsx}` существуют
     - `npx tsc --noEmit -p projects/react-playground/tsconfig.app.json` зелёный
     - `projects/react-playground-e2e/screenshots/mcp-credit-v11/core/page{1..6}-*.png` существуют, все fullPage (проверить размер ≥ 1440×900)
     - `projects/react-playground-e2e/videos/mcp-credit-v11/core/walkthrough.webm` существует
     - В transcript нет `Read.*packages/` (sandbox compliance)

3. **Full-run (3 targets, parallel)**:
   - Запустить orchestrator iter=11
   - Проверить всё выше × 3 + `docs/iter-summaries/iter-11.md` корректен (метрики не пустые, gaps структурированы)
   - App.tsx содержит 3 новых route, остальные iter не тронуты

4. **Patch loop**:
   - Применить 1 предложенный patch к MCP
   - Запустить orchestrator iter=12
   - В iter-12 summary: gap из iter-11 либо closed, либо severity downgraded

5. **Stop condition**:
   - При iter с gaps==0 orchestrator выводит «GREEN» и не предлагает iter+1

---

## Sequencing (как выкатывать)

| Step | Что | Почему отдельно |
|------|-----|-----------------|
| 1 | Создать `docs/iter-prompts/{orchestrator,sub-agent.template,templates/*}.md` + `docs/iter-summaries/.keep` | Pure docs, ничего не запускается, ревью промтов |
| 2 | Изменить `playwright.config.ts` (video + ITER_OUTPUT_DIR), `.gitignore` (видео опционально) | Инфраструктура для запуска |
| 3 | Mini-run iter=11 на target=core (manual, без orchestrator) | Валидация sub-agent промта end-to-end |
| 4 | Update CLAUDE.md (раздел про iter system) | Закрепить рабочий процесс после mini-run |
| 5 | Full-run iter=11 (orchestrator, 3 targets parallel) | Первая полная итерация |
| 6 | После 1-2 циклов — рефакторинг промтов на основании опыта | Нормальная стабилизация |

Каждый step — отдельный PR.

---

## Files to create — checklist

- [ ] `docs/iter-prompts/orchestrator.md`
- [ ] `docs/iter-prompts/sub-agent.template.md`
- [ ] `docs/iter-prompts/templates/dev-plan.template.md`
- [ ] `docs/iter-prompts/templates/dev-report.template.md`
- [ ] `docs/iter-prompts/templates/iter-summary.template.md`
- [ ] `docs/iter-summaries/.keep`

## Files to modify — checklist

- [ ] `projects/react-playground-e2e/playwright.config.ts` — video + dynamic outputDir + viewport
- [ ] `.gitignore` — добавить `projects/react-playground-e2e/videos/` (`.tmp/` уже включён)
- [ ] `projects/react-playground/src/App.tsx` — будет автоматически дополняться orchestrator'ом, baseline без изменений
- [ ] `CLAUDE.md` — раздел «Iter prompt system»

---

## Открытый вопрос (не блокирующий план — решается в PR)

**Как orchestrator получает token-метрики sub-agent'а?** Anthropic SDK не экспонирует напрямую. Опции:
- A. Sub-agent сам логирует в dev-report «approximate based on transcript size» (грубо)
- B. Использовать Claude Code transcript log в `.claude/projects/.../`-jsonl (post-hoc парсинг)
- C. Считать proxy-метрику: количество tool calls × wall time

Дефолт — **B** (jsonl парсинг по `tokensUsed` полю), fallback — A.
