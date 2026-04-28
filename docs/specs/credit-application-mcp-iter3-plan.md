# План iteration 3: фиксы MCP по результатам визуально-поведенческой проверки v2-страниц

> Это **план для следующей итерации MCP**, не отчёт о done-работе. Цель — закрыть пробелы, из-за которых sub-агенты допустили перечисленные ниже дефекты на pages 1/2/3 в v2.
>
> Источник дефектов: re-check всех трёх v2-страниц через playwright 2026-04-28 (см. `screenshots/mcp-credit-v2/recheck/page<N>/`). Сравнение с baseline `complex-multy-step-form*`.

## Сводка дефектов по страницам

| # | Дефект | Page 1 (core) | Page 2 (renderer-react) | Page 3 (renderer-json) | Severity |
|---|---|---|---|---|---|
| D1 | `[object Object]` в "Описание" нового item FormArray (sub-agent передал FieldConfig вместо plain leaves в template для AddButton) | **YES** | NO ✓ | NO ✓ | **critical** |
| D2 | `hasEncumbrance` checkbox самопроизвольно `true` в новом item (та же причина, FieldConfig instead of leaf) | **YES** | NO ✓ | NO ✓ | **critical** |
| D3 | Toggling hasProperty/hasExistingLoans **крашит app в белый экран** (TypeError в FormField.Root + нет ErrorBoundary) | NO | NO | **YES** | **critical** |
| D4 | Conditional fields (mortgage/auto-only, business-only) рендерятся ВСЕГДА просто как disabled, а не скрываются. Визуальный спам vs baseline | YES | YES | YES | **high** |
| D5 | Spec compliance: page 3 сильно усечён (gender, birthPlace, snils, companyInn, companyPhone, companyAddress, businessInn, businessActivity, additionalIncomeSource etc. ОТСУТСТВУЮТ; passport collapsed в одно поле; maritalStatus/childrenCount perепenесены из step 5 в step 2) | NO | NO | **YES** | **high** |
| D6 | Inconsistent testIds: page 1 = `input-loanAmount`, page 2 = `input-step1-loanAmount`, page 3 = `input-loanAmount`. Tests не переносимы между страницами | YES | YES | YES | high |
| D7 | Generic error msg `"Поле обязательно для заполнения"` без человеческого текста — пропущенный `{ message: '...' }` argument в `required(...)` | NO ✓ | YES (50%) | YES (~70%) | high |
| D8 | Step indicator chips НЕ кликабельны → нельзя свободно навигировать между завершёнными шагами как на baseline | YES | YES | YES | medium |
| D9 | Step indicator без иконок и тире/разделителей (baseline: `<Coins/> Кредит 1 — <User/> Данные 2 — ...`) | YES | YES | YES | medium |
| D10 | Нет card wrap (`bg-white border rounded-xl shadow-sm p-6`) вокруг секции step | YES | NO ✓ | YES | medium |
| D11 | Нет progress bar внизу `Шаг N из 6 • XX% завершено` | YES | YES | YES | medium |
| D12 | Кнопка "Далее" без стрелки `→`, выравнивание разнится (page 3 — слева, pages 1/2 — справа) | YES | YES | YES | low |
| D13 | Page 2: label "Имеется обременение (залог)" дублируется (h-label + ui-kit Checkbox label) в карточке Property | NO | YES | NO | medium |
| D14 | Page 3 placeholder англ. "Select an option..." вместо "Выберите тип кредита" | NO | NO | YES | medium |
| D15 | Page 3 единицы измерения inconsistent: "(руб.)" vs pages 1/2 "(₽)"; "(мес.)" vs "(месяцев)" | NO | NO | YES | low |
| D16 | Page 3 conditional field carBrand+carModel collapsed в одно текстовое поле "Марка/модель авто" | NO | NO | YES | high |
| D17 | Phone validation pattern требует точно `+7 (916) 123-45-67` (с пробелами и скобками), не пропускает чистый `+79161234567` — UX gap, нет normalization | YES | YES | NO* (нет такой валидации) | low |
| D18 | Inconsistent rate maps: page 1 consumer=15.5%, page 2 consumer=17%, page 3 consumer=0 (computed cascade не сработал на mount) | YES | YES | YES | low |
| D19 | Page 1 "Семейное положение" + "Кол-во иждивенцев" в 2 колонки; page 2 + page 3 — RadioGroup vertical / 3-колонки. Inconsistent layout density | YES | YES | YES | low |
| D20 | Page 1+3: разные defaults loanType (page 1 default consumer, page 3 default empty с placeholder) | YES | NO | YES | low |

\* page 3 сильно усечён — phoneMain поле просто отсутствует, отдельный D5.

## Корневые причины и фиксы MCP

### RC1 → закрывает D1, D2 (page 1 stage 4 ошибка с FieldConfig)

**Корневая причина:** На момент работы page 1 stage 4 sub-agent в MCP не было правила #11 про `FormArray.AddButton.initialValue` ожидает PLAIN leaf values. Page 2 sub-agent его обнаружил эмпирически (после `[object Object]`), правило добавлено в `create-form` prompt iter-2 final commit. Page 1 НЕ был перезапущен с обновлённым промптом.

**Фикс MCP:**
1. Сделать тот же warning **отдельным жирным блоком** в `add-form-array` prompt, не только в `create-form`. Sub-agent для stage 4 (FormArray) идёт в `add-form-array`, не в `create-form`.
2. Добавить в `find_recipe topic:"form-array"` recipe пример с **wrong vs right** template:
    ```typescript
    // ❌ WRONG — produces [object Object] in fields, checkbox flips to true
    const wrongTemplate = () => ({
      type: { value: 'apartment', component: Select, ... },  // FieldConfig — not allowed in initialValue
    });

    // ✅ RIGHT — plain leaf values
    const rightTemplate = () => ({
      type: 'apartment',
      description: '',
      estimatedValue: 0,
      hasEncumbrance: false,
    });
    ```
3. Опционально: добавить runtime guard в `FormArray.AddButton` который detect `initialValue` со shape `{ value: ..., component: ... }` и бросает **дев-friendly error** вместо silent corruption.

**Action items:**
- [ ] `packages/reformer-mcp/src/prompts/add-form-array.ts` — preamble warning block.
- [ ] `packages/reformer/docs/llms/10-arrays.md` — wrong/right side-by-side example в "Add/remove items" секции.
- [ ] `packages/reformer-mcp/src/prompts/create-form.ts` правило #11 — оставить.
- [ ] (Optional) `packages/reformer-cdk/src/form-array/...` — runtime warn/throw.

### RC2 → закрывает D3 (page 3 toggle крашит app)

**Корневая причина:** Page 3 sub-agent либо (а) не реализовал hasProperty toggle вообще для array section в JSON registry, и при render тригерится FormField.Root над `undefined` control, либо (b) `useFormControl(form.step5.hasProperty)` возвращает `undefined` потому что путь сместился (sub-agent поставил hasProperty в step 4, а array-blocks ищут в step 5). Симптом: TypeError "Cannot read properties of undefined (reading 'value')" в FormField.Root.

**Фикс MCP:**
1. В `add-form-array` prompt для **target=renderer-json** добавить отдельную секцию "Hide-when-toggle-off pattern". Закрепить идиому:
    ```typescript
    // Custom block component (registered in defineRegistry)
    function PropertiesArrayBlock({ form }: { form: FormProxy<MyForm> }) {
      const ctrl = useFormControl(form.step5.hasProperty); // <-- exact path
      const hasProperty = (ctrl as { value?: boolean })?.value;
      if (!hasProperty) return null;
      // ... FormArray.Root ...
    }
    ```
2. Добавить **defensive null-check** в шаблонах: если `useFormControl(form.x.y)` вернул `undefined` (путь не существует), ОБЯЗАТЕЛЬНО вернуть `null` перед обращением к `.value`. Текущая идиома `(ctrl as unknown as {value: boolean}).value` падает на undefined.
3. Документировать в troubleshooting: **"Cannot read properties of undefined (reading 'value')" в FormField.Root после toggle = path mismatch между schema и FormProxy. Проверить, что путь в `useFormControl(form.X.Y)` идентичен пути в `createForm({ form: { X: { Y: ... } } })`**.
4. Sub-agent должен НЕ перемещать hasProperty/hasExistingLoans/hasCoBorrower из step 5 в другие шаги — добавить в `create-form` prompt правило: "Не реструктурировать спеку — поля step5 должны оставаться в step5".

**Action items:**
- [ ] `packages/reformer-mcp/src/prompts/add-form-array.ts` — отдельный target=renderer-json раздел.
- [ ] `packages/reformer-renderer-json/docs/llms/06-troubleshooting.md` — entry "TypeError Cannot read properties of undefined value".
- [ ] `packages/reformer-renderer-json/docs/llms/05-custom-blocks.md` (новый) — defensive null-check pattern.
- [ ] `packages/reformer-mcp/src/prompts/create-form.ts` — правило: "Не реструктурируй спеку, поля по шагам как заданы".

### RC3 → закрывает D4 (conditional fields visible disabled)

**Корневая причина:** Sub-агенты следовали идиоме `enableWhen(...)` (которая снимает/возвращает disabled), но НЕ скрывали поля. На baseline `complex-multy-step-form` поля скрываются через React conditional render (`{loanType === 'mortgage' && <Field ... />}`) — disable + visible выглядит как визуальный спам.

**Фикс MCP:**
1. В `add-behavior` prompt различить две идиомы:
    - **`enableWhen`** — для случаев когда поле должно остаться видимым (например, password confirmation активен только когда password есть).
    - **`hideWhen`** (или conditional render via `useFormControlValue` + JSX `{cond && <FormField/>}`) — когда нерелевантное поле должно ИСЧЕЗНУТЬ.
2. Добавить в `create-form` prompt правило: "Conditional поля (mortgage-only, auto-only, employed-only, business-only) скрывай через JSX-conditional или RenderSchema `hideWhen`, не через `enableWhen` (последний оставляет грязный disabled clutter)".
3. Для renderer-react: использовать `RenderBehaviorFn` + `node.setHidden()` или прямой `hideWhen(...)` recipe, не `enableWhen`.
4. Для renderer-json: те же кастомные блоки с conditional return.

**Action items:**
- [ ] `packages/reformer-mcp/src/prompts/add-behavior.ts` — preamble: "enableWhen vs hideWhen — когда что использовать".
- [ ] `packages/reformer/docs/llms/04-common-patterns.md` или новый `21-hide-vs-disable.md`.
- [ ] `packages/reformer-mcp/src/prompts/create-form.ts` — правило "conditional fields → hidden, not disabled".

### RC4 → закрывает D5, D16 (page 3 spec drift)

**Корневая причина:** Sub-agent для page 3 не получил жёсткой инструкции "не дробить и не объединять поля спеки". Решил скомпрессировать форму для собственного удобства (passport стал одним полем; carBrand+carModel collapsed в "Марка/модель авто"; gender/birthPlace/snils пропущены; maritalStatus переехал в step 2; hasProperty переехал в step 4).

**Фикс MCP:**
1. В `create-form` prompt добавить правило: "Используй спеку как **literal**: каждый field name спеки = отдельный field в FormSchema. Не объединять fields, не пропускать, не переносить между шагами. Если поле в спеке логически parent.child — нести в FormSchema как `parent: { child: {...} }` (а не `parent_child: {...}`)".
2. После генерации FormSchema в финальном чек-листе sub-agent ОБЯЗАН перечислить все fields спеки и подтвердить включение (с галочкой). Если поле пропущено — обосновать.

**Action items:**
- [ ] `packages/reformer-mcp/src/prompts/create-form.ts` — правило о literal-подходе к спеке + чек-лист в финальном выводе.

### RC5 → закрывает D6 (inconsistent testId conventions)

**Корневая причина:** В `ui-kit` `FormField` пробрасывает `testId` пропс на input как `data-testid="input-{testId}"`. Sub-agents разных страниц передавали разные форматы:
- Page 1: `<FormField testId="loanAmount" />` → `input-loanAmount`
- Page 2: `<FormField testId="step1.loanAmount" />` или подобное с auto-namespace → `input-step1-loanAmount`
- Page 3: `<FormField testId="loanAmount" />` через JSON registry → `input-loanAmount`

**Фикс MCP:**
1. В `create-form` prompt добавить правило: "testId формируй как dotted-path по структуре FormSchema (`step1.loanAmount`, `step2.passportData.series`). НЕ использовать просто leaf name — через несколько шагов collisions неизбежны".
2. Документировать canonical pattern в `packages/reformer-ui-kit/docs/llms/05-form-field-integration.md`.

**Action items:**
- [ ] `packages/reformer-mcp/src/prompts/create-form.ts` — правило testId convention.
- [ ] `packages/reformer-ui-kit/docs/llms/05-form-field-integration.md` — testId section.

### RC6 → закрывает D7 (generic error messages)

**Корневая причина:** `required(path.X)` без `{ message: '...' }` argument дефолтно показывает "Поле обязательно для заполнения". Sub-agents pages 2/3 пропустили message чаще, чем page 1.

**Фикс MCP:**
1. В `add-validation` prompt в каждом примере **обязательно** показывать message argument: `required(path.loanAmount, { message: 'Введите сумму кредита' })`. Сейчас в некоторых примерах пропущен.
2. Добавить правило: "В `required(...)` всегда передавай `{ message: '...' }` с осмысленным текстом, никогда не оставляй default — пользователь не понимает, какое поле проверить".

**Action items:**
- [ ] `packages/reformer-mcp/src/prompts/add-validation.ts` — preamble правило + все примеры с message.
- [ ] `packages/reformer/docs/llms/04-common-patterns.md` — обновить validation snippets.

### RC7 → закрывает D8, D9, D10, D11, D12, D13 (visual-density gap vs baseline)

**Корневая причина:** Текущий `create-form` layout-skeleton показывает **минимальный** Section/Box/grid pattern. На baseline есть полноценный wizard UI с card wrap, иконами в indicator, прогресс-баром, "Далее →" arrow, нав-чипами кликабельными.

**Фикс MCP:**
1. Переписать layout-skeleton в `create-form` prompt:
    - Step section wrap: `<section className="bg-white border rounded-xl shadow-sm p-6 space-y-4">` (не просто `<section className="space-y-4">`).
    - Step indicator: ссылка на baseline-визуал с иконами + dashes; chip = `<button>` с onClick → setCurrentStep (если completedSteps.has(n) || n <= maxReachedStep).
    - Footer с прогресс-баром: `<div className="text-sm text-center text-gray-500">Шаг {currentStep} из {TOTAL_STEPS} • {Math.round((currentStep-1)/(TOTAL_STEPS-1)*100)}% завершено</div>`.
    - Кнопка "Далее →" с arrow.
2. Добавить новый recipe `find_recipe topic:"wizard-ui-density"` показывающий полный шаблон.

**Action items:**
- [ ] `packages/reformer-mcp/src/utils/project-detector.ts` `renderLayoutSkeletonBlock(...)` — расширить.
- [ ] `packages/reformer-mcp/src/prompts/add-wizard.ts` — добавить полный UI skeleton (текущий слишком тощий).
- [ ] Новый recipe `packages/reformer-cdk/docs/llms/11-wizard-ui-density.md`.

### RC8 → закрывает D13 (label дублирование Checkbox в array на page 2)

**Корневая причина:** В render-schema.tsx page 2 для array item используется `<CdkFormField.Root + Label + Control + Error>`. `CdkFormField.Label` рендерит label из `componentProps.label`. Внутри `Checkbox` ui-kit ТОЖЕ рендерит label справа от чекбокса (свой собственный). Получается двойной label.

**Фикс MCP:**
1. Для `Checkbox` НЕ использовать `CdkFormField.Label` — пробрасывать `componentProps.label` прямо в Checkbox (он сам отрисует).
2. Документировать это исключение в `add-form-array` prompt (target=renderer-react) и `packages/reformer-ui-kit/docs/llms/03-choice-fields.md`.

**Action items:**
- [ ] `packages/reformer-mcp/src/prompts/add-form-array.ts` (target=renderer-react) — excpetion для Checkbox.
- [ ] `packages/reformer-ui-kit/docs/llms/03-choice-fields.md` — Checkbox label idiom note.

### RC9 → закрывает D14, D15, D17, D18, D19, D20 (cosmetic + i18n + naming inconsistencies)

**Корневая причина:** Sub-agents pages 1/2/3 принимают **независимые** решения по placeholder text, label единиц, default rate maps, layout density. MCP не задаёт canonical values, потому каждый sub-agent изобретает своё.

**Фикс MCP:**
1. Для credit-application spec — добавить **referenced canonical labels** в спеку (`docs/specs/credit-application-form.md`). Sub-agent читает спеку, не выдумывает свои.
2. В `create-form` prompt добавить правило: "Все user-facing strings (label, placeholder, error message) бери из спеки или родного языка пользователя; не оставляй дефолтные английские placeholder типа 'Select an option...'".
3. Указать canonical единицы измерения в спеке: суммы — "(₽)", сроки — "(месяцев)" (полное слово, не "мес.").

**Action items:**
- [ ] `docs/specs/credit-application-form.md` — добавить таблицу canonical labels + единицы.
- [ ] `packages/reformer-mcp/src/prompts/create-form.ts` — правило "user-facing strings из спеки, не выдумывать".

## Тестовый план для iter 3

После применения всех фиксов MCP, спавнить **3 новых sub-агента** (по одному на каждый стек) для **page 1+2+3-v3**:
1. `mcp-credit-application-v3/`, `mcp-credit-application-renderer-v3/`, `mcp-credit-application-renderer-json-v3/`.
2. На приёмке проверять каждый из 20 дефектов выше через playwright + DOM assertions.
3. Если дефект остался — фиксить ещё раз MCP, удалять каталог sub-agent, перезапускать.

## Definition of Done iter 3

- [ ] D1, D2, D3 (critical) — закрыты на всех 3 страницах.
- [ ] D4, D5, D6, D7, D16 (high) — закрыты на всех 3 страницах.
- [ ] D8-D13, D14, D15 (medium) — закрыты как минимум на 2 из 3 страниц.
- [ ] D17-D20 (low) — задокументированы как known-acceptable, либо закрыты.
- [ ] MCP-фиксы зафиксированы в `packages/reformer-mcp/src/prompts/*.ts`, `packages/reformer*/docs/llms/*.md`, `packages/reformer-cdk/...`, `docs/specs/credit-application-form.md` — отдельными коммитами.
- [ ] Sub-agent runs для v3 страниц проходят 1-2 итерации (vs 5-15 в iter 1, 1-2 в iter 2 — должно остаться на этом уровне).
- [ ] Финальный отчёт `docs/specs/credit-application-mcp-report-v3.md` с side-by-side скриншотами v2 vs v3 vs baseline.

## Связанные файлы

- Re-check screenshots: `projects/react-playground-e2e/screenshots/mcp-credit-v2/recheck/page<N>/`
- Baseline screenshot: `projects/react-playground-e2e/screenshots/mcp-credit-v2/recheck/baseline-complex-step1.png`
- iter 2 final report: `docs/specs/credit-application-mcp-report-v2.md`
- iter 1 final report: `docs/specs/credit-application-mcp-report.md`
- spec: `docs/specs/credit-application-form.md`
