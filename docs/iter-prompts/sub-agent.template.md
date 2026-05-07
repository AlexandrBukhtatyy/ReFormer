# Sub-agent — iter-{ITER} target={TARGET}

> Шаблон. Orchestrator подставляет `{ITER}`, `{TARGET}`, `{SPEC_PATH}` перед вызовом Agent'а.
> Полный план: [docs/plans/proud-pondering-jellyfish.md](../plans/proud-pondering-jellyfish.md).

---

## Sandbox — strict, NO exceptions

Ты — sub-agent в **MCP-only sandbox**. Цель — сгенерировать форму **только** на основе MCP-сервера (`@reformer/mcp`) и спеки. Это тест **качества MCP**, а не Claude. Любое чтение существующего кода в `packages/` или родственных примерах в `projects/.../examples/` — **подделка результатов** (tainted).

### МОЖНО

- MCP tools: `mcp__reformer__find_recipe`, `mcp__reformer__get_symbol_docs`, `mcp__reformer__report_issue`
- MCP prompts/resources, экспонированные сервером (через slash-commands если настроены)
- Read спеки: `{SPEC_PATH}` (read-only — НЕ редактировать, см. CLAUDE.md → Specs are read-only)
- Read/Write своего workspace: `.tmp/iter-artifacts/iter-{ITER}/{TARGET}/`
- Write нового кода: `projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-v{ITER}/`
- Write e2e теста: `projects/react-playground-e2e/tests/iter/mcp-credit-{TARGET}-v{ITER}.spec.ts`
- Bash: tsc / eslint / playwright / mkdir / find (на свои каталоги)
- `node_modules/@reformer/*` — это то, что видит реальный консумент через `npm install`. Используй ТОЛЬКО если MCP не дал ответа; зафиксируй такой случай как gap.

### НЕЛЬЗЯ (orchestrator аудирует через grep по transcript'у)

- Read/Glob/Grep по `packages/` (исходники библиотек)
- Read/Glob/Grep по `projects/react-playground/src/pages/examples/` кроме своего нового каталога
- Read/Glob/Grep по `projects/react-playground/src/components/`, `factories/`, `hooks/`, `utils/`, и подобным «общим» helper'ам
- Любая правка `docs/specs/`
- `git commit`, `git push`, `git tag`, `git checkout` (любая ветка)
- Изменение `App.tsx` — это сделает orchestrator после успешной генерации

Если поймал себя на запрещённой операции — откатить, зафиксировать в `dev-report.md` секции «Sandbox violations» (это понизит iter score, но честно).

---

## Step 0 — acknowledge

В первом сообщении распечатай:

> Working in MCP-only sandbox. Target=`{TARGET}`. Iter=`{ITER}`. Spec=`{SPEC_PATH}`.
> Allowed sources: MCP server + spec + own workspace.
> Forbidden: packages/, sibling examples, common helpers.

---

## Step 1 — discovery

1. **Read спеки** `{SPEC_PATH}`. Запомнить:
   - Шаги формы (FormWizard pages)
   - Поля per-step + типы
   - Валидации (sync + async)
   - Computed-fields (formula-based)
   - FormArray sections (списки)
   - Conditional rendering (applyWhen)

2. **Discovery через MCP** — обязательный набор для полной реализации спеки:

   **Обязательные recipes:**
   - `find_recipe(topic="quick-start")` — **ПЕРВЫМ**, раздел про FormField + Arrays of objects
   - `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")` — **ОБЯЗАТЕЛЬНО для ВСЕХ targets**
   - `find_recipe(topic="type-safety-recipes")` — Recipe 8 для union-type defaults
   - `find_recipe(topic="form-wizard")` — multi-step. **Читай разделы про STEP_VALIDATIONS shape** (Record<number, ...>, НЕ array — silent no-op!) и **RenderContextProvider** если используешь RenderNode body
   - `find_recipe(topic="form-array")` — tuple format `[itemSchema]`, для всех 3 array sections спеки
   - `find_recipe(topic="compute-from")` — 8 computed fields (alias map активен)
   - `find_recipe(topic="async-validator")` / `find_recipe(topic="async-validator-debounce")` — для email uniqueness, INN check
   - `find_recipe(topic="async-options-loading")` — для cities by region, carModel by carBrand
   - `find_recipe(package="@reformer/ui-kit", topic="input-mask")` — phones, passport, INN, SNILS
   - `find_recipe(topic="copy-from")` — sameAsRegistration → residenceAddress
   - `find_recipe(topic="validation")` — required/min/max/pattern/email + cross-field
   - `find_recipe(topic="common-mistakes")` — overload-error decoding (превентивно)

   **Target-specific:**
   - `core` → `find_recipe(topic="hooks")` (useFormControlValue для conditional rendering)
   - `renderer-react` → `find_recipe(topic="renderer-react")` (overview + RenderSchema)
   - `renderer-json` → `find_recipe(package="@reformer/renderer-json", topic="overview")` (closure-pattern)

   **Symbols (минимум):**
   - `get_symbol_docs(symbol="createForm")`
   - `get_symbol_docs(symbol="FormField")` (живёт в `@reformer/ui-kit`)
   - `get_symbol_docs(symbol="ValidationSchemaFn")`
   - `get_symbol_docs(symbol="computeFrom")`
   - `get_symbol_docs(symbol="applyWhen")`
   - target-specific:
     - `renderer-react` → `get_symbol_docs(symbol="createRenderSchema")`
     - `renderer-json` → `get_symbol_docs(symbol="JsonFormRenderer")` (НЕ `JsonRenderer` — такого нет), `get_symbol_docs(symbol="createRenderSchemaFromJson")`

3. **Сохранить raw responses** в `.tmp/iter-artifacts/iter-{ITER}/{TARGET}/discovery.md` (для аудита и repro). Один блок на каждый MCP-вызов с заголовком и query.

---

## Step 2 — planning

Записать `.tmp/iter-artifacts/iter-{ITER}/{TARGET}/dev-plan.md` по шаблону [`docs/iter-prompts/templates/dev-plan.template.md`](./templates/dev-plan.template.md):

- Структура формы (из спеки)
- Список файлов которые будут созданы
- Список recipes/symbols, которые планируешь использовать (со ссылками на discovery.md)
- Open questions: что MCP не разъяснил — это будущие gap'ы

---

## Step 3 — code generation

> ## SCOPE — реализуй ПОЛНУЮ спеку
>
> Цель iter — проверить, что **MCP-only sub-agent делает форму ПО СПЕКЕ без ошибок**, не подглядывая в исходники reformer. Реализация должна **соответствовать оригинальной спецификации** в `{SPEC_PATH}`. 3 sub-agent'а (core/renderer-react/renderer-json) делают **ту же самую форму** — это позволит сравнить разные стеки реформера на одной задаче.
>
> **Реализуй ВСЁ что описано в спеке**:
> - **Все 6 шагов FormWizard** с их полями и темами (Кредит → Личные → Контакты → Работа → Доп. инфо → Подтверждение)
> - **Все поля** каждого шага (~80 полей всего) — не пропускать, не объединять, не упрощать
> - **Все computed fields** через `computeFrom` (`fullName`, `age`, `interestRate`, `monthlyPayment`, `initialPayment`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`)
> - **Все conditional rendering** через `applyWhen` (mortgage, car, employed, selfEmployed, sameAsRegistration, hasProperty, hasExistingLoans, hasCoBorrower)
> - **Все FormArray sections** — `properties[]`, `existingLoans[]`, `coBorrowers[]` со всеми полями элементов
> - **Все validators** из спеки — `required`, `min`/`max`, `minLength`/`maxLength`, `pattern`, `email`, cross-field validations
> - **Async validators** где описаны в спеке (email uniqueness, INN validation)
> - **Async options loading** где описаны (city by region, carModel by carBrand)
> - **InputMask** для phone/passport/INN/SNILS/postalCode/etc
>
> **Если что-то не понятно из спеки** — фиксируй в dev-report как «open question / spec ambiguity», но НЕ выбрасывай поле/механизм.
>
> **Если что-то не получилось из-за gap в MCP** (recipe не помог, symbol не нашёлся) — фиксируй как gap **с конкретным указанием** какого ответа MCP не хватило. Это главный output iter.
>
> **Token budget per sub-agent: что нужно — то и трать**. Реализация полной спеки приоритетнее экономии токенов. iter-12 показал ~180k tokens / ~25-30 мин per target — это нормальный target.

```bash
mkdir -p projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-v{ITER}
```

В зависимости от target:

| target           | files                                                  | стек                                       |
| ---------------- | ------------------------------------------------------ | ------------------------------------------ |
| `core`           | `schema.ts` + `index.tsx`                              | `createForm` + `FormWizard` (ui-kit) + `FormField` (ui-kit) |
| `renderer-react` | `schema.ts` + `index.tsx`                              | `createRenderSchema` + `<FormRenderer fieldWrapper=FormField>` |
| `renderer-json`  | `schema.json` + `index.tsx`                            | `<JsonFormRenderer>` + closure pattern (НЕ `JsonRenderer` — такого нет) |

### Schema-driven UI rule (CRITICAL — главная находка iter-11)

**Компонент И его пропсы декларируются в СХЕМЕ**. JSX рендерит `<FormField control={form.x} />` БЕЗ дополнительных props. Это применимо ко ВСЕМ targets, включая core.

```ts
// schema.ts ✓
{ email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } } }
```
```tsx
// page.tsx ✓
<FormField control={form.email} />
```

❌ **НЕ ДЕЛАЙ**: свои Input/Select/Checkbox компоненты с label-prop'ами в JSX. Это anti-pattern, ломает schema-driven архитектуру и удваивает код.

`FormField` живёт в `@reformer/ui-kit`. Подключай через `import { FormField, Input, Select, Checkbox, Button } from '@reformer/ui-kit'`. Это **peer-dependency**, не нарушает sandbox или архитектуру.

### Type-safety правила (must follow)

- **type aliases** для FormFields, **НЕ interface** (avoids TS2344 cascade)
- `import type { ValidationSchemaFn } from '@reformer/core'` (НЕ `/validators`)
- `import { required, applyWhen, ... } from '@reformer/core/validators'` (functions из submodule)
- annotated destructuring в `computeFrom` callback'ах:
  ```ts
  computeFrom([path.x], path.y, ({ x }: MyForm) => ...)  // ✓
  computeFrom([path.x], path.y, ({ x }) => x as number)  // ✗ never cast
  ```
- **union-type defaults**: `value: 'male'` widening к `string`. Используй `satisfies FieldConfig<UnionType>` (Recipe 8 в `30-type-safety-recipes.md`):
  ```ts
  gender: { value: 'male', component: Radio, componentProps: { ... } } satisfies FieldConfig<Gender>
  ```
- **TS2769 `'form' does not exist in FormSchema<T>'`** — misleading. Это симптом literal-widening внутри. Extract `const form: FormSchema<T> = { ... }` чтобы получить реальную ошибку. См. `05-common-mistakes.md`.
- никаких `as`-кастов для обхода типов в схеме
- следуй всем рецептам из `find_recipe(topic="type-safety-recipes")`

---

## Step 4 — validation loop (max 3 cycles)

```bash
cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc-{TARGET}.log
```

Если errors:
- Распарсить (TS2614 / TS2322 / TS7006 / TS2589 — каждая категория имеет известный фикс)
- **Использовать MCP** (`find_recipe`, `get_symbol_docs`) для уточнения сигнатуры
- Применить fix
- Retry tsc

После tsc — lint:
```bash
npm run lint -w react-playground 2>&1 | tail -50
```

После lint — build:
```bash
npm run build -w react-playground 2>&1 | tail -30
```

Если 3 цикла fail — мягкий exit, dev-report `status=blocked`, скип e2e (Step 5).

---

## Step 5 — e2e walkthrough (Playwright)

Создать `projects/react-playground-e2e/tests/iter/mcp-credit-{TARGET}-v{ITER}.spec.ts`:

> **Walkthrough всех 6 шагов** — заполни **все required поля** каждого шага (по спеке), fullPage screenshot после заполнения. Итого 7 screenshots (page1..page6 + page-final). Цель — провести форму до submit, чтобы убедиться что всё работает end-to-end.

```ts
import { test } from '@playwright/test';

const N = {ITER};
const TARGET = '{TARGET}';
const URL = `/mcp-credit-application-${TARGET}-v${N}`;

test(`mcp-credit-${TARGET}-v${N} — walkthrough`, async ({ page }) => {
  await page.goto(URL);

  for (const step of [1, 2, 3, 4, 5, 6]) {
    // Step-specific: заполни required поля шага (минимум — те, которые ты определил в схеме)
    // ...

    await page.screenshot({
      path: `screenshots/mcp-credit-v${N}/${TARGET}/page${step}-filled.png`,
      fullPage: true,
    });

    if (step < 6) {
      await page.getByRole('button', { name: /Далее|Next/i }).click();
    }
  }

  // Submit
  await page.getByRole('button', { name: /Отправить|Submit/i }).click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: `screenshots/mcp-credit-v${N}/${TARGET}/page-final.png`,
    fullPage: true,
  });
});
```

Запустить (dev-server должен быть поднят orchestrator'ом):
```bash
cd projects/react-playground-e2e && \
  ITER_MODE=on \
  ITER_OUTPUT_DIR=videos/mcp-credit-v{ITER}/{TARGET}/ \
  npx playwright test --project=iter mcp-credit-{TARGET}-v{ITER}.spec.ts \
    2>&1 | tee /tmp/playwright-{TARGET}.log
```

После теста переименовать видео в каноничный путь:
```bash
# Playwright кладёт в videos/.../<test-name>/video.webm — переименовать
find projects/react-playground-e2e/videos/mcp-credit-v{ITER}/{TARGET} \
  -name 'video.webm' -exec mv {} \
  projects/react-playground-e2e/videos/mcp-credit-v{ITER}/{TARGET}/walkthrough.webm \;
```

**Важно**:
- `--project=iter` обязателен — иначе тест не подхватится (см. `playwright.config.ts` projects).
- `ITER_MODE=on` включает video + viewport 1440×900.
- Скриншоты обязательно `fullPage: true` (см. CLAUDE.md memory rule).

---

## Step 6 — dev-report

Записать `.tmp/iter-artifacts/iter-{ITER}/{TARGET}/dev-report.md` по шаблону [`docs/iter-prompts/templates/dev-report.template.md`](./templates/dev-report.template.md). Заполнить ВСЕ секции; пустые помечать `n/a — reason`.

Особое внимание — **MCP gaps**: каждый gap должен иметь:
- `gap-id`: короткий slug (`g-find_recipe-async-fail`)
- `severity`: high / med / low
- `evidence`: цитата ответа MCP или фраза «MCP returned no recipe for X»
- `proposed fix`: что добавить в MCP (новый recipe / extra example / правка template)

---

## Step 7 — return

Вернуть orchestrator'у короткий structured summary как **последнее сообщение agent'а**:

```yaml
status: ok | partial | blocked | tainted
target: {TARGET}
iter: {ITER}
gaps:
  high: N
  med: N
  low: N
files_written:
  - projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-v{ITER}/schema.ts
  - projects/react-playground/src/pages/examples/mcp-credit-application-{TARGET}-v{ITER}/index.tsx
  - projects/react-playground-e2e/tests/iter/mcp-credit-{TARGET}-v{ITER}.spec.ts
report_path: .tmp/iter-artifacts/iter-{ITER}/{TARGET}/dev-report.md
discovery_path: .tmp/iter-artifacts/iter-{ITER}/{TARGET}/discovery.md
screenshots_count: N
video_path: projects/react-playground-e2e/videos/mcp-credit-v{ITER}/{TARGET}/walkthrough.webm
blockers:
  - (если есть)
```

---

## Известные подводные камни

- `find_recipe` без явной темы возвращает топ-1. Если ответ не подходит — переформулируй keyword (`computed` / `compute-from` / `derived`).
- При TS-error «implicit any on `path`» — проверь импорт `ValidationSchemaFn` (Recipe 1: из `@reformer/core`, не из `/validators`).
- `path.X` (FieldPath) используется в схеме (`createForm` callback). `form.X` (FormProxy) — в hooks. Перепутаешь — runtime-ошибка.
- В `renderer-json` schema.json — это **JSON**, не TS. Импорт через `import schema from './schema.json'` с `tsconfig` `resolveJsonModule: true` (должно быть включено по умолчанию в playground).
- Дев-сервер должен уже работать на `http://localhost:5173`. Если не работает — fail-fast в Step 5, но **не запускай его сам** (это работа orchestrator'а или пользователя).
