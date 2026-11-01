# Калибровка MCP-сервера `@reformer/mcp`: внешние агенты и ассистент конструктора

## Context

Цель — откалибровать MCP-сервер так, чтобы с его помощью можно было создавать **и простые формы
с валидацией и поведением, и сложные многошаговые** (визард, массивы, вычисляемые поля, условная
видимость). Эталоны — рабочие формы `projects/react-playground` с их e2e-наборами и эталонные
наборы кодогенерации конструктора. Главный инструмент замера — MCP Inspector CLI
(`npx -y @modelcontextprotocol/inspector@2.12.0 --cli`): детерминированно, без LLM в контуре.

**Что изменила работа над ассистентом конструктора (23–27.10)** — теперь у сервера два потребителя:

1. **Внешние агенты** (Claude Code и др.) — stdio-сервер `packages/reformer-mcp/dist/index.js`,
   профиль `node`, регистрация в `.mcp.json`.
2. **Ассистент конструктора** (`projects/reformer-builder-playground/.ui_builder/plugins/`):
   - бандл сервера в Web Worker (`4f39340a`, `.ui_builder/mcp/reformer/server.js`, собирает
     `npm run mcp:build`), профиль `browser`: без `report_issue`/`debug`, `plan_form` без
     `specPath`, без промптов. Модель зовёт его через фасад `mcp_tools`/`mcp_call` плагина
     `forms/mcp`; ответ длиннее `ANSWER_BUDGET = 1400` символов режется
     (`forms/mcp/src/assistant/format.ts:19`), остаток модель дочитывает `read_resource`;
   - встроенная справка `ask_reformer` → `askReformer` (`packages/reformer-mcp/src/core/facade.ts`)
     и проверка кода `checkCode` → `validateCode` (`src/core/validate/code.ts`) — барьер записи
     режима файлов (`plugins/reformer/ai/src/knowledge/mcp-reference.ts`);
   - правила формы живут в коде модуля, раскладка `folders` (`validation/form.ts`,
     `validation/<шаг>.ts`, `behavior/index.ts`, `validation/messages.ts`, `constants/`);
     эталоны печати — 17 наборов `plugins/reformer/codegen/src/pipeline/__golden__/`.
   - Замер на живой модели (`docs/mcp-eval/builder-form-scenarios.md`): qwen 18/19, gemma 16/19,
     только структурный режим. Открыто по MCP: **ReFormer-kbs4** (ложные RF002/RF005 у
     `validateCode` на коде кодогенерации — бьёт по барьеру записи), ReFormer-pihy, k1zf, dfl, 3yx2.

**Чего не хватает:** `eval/` (`npm run mcp:evaluate`, стратегии `v6-choose`, `builder-facade`)
мерит только извлечение знаний; юнит-тесты работают на фикстуре; `assistant-scenarios-eval`
мерит ассистента целиком. **С эталонными формами никто не сверяет**, и бандл воркера извне
не проверяется. Пределы конвейера, видимые по коду (гипотезы, подтверждаем замером): анализатор
спеки знает только `required/email/minLength/maxLength/min/max` и «Условное (при x='y')»
(`src/core/spec/analyze.ts:402-482`); вычисляемые поля → предупреждение
(`src/core/generate/from-spec.ts:141-147`); `visibility`/`dataSources` не заполняются;
`generate_form` не проверяет имена валидаторов (`builders.ts:331-345`); `hideWhen` для `core` не
печатается (`builders.ts:1003-1010`).

Решения пользователя: **замер + правки** в `packages/reformer-mcp` (каждый пробел — задача bd);
**все три таргета**; **стенд в репозитории**; **оба канала**; **живая модель — выборочно после
правок**.

## Каналы и способ замера

| Канал | Потребитель | Как гоняем |
|---|---|---|
| stdio `dist/index.js`, профиль node | внешние агенты | Inspector CLI напрямую |
| бандл `.ui_builder/mcp/reformer/server.js`, профиль browser | ассистент через `mcp_call` | Inspector CLI через stdio-переходник `worker-stdio.mjs`: бандл в `node:vm` с `self`, как `tests/worker-bundle.test.ts:31-64`; строка stdin ↔ кадр `postMessage` |
| `askReformer` / `validateCode` | `ask_reformer`, барьер записи режима файлов | прямой вызов из стенда (импорт из `dist/core/…`, как в `mcp-reference.ts`) + `mcp:evaluate --strategy builder-facade` |

## Эталоны

| Кейс | Роль | Источник | e2e / критерий |
|---|---|---|---|
| `registration` | простая: валидация + поведение | `react-playground/src/pages/demo/registration-form-renderer-json/` (8 полей, required/email/minLength/pattern, `cross`, 2× `validateAsync`, `onChange`); спека-фикстура выводится из формы — в стенде, **не** в `docs/specs/` | `tests/pages/registration-form-json/registration-form-json.spec.ts` |
| `credit` | сложная многошаговая | спека `docs/specs/credit-application-form.md` (read-only); форма `src/pages/demo/complex-multy-step-form/` (6 шагов, ~75 полей, 3 массива) + `complex-multy-step-form-renderer-json/` | `tests/pages/complex-multy-step-form/` (POM `CreditFormPage`, проекты `iter-*`, `playwright.config.ts:235-262`) |
| `codegen-golden` | код, который пишет ассистент | 17 наборов `__golden__/` (plain/rich/wizard/parts/rows, с правилами и без) | `validate_form`/`validateCode` без ложных ошибок, `kind=layout` принимает раскладку |
| `behaviors` | каталог операторов (содержание) | `src/pages/demo/behaviors/BehaviorsExamples.tsx:251-272` | — |
| `scenarios` | формулировки пользователей ассистента | `projects/reformer-builder/docs/assistant-form-scenarios.md` §5–10 | источник `operators.json` |
| `insurance` | holdout, **не подгоняем** | `docs/specs/insurance-application-form.md` | только метрики T1/T2 |
| `loan` | регрессия | `packages/reformer-mcp/tests/fixtures/spec-loan-request.md` | — |

Сравнение с формами playground — **семантическое** (поля, шаги, массивы, правила, поведение,
видимость), не пофайловое: раскладки у них разные.

## Стенд: `packages/reformer-mcp/eval/calibration/`

```
cases/<case>/facts.json    эталонные факты из кода формы: fields[path,type,step], steps[],
                           arrays[name,itemFields], validation[target,rule,when,cross,async,each],
                           behavior[kind,target,sources], visibility[selector,dependsOn], dataSources[]
cases/<case>/intent.json   полная FormIntent эталона — проверка выразительности generate_form
cases/registration/spec.md спека-фикстура простой формы
operators.json             «требование RU/EN → оператор»: формулировки сценариев §5–10, behaviors,
                           credit; то, чего нет в eval/corpus/03-behaviors.json
worker-stdio.mjs           stdio-переходник к бандлу воркера
run.mjs                    драйвер: Inspector CLI по двум каналам (--channel node|worker|both),
                           прямые вызовы askReformer/validateCode; сырые ответы → .tmp/mcp-calibration/<run>/
score.mjs                  сверка с facts, извлечение файлов, tsc, метрики → metrics.json + report.md
```

Плюс `docs/mcp-eval/calibration.md` (метод), `docs/mcp-eval/calibration-baseline.json`, в корневом
`package.json` — `"mcp:calibrate": "node packages/reformer-mcp/eval/calibration/run.mjs"`.

- Node (`.mjs`), как `eval/runner.mjs`; версия Inspector закреплена в `run.mjs`, без devDependency.
- `specPath` — абсолютный (резолвится от cwd сервера, `src/platform/cli/spec-source.ts`).
- intent из `plan_form` — регэкспом по блоку ```` ```json ````, в `generate_form` — через
  `--tool-args-json`; файлы бандла — по `### \`path\`` + код-блок
  (`src/core/tools/generate-form.ts:152-154, 196-316`).
- tsc бандла — как `tests/form-from-spec.test.ts:316` (`ts.createProgram`, резолв от пакета).

## Этап 0 — подготовка и протокольный smoke

1. `git status docs/specs/` пуст. Незакоммиченные правки ассистента в рабочей копии (qsm8.12:
   `plugins/reformer/ai/src/loop/prompt.ts`, `tools/insert-node.ts`, замер и docs) — чужая текущая
   работа, не трогаем.
2. Сборка: `npm --prefix packages/reformer-mcp run build` (dist старше `4f39340a`) и бандл
   конструктора `npm --prefix projects/reformer-builder-playground run mcp:build`.
3. `run.mjs --smoke`, оба канала: `initialize` (имя/версия); `tools/list --strict` (exit 0;
   node — 10 инструментов в порядке `tests/server-catalog.test.ts:16`, worker — без
   `report_issue`/`debug`, у `plan_form` нет `specPath`); `resources/list`/`read` (`guide`,
   валидный `catalog`, выборка секций); prompts — только node (без sampling `plan-form`,
   `create-form`, `discover-context` деградируют штатно), worker — `prompts/list` отвечает
   «нет возможности»; негативы (неизвестные имена, пропущенные обязательные аргументы → `isError`,
   не падение; `review` без `code`); debug-режим node (`-e REFORMER_DEBUG=true`); регистрация из
   `.mcp.json`; нет висящих процессов. `report_issue` — с
   `-e REFORMER_ISSUE_REPORTS_DIR=.tmp/mcp-calibration/issue-reports`.
4. **Паритет каналов:** одинаковые вызовы (`choose_api`, `find_recipe`, `validate_form`,
   `generate_form`) дают одинаковые ответы; расхождение = устаревший корпус бандла или ветвление
   ядра по профилю.

## Этап 1 — базовый замер (`npm run mcp:calibrate`)

- **T1 спека → intent** (`plan_form`; node — по `specPath`, worker — по тексту спеки в
  `description`): recall/precision полей, шаги и распределение полей, массивы и поля строк, recall
  правил по видам, поведение и видимость, число «не разобран».
- **T2 intent → бандл** (`generate_form`): {intent из plan_form, эталонная} × 3 таргета —
  cross-check C1–C10, потери intent, `validate_form` `code`/`layout`/`bundle`, ошибки tsc.
- **T3 рантайм**: бандлы из эталонных intent монтируются в playground
  (`src/pages/debug/mcp-calibration/<case>-<target>/`, 4 правки `App.tsx`). credit — маршруты
  `/mcp-credit-application-<target>-vcal`, `MCP_ITER_VERSION=cal`, все спеки
  `complex-multy-step-form/`, кроме loading-error, visual, performance, accessibility.
  registration — тот же спек с путём из env (единственная правка теста:
  `process.env.REG_FORM_PATH ?? '/demo/registration-json'`).
- **T4 подбор API**: `choose_api` по `operators.json` через оба канала и `askReformer` на тех же
  вопросах с бюджетом `ask_reformer` (виден ли ожидаемый оператор); `get_symbol_docs` для каждого
  `@reformer/*`-символа эталонов; `find_recipe` для wizard, form-array, copy-from, json-schema,
  directory-layout; базы `mcp:evaluate --strategy v6-choose` и `--strategy builder-facade`.
- **T5 ложные срабатывания проверки кода**: `validate_form kind=code` (оба канала) и `validateCode`
  напрямую по каждому файлу эталонов playground и **17 наборов `__golden__`** — код рабочий, любая
  ошибка = ложное срабатывание (ReFormer-kbs4); `kind=json-schema` по
  `complex-multy-step-form-renderer-json/form.schema.json`; `kind=layout` по наборам файлов
  эталонов и `__golden__/*/_manifest.txt` (раскладка модуля ассистента должна проходить).
- **T6 пригодность ответа агенту**: размер каждого ответа и есть ли главное в первых 1400
  символах (`ANSWER_BUDGET` фасада `mcp_call`): у `generate_form` — статус проверки и список
  файлов, у `plan_form` — счётчики и предупреждения, у `validate_form` — вердикт и первые
  находки, у `choose_api` — оператор; отказ называет починку.

Итог — `report.md`: метрики по каналам и пробелы по классам — протокол/паритет, анализатор,
генератор, проверка кода, извлечение, форма ответа, ограничения библиотеки.

## Этап 2 — калибровка (цикл правок в `packages/reformer-mcp`)

Порядок — по вкладу в цель:
1. **простая форма** (registration): эталонная intent → бандл → e2e на 3 таргетах, оба канала;
2. **ложные срабатывания `validateCode` на коде ассистента** (kbs4) — они запирают запись
   режима файлов;
3. **сложная форма** (credit) — то же, что п. 1;
4. полнота `plan_form`; где прозу формулы или условия надёжно не разобрать — предупреждение с
   оператором и рецептом, а не молчание;
5. подбор API (T4) и форма ответов под бюджет (T6).

На каждый пробел: `bd create` (или существующая задача) → правка в `src` (и `docs/llms`, если
дело в документации) → юнит-тест по образцу ближайшего (`generate-form.test.ts`,
`form-from-spec.test.ts`, `validate-form.test.ts`, `api-decision.test.ts`, `facade.test.ts`) →
тесты и tsc пакета → пересборка dist **и бандла конструктора** → `mcp:calibrate`. Holdout
(insurance) и обе стратегии `mcp:evaluate` не должны ухудшиться. Ограничения библиотеки (например,
ReFormer-peb0) и дефекты инструментов ассистента (qsm8.13, qsm8.14, lhvk.9) — только задачи bd:
код ассистента и библиотеки в этой работе не трогаем.

## Этап 3 — повторный замер и живая модель

1. Финальный `mcp:calibrate` → `calibration-baseline.json`, таблица «до/после» в
   `docs/mcp-eval/calibration.md`.
2. Тесты конструктора, завязанные на MCP: интеграция `plugins/reformer/integration/assistant-mcp.test.ts`,
   тесты `plugins/reformer/ai` (справка, гейт кода) и `plugins/forms/mcp`.
3. **Живая модель, выборочно** (при поднятой Ollama): `assistant-scenarios-eval.test.ts` с
   `EVAL_MODEL=qwen3.8:27b-32k` и `EVAL_ONLY` = сценарии, где в прогоне
   `.tmp/eval/form-scenarios-qwen3.8_27b-32k-2026-10-27T08-54-34-766Z.json` были
   `ask_reformer`/`mcp_*`, плюс базовые 1.1, 5.4, 7.1, 7.3, 7.4, 8.1, 9.1. Сравнение с прогоном
   27.10 (18/19) — дописывается разделом в `docs/mcp-eval/builder-form-scenarios.md`.
4. Отчёт в чат: метрики, закрытые и оставшиеся пробелы с id bd.

## Критерии готовности (предлагаемые, можно скорректировать)

- Smoke обоих каналов — pass; `tools/list --strict` — exit 0; разница списков node/worker ровно
  ожидаемая; паритет ответов — или расхождение объяснено.
- registration и credit, эталонная intent, 3 таргета: cross-check ✅, tsc 0, `validate_form code`
  без ошибок; e2e registration зелёный, credit — ≥ 90 %; каждый красный сценарий — с задачей bd.
- `plan_form` по credit: 6 шагов, 3 массива, recall полей и распределения ≥ 95 %, поддерживаемые
  виды правил — 100 %, неразобранное — с оператором; insurance — не хуже baseline.
- Ложных ошибок `validateCode`/`validate_form` на эталонах playground и `__golden__` — 0
  (kbs4 закрыта); `kind=layout` принимает все наборы `__golden__`.
- `choose_api` по `operators.json` — 100 %; `askReformer` называет ожидаемый оператор в бюджете;
  покрытие `get_symbol_docs` — 100 %; главное в первых 1400 символах — во всех ответах T6.
- `mcp:evaluate` (`v6-choose`, `builder-facade`) — не хуже baseline; живая модель — без регрессий
  к прогону 27.10.

## Ограничения

- Правки — только `packages/reformer-mcp` и новый стенд; `docs/specs/` только читаем; эталонные
  формы, код ассистента и кодогенерации не меняем (кроме env-пути в одном e2e-спеке).
- Бандл `.ui_builder/mcp/reformer/` — производный (в git только `README.md`, `server.json`,
  `.gitignore`).
- tsc — только из каталога пакета; временное — `.tmp/mcp-calibration/`; скриншоты и видео —
  `projects/react-playground-e2e/{screenshots,videos}/mcp-calibration/`.
- Сгенерированные формы и правки `App.tsx` — незакоммиченными, решение за вами. Коммиты, push и
  выгрузка bd в git — только по вашей просьбе.

## Verification

- `npm --prefix packages/reformer-mcp test`; `npx tsc --noEmit` из `packages/reformer-mcp`;
  сборка пакета и `mcp:build` конструктора.
- `npm run mcp:calibrate -- --channel both` дважды подряд → одинаковый `metrics.json`.
- `npm run mcp:evaluate` и `npm run mcp:evaluate -- --strategy builder-facade` против baseline.
- e2e из `projects/react-playground-e2e`:
  `MCP_ITER_VERSION=cal npx playwright test --project=iter-core --project=iter-renderer-react --project=iter-renderer-json`
  (подмножество) и `REG_FORM_PATH=… npx playwright test tests/pages/registration-form-json`.
- vitest конструктора (п. 2 этапа 3); выборочный прогон живой модели (п. 3).
- `git status docs/specs/` — пусто.
