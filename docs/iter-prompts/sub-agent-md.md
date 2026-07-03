# Sub-agent — paper listing, run={RUN_ID} target={TARGET}

> Шаблон. Orchestrator (`orchestrator-md.md`) подставляет `{RUN_ID}`, `{TARGET}`, `{SPEC_PATH}` перед вызовом Agent'а.
> Родственники: полный code-gen — [`sub-agent.template.md`](./sub-agent.template.md); минимальный baseline — [`sub-agent-clean.md`](./sub-agent-clean.md).
>
> **PAPER MODE.** Ты НЕ пишешь приложенческий код. Ты производишь **ровно один markdown-файл** —
> листинг того, что бы ты создал. Это dry-run калибровка: измеряется guidance-качество MCP-сервера
> на **корректности дизайна** формы, без tsc/lint/build/dev-сервера/Playwright.

---

## Sandbox — strict, NO exceptions

Ты — sub-agent в **MCP-only sandbox**. Цель — спроектировать форму **только** на основе MCP-сервера (`@reformer/mcp`) и спеки. Это тест **качества MCP**, а не Claude. Любое чтение существующего кода в `packages/` или родственных примерах в `projects/.../examples/` — **подделка результатов** (tainted).

### МОЖНО

- MCP tools: `mcp__reformer__find_recipe`, `mcp__reformer__get_symbol_docs`, `mcp__reformer__list_symbols`, `mcp__reformer__validate_json_schema`, `mcp__reformer__check_behaviors`, `mcp__reformer__report_issue`
- MCP prompts/resources, экспонированные сервером
- Read спеки: `{SPEC_PATH}` (read-only — НЕ редактировать, см. CLAUDE.md → Specs are read-only)
- Read/Write своего workspace: `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/`
- Bash **только** на свой workspace: `mkdir -p`, `wc -l`, `find` по `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/`

### НЕЛЬЗЯ (orchestrator аудирует через grep по transcript'у)

- **Write любого кода в `projects/`** — в paper mode приложенческий код НЕ создаётся вообще. Твой код живёт только внутри `form-listing.md` в fenced-блоках.
- Read/Glob/Grep по `packages/` (исходники библиотек)
- Read/Glob/Grep по `projects/react-playground/src/pages/examples/` (любой каталог)
- Read/Glob/Grep по `projects/react-playground/src/components/`, `factories/`, `hooks/`, `utils/`, и подобным «общим» helper'ам
- **Read `node_modules/@reformer/*` `.d.ts`** — на бумаге нет tsc, который форсит проблему, поэтому peeking в `.d.ts` замещает предохранитель. Разрешён ТОЛЬКО как крайний fallback когда MCP молчит, и **обязан** быть залогирован как gap (`workaround: fallback to node_modules .d.ts inspection`). Orchestrator грепает такие reads.
- Любая правка `docs/specs/`
- `git commit`, `git push`, `git tag`, `git checkout` (любая ветка)
- Изменение `App.tsx` — в paper mode роутов нет, форма нигде не монтируется
- tsc / eslint / npm build / playwright / dev-сервер — на бумаге они бессмысленны, не запускай

Если поймал себя на запрещённой операции — откатить, зафиксировать в `form-listing.md` §3.2 как gap-honesty (это понизит score, но честно).

---

## Step 0 — acknowledge (paper mode)

В первом сообщении распечатай:

> Working in MCP-only sandbox — **PAPER MODE**. Target=`{TARGET}`. Run=`{RUN_ID}`. Spec=`{SPEC_PATH}`.
> Allowed sources: MCP server + spec + own workspace.
> Forbidden: writing app code, packages/, sibling examples, common helpers, node_modules .d.ts (unless MCP-silent → logged as gap).
> Output: exactly one file — `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/form-listing.md` (file tree + full code listing + MCP errors).

```bash
mkdir -p .tmp/iter-artifacts/{RUN_ID}/{TARGET}
```

---

## Step 1 — discovery

1. **Read спеки** `{SPEC_PATH}`. Запомнить:
   - Шаги формы (FormWizard pages)
   - Поля per-step + типы
   - Валидации (sync + async)
   - Computed-fields (formula-based)
   - FormArray sections (списки)
   - Conditional fields — видимость/доступность через enableWhen, условная валидация через branch-node { when, children } (НЕ applyWhen — такого экспорта нет)

2. **Discovery через MCP** — обязательный набор для полной реализации спеки:

   **Обязательные recipes:**
   - `find_recipe(topic="quick-start")` — **ПЕРВЫМ**, раздел про FormField + Arrays of objects
   - `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")` — **ОБЯЗАТЕЛЬНО для ВСЕХ targets**
   - `find_recipe(topic="type-safety-recipes")` — Recipe 8 для union-type defaults
   - `find_recipe(topic="form-wizard")` — multi-step. Читай разделы про STEP_VALIDATIONS shape (`Record<number, ...>`, НЕ array — silent no-op!) и RenderContextProvider если используешь RenderNode body
   - `find_recipe(topic="form-array")` — tuple format `[itemSchema]`, для всех 3 array sections спеки
   - `find_recipe(topic="compute-from")` — 8 computed fields (alias map активен)
   - `find_recipe(topic="async-validator")` / `find_recipe(topic="async-validator-debounce")` — для email uniqueness, INN check
   - `find_recipe(topic="async-options-loading")` — для cities by region, carModel by carBrand
   - `find_recipe(package="@reformer/ui-kit", topic="input-mask")` — phones, passport, INN, SNILS
   - `find_recipe(topic="copy-from")` — sameAsRegistration → residenceAddress
   - `find_recipe(topic="validation")` — required/min/max/pattern/email + cross-field
   - `find_recipe(topic="common-mistakes")` — overload-error decoding (превентивно)

   **Target-specific:**
   - `core` → `find_recipe(topic="conditional-fields")` + `get_symbol_docs(symbol="useFormControlValue")` (условный рендер в JSX)
   - `renderer-react` → `find_recipe(topic="renderer-react")` (overview + RenderSchema)
   - `renderer-json` → `find_recipe(package="@reformer/renderer-json", topic="overview")` (closure-pattern) + `find_recipe(topic="json-schema")`

   **Symbols (минимум):**
   - `get_symbol_docs(symbol="createForm")`
   - `get_symbol_docs(symbol="FormField")` (живёт в `@reformer/ui-kit`)
   - `get_symbol_docs(symbol="ModelValidator")` (тип валидатора `(value, model, root)`; `ValidationSchemaFn` НЕ существует)
   - `get_symbol_docs(symbol="computeFrom")`
   - `get_symbol_docs(symbol="enableWhen")` (условная видимость/доступность) + `get_symbol_docs(symbol="validateFormModel")` (движок валидации схемы-дерева)
   - target-specific:
     - `renderer-react` → `get_symbol_docs(symbol="createRenderSchema")`
     - `renderer-json` → `get_symbol_docs(symbol="JsonFormRenderer")` (НЕ `JsonRenderer` — такого нет), `get_symbol_docs(symbol="createRenderSchemaFromJson")`

3. **Сохранить raw responses** в `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/discovery.md` (для аудита и repro). Один блок на каждый MCP-вызов с заголовком и query.

   **Traceability requirement (paper mode):** без tsc невозможно поймать галлюцинированный API. Поэтому **каждый нетривиальный символ / recipe, который появится в листинге, ОБЯЗАН иметь запись в `discovery.md`**. Orchestrator spot-check'ает (C9) — API без записи считается потенциальной галлюцинацией.

---

## Step 2 — planning

Записать `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/dev-plan.md` по шаблону [`docs/iter-prompts/templates/dev-plan.template.md`](./templates/dev-plan.template.md):

- Структура формы (из спеки)
- Список файлов которые фигурируют в листинге (в **Planned files** укажи реальные пути `mcp-credit-application-{TARGET}-{RUN_ID}/...`, без e2e-spec — в paper mode тестов нет)
- Список recipes/symbols, которые планируешь использовать (со ссылками на discovery.md)
- Open questions: что MCP не разъяснил — это будущие gap'ы

---

## Step 3 — MD-listing generation (замена code-gen)

Заполни `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/form-listing.md` по шаблону [`docs/iter-prompts/templates/form-listing.template.md`](./templates/form-listing.template.md). Секции §1 (дерево файлов) и §2 (полный код per file) — здесь.

> ## SCOPE — опиши ПОЛНУЮ спеку
>
> 3 sub-agent'а (core/renderer-react/renderer-json) описывают **ту же самую форму** — это позволит сравнить стеки реформера на одной задаче. Листинг должен **соответствовать оригинальной спецификации** в `{SPEC_PATH}`.
>
> **Опиши ВСЁ что описано в спеке**:
>
> - **Все 6 шагов FormWizard** (Кредит → Личные → Контакты → Работа → Доп. инфо → Подтверждение)
> - **Все поля** каждого шага (~80 полей всего) — не пропускать, не объединять, не упрощать
> - **Все computed fields** через `computeFrom` (`fullName`, `age`, `interestRate`, `monthlyPayment`, `initialPayment`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`)
> - **Все conditional rendering** через `enableWhen` (видимость/доступность, `{ resetOnDisable }`) + branch-node `{ when, children }` (условная валидация) — mortgage, car, employed, selfEmployed, sameAsRegistration, hasProperty, hasExistingLoans, hasCoBorrower. ⚠️ `applyWhen` — ЛОКАЛЬНЫЙ typed-хелпер примеров, НЕ экспорт `@reformer/core`
> - **Все FormArray sections** — `properties[]`, `existingLoans[]`, `coBorrowers[]` со всеми полями элементов
> - **Все validators** из спеки — `required`, `min`/`max`, `minLength`/`maxLength`, `pattern`, `email`, cross-field
> - **Async validators** где описаны (email uniqueness, INN validation)
> - **Async options loading** где описаны (city by region, carModel by carBrand)
> - **InputMask** для phone/passport/INN/SNILS/postalCode/etc

### Правило полноты листинга (CRITICAL — paper mode)

**Код в §2 — ПОЛНЫЙ, без сокращений.** Запрещено: `// остальные поля аналогично`, `// ...`, `/* и т.д. */`, любые плейсхолдеры вместо реального поля. Каждое поле спеки выписано явно в fenced-блоке. Orchestrator считает leaf-поля и `testId:` прямо по тексту листинга (C1/C2) — элизия обнуляет coverage-score.

Причина: на бумаге нет tsc/runtime. Единственное доказательство, что форма спроектирована полно и корректно — это сам текст листинга. Сокращённый листинг = недоказанная форма.

### Целевой стек и файлы

| target           | files                                       | стек                                                                    |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `core`           | `schema.ts` + `index.tsx`                   | `createForm` + `FormWizard` (ui-kit) + `FormField` (ui-kit)             |
| `renderer-react` | `schema.ts` + `index.tsx`                   | `createRenderSchema` + `<FormRenderer fieldWrapper=FormField>`          |
| `renderer-json`  | `schema.json` + `registry.ts` + `index.tsx` | `<JsonFormRenderer>` + closure pattern (НЕ `JsonRenderer` — такого нет) |

Дерево файлов в §1 — по этой таблице (для core / renderer-react подсекцию §2.3 registry.ts удалить).

### Schema-driven UI rule (CRITICAL — главная находка iter-11)

**Компонент И его пропсы декларируются в СХЕМЕ**. JSX рендерит `<FormField control={form.x} />` БЕЗ дополнительных props. Применимо ко ВСЕМ targets, включая core.

```ts
// schema.ts ✓
{ email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email', testId: 'email' } } }
```

```tsx
// index.tsx ✓
<FormField control={form.email} />
```

❌ **НЕ ДЕЛАЙ**: свои Input/Select/Checkbox компоненты с label-prop'ами в JSX. Это anti-pattern, ломает schema-driven архитектуру и удваивает код.

`FormField` живёт в `@reformer/ui-kit`. Подключай через `import { FormField, Input, Select, Checkbox, Button } from '@reformer/ui-kit'`. Это peer-dependency, не нарушает sandbox или архитектуру.

### Convention testId = path-with-dashes (CRITICAL)

**КАЖДОЕ поле формы ОБЯЗАНО иметь `componentProps.testId`.** Top-level — `testId === fieldName`. Nested groups — **с префиксом группы через дефис** (path joining: `personalData.lastName` → `personalData-lastName`). Array items — имя leaf'а БЕЗ префикса массива (consumer ставит индекс сам).

```ts
// schema.ts ✓
loanAmount: { value: null, component: Input, componentProps: { label: '...', testId: 'loanAmount' } },
loanType:   { value: 'consumer', component: Select, componentProps: { label: '...', testId: 'loanType', options: [...] } } satisfies FieldConfig<LoanType>,

personalData: {
  lastName:  { value: '', component: Input, componentProps: { label: 'Фамилия', testId: 'personalData-lastName' } },
  firstName: { value: '', component: Input, componentProps: { label: 'Имя',     testId: 'personalData-firstName' } },
  birthDate: { value: '', component: Input, componentProps: { label: 'Дата рождения', testId: 'personalData-birthDate', type: 'date' } },
},

passportData: {
  series: { value: '', component: Input, componentProps: { label: 'Серия', testId: 'passportData-series' } },
  number: { value: '', component: Input, componentProps: { label: 'Номер', testId: 'passportData-number' } },
},

// FormArraySection items — consumer ставит индекс сам. Внутри item-template имена полей БЕЗ префикса массива:
properties: [{
  type:           { value: 'apartment', component: Select,   componentProps: { label: 'Тип',       testId: 'type', options: [...] } },
  estimatedValue: { value: 0,           component: Input,    componentProps: { label: 'Стоимость', testId: 'estimatedValue', type: 'number' } },
}],
```

**Почему**: testId — единая convention для consumer'ов (POM, abstract tests). Даже без запуска тестов в paper mode convention остаётся ожидаемой нормой; orchestrator проверяет её по тексту (C2/C3).

### Type-safety правила (must follow — листинг должен быть type-correct by construction)

- **type aliases** для FormFields, **НЕ interface** (avoids TS2344 cascade)
- `import type { ModelValidator } from '@reformer/core'` (тип валидатора; `ValidationSchemaFn` НЕ существует)
- `import { required, min, max, email, pattern, minLength, maxLength } from '@reformer/core/validators'` (submodule — только чистые фабрики; `applyWhen` там нет)
- annotated destructuring в `computeFrom` callback'ах:
  ```ts
  computeFrom([path.x], path.y, ({ x }: MyForm) => ...)  // ✓
  computeFrom([path.x], path.y, ({ x }) => x as number)  // ✗ never cast
  ```
- **union-type defaults**: `value: 'male'` widening к `string`. Используй `satisfies FieldConfig<UnionType>` (Recipe 8 в `30-type-safety-recipes.md`):
  ```ts
  gender: { value: 'male', component: Radio, componentProps: { ... } } satisfies FieldConfig<Gender>
  ```
- никаких `as`-кастов для обхода типов в схеме
- следуй всем рецептам из `find_recipe(topic="type-safety-recipes")`

> На бумаге нет tsc — эти правила невозможно проверить компилятором. Поэтому места, где ты **не уверен**, что код скомпилируется (overload, prop-flow, union widening), выписывай в §3.1 «Type-risk spots». Честная самодекларация здесь — часть калибровочного сигнала.

---

## Step 3.5 — paper-compile self-check (замена tsc/build)

Единственный «компилятор» на бумаге — сами MCP-tools. Оба sandbox-legal. Заполни §3.1 листинга.

1. **`renderer-json` → `validate_json_schema`.** Извлеки ```json блок из §2.1 (schema.json) и прогони:

   ```
   validate_json_schema(schema=<твой JSON>, componentNames=[...из registry.ts...], dataSourceNames=[...из registry.ts...])
   ```

   Запиши `{valid, errors}`. Если `invalid` — **почини листинг и перепрогони** (paper-аналог tsc-retry loop, cap 3 цикла). Для core / renderer-react: `n/a — target не JSON-DSL`.

2. **Все target'ы → `check_behaviors`.** Построй dep-map для 8 computed + copyFrom (`target ← reads[]`) и прогони:

   ```
   check_behaviors(dependencies=[{ target: "monthlyPayment", reads: ["loanAmount","loanTerm","interestRate"] }, ...])
   ```

   Запиши `cycles` / `self-refs` в §3.1. Если цикл — это дизайн-баг: пересмотри computed-граф.

3. **Type-risk spots.** Выпиши места, где веришь в компиляцию, но без tsc доказать не можешь.

---

## Step 4 — errors/gaps collection

Заполни §3.2 (структурированные MCP gaps) и §3.3 (машиночитаемый YAML-сигнал) листинга. Это **главный output paper-агента**.

Каждый gap:

- `gap-id`: короткий slug (`g-find_recipe-async-fail`) — консистентный между target'ами, чтобы orchestrator дедуплицировал
- `severity`: high / med / low
- `evidence`: цитата ответа MCP или фраза «MCP returned no recipe for X»
- `proposed patch direction`: что добавить/поправить в `packages/reformer-mcp/` (новый recipe / extra example / правка template)

Если gap'ов нет — `_None — MCP closed all questions._`.

§3.3 YAML заполни фактическими числами (coverage / testid counts / paper_compile / gaps) — orchestrator сверит со своим независимым подсчётом.

---

## Step 5 — return

Вернуть orchestrator'у короткий structured summary как **последнее сообщение agent'а**:

```yaml
status: ok | partial | blocked | tainted
target: { TARGET }
run: { RUN_ID }
listing_path: .tmp/iter-artifacts/{RUN_ID}/{TARGET}/form-listing.md
discovery_path: .tmp/iter-artifacts/{RUN_ID}/{TARGET}/discovery.md
mcp_calls: N
coverage: { steps: N/6, computed: N/8, arrays: N/3, fields: ~N/~80, conditional_groups: N/8 }
paper_compile:
  json_schema_valid: true | false | n/a # n/a для core / renderer-react
  behaviors_cycles: none | [list]
testid: { leaves: N, with_testid: N, convention_violations: N }
gaps: { high: N, med: N, low: N }
notes: <одна строка>
blockers:
  - (если есть)
```

---

## Известные подводные камни

- `find_recipe` без явной темы возвращает топ-1. Если ответ не подходит — переформулируй keyword (`computed` / `compute-from` / `derived`).
- На бумаге нет tsc → тип-ошибки не проявятся сами. Твоя честность в §3.1 (type-risk spots) — единственный сигнал о них. Не прячь неуверенность.
- `path.X` (FieldPath) используется в схеме (`createForm` callback). `form.X` (FormProxy) — в hooks. Перепутаешь — runtime-ошибка (в листинге отрази корректно).
- В `renderer-json` schema.json — это **JSON**, не TS. Строковые операторы `$model(path)` / `$component(Name)` / `$dataSource(Name)`; каждый `$component`/`$dataSource` ОБЯЗАН быть в `registry.ts`, иначе `validate_json_schema` (и рантайм) упадёт.
- `.d.ts` в `node_modules` — крайний fallback только когда MCP молчит, и всегда с gap-логом. Тихое чтение = tainted при аудите.
