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

- MCP tools: `mcp__reformer__find_recipe`, `mcp__reformer__get_symbol_docs`, `mcp__reformer__list_symbols`, `mcp__reformer__validate_form` (`kind="json-schema"` / `kind="behaviors"` — заменил прежние `validate_json_schema` и `check_behaviors`), `mcp__reformer__report_issue`
- MCP prompts/resources, экспонированные сервером
- Read спеки: `{SPEC_PATH}` (read-only — НЕ редактировать, см. CLAUDE.md → Specs are read-only)
- Read/Write своего workspace: `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/`
- Bash **только** на свой workspace: `mkdir -p`, `wc -l`, `find` по `.tmp/iter-artifacts/{RUN_ID}/{TARGET}/`

### НЕЛЬЗЯ (orchestrator аудирует через grep по transcript'у)

- **Write любого кода в `projects/`** — в paper mode приложенческий код НЕ создаётся вообще. Твой код живёт только внутри `form-listing.md` в fenced-блоках.
- Read/Glob/Grep по `packages/` (исходники библиотек)
- Read/Glob/Grep по `projects/react-playground/src/pages/demo/` и `.../pages/debug/` (любой каталог)
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
   - FieldArray sections (списки)
   - Conditional fields — видимость/доступность через `enableWhen`, условная валидация через `validateWhen` (НЕ `applyWhen` и НЕ branch-узел `{ when, children }` — их больше нет)

2. **Discovery через MCP** — обязательный набор для полной реализации спеки:

   **Обязательные recipes:**
   - `find_recipe(topic="quick-start")` — **ПЕРВЫМ**, раздел про FormField + Arrays of objects (узел `{ model, item }`)
   - `find_recipe(topic="unified-contract")` — единый контракт: модель → схема → `createForm` → поведение, одинаково для всех targets
   - `find_recipe(topic="directory-layout")` — раскладка файлов модуля формы (одна на все targets)
   - `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")` — **ОБЯЗАТЕЛЬНО для ВСЕХ targets**
   - `find_recipe(topic="type-safety-recipes")` — тип формы через `type`, привязка к ручкам модели, `cross`, `compute` без кастов
   - `find_recipe(topic="form-wizard")` + `find_recipe(topic="form-flow")` — multi-step. Шаги — поток `createForm({ flow: { steps: [{ id, rules }] } })`, `id` = `selector` узла шага; визард — `flow={bundle.flow}`, отправка — `bundle.submit(handler)`
   - `find_recipe(topic="form-array")` — узел `{ model: model.$.items, component: FieldArray, item: (row) => узел }` + шаблон строки `arrayOf(blank)` в модели, для всех 3 array sections спеки
   - `find_recipe(topic="compute-from")` — 8 computed fields (alias map активен)
   - `find_recipe(topic="async-validator")` / `find_recipe(topic="async-validator-debounce")` — для email uniqueness, INN check
   - `find_recipe(topic="async-options-loading")` — для cities by region, carModel by carBrand
   - `find_recipe(package="@reformer/ui-kit", topic="input-mask")` — phones, passport, INN, SNILS
   - `find_recipe(topic="copy-from")` — sameAsRegistration → residenceAddress
   - `find_recipe(topic="validation")` — required/min/max/pattern/email + cross-field (`defineValidation` + `validate` / `validateWhen` / `cross`)
   - `find_recipe(topic="issue-messages")` — тексты ошибок: правила без `message`, словарь `defineIssueMessages` по кодам + `ValidationMessagesProvider`
   - `find_recipe(topic="common-mistakes")` — overload-error decoding (превентивно)

   **Target-specific:**
   - `core` → `find_recipe(topic="conditional-fields")` + `get_symbol_docs(symbol="useFormControlValue")` (условный рендер в JSX)
   - `renderer-react` → `find_recipe(package="@reformer/renderer-react", topic="form-bundle")` (сборка `createForm` + `FormRenderer`, узлы схемы)
   - `renderer-json` → `find_recipe(package="@reformer/renderer-json", topic="format-2")` (документ формата 2) + `find_recipe(package="@reformer/renderer-json", topic="registry")` (реестр `$component` / `$dataSource`)

   **Symbols (минимум):**
   - `get_symbol_docs(symbol="createForm")` (сборка: `model`, `schema`, `behavior`, `validation`, `flow`; у renderer-json ещё `registry`)
   - `get_symbol_docs(symbol="useFormBundle")` (`@reformer/core/react` — сборка один раз на компонент)
   - `get_symbol_docs(symbol="FormField")` (живёт в `@reformer/ui-kit`)
   - `get_symbol_docs(symbol="defineValidation")` + `get_symbol_docs(symbol="validate")` (`@reformer/core/validation`; тип правила поля — `Rule<T>`; правила прогоняет сборка `createForm({ validation })`. `ModelValidator` и `ValidationSchemaFn` удалены)
   - `get_symbol_docs(symbol="defineFormBehavior")` (`@reformer/core/behaviors`) + `get_symbol_docs(symbol="computeFrom")`
   - `get_symbol_docs(symbol="enableWhen")` (условная видимость/доступность) + `get_symbol_docs(symbol="validateWhen")` (условная валидация)
   - `get_symbol_docs(symbol="FormWizard")` (визард — адаптер потока сборки `createForm({ flow })`)
   - `get_symbol_docs(symbol="defineIssueMessages")` (`@reformer/core/i18n` — словарь текстов по кодам)
   - target-specific:
     - `renderer-react` → `get_symbol_docs(symbol="FormRenderer")` (`@reformer/renderer-react`; `createRenderSchema` — прежний путь, не используй)
     - `renderer-json` → `get_symbol_docs(symbol="defineJsonSchema")` + `get_symbol_docs(symbol="defineRegistry")` (реестр → `createForm({ registry })`, рисует тот же `FormRenderer`; `JsonFormRenderer` / `createJsonForm` — прежний формат без `format: 2`)

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
> - **Все 6 шагов FormWizard** (Кредит → Личные → Контакты → Работа → Доп. инфо → Подтверждение); шаги и их правила — поток `createForm({ flow })`
> - **Все поля** каждого шага (~80 полей всего) — не пропускать, не объединять, не упрощать
> - **Все computed fields** через `compute` / `computeFrom` (`fullName`, `age`, `interestRate`, `monthlyPayment`, `initialPayment`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`)
> - **Все conditional rendering** через `enableWhen` (видимость/доступность, `{ resetOnDisable }`) + `validateWhen` (условная валидация) — mortgage, car, employed, selfEmployed, sameAsRegistration, hasProperty, hasExistingLoans, hasCoBorrower. ⚠️ `applyWhen` и branch-узла `{ when, children }` больше нет — ни экспортом `@reformer/core`, ни локальным хелпером
> - **Все FieldArray sections** — `properties[]`, `existingLoans[]`, `coBorrowers[]` со всеми полями элементов
> - **Все validators** из спеки — `required`, `min`/`max`, `minLength`/`maxLength`, `pattern`, `email`, cross-field; правила без `message` — тексты по кодам в словаре `defineIssueMessages`
> - **Async validators** где описаны (email uniqueness, INN validation)
> - **Async options loading** где описаны (city by region, carModel by carBrand)
> - **InputMask** для phone/passport/INN/SNILS/postalCode/etc

### Правило полноты листинга (CRITICAL — paper mode)

**Код в §2 — ПОЛНЫЙ, без сокращений.** Запрещено: `// остальные поля аналогично`, `// ...`, `/* и т.д. */`, любые плейсхолдеры вместо реального поля. Каждое поле спеки выписано явно в fenced-блоке. Orchestrator считает leaf-поля и `testId:` прямо по тексту листинга (C1/C2) — элизия обнуляет coverage-score.

Причина: на бумаге нет tsc/runtime. Единственное доказательство, что форма спроектирована полно и корректно — это сам текст листинга. Сокращённый листинг = недоказанная форма.

### Целевой стек и файлы

Раскладка файлов **одна на все targets** (канон — `find_recipe(topic="directory-layout")`): `index.tsx`, `types.ts`, `model.ts`, `form.schema.ts`, `form.behavior.ts`, `form.validation.ts`, `data-sources.ts`, `api.ts` (+ `registry.ts` у renderer-json; по необходимости `form.flow.ts` — шаги визарда, `form.messages.ts` — словарь текстов ошибок). Различается только стек:

| target           | files                           | стек                                                                                                                                        |
| ---------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`           | общая раскладка                 | `createForm` в `useFormBundle` + разметка в JSX: `FormWizard` (ui-kit, `flow={bundle.flow}`) + `FormField` (ui-kit)                         |
| `renderer-react` | общая раскладка                 | `createForm` в `useFormBundle` + `<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />`                                    |
| `renderer-json`  | общая раскладка + `registry.ts` | `form.schema.ts` — документ формата 2 в `defineJsonSchema<T>`; `createForm({ model, schema, registry })` + `<FormRenderer form={bundle} />` |

Дерево файлов в §1 — по этой раскладке (для core / renderer-react подсекцию §2.3 registry.ts удалить).

### Schema-driven UI rule (CRITICAL — главная находка iter-11)

**Компонент И его пропсы декларируются в СХЕМЕ**. JSX рендерит `<FormField control={form.x} />` БЕЗ дополнительных props. Применимо ко ВСЕМ targets, включая core.

```ts
// form.schema.ts ✓ — узел привязан ручкой модели (ключ `model`, не `value`)
{ model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email', testId: 'email' } }
```

```tsx
// index.tsx ✓ — form = bundle.form (FormGroup), form.email — FormControl
<FormField control={form.email} />
```

❌ **НЕ ДЕЛАЙ**: свои Input/Select/Checkbox компоненты с label-prop'ами в JSX. Это anti-pattern, ломает schema-driven архитектуру и удваивает код.

`FormField` живёт в `@reformer/ui-kit`. Подключай через `import { FormField, Input, InputNumber, SelectAsync, CheckboxWithLabel, Button } from '@reformer/ui-kit'`. Это peer-dependency, не нарушает sandbox или архитектуру.

### Convention testId = path-with-dashes (CRITICAL)

**КАЖДОЕ поле формы ОБЯЗАНО иметь `componentProps.testId`.** Top-level — `testId === fieldName`. Nested groups — **с префиксом группы через дефис** (path joining: `personalData.lastName` → `personalData-lastName`). Array items — имя leaf'а БЕЗ префикса массива (consumer ставит индекс сам).

```ts
// form.schema.ts ✓
{ model: model.$.loanAmount, component: InputNumber, componentProps: { label: '...', testId: 'loanAmount' } },
{ model: model.$.loanType,   component: SelectAsync, componentProps: { label: '...', testId: 'loanType', options: [...] } },

// вложенная группа — подформа { model, part }: part получает под-модель группы
const personalDataPart = (pd: FormModel<PersonalData>): FormSchemaNode => ({
  children: [
    { model: pd.$.lastName,  component: Input, componentProps: { label: 'Фамилия', testId: 'personalData-lastName' } },
    { model: pd.$.firstName, component: Input, componentProps: { label: 'Имя',     testId: 'personalData-firstName' } },
    { model: pd.$.birthDate, component: Input, componentProps: { label: 'Дата рождения', testId: 'personalData-birthDate', type: 'date' } },
  ],
});
{ model: model.$.personalData, part: personalDataPart },

const passportDataPart = (passport: FormModel<PassportData>): FormSchemaNode => ({
  children: [
    { model: passport.$.series, component: Input, componentProps: { label: 'Серия', testId: 'passportData-series' } },
    { model: passport.$.number, component: Input, componentProps: { label: 'Номер', testId: 'passportData-number' } },
  ],
});
{ model: model.$.passportData, part: passportDataPart },

// строка массива { model, component: FieldArray, item } — consumer ставит индекс сам. Внутри item имена полей БЕЗ префикса массива:
const propertyRow = (property: FormModel<PropertyItem>): FormSchemaNode => ({
  children: [
    { model: property.$.type,           component: SelectAsync, componentProps: { label: 'Тип',       testId: 'type', options: [...] } },
    { model: property.$.estimatedValue, component: InputNumber, componentProps: { label: 'Стоимость', testId: 'estimatedValue' } },
  ],
});
{ model: model.$.properties, component: FieldArray, item: propertyRow },
```

**Почему**: testId — единая convention для consumer'ов (POM, abstract tests). Даже без запуска тестов в paper mode convention остаётся ожидаемой нормой; orchestrator проверяет её по тексту (C2/C3).

### Type-safety правила (must follow — листинг должен быть type-correct by construction)

- **type aliases** для типа формы, **НЕ interface** (avoids TS2344 cascade)
- `import type { Rule } from '@reformer/core/validation'` (тип правила поля; `ModelValidator` и `ValidationSchemaFn` удалены). Cross-field — `cross` из аргумента `defineValidation<T>(({ model, cross }) => …)` над типизированным снимком
- `import { required, min, max, email, pattern, minLength, maxLength } from '@reformer/core/validators'` (submodule — только чистые фабрики, без `message`: `required({ code: 'loanAmount.required' })`; операторы `validate` / `validateWhen` — в `@reformer/core/validation`)
- computed — в `form.behavior.ts` (`defineFormBehavior` из `@reformer/core/behaviors`); `compute` читает модель напрямую, `computeFrom` получает значения источников по порядку:
  ```ts
  compute(model.$.y, () => model.x * 2); // ✓
  computeFrom([model.$.x], model.$.y, (x) => x * 2); // ✓ явный список зависимостей
  computeFrom([model.$.x], model.$.y, (x) => x as number); // ✗ never cast
  ```
- **union-type defaults**: начальные значения живут в модели, а не в узле схемы — `createModel<CreditForm>({ … })` (или `initial` в `createForm<T>`) сверяет литерал `'male'` с типом формы, widening к `string` нет. Прежний `satisfies FieldConfig<…>` на узле не нужен — у узла нет `value`
- **тип узла `FormSchemaNode` закрыт**: прежние ключи `value:` / `array:` вместо `model:` и `validators` в узле — ошибка компиляции (Recipe 3 в `30-type-safety-recipes.md`)
- никаких `as`-кастов для обхода типов в схеме
- следуй всем рецептам из `find_recipe(topic="type-safety-recipes")`

> На бумаге нет tsc — эти правила невозможно проверить компилятором. Поэтому места, где ты **не уверен**, что код скомпилируется (overload, prop-flow, union widening), выписывай в §3.1 «Type-risk spots». Честная самодекларация здесь — часть калибровочного сигнала.

---

## Step 3.5 — paper-compile self-check (замена tsc/build)

Единственный «компилятор» на бумаге — сами MCP-tools. Оба sandbox-legal. Заполни §3.1 листинга.

1. **`renderer-json` → `validate_form(kind="json-schema")`.** Возьми документ формата 2 из §2.1 (`form.schema.ts`, аргумент `defineJsonSchema<T>(…)`) и прогони:

   ```
   validate_form(kind="json-schema", schema=<твой документ>, componentNames=[...из registry.ts...], dataSourceNames=[...из registry.ts...])
   ```

   Запиши `{valid, errors}`. Если `invalid` — **почини листинг и перепрогони** (paper-аналог tsc-retry loop, cap 3 цикла). Для core / renderer-react: `n/a — target не JSON-DSL`.

2. **Все target'ы → `validate_form(kind="behaviors")`.** Построй dep-map для 8 computed + copyFrom (`target ← reads[]`) и прогони:

   ```
   validate_form(kind="behaviors", dependencies=[{ target: "monthlyPayment", reads: ["loanAmount","loanTerm","interestRate"] }, ...])
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
- Узел схемы привязывается ручкой модели `model.$.x` (в builder'е `(model) => узел`). Нода формы — `FormControl` / `FormGroup` (`bundle.form.x`): её получают `<FormField control>` и хуки `@reformer/core/react`. Перепутаешь — ошибка компиляции или рантайма (в листинге отрази корректно).
- В `renderer-json` схема — документ формата 2 (`"format": 2`, привязка ключом `model`) в `form.schema.ts` через `defineJsonSchema<T>`. Строковые операторы `$model(path)` / `$component(Name)` / `$dataSource(Name)` / `$part(name)`; каждый `$component`/`$dataSource` ОБЯЗАН быть в `registry.ts`, иначе `validate_form(kind="json-schema")` (и рантайм) упадёт.
- `.d.ts` в `node_modules` — крайний fallback только когда MCP молчит, и всегда с gap-логом. Тихое чтение = tainted при аудите.
