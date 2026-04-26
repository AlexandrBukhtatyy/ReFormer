# План: полное покрытие документации `@reformer/*` для ИИ-агентов

## Context

Предыдущий эпик (`PROMT.md`) поднял инфраструктуру: конвенцию [docs/llms-convention.md](../llms-convention.md), генератор [scripts/generate-llms-txt/](../../scripts/generate-llms-txt/), MCP-tools `get_symbol_docs`/`find_example`, `reformer://` ресурсы. Сейчас все 5 пакетов проходят аудит **формально** (0 callable без `@example`), но содержательно покрытие неполное.

Аудит трёх параллельных Explore-агентов вскрыл четыре блока пробелов:

1. **`@reformer/core` ≈ 75% полноты.** 21 файл `docs/llms/` хорошо покрывают array/computeFrom/enableWhen/watchField/cycle-detection. `copyFrom`, `syncFields`, `resetWhen`, `transformValue`, `revalidateWhen` упомянуты только в `03-api-signatures.md` без отдельных рецептов. Submit/reset workflow и async preload не документированы как самостоятельные сценарии. JSDoc на behaviors (`watch-field`, `enable-when`) даёт 1 минимальный `@example` без try-catch / guard / `resetOnDisable`.
2. **`@reformer/cdk`.** 3 файла (`01-overview`, `02-form-array`, `03-form-navigation`). Нет `FormField` compound-API doc, нет troubleshooting, нет рецептов (nested array, custom AddButton, conditional step visibility). Headless useFormWizard / scrollToTop / onStepChange не описаны.
3. **`@reformer/ui-kit` — критическая дыра.** Все 3 файла `docs/llms/` — копии cdk-доков, а не про собственные компоненты. Input/InputMask/InputPassword/Textarea/Checkbox/RadioGroup/Select/Button/FormField/AsyncBoundary/ExampleCard в `docs/llms/` отсутствуют. JSDoc минимальный (одно-двух-строчный `@example`).
4. **`@reformer/renderer-react` и `renderer-json`** в целом покрыты (4 файла каждый, anti-patterns + troubleshooting), но нет рецептов: custom fieldWrapper, programmatic node manipulation, source values cookbook, `$template` для массивов с разбором.

Контрольный список — **45 реальных сценариев** из `projects/react-playground/src/pages/examples/` (см. отчёт Explore агента 3): 5 создание формы, 9 валидация, 9 behaviors, 4 submit/reset, 3 подписки, 5 headless CDK, 4 TS-renderer, 4 JSON-renderer, 2 загрузка данных, 5 UI-kit. Цель плана — каждый сценарий должен находиться через `reformer-mcp` без чтения исходников.

## Ответы пользователя по подходу

- **ui-kit-копии:** удалить копии cdk-доков и написать ui-kit-документацию с нуля.
- **Трекинг:** новый эпик + ~12 beads-issues, агент идёт по ready-очереди.
- **Глубина рецептов:** глубоко — 2–4 сценария на раздел (happy path + edge case + anti-pattern).

## Декомпозиция (12 issues + epic)

### Эпик `EPIC-DOCS2`

`bd create --type=epic --priority=2 --title="EPIC: Full @reformer/* documentation coverage v2"`. Все ниже — `parent-child` к нему.

### Track A — `@reformer/core` (3 issues)

| ID | Title | Содержание |
|---|---|---|
| A.1 | Behaviors recipes — copyFrom, syncFields, resetWhen, transformValue, revalidateWhen | Создать 5 файлов: [packages/reformer/docs/llms/23-copy-from.md](../../packages/reformer/docs/llms/), `24-sync-fields.md`, `25-reset-when.md`, `26-transform-value.md`, `27-revalidate-when.md`. Каждый: Purpose, 2–4 примера (включая `apply([...])`), Anti-patterns, Troubleshooting. Опираться на [packages/reformer/src/behaviors/](../../packages/reformer/src/behaviors/) и эталон [BehaviorsExamples.tsx](../../projects/react-playground/src/pages/examples/behaviors/BehaviorsExamples.tsx). |
| A.2 | Lifecycle docs — submit/reset/preload | Создать `28-submit-and-reset.md` (`form.markAsTouched`/`validate`/`getValue`/`reset`/`pending`, эталон [RegistrationForm.tsx:124-148](../../projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx)) и `29-async-preload.md` (initial values, async preload через `watchField`/external hook, race condition guards, эталон [credit-application-behavior.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form/behaviors/credit-application-behavior.ts)). |
| A.3 | JSDoc deep-dive на behaviors | Расширить `@example` в [packages/reformer/src/behaviors/watch-field.ts](../../packages/reformer/src/behaviors/watch-field.ts) (try-catch + guard + debounce), `enable-when.ts` (resetOnDisable + cycle prevention), `compute-from.ts`, `revalidate-when.ts`, `reset-when.ts`, `sync-fields.ts`, `transform-value.ts`, `copy-from.ts` — у каждого минимум 2 содержательных `@example`. |

### Track B — `@reformer/cdk` (3 issues)

| ID | Title | Содержание |
|---|---|---|
| B.1 | `04-form-field.md` (FormField compound API) | Новый файл [packages/reformer-cdk/docs/llms/04-form-field.md](../../packages/reformer-cdk/docs/llms/). Описать `FormField.Root`, `Label`, `Control`, `Error`, `Hint`, `useFormFieldContext`. Покрыть 2–4 сценария: базовый, custom layout, async-валидация (pending), интеграция с `@reformer/ui-kit`. |
| B.2 | `05-recipes.md` (advanced patterns) | Новый файл с рецептами: (1) nested FormArray (FormArray внутри Item); (2) custom AddButton с собственным triggering UI; (3) conditional step visibility / dynamic step count в FormWizard; (4) externally-controlled wizard через `useRef<FormWizardHandle>`. Привязка к [CreditApplicationForm.tsx](../../projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx). |
| B.3 | `06-troubleshooting.md` + JSDoc на хуках/handles | Создать troubleshooting (10+ ошибок: «AddButton не появляется», «List ререндерит весь массив», «FormWizardHandle.goToStep не работает», «steps без validations пропускают валидацию», ...). Расширить JSDoc на `FormArrayHandle`, `FormWizardHandle`, `useFormArray`, `useFormArrayItemContext`, `useFormFieldContext` — у каждого 2 `@example`. |

### Track C — `@reformer/ui-kit` (4 issues, КРИТИЧНО)

| ID | Title | Содержание |
|---|---|---|
| C.1 | Cleanup + `01-overview.md` | Удалить копии: [packages/reformer-ui-kit/docs/llms/02-form-array.md](../../packages/reformer-ui-kit/docs/llms/02-form-array.md), `03-form-navigation.md`. Переписать `01-overview.md` под себя: установка, импорты, философия (Tailwind + Radix), список собственных компонентов в виде таблицы, ссылка на эталоны в `react-playground`. |
| C.2 | Field components docs | Три новых файла: `02-text-fields.md` (Input, InputMask, InputPassword, Textarea — value/onChange-контракт, type='number' edge cases, mask format, password toggle), `03-choice-fields.md` (Checkbox, RadioGroup, Select + 8 sub-компонентов: SelectGroup/Value/Trigger/Content/Label/Item/ScrollUp/ScrollDownButton; resource-loading в Select), `04-layout-and-buttons.md` (Button с variants/sizes/asChild, AsyncBoundary loading/error/ready, ExampleCard для playground, `cn` helper). |
| C.3 | `05-form-field-integration.md` | Как UI-kit-овский `FormField` интегрируется с `@reformer/cdk` `FormField.Root` и как он используется как `fieldWrapper` в `@reformer/renderer-react`. Покрыть 2–4 сценария: автономно через `<FormField control={...}>`, как `fieldWrapper` в RenderSchema, кастомизация label/error через children-prop, интеграция с Checkbox-исключением. |
| C.4 | `06-troubleshooting.md` + JSDoc deep-dive | 8–10 типичных проблем («number input возвращает строку», «Select не показывает options», «mask не работает», «forwardRef + Radix Slot конфликты», ...). Расширить JSDoc на каждом `XxxProps` (описание каждой prop) и на компонентах (variants для Button, options-структура для Select). |

### Track D — `@reformer/renderer-react` + `renderer-json` (1 issue)

| ID | Title | Содержание |
|---|---|---|
| D.1 | Cookbooks для обоих рендереров | Два новых файла: [packages/reformer-renderer-react/docs/llms/05-cookbook.md](../../packages/reformer-renderer-react/docs/llms/) (custom fieldWrapper, programmatic node manipulation через `proxy.node().setHidden/patchProps/resetHidden`, container-компонент с своим children-проп) и [packages/reformer-renderer-json/docs/llms/05-cookbook.md](../../packages/reformer-renderer-json/docs/llms/) (`$template` для массивов, source-функции/константы рецепты, control-пропсы, миграция с TS RenderSchema). Эталоны — [render-schema.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts), [json-schema.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts), [registry.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts). |

### Финал (1 issue)

| ID | Title | Содержание |
|---|---|---|
| F.1 | Regenerate llms.txt + MCP smoke-test | `npm run generate:llms` для всех пакетов; idempotent re-run; ручной тест MCP-инструментов: `get_symbol_docs({ symbol: "copyFrom" })` возвращает свежий `@example`, `find_example({ scenario: "wizard" })` ссылается на актуальный `recipes.md`, `reformer://docs/ui-kit` показывает 5 новых файлов, `review` prompt подгружает новые anti-patterns. Финальный аудит `--audit` остаётся 0/0 во всех пакетах. |

## Параллельное выполнение через субагентов

Треки A, B, C, D **независимы по файлам** — каждый трогает только свой пакет, конфликтов в git нет. Запускаются как 4 параллельных субагента (general-purpose).

Порядок:

1. **Подготовка (последовательно):** создать в beads эпик `EPIC-DOCS2` и 12 issues с зависимостями `parent-child` к эпику. Зависимостей `blocks` между треками нет, кроме `F.1 → all` (финал ждёт всех).
2. **Запуск 4 субагентов параллельно** в одном сообщении (4 `Agent` tool-use):
   - **Agent-A** (Track A): добивает `@reformer/core` — закроет 3 issues (A.1, A.2, A.3).
   - **Agent-B** (Track B): добивает `@reformer/cdk` — закроет 3 issues (B.1, B.2, B.3).
   - **Agent-C** (Track C): полностью переписывает `@reformer/ui-kit` — закроет 4 issues (C.1, C.2, C.3, C.4).
   - **Agent-D** (Track D): cookbooks для двух рендереров — закроет 1 issue (D.1).
3. **F.1 — последовательно после всех:** регенерация `llms.txt` + smoke-test MCP.

Каждому субагенту в промпте передать:
- Путь к этому плану (`docs/plans/bright-brewing-forest.md`) и к [docs/llms-convention.md](../llms-convention.md).
- **Образец стиля** для текста: для core — [packages/reformer/docs/llms/11-async-watchfield.md](../../packages/reformer/docs/llms/11-async-watchfield.md) (полный с anti-patterns); для cdk/ui-kit/renderer — [packages/reformer-renderer-json/docs/llms/02-json-schema.md](../../packages/reformer-renderer-json/docs/llms/02-json-schema.md).
- Список конкретных файлов из таблицы трека.
- Эталонные примеры из `projects/react-playground/src/pages/examples/`.
- Команда self-check: `node scripts/generate-llms-txt <pkg> --audit` → 0 callable без `@example`.
- Команда обновления beads: `'/c/Users/user/AppData/Local/Programs/bd/bd.exe' update <id> --status=in_progress` → работа → `bd close <id> --reason="..."`.
- Запрет: не трогать файлы вне своего пакета; не запускать `npm run generate:llms` (это работа F.1); не делать git commit (коммит — отдельным шагом после F.1).

Контроль качества после возврата субагентов: я перечитываю выборочные новые `.md`, проверяю что сценарии соответствуют плану, пробегаюсь `--audit` и MCP-smoke-test, потом единый коммит.

## Выходные критерии (Definition of Done)

- 12 + 1 issues закрыты, EPIC-DOCS2 закрыт.
- Все 45 контрольных сценариев из react-playground находятся через `reformer-mcp` без чтения `src/`.
- 0 callable публичных символов без `@example` (как сейчас) **и** все эти `@example` нетривиальны (минимум impоrts + рабочий вызов).
- Каждый пакет имеет в `docs/llms/` секции: overview, тематические рецепты, anti-patterns, troubleshooting.
- `npm run generate:llms` идемпотентен после регенерации.
- MCP-сервер собирается; smoke-test ниже выполняется.

## Верификация

```bash
# 1. Аудит JSDoc
node scripts/generate-llms-txt packages/reformer --audit
node scripts/generate-llms-txt packages/reformer-cdk --audit
node scripts/generate-llms-txt packages/reformer-ui-kit --audit
node scripts/generate-llms-txt packages/reformer-renderer-react --audit
node scripts/generate-llms-txt packages/reformer-renderer-json --audit
# Ожидание: каждый — "Missing @example (callable only): 0".

# 2. Регенерация и идемпотентность
npm run generate:llms
git diff --stat -- 'packages/*/llms.txt'        # после первого запуска — изменения есть
npm run generate:llms
git diff --stat -- 'packages/*/llms.txt'        # после второго — пусто

# 3. MCP smoke-test
cd packages/reformer-mcp && npm run build
node -e "import('./packages/reformer-mcp/dist/utils/symbols-parser.js').then(m => console.log(m.findSymbol('copyFrom')?.tags.filter(t => t.tag === 'example').length))"
# Ожидание: ≥ 2.

# 4. Manual проверка через MCP-клиент (Claude Code, mcp-inspector):
#    - reformer://docs/ui-kit  → 5+ секций (overview, text-fields, choice-fields, layout, form-field-integration, troubleshooting)
#    - reformer://api/cdk      → видны useFormArray, useFormFieldContext с описанием
#    - find_example("nested-array") → возвращает рецепт из cdk/05-recipes.md
#    - get_symbol_docs({ symbol: "watchField" }) → @example с try-catch и guard
```

## Файлы, затрагиваемые планом

**Новые:**
- `packages/reformer/docs/llms/{23,24,25,26,27,28,29}.md` (7)
- `packages/reformer-cdk/docs/llms/{04,05,06}.md` (3)
- `packages/reformer-ui-kit/docs/llms/{01,02,03,04,05,06}.md` (6 — `01` overwrite)
- `packages/reformer-renderer-react/docs/llms/05-cookbook.md` (1)
- `packages/reformer-renderer-json/docs/llms/05-cookbook.md` (1)

**Удаляемые:**
- `packages/reformer-ui-kit/docs/llms/02-form-array.md`
- `packages/reformer-ui-kit/docs/llms/03-form-navigation.md`

**Правка JSDoc** (без переписывания структуры файлов):
- `packages/reformer/src/behaviors/*.ts` (8 файлов)
- `packages/reformer-cdk/src/components/form-array/*.tsx`, `form-wizard/*.tsx`, `form-field/*.tsx` (хуки и Handle-типы)
- `packages/reformer-ui-kit/src/components/ui/*.tsx` (deep-dive по props и variants)

**Регенерируемые автоматически:**
- `packages/*/llms.txt` (6 файлов).

## Out of scope

- README пакетов в корне (отдельная история, не для агентов).
- Перевод существующей документации на другой язык — оставляем смесь RU/EN.
- Документация для `@reformer/mcp` (`docs/llms/`) — у пакета 0 публичных символов, его «документация» — это сам MCP-протокол.
- Создание новых эталонных примеров в `react-playground` (используем существующие как точки опоры).
