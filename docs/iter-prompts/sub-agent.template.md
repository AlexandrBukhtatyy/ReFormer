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

2. **Discovery через MCP** — минимальный обязательный набор (~6-8 вызовов, не 18):
   - `find_recipe(topic="quick-start")` — **ОБЯЗАТЕЛЬНО ПЕРВЫМ**, раздел про FormField + Arrays of objects
   - `find_recipe(package="@reformer/ui-kit", topic="form-field-integration")` — **ОБЯЗАТЕЛЬНО для ВСЕХ targets**
   - `find_recipe(topic="type-safety-recipes")` — **ОБЯЗАТЕЛЬНО**, особенно Recipe 8 для union-type defaults
   - `find_recipe(topic="form-wizard")` — для multi-step (если делаешь FormWizard) + **читай раздел про STEP_VALIDATIONS shape** (Record<number, ...>, НЕ array — silent no-op!) + раздел про RenderContextProvider если используешь RenderNode body
   - `find_recipe(topic="form-array")` — **ОБЯЗАТЕЛЬНО для reduced-scope iter** (1 array section). Tuple format `[itemSchema]`, **НЕ** `FieldConfig<T[]>`.
   - `find_recipe(topic="compute-from")` — для 1 computed field (alias map активен)
   - target-specific:
     - `core` → `find_recipe(topic="hooks")` (если используешь useFormControlValue для conditional)
     - `renderer-react` → `find_recipe(topic="renderer-react")` (overview + RenderSchema)
     - `renderer-json` → `find_recipe(package="@reformer/renderer-json", topic="overview")` (closure-pattern)

   **Доп. recipes — только по необходимости** (если ошибка / непонятно):
   - `find_recipe(topic="common-mistakes")` — overload-error decoding (если столкнулся с TS2769)
   - `find_recipe(topic="validation")` — расширенные patterns (если нужны)

   **Symbols** (минимум):
   - `get_symbol_docs(symbol="createForm")`
   - `get_symbol_docs(symbol="FormField")` (живёт в `@reformer/ui-kit`)
   - target-specific:
     - `renderer-react` → `get_symbol_docs(symbol="createRenderSchema")`
     - `renderer-json` → `get_symbol_docs(symbol="JsonFormRenderer")` (НЕ `JsonRenderer` — такого нет)

   **НЕ нужно** в discovery: `find_recipe(async-validator)`, `find_recipe(input-mask)` — потому что мы их НЕ реализуем (см. minimum-viable scope в Step 3).

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

> ## ⚠️ SCOPE — структура из спеки, детали упрощённые
>
> Цель iter — проверить, что **MCP-only sub-agent делает форму без ошибок**, не подглядывая в исходники reformer. **Скелет формы (количество шагов, темы шагов, ключевые секции) должен соответствовать спеке.** Упрощать можно детали внутри шагов.
>
> **Реализуй**:
> - **6 шагов FormWizard** — ровно как в спеке. Темы шагов сохраняй (1. Кредит → 2. Личные данные → 3. Контакты → 4. Работа → 5. Доп. инфо → 6. Подтверждение). Не объединяй и не пропускай шаги.
> - **2-4 поля per шаг** (16-24 поля всего вместо 80+) — выбирай ключевые поля каждого шага из спеки. Для каждого поля бери разные типы (text, number, date, select, checkbox, textarea).
> - **1-2 computed fields** через `computeFrom` — выбери самые показательные из спеки (например `fullName = lastName + firstName + middleName` на step 2; `monthlyPayment = annuityFormula(loanAmount, loanTerm, interestRate)` на step 1). Остальные computed — n/a для iter.
> - **1 conditional rendering** через `applyWhen` — берёшь из спеки (например mortgage section на step 1, или employed section на step 4).
> - **1 FormArray section** (упрощённая) — берёшь любую из 3 в спеке (`properties` / `existingLoans` / `coBorrowers`). 2-3 поля per item, без сложной валидации.
> - **Минимум валидации**: `required` на критичных полях + 1-2 `min`/`max`/`minLength` для демонстрации.
> - **БЕЗ async validators / async options loading / InputMask** — это feature-completeness, не критично для MCP validation. Маркируй в dev-report как «out of iter-scope, not gap».
>
> Это покрывает ВСЕ ключевые механизмы ReFormer (multi-step navigation, computed, conditional, array, типы полей, FormField pattern) при сохранении структуры формы из спеки.
>
> **Token budget per sub-agent: ~120k tokens / ~15 минут**. Если приближаешься к 100k — переходи к Step 4-5 без новых features.

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

> **Walkthrough всех 6 шагов** — заполни минимально-достаточные required поля на каждом, fullPage screenshot после заполнения. Итого 7 screenshots (page1..page6 + page-final).

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
