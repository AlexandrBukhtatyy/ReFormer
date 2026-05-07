# Оптимизация iter-цикла: shared abstract e2e tests вместо per-target generation

## Context

Текущий sub-agent (iter-11..16) тратит ~25-30k tokens на Step 5 — генерацию собственного e2e-walkthrough теста (~110 LOC). Это **дублирование**: 3 sub-agent'а пишут 3 разных теста, проверяющих одну и ту же спеку. Кроме токенов, пострадает cross-target consistency: каждый sub-agent выбирает свои selectors/testIds/assertions.

**Идея пользователя**: написать abstract e2e tests **один раз** на основании спеки, запустить против результата каждого sub-agent'а. Уже сделано в репо для `complex-multy-step-form`! См. ниже.

**Уже существующее переиспользуемое**:
- [`projects/react-playground-e2e/tests/pages/complex-multy-step-form/credit-form-page.pom.ts`](projects/react-playground-e2e/tests/pages/complex-multy-step-form/credit-form-page.pom.ts) — POM `CreditFormPage` с параметризацией `basePath` + `variant: 'compound' | 'renderer' | 'json'`. Все методы `fillLoanAmount`, `fillStep2PersonalData`, `expectComputedField`, и т.п. — уже абстрактные.
- 9 spec-файлов в том же каталоге: `happy-path.spec.ts`, `arrays.spec.ts`, `computed-fields.spec.ts`, `conditional-fields.spec.ts`, `dependencies.spec.ts`, `accessibility.spec.ts`, `loading-error.spec.ts`. **Полное покрытие спеки**.
- POM использует convention `data-testid="input-{testId}"`. ui-kit `FormField` строит этот атрибут из `componentProps.testId` (или из JSX-prop `testId`).
- В [`projects/react-playground-e2e/playwright.config.ts`](projects/react-playground-e2e/playwright.config.ts) уже есть 3 projects (`complex-multy-step-form`, `complex-multy-step-form-renderer`, `complex-multy-step-form-json`) с `metadata.basePath` + `metadata.variant`. POM читает их через fixture в `tests/shared/test-factory.ts`.

**Цель**: убрать e2e generation из sub-agent'а; добавить 3 dynamic playwright projects (`iter-core` / `iter-renderer-react` / `iter-renderer-json`) с `basePath` из `MCP_ITER_VERSION` env; orchestrator запускает abstract specs против iter-форм. Cross-target расхождения становятся **первоклассным сигналом** (target X прошёл 9/9, target Y — 7/9 — конкретно какие spec'и).

Token saving: ~25-30k × 3 = ~75-90k tokens per iter (≈15% от текущего ~600k бюджета).

## Файлы для модификации

### `projects/react-playground-e2e/playwright.config.ts`

Добавить 3 dynamic projects, активные только когда `MCP_ITER_VERSION` env установлен:

```ts
const ITER_VERSION = process.env.MCP_ITER_VERSION;

// в массив projects, после существующих:
...(ITER_VERSION
  ? [
      {
        name: 'iter-core',
        testDir: './tests/pages/complex-multy-step-form',
        use: { ...devices['Desktop Chrome'] },
        metadata: {
          basePath: `/mcp-credit-application-core-v${ITER_VERSION}`,
          variant: 'compound' as const,
        },
      },
      {
        name: 'iter-renderer-react',
        testDir: './tests/pages/complex-multy-step-form',
        use: { ...devices['Desktop Chrome'] },
        metadata: {
          basePath: `/mcp-credit-application-renderer-react-v${ITER_VERSION}`,
          variant: 'renderer' as const,
        },
      },
      {
        name: 'iter-renderer-json',
        testDir: './tests/pages/complex-multy-step-form',
        use: { ...devices['Desktop Chrome'] },
        metadata: {
          basePath: `/mcp-credit-application-renderer-json-v${ITER_VERSION}`,
          variant: 'json' as const,
        },
      },
    ]
  : [])
```

### `docs/iter-prompts/sub-agent.template.md`

**Step 5 (e2e walkthrough)** — переписать. Сейчас sub-agent пишет ~110 LOC e2e теста с 7 screenshot'ами + walkthrough. Заменить на:

- **Smoke runtime check** (~10 LOC): `npx playwright test --project=smoke` (уже существующий smoke project) — проверить что страница рендерится без console errors. Один screenshot final.
- **Convention testId = fieldName** (новое правило в Step 3 / Type-safety rules): для каждого поля схемы `componentProps.testId` ДОЛЖЕН совпадать с именем поля (camelCase). Например: `loanAmount: { ..., componentProps: { testId: 'loanAmount', ... } }`. POM обращается через `data-testid="input-loanAmount"`. **Без этого convention abstract tests упадут.**
  - Для nested groups (personalData, passportData, registrationAddress): testId = `lastName`, `firstName`, `series` и т.п. (без префикса группы — POM ожидает плоские имена).
  - Для array items: testId per item — это сложнее, POM использует индексы; sub-agent должен следовать convention внутри FormArraySection.
- **Не писать** `tests/iter/mcp-credit-{target}-v{ITER}.spec.ts` — orchestrator запускает существующие abstract specs.

Token saving ожидаем ~25-30k per sub-agent.

### `docs/iter-prompts/orchestrator.md`

**Добавить Step 4.5** (после App.tsx merge, перед aggregate):

```bash
# Запуск abstract test suite против всех 3 iter-форм
cd projects/react-playground-e2e

for target in core renderer-react renderer-json; do
  MCP_ITER_VERSION=N npx playwright test \
    --project=iter-${target} \
    --reporter=json \
    > /tmp/iter-${target}-results.json
done
```

Парсить результаты через `jq` или Node:
- Per spec / per target — pass/fail
- Total pass rate per target
- Расхождения cross-target

Записать в `iter-summary.md` секцию **"Abstract test results"**:

| target | happy-path | arrays | computed | conditional | dependencies | a11y | loading-error |
|--------|-----------|--------|----------|-------------|--------------|------|---------------|
| core | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ 2/3 | ✅ |
| renderer-react | ✅ | ✅ | ✅ | ⚠️ 1/2 | ✅ | ✅ | ✅ |
| renderer-json | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

Это **новый primary signal качества** — лучше чем «status=ok» от sub-agent'а.

### Удалить `projects/react-playground-e2e/tests/iter/`

Каталог больше не нужен — sub-agent'ы туда не пишут.

### `CLAUDE.md` (раздел "Iter prompt system" → "Артефакты iter-N")

Обновить:
- Убрать `tests/iter/mcp-credit-{target}-v{N}.spec.ts` из списка артефактов
- Добавить `MCP_ITER_VERSION=N npx playwright test --project=iter-{target}` как способ запуска abstract test suite

### `docs/iter-prompts/templates/iter-summary.template.md`

Добавить новую обязательную секцию **"Abstract test results"** с таблицей per spec × target.

## Architecture flow (после оптимизации)

```
[orchestrator]
  Step 0: pre-flight (placeholder каталоги, App.tsx routes — БЕЗ e2e specs)
  Step 1: 3 sub-agent'а параллельно
    └─ sub-agent: discovery → plan → code → tsc/lint/build → SMOKE check (1 page load, 1 screenshot) → dev-report
       (БЕЗ Step 5 e2e generation)
  Step 2: sandbox audit
  Step 3: App.tsx merge (если нужно)
  Step 4.5 (NEW): MCP_ITER_VERSION=N npx playwright test --project=iter-{core,renderer-react,renderer-json}
                  ↳ парсинг JSON результатов → таблица per spec
  Step 5: aggregate dev-reports + abstract test results → iter-summary.md
  Step 6: patch drafts (новый источник: failing abstract tests = MCP gaps в форме генерации)
  Step 7: stop check
  Step 8: handoff
```

## Verification

1. **Smoke test** — добавить только playwright.config changes (3 dynamic projects), запустить вручную против одной из существующих v* форм:
   ```bash
   MCP_ITER_VERSION=15 npx playwright test --project=iter-core --grep @smoke
   ```
   (но v15 удалена — нужно сначала восстановить тестовый артефакт или запустить против iter-17 после обновлений)
2. **End-to-end** — обновить sub-agent.template.md, orchestrator.md, запустить iter-17 в новом режиме:
   - sub-agent'ы должны быть быстрее (~155k тoken'ов вместо ~180-220k)
   - orchestrator выводит таблицу abstract test results
   - расхождения между targets видны явно
3. **Token saving** — сравнить total iter-17 tokens с iter-15/iter-16 (~600-650k). Ожидаем ~500-550k.
4. **Coverage** — abstract test coverage не должен упасть; наоборот должен возрасти (9 spec files vs ~7 шагов в собственном sub-agent walkthrough).

## Compatibility

POM существующего `complex-multy-step-form/credit-form-page.pom.ts` использует convention `data-testid="input-{testId}"`. Если sub-agent'ы iter-15/iter-16 НЕ следовали этой convention (а исследование показало что в iter-15+ они использовали `testId={'fieldName'}` — что попадает в convention), abstract tests упадут на этих historical pages. Это **OK** — pages удалены в commit `d8ac252`, история сохранена в iter-summaries.

**Sub-agent'ам в iter-17+** правило convention testId=fieldName становится обязательным.

## Sequencing (как раскатывать)

| Step | Что | Почему отдельно |
|------|-----|-----------------|
| 1 | Расширить `playwright.config.ts` 3 iter-projects | Минимально-инвазивная инфраструктура |
| 2 | Обновить `sub-agent.template.md`: убрать e2e gen, добавить convention testId=fieldName | Снижает sub-agent budget |
| 3 | Обновить `orchestrator.md`: Step 4.5 abstract tests + parsing | Главная новизна цикла |
| 4 | Обновить `iter-summary.template.md`: добавить раздел Abstract test results | Иначе summary неполный |
| 5 | Удалить `tests/iter/` каталог + cleanup CLAUDE.md | Cleanup |
| 6 | Smoke iter-17 в новом режиме | Валидация |
| 7 | После 1-2 циклов — рефакторинг по обнаруженным edge cases | Стабилизация |

Каждый step — отдельный commit.

## Open questions (не блокирующие)

1. **Array items testIds**: POM в `arrays.spec.ts` обращается к items через `data-testid="input-properties-{index}-type"` или похожее? Нужно проверить точную convention POM для FormArraySection и явно прописать в sub-agent.template.md. Решается при first-run (Step 6 sequencing).
2. **`variant: 'compound' | 'renderer' | 'json'`** — POM может разное для каждого variant'а. Нужно проверить что POM работает с iter-формами «как есть» или нужны minor правки. Решается при smoke (Step 6 sequencing).
3. **Failure attribution**: если abstract test упал — это либо (a) MCP не подсказал sub-agent'у нужную фичу, либо (b) sub-agent ошибся, либо (c) POM ожидает testId которого нет в convention. Orchestrator должен помочь различать через категорию failure (smoke / a11y / array / etc) → конкретный gap-id.

## Token budget impact (ожидаемо)

| iter | sub-agent budget | total (3 par) | abstract tests run | iter-summary |
|------|------------------|---------------|--------------------|--------------|
| iter-15 (current) | ~180-220k each | ~648k | ❌ (sub-agent сам пишет) | manual aggregation |
| iter-17 (planned) | ~150-180k each | ~480-540k | ✅ (orchestrator runs once) | + table abstract test results |

Saving ~15% tokens + значительно более качественный сигнал (per-spec breakdown vs «status: ok»).
