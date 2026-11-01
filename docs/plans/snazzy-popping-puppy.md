# План: качество тестирования `@reformer/mcp` — сценарии, контракт формы, записи прогонов

## Context

Пользователь хочет поднять качество тестирования MCP-сервера: (1) сценарии от простого промта до
реализации по спецификации, (2) тесты поведения, валидации и внешнего вида сгенерированной формы,
(3) отчёты по прогонам для учёта и сравнения подходов. Дополнено: трассировка вызовов на стороне
сервера, повторы N + статистика, матрица «модель × подход × сценарий» с holdout, контракт Node
stdio-протокола, golden/property-based `generate_form`, проверка чувствительности приборов, гигиена.

Что уже есть (переиспользуем, не дублируем):

| Слой | Где | CI | Дыра |
|---|---|---|---|
| Юнит-тесты (25 файлов) | `packages/reformer-mcp/tests/` | да | нет теста Node stdio и промптов; тесты не типизируются; ~80 тихих `skipIf`; `report-issue.test.ts` мусорит 228 файлами |
| Retrieval eval, 61 задача | `eval/runner.mjs`, `npm run mcp:evaluate` | да, гейт | — |
| Калибровка T1–T6 | `eval/calibration/`, `npm run mcp:calibrate` | нет | **не закоммичена**; гейта против `calibration-baseline.json` нет |
| Сценарии билдера (qwen/gemma) | `assistant-scenarios-eval.test.ts` | нет | итоги переписываются в md руками |
| iter-цикл | `docs/iter-prompts/` | нет | ручной, `docs/iter-summaries/` удалён, последний запуск — июль |

Внешний агент (Claude Code и т.п.) автоматически через MCP не прогоняется вообще; POM кредитки
ждёт того, чего спека не задаёт (отсюда iter-18 1/63); единого формата прогона нет.

## Решения пользователя

- Агент сценариев — **оба через адаптер**: Claude Code headless + Ollama (qwen/gemma).
- Отчёты — **run-record JSONL в репо** (`docs/mcp-eval/runs/`) + `mcp:compare` + HTML-сводка.
- Вид формы — **гейт ARIA-снимком + axe**, fullPage-скриншоты — артефакт, не гейт.
- Делаем все 4 потока: A гигиена/протокол, B отчёты, C контракт формы, D сценарии.
- Калибровку **сначала закоммитить** отдельным коммитом (по явному «закоммить» пользователя);
  сгенерированные `mcp-calibration/<case>-<target>/` → `.gitignore`, коммитится только `index.tsx`.
- Claude — **подписка (OAuth) + `--restricted`** (не `--bare`); `costUsd` в записи условный,
  `agent.auth: "oauth"`.
- iter-цикл — **пометить устаревшим** после первого батча L5-credit (баннер отдельным изменением
  вне цикла); POM кредитки остаётся необязательной стадией `--reference-e2e credit`.
- Holdout-задания L1–L4 **пишет пользователь**; до тех пор holdout = страхование (`contaminated: partial`).

## Порядок фаз

0 → (A ∥ B1) → C → D. MVP каждой фазы даёт ценность сразу.

- **Фаза 0**: коммит калибровки (с разрешения), `.gitignore` слотов.
- **A (MVP)**: A1 утечка report_issue, A3 строгие предусловия, A4 контракт Node-сервера, A8 трассировка.
- **B (MVP)**: схема + записи из `mcp:evaluate`/`mcp:calibrate` + `mcp:compare` (Wilson/Fisher). HTML позже.
- **C (MVP)**: контракты loan + registration, стадии static + headless, самопроверка golden/negative. Браузер — вторым шагом.
- **D (MVP)**: адаптер `replay` (детерминированный, для CI) + Ollama, 6 сценариев, N=3.

## Поток A — гигиена, протокол, трассировка

1. **A1** `tests/report-issue.test.ts`: `beforeEach` ставит `REFORMER_ISSUE_REPORTS_DIR` во временный
   каталог; тест «project-root default» явно снимает переменную и делает `chdir`. Удалить
   `packages/reformer-mcp/.reformer/issue_reports` (gitignored).
2. **A2** `tests/tsconfig.json` (extends пакета, `moduleResolution: Bundler`, `noEmit`, include src+tests),
   скрипт `typecheck:tests`, шаг в CI. Ошибки чинить, не подавлять.
3. **A3** `tests/support/preconditions.ts` — `precondition(name, available, hint)`: при
   `REFORMER_TEST_STRICT=1` бросает вместо пропуска. Все `runIf`/`skipIf` переводятся на него;
   мета-тест следит; в CI шаг тестов MCP — со strict.
4. **A4** Минимальный рефактор: `createNodeServer({ debug, version, onCall })` из `src/index.ts`
   → `src/platform/cli/server.ts`. `tests/node-server.test.ts`: `InMemoryTransport` + SDK `Client` —
   `prompts/list` (7), `prompts/get` каждого, `InvalidParams` ×2, debug-гейтинг,
   `resources/templates/list`; плюс один stdio-тест на `dist/index.js` (версия = `package.json`).
5. **A5** `tests/surface-golden.test.ts`: `toMatchFileSnapshot` `{name, description, inputSchema}`
   tools/prompts/templates для профилей node и browser + потолок static-токенов (согласован с `baseline.json`).
6. **A6** Недостающие кейсы: RF007/RF008/RF009, C2, фильтры `list_symbols`, `get_symbol_docs` с
   `package`, `plan_form` с валидным `specPath` (фикстура loan).
7. **A7** Golden `generate_form`: 3 intent (loan, registration, credit) × 3 таргета в
   `tests/__golden__/generate-form/`; property-based на `fast-check` (devDep): случайный FormIntent →
   кросс-проверка чиста, `readIntent` без потерь, детерминизм; `tsc` по 10 сидам — в `test:slow`.
8. **A8** Трассировка: `mountReformerServer(server, catalogs, options = {})` с `onCall?`; без хука —
   те же обработчики (ноль накладных, проверяется тестом). `src/platform/cli/trace-sink.ts`:
   `REFORMER_TRACE_FILE` → JSONL `{ts, seq, kind, name, argumentsChars, argumentsDigest,
   argumentsPreview≤300, resultChars, isError, durationMs}`. Промпты тоже трассируются.
9. **A9** `eval/calibration/compare.mjs`: `metrics.json` vs `calibration-baseline.json`
   (числители не падают, ошибки tsc/layout/code не растут, smoke.fail пуст); `run.mjs --gate`,
   `--save-baseline`; путь сервера переопределяется `REFORMER_MCP_SERVER`. Новый workflow
   `.github/workflows/mcp-quality.yml` (ночью + вручную + push в main): калибровка без `--e2e`,
   `mcp:verify --golden`, `mcp:scenarios --agent replay`.
10. **A10** `npm run mcp:mutate`: `eval/mutations/catalog.json` `{id, file, find, replace, expectRedIn[]}`;
    копия `dist`/llms в `.tmp/mcp-mutants/<id>/`, патч копии, прогон приборов с `--server`.
    Статусы killed/survived/stale (stale — ошибка каталога). ≥8 стартовых мутантов (алиас wizard,
    computeFrom↔copyFrom, без `required`, без раскладки в llms.txt, разбор «Мин/Макс», маппинг
    RF, перепутанные подписи → `browser.aria`; снятый `testId` — задокументированный выживший).
11. **A11** Поправить комментарий `.github/workflows/test.yml` (~137–141: «61 задача»,
    `docs/mcp-eval/baseline.json`).

## Поток B — run-record, сравнение, отчёт

**Схема** `reformer-mcp-run/1`, одна JSONL-строка на прогон (≤2 КБ, калибровка ≤6 КБ, лимит — тестом):
`runId, batchId, harness (retrieval|calibration|builder|scenario), startedAt, durationMs,
source{gitSha, branch, dirty, dirtyDigest}, server{channel, version, surfaceDigest, buildDigest,
knowledgeDigest, staticTokens}, agent{kind, model, auth, settings}, approach{id},
scenario{id, level, target, split, contractDigest}, repeat{index, of}, verdict (pass|fail|invalid),
exitReason, score, gates[], checks{id: "pass" | ["fail", "≤200 симв."]}, metrics[{id, value|hit/total,
better}], usage{input/output/reasoning/cacheRead tokens, costUsd, turns, toolCalls, toolErrors},
toolSequence, artifacts{runDir}, host`. `invalid` (прибор сломался) в статистику не входит.

**Хранение**: всегда `.tmp/mcp-runs/<batchId>/records.jsonl` + сырьё; в git — только по `--publish`:
`docs/mcp-eval/runs/<YYYY>/<batchId>-<harness>-<label>.jsonl`, `runs/baselines.json` (алиасы),
`runs/README.md`. Существующие `baseline.json`/`calibration-baseline.json` не трогаем.

**Адаптеры**: `eval/runner.mjs` и `eval/calibration/run.mjs` в конце пишут запись (`checks` — по
задаче / по проверке smoke и T2, `metrics` — из `buildMetrics` с разбором `"x/y"`), флаг `--publish`.
Харнесс билдера не трогаем — `eval/records/import-builder.mjs` конвертирует `.tmp/eval/form-scenarios-*.json`.

**`npm run mcp:compare -- A B [--group …] [--gate] [--md file] [--show-holdout]`**: шапка — различия
sha и трёх отпечатков; по ячейке `(harness, scenario, target, model, approach)` — k/n, Wilson 95%,
Δ, точный тест Фишера, медианы токенов/стоимости; перевороты checks; pass@1, несмещённый pass@k,
pass^k; holdout — только агрегатом. `--gate` — exit 1 при значимой регрессии tuned или ухудшении
детерминированной метрики. В выводе честно: при N=3 значим только 0/3↔3/3, для решений N=5.

**`npm run mcp:report`** → самодостаточный `.tmp/mcp-eval/report/index.html` (inline CSS/SVG): тренды,
тепловая карта «сценарий × модель/подход», стоимость, holdout-агрегат. Строится из закоммиченных JSONL.

## Поток C — контракт и верификатор формы

**Контракт** `reformer-mcp-contract/1` = форма `facts.json` калибровки + `bind{path, label-regex}` +
`sample` + `probes[]`. Проба: новая форма → `sample` → `set` (для массивов `{push: {...}}`) → `tick()`
→ `validateModel` → ожидания `valid | invalid[] | errorCode{} | disabled[] | enabled[] | values{} |
arrayLength{}`; `hidden[]`/`readonly[]` — только `where: "browser"` (`hideWhen` исполняет рендерер).
`gate: true` делает пробу гейтом. MVP-контракты: L5-loan (утверждения `form-from-spec.test.ts:569-649`),
L5-registration (`cases/registration/facts.json` + пробы), затем L5-credit (`credit/facts.json` + ~15 проб).

**`npm run mcp:verify -- --dir <bundle> --contract <file> [--browser] | --golden | --negative`**:

- **static**: `workspace.entry` (gate: `form/index.tsx` экспортирует компонент), `workspace.layout`
  (`validate_form kind=layout`), `static.tsc` (gate; `typecheck` вынесен из
  `calibration/lib/bundle.mjs` в `eval/lib/typecheck.mjs`), `static.validateCode` (`parseValidate`
  из `tracks.mjs`). Бандл копируется в `.tmp/mcp-runs/…/bundle/` внутри репо (резолв `@reformer/*`).
- **headless**: дочерний процесс `node --import tsx eval/verify/runtime-child.mjs` с таймаутом.
  Общий хелпер `eval/lib/form-runtime.mjs` вынесен из `form-from-spec.test.ts:512-567`
  (`createFormFromModel`, `validateModel`, `tick`, шаги flow); `form-from-spec` переводится на него.
  Проверки `runtime.load` (gate), `runtime.structure.fields|arrays|steps` (пути из
  `createFormModel()`, подписи из `formSchema`), `runtime.probe.<id>`.
  Неканоничная раскладка (нет `model.ts`/`createFormModel`) → headless `fail` с причиной `nonCanonical` —
  это честный дефект MCP (гайд сервера требует раскладку).
- **browser** (пакетно на батч): монтирование по образцу `calibration/runtime.mjs` в
  `projects/react-playground/src/pages/debug/mcp-scenarios/<slot>/module/` + общий `Page.tsx`
  (ErrorBoundary, `data-testid="scenario-root"`), `index.tsx` с `import.meta.glob`, маршрут в
  `App.tsx`, слоты в `.gitignore`. Проект Playwright `mcp-scenarios` (при `MCP_SCENARIO_MANIFEST`),
  один спек `tests/mcp-scenarios/scenario-contract.spec.ts`: `browser.render` (gate),
  `browser.aria` (gate, `toMatchAriaSnapshot(строка)` — выводится из контракта или
  `expected.aria.yml`, т.к. `*.spec.ts-snapshots` в `.gitignore`), `browser.axe` (gate,
  serious/critical через `tests/shared/a11y.ts`), скриншот →
  `projects/react-playground-e2e/screenshots/mcp-scenarios/<batchId>/<slot>.png`, `browser.probe.*`.
  `playwright()`/`flatten()` выносятся из `runtime.mjs` в `eval/lib/playwright.mjs`.
  Таблица ролей ui-kit `eval/contracts/aria-roles.json` — спайк C5 через `ariaSnapshot()` на демо.
- **Самопроверка**: `--golden` — `generate_form(reference.intent)` каждого tuned-сценария × таргета
  зелёный; `--negative` — фикстуры `eval/verify/fixtures/negative/*` роняют заранее известный check id.

## Поток D — лестница сценариев и раннеры

**Раскладка** `packages/reformer-mcp/eval/scenarios/`: `README.md`, `_shared/output-convention.md`
(«результат в `form/`, точка входа `form/index.tsx`, ничего не ставь», таргет словами),
`_shared/workspace/package.json` (фиктивный потребитель — `project-detector` смотрит в cwd),
`approaches.json`, `matrices/{smoke,nightly-ollama,claude-full}.json`, `<id>/{scenario.json, prompt.md,
contract.json, reference.intent.json, expected.aria.yml?}`, `holdout/…`. Для L5 раннер **копирует**
спеку в рабочую область как `spec.md` (`docs/specs/` read-only).

**Лестница** (MVP помечен ★):

| id | Ур. | Таргет | Задание |
|---|---|---|---|
| L1-feedback ★ | 1 | renderer-react | «Сделай форму обратной связи: имя, email и сообщение.» |
| L1-login | 1 | core | «Форма входа: логин и пароль, оба обязательны.» |
| L2-registration-lite ★ | 2 | renderer-react | email (формат), пароль ≥8, повтор (совпадает), возраст 18–120 |
| L2-profile-json | 2 | renderer-json | ФИО 2–100, телефон-маска, дата рождения, город из списка; всё обязательно |
| L3-delivery ★ | 3 | renderer-react | `deliveryMethod` pickup/delivery; при delivery — `address`, `deliveryDate` видимы и обязательны |
| L3-order-total ★ | 3 | core | `price`, `quantity`, `discount` 0–50; `total` = price×qty×(1−d/100), read-only |
| L4-contacts-array ★ | 4 | renderer-react | массив `contacts` {name, phone} обязательны, 1–5 строк |
| L4-wizard-3steps | 4 | renderer-react | мастер 3 шага, нельзя дальше без заполнения шага |
| L5-loan ★ | 5 | core | по `spec-loan-request.md` |
| L5-registration | 5 | renderer-json | по `calibration/cases/registration/spec.md` |
| L5-credit | 5 | все 3, `heavy` | по `credit-application-form.md` (заменяет iter-цикл) |
| L5-insurance | 5 | renderer-react | holdout, `contaminated: partial` |
| holdout L1–L4 ×4 | 1–4 | разные | **пишет пользователь** |

С L3 в задании названы технические id полей и значения enum (пробам нужна привязка); в L1–L2
контракт связывает по подписи. Holdout запускается только с `--include-holdout`, в отчётах —
агрегатом, его провалы не становятся материалом для правок сервера.

**Интерфейс адаптера** `eval/agents/*.mjs`: `runAgent({scenario, workspaceDirectory, prompt, model,
approach, serverPath, traceFile, limits}) → {transcriptPath, toolCalls[], usage, costUsd, durationMs,
exitReason, finalText, isolation{ok, problems}}`. Адаптеры: `replay` (копирует
`generate_form(reference.intent)` — CI и отладка), `ollama`, `claude-code`.

**Раннер** `npm run mcp:scenarios -- --matrix <file> | --agent … --model … --approach … --scenario 'L3-*'
--repeats N --concurrency K --max-usd-batch X --server <dist> --include-holdout --browser --publish`:
рабочая область в `os.tmpdir()/reformer-mcp-runs/<batch>/<run>/` (вне репо), сырьё в
`.tmp/mcp-runs/<batch>/<run>/` (prompt, transcript, server-trace, bundle, verify.json); static +
headless сразу, браузер — одним запуском Playwright на батч. Бюджет батча останавливает
планирование (остаток → `invalid/budget`); таймаут убивает дерево процессов (`treeKillCommand` из
`scripts/run-vitest-verdict.mjs`); после батча — поиск сирот (`serverProcesses` из `smoke.mjs` →
`eval/lib/processes.mjs`). Параллельность: Claude 2–3, Ollama 1.

**Claude Code** (OAuth): `claude -p --output-format stream-json --verbose --model <m>
--mcp-config <runDir>/mcp.json --strict-mcp-config --restricted --tools "Read,Write,Edit,Glob,Grep"
--allowedTools "mcp__reformer__*,Read,Write,Edit,Glob,Grep" --permission-mode acceptEdits
--permission-prompts none --disable-slash-commands --no-session-persistence --max-budget-usd <cap>`,
cwd = рабочая область, задание через stdin. `mcp.json` запускает `process.execPath
packages/reformer-mcp/dist/index.js` с `REFORMER_TRACE_FILE` и `REFORMER_ISSUE_REPORTS_DIR` в runDir.
**Канарейка** по `system/init`: cwd вне репо, tools ⊆ разрешённых, MCP = только `reformer`
connected — иначе `invalid`. Из `result`: `total_cost_usd`, `usage`, `num_turns`, `subtype`.
**Спайк D4.0**: `--max-turns` в `--help` нет (ограничиваем бюджетом и таймаутом); проверить,
подмешивается ли `~/.claude/CLAUDE.md` при `--restricted`.

**Ollama**: без AI SDK (в корне `ai@5`, у билдера `ai@7` — несовместимо) — нативный
`POST /api/chat` через `fetch` + SDK `Client` + `StdioClientTransport` (cwd = рабочая область);
локальные `read_file`/`write_file`/`list_files` с защитой пути; `maxSteps`, `think`, `num_ctx`;
токены из `prompt_eval_count`/`eval_count`; усечение старых ответов инструментов до 1500 символов
(метрика `harness.truncations`); детектор текстовых вызовов — перенос трёх регулярок из
`textual-call.ts` (не импортом), одно подталкивание, метрика `process.textualCalls`.
Перед батчем — проверка `/api/tags`.

**Подходы** (`approaches.json`): `bare`, `prompt-create-form` (раннер сам берёт
`prompts/get create-form` и отдаёт одинаковый текст обоим агентам), `start-here`, `no-generate`
(без `generate_form`). A/B сборок — `--server <другой dist>` (видно по `buildDigest`).
Метрики процесса из `server-trace.jsonl`: `mcpCalls` по инструментам, `mcpErrors`,
`mcpResultChars`, `repeatedCalls`, `validatedBeforeFinish`.

## Файлы

**Изменить**: `packages/reformer-mcp/src/core/server/mount.ts`, `src/index.ts`, `eval/runner.mjs`,
`eval/calibration/{run.mjs, lib/inspector.mjs, lib/bundle.mjs, runtime.mjs}`,
`tests/{report-issue,form-from-spec}.test.ts` и тесты с `runIf/skipIf`,
`projects/react-playground/src/App.tsx`, `projects/react-playground-e2e/playwright.config.ts`,
`.gitignore`, корневой `package.json` (скрипты `mcp:compare|report|verify|scenarios|mutate`),
`packages/reformer-mcp/package.json` (devDeps `tsx`, `fast-check`; `typecheck:tests`, `test:slow`),
`.github/workflows/test.yml`.

**Создать**: `src/platform/cli/{server,trace-sink}.ts`; `tests/{tsconfig.json, support/preconditions.ts,
node-server, surface-golden, trace, generate-form-golden, generate-form-property, run-record,
eval-stats}.test.ts` + `__golden__/`; `eval/lib/{typecheck,form-runtime,processes,playwright}.mjs`;
`eval/records/{schema.json,record,stats,compare,report-html,import-builder}.mjs`;
`eval/contracts/{schema.json,aria-roles.json,derive-aria.mjs}`; `eval/verify/{index,static,runtime-child,
probes,browser}.mjs` + `fixtures/negative/`; `eval/scenarios/**`; `eval/agents/{claude-code,ollama,
replay,textual-call,workspace-tools}.mjs`; `eval/mutations/{catalog.json,run.mjs}`;
`eval/calibration/compare.mjs`; `projects/react-playground/src/pages/debug/mcp-scenarios/index.tsx`;
`projects/react-playground-e2e/tests/mcp-scenarios/scenario-contract.spec.ts`;
`.github/workflows/mcp-quality.yml`; `docs/mcp-eval/runs/{README.md,baselines.json}`, `docs/mcp-eval/scenarios.md`.

**Переиспользовать**: `McpClient`, `estimateTokens` (`eval/lib/client.mjs`); `inspect`, `pool`, `textOf`
(`calibration/lib/inspector.mjs`); `parseGenerateForm`, `writeBundle`, `typecheck`
(`calibration/lib/bundle.mjs`); `normalizeFacts`, `ruleName` (`calibration/lib/score.mjs`);
`parseValidate` (`calibration/tracks.mjs`); `pageTsx`, `playwright`, `flatten` (`calibration/runtime.mjs`);
`serverProcesses` (`calibration/smoke.mjs`); `treeKillCommand` (`scripts/run-vitest-verdict.mjs`);
`checkA11y` (`react-playground-e2e/tests/shared/a11y.ts`); `buildBundle`, `readIntent`
(`src/core/generate/`); `createToolCatalog`, `createResourceCatalog`, `mountReformerServer`.

## Verification

- **A**: `npm run build -w @reformer/mcp`; `REFORMER_TEST_STRICT=1 npm run test -w @reformer/mcp` —
  0 пропусков, `.reformer/issue_reports` не появился; без `dist/` strict-прогон падает с текстом
  предусловия; `npm run typecheck:tests -w @reformer/mcp` — 0; правка описания инструмента роняет
  `surface-golden`; `REFORMER_TRACE_FILE=.tmp/trace-check.jsonl npm run mcp:evaluate` — строк = вызовов,
  без переменной вывод побайтно прежний; `npm run mcp:calibrate -- --gate` — exit 0, на завышенном
  baseline — exit 1; `npm run mcp:mutate` — все killed, кроме задокументированных.
- **B**: `mcp:evaluate -- --publish`, `mcp:calibrate -- --publish` дают JSONL, проходящие
  `run-record.test.ts`; `mcp:compare X X` — «без изменений»; тесты stats: Wilson 0/5 → [0, 0.43],
  Fisher 0/5 vs 5/5 → p≈0.0079; `mcp:report` строит HTML с трендом из ≥2 батчей.
- **C**: `mcp:verify -- --golden` — все tuned × таргеты зелёные (static+headless); `--negative` —
  каждая фикстура роняет свой check; `--golden --browser --scenario L5-registration` — aria и axe
  зелёные, скриншот в `screenshots/mcp-scenarios/golden/`; `form-from-spec` зелёный на хелпере.
- **D**: `mcp:scenarios -- --agent replay --scenario 'L*'` — все tuned pass (детерминированно);
  `--agent ollama --model qwen3.8:27b-32k --scenario L1-feedback` — запись есть, трасса непуста;
  `--agent claude --model sonnet --scenario L1-feedback --canary` — изоляция ok; затем батчи по
  матрицам с `--max-usd-batch` и `--publish`.

## Beads: эпик «MCP: качество тестирования — сценарии, контракт формы, записи прогонов»

| # | Задача | Приёмка | Зависит |
|---|---|---|---|
| 0.1 | Коммит калибровки, `.gitignore` слотов | калибровка в git, слоты игнорируются | — |
| A.1 | report_issue: тесты во временный каталог | после тестов каталога нет | — |
| A.2 | tsconfig тестов + `typecheck:tests` в CI | 0 ошибок | — |
| A.3 | Строгие предусловия | 0 артефактных пропусков в CI | — |
| A.4 | `createNodeServer` + контракт Node-сервера | промпты, InvalidParams, debug, templates, версия | — |
| A.5 | Golden поверхности + потолок токенов | правка описания роняет тест | A.4 |
| A.6 | RF007/8/9, C2, фильтры, specPath | позитив+негатив на каждый | — |
| A.7 | Golden + property-based `generate_form` | 3×3 снимка, 200 итераций без ошибок | 0.1 |
| A.8 | Трассировка `REFORMER_TRACE_FILE` | off — те же обработчики; on — строк = вызовов | A.4 |
| A.9 | Гейт калибровки + `mcp-quality.yml` | `--gate` красный при ухудшении | 0.1 |
| A.10 | Мутанты чувствительности | ≥8, выжившие задокументированы | A.9, C.3 |
| A.11 | Комментарий CI; баннер устаревания iter-цикла (вне цикла) | после первого батча L5-credit | D.7 |
| B.1 | Схема run-record + библиотека (git, отпечатки) | JSON Schema + тест размера | — |
| B.2 | Записи из evaluate/calibrate, импорт билдера | 3 харнесса, `--publish` | B.1, 0.1 |
| B.3 | `mcp:compare` + stats | тесты статистики, X vs X пусто | B.1 |
| B.4 | HTML `mcp:report` | тренды + матрица | B.3 |
| C.1 | Формат контракта + контракты loan/registration/credit | схема + 3 контракта | 0.1 |
| C.2 | Хелперы typecheck + form-runtime | form-from-spec на хелпере | 0.1 |
| C.3 | Верификатор static/headless/пробы | golden зелёный, negative падает | C.1, C.2 |
| C.5 | Спайк: роли ARIA ui-kit | `aria-roles.json` сверен | — |
| C.4 | Браузерная стадия (ARIA, axe, скриншот) | L5-registration golden зелёный | C.3, C.5 |
| D.1 | Формат сценария + 6 MVP с эталонами | `verify --golden` 6/6 | C.3 |
| D.2 | Раннер + replay | replay 6/6 pass, записи валидны | B.1, A.8, D.1 |
| D.3 | Адаптер Ollama | L1–L3 на qwen проходят цикл | D.2 |
| D.4 | Адаптер Claude Code + канарейка (спайк флагов) | канарейка ok, стоимость в записи | D.2 |
| D.5 | Остальные tuned-сценарии + страхование; места под holdout пользователя | эталоны tuned зелёные | D.1 |
| D.6 | Подходы + A/B сборок | одинаковый текст обоим агентам | D.3, D.4 |
| D.7 | Первые базовые батчи + `docs/mcp-eval/scenarios.md` | опубликованы батчи qwen и Claude, compare/HTML строятся | D.6, C.4, B.4 |

## Риски

- **Стоимость/лимит подписки Claude**: `--max-budget-usd` на прогон и `--max-usd-batch` на батч;
  первый батч — калибровочный (L1–L3, N=1); LLM-прогоны никогда не в CI.
- **Ollama**: 32k мало для L5 — красный L5 на локальных моделях — данные, не поломка прибора.
- **Нестабильность**: N=3–5, Wilson/Fisher/pass^k вместо одиночных вердиктов.
- **Windows**: `child.kill()` не убивает дерево → `taskkill /T /F` и поиск сирот; задание через
  stdin (предел командной строки); после TaskStop фоновых задач проверять порт и процессы
  (vite, playwright). Слоты монтировать до старта Playwright.
- **Изоляция Claude под OAuth**: без `--bare` возможен подмес `~/.claude/CLAUDE.md` — канарейка
  обязательна, спайк D4.0 это проверяет.
- **Контракты как прибор**: невыполнимый контракт валит честную работу — поэтому обязательный
  `reference.intent.json` и `verify --golden` в `mcp-quality.yml`.
- **Рабочее дерево**: много чужих незакоммиченных правок (билдер, src MCP) и параллельные сессии —
  коммиты только по явной просьбе, через `git commit -F файл -- пути`; спеки `docs/specs/` read-only.
