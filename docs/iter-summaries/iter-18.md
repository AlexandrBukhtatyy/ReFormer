# iter-18 summary — 2026-05-08 (regression check на convention testId fix iter-17)

> Прогон после fix convention testId в commit `45063ff` (iter-17): nested groups теперь `parentField-childField`. Цель — проверить что 3 sub-agent'а корректно следуют новой convention и abstract tests проходят больше.

## Run metrics

| target         | tokens   | tool_uses | tsc | smoke                                    | testid convention | abstract tests pass |
| -------------- | -------- | --------- | --- | ---------------------------------------- | ----------------- | ------------------- |
| core           | 179k     | 71        | 0   | ✅ (1 React warning)                     | ✅ yes            | 1/63                |
| renderer-react | 206k     | 82        | 0   | ❌ (smoke failed на testId leak warning) | ✅ yes            | 1/63                |
| renderer-json  | 207k     | 89        | 0   | ✅                                       | ✅ yes            | (test run прерван)  |
| **total**      | **592k** | **242**   | 0   | partial                                  | yes×3             | низкий — см. ниже   |

vs iter-17 (594k): -0.3% — token spend стабилизировался.

## Spec coverage (одинаково в 3 targets)

| механизм           | core  | renderer-react | renderer-json |
| ------------------ | ----- | -------------- | ------------- |
| 6 шагов FormWizard | ✅    | ✅             | ✅            |
| ~80 полей          | ✅ 83 | ✅ ~80         | ✅ ~80        |
| 8/8 computed       | ✅    | ✅             | ✅            |
| applyWhen          | 7     | 5              | 6             |
| 3/3 FormArrays     | ✅    | ✅             | ✅            |
| async validators   | ✅    | ✅             | ❌ no         |
| async options      | ✅    | ✅             | ❌ no         |
| InputMask          | ✅    | ✅             | ✅            |

## testId convention compliance (iter-17 fix verification)

Все 3 sub-agent'а **верно** применили convention из commit `45063ff`:

- Top-level: `loanAmount`, `inn`, `phoneMain` — без префикса
- Nested groups: `personalData-lastName`, `passportData-series`, `registrationAddress-region`, `residenceAddress-region` — с префиксом через дефис
- Array items: `type`, `description`, `bank`, `lastName` (для coBorrowers через nested) — без префикса массива

**iter-17 → iter-18 fix СРАБОТАЛ.** Главное препятствие abstract tests из iter-17 устранено.

## Patches regression check

Все 12 patches от iter-11..16 + convention fix iter-17 — applied / N/A. Zero regression.

## Abstract test results — низкий pass, новый класс gap

| target         | passed        | failed        | дошло до конца |
| -------------- | ------------- | ------------- | -------------- |
| core           | 1/63          | 62/63         | yes            |
| renderer-react | 1/63          | 62/63         | yes            |
| renderer-json  | (interrupted) | (interrupted) | no             |

vs iter-17 (1-2/63): улучшение **не произошло** — convention fix testId был необходим, но **недостаточен**. Открыт новый gap.

### G1-iter18 [HIGH] g-pom-expects-headings-not-in-spec — НОВЫЙ КЛАСС GAP

- **target**: все 3 (одинаково проявилось)
- **evidence**: первый failure всех 3 specs:
  ```
  Error: expect(locator).toBeVisible() failed
  Locator: getByRole('heading', { name: /основная информация о кредите/i })
  ```
  POM ожидает headings per step:
  - step 1: «Основная информация о кредите»
  - step 2: «Персональные данные»
  - step 3: «Контактная информация»
  - step 4: «Информация о занятости»
  - step 5: «Дополнительная информация»
  - step 6: «Подтверждение и согласия»
- **Sub-agent generated**: ставит свои headings, но текст разный (например core: `<h3>Личные данные</h3>` вместо `<h?>Персональные данные</h?>`).
- **Root cause**: спека НЕ диктует exact heading text — упоминает темы шагов в TOC, но не как обязательный rendered heading. POM привязан к UI conventions из reference implementation `complex-multy-step-form`. **POM ↔ spec mismatch на UI level.**
- **regression**: новый класс — до iter-17 (sub-agent сам писал e2e под свой UI) этот gap не был виден.
- **proposed patch direction**: добавить в `sub-agent.template.md` обязательный список UI conventions:
  - Step 1 heading: «Основная информация о кредите»
  - Step 2 heading: «Персональные данные»
  - Step 3 heading: «Контактная информация»
  - Step 4 heading: «Информация о занятости»
  - Step 5 heading: «Дополнительная информация»
  - Step 6 heading: «Подтверждение и согласия»
  - Каждый heading = `<h2>` или `<h3>` (любой role=heading), exact text как в спеке (TOC).

### G2-iter18 [HIGH] g-uikit-testid-leak — REGRESSION на конвенции

- **targets affected**: core, renderer-react (smoke specs упали на console error)
- **evidence**: React warning «React does not recognize the `testId` prop on a DOM element». Когда sub-agent ставит `componentProps: { testId: 'loanAmount', ... }`, ui-kit FormField → Input → DOM `<input>` получает `testId` как unknown HTML attr.
- **root cause**: ui-kit FormField forward'ит componentProps на нижний DOM, не filtering `testId`. Convention testId через componentProps генерирует side-effect React warning.
- **proposed patch direction**:
  - Вариант A: исправить ui-kit FormField — strip `testId` (и любые non-DOM props) перед spread на native element.
  - Вариант B: convention testId через JSX prop `<FormField control={...} testId="..." />` (а не componentProps). Но это противоречит schema-driven архитектуре (всё в schema).
  - Предпочтительно A — ui-kit fix.

### G3-iter18 [HIGH] g-jsonformapp-cookbook-still-incomplete (renderer-json)

- **target**: renderer-json
- **evidence**: cookbook recipe `JsonFormApp` (исправленный в iter-16/G1-iter17) **всё ещё не инжектирует** `form` в FormRoot.componentProps. Sub-agent комбинировал с `createMyFormSchema` pattern из overview recipe.
- **proposed patch**: дополнить `JsonFormApp` cookbook — показать full mounting с form-injection в root.

### Прочие gaps

- **G4-iter18 [MED] async validators/options не реализованы в renderer-json** — нет canonical pattern для mock async без backend.
- **G5-iter18 [MED] FormWizard inside renderer-json schema** — нет canonical recipe.
- **G6-iter18 [MED] validate-array-cross-field (core)** — нет doc для cross-field validation внутри array item через `validateItems`.
- **5+ low gaps** — minor.

## Verification

| check                                   | result                                           |
| --------------------------------------- | ------------------------------------------------ |
| `npx tsc --noEmit -p tsconfig.app.json` | **PASS** (0 errors)                              |
| Sub-agent smoke screenshots             | 3 (1 per target)                                 |
| Sub-agent dev-reports                   | 3                                                |
| Abstract test JSON results              | core, renderer-react (renderer-json interrupted) |

## Stop check

- gaps after dedup: 3 high (NEW CLASS: POM-spec UI mismatch, ui-kit testId leak, JsonFormApp recipe still incomplete) + 3 med + 5 low
- post-merge errors: 0
- iter: 18
- **decision**: `continue → /iter 19` (после patch G1-iter18 — добавить UI headings convention в sub-agent.template.md)

## Главный learning iter-цикла за всю сессию

| iter   | главный gap                                                                           |
| ------ | ------------------------------------------------------------------------------------- |
| 11     | FormField anti-pattern (sub-agent писал свои field-обёртки)                           |
| 12     | 0 HIGH                                                                                |
| 14     | FormWizard STEP_VALIDATIONS Record vs array (silent no-op)                            |
| 15     | 0 HIGH (MCP стабилизировался на полной спеке)                                         |
| 16     | regression на patch G3-iter15 (`registry.clone()` не существует)                      |
| 17     | regression на моём convention testId в template (nested groups)                       |
| **18** | **POM ↔ spec UI mismatch (headings)** + ui-kit testId leak (regression на convention) |

Каждый iter вскрывает 1-2 архитектурных gap'а. iter-цикл работает как **средство калибровки**:

- MCP-сервер (recipes, type signatures, sub-agent guidance)
- Моих собственных правил в template/plans
- POM ↔ spec consistency (новый класс с iter-18)

## Next session

1. **G1-iter18 (HIGH)**: добавить в `sub-agent.template.md` секцию «UI conventions из POM» с обязательными headings per step.
2. **G2-iter18 (HIGH)**: ui-kit FormField — strip non-DOM props перед forward.
3. **G3-iter18 (HIGH)**: дополнить JsonFormApp cookbook recipe form-injection в FormRoot.
4. После patches — iter-19 regression check.
