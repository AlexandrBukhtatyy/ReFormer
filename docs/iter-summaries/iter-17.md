# iter-17 summary — 2026-05-07 (first run with abstract test suite + smoke-only sub-agent)

> Первый прогон новой архитектуры (commit `9283ade`): sub-agent делает только smoke check, orchestrator запускает abstract test suite через 3 dynamic playwright projects.
>
> **Главная находка**: convention testId=fieldName **которую я записал в plan, оказалась неверной** для nested groups. POM ожидает `data-testid="input-personalData-lastName"` (с префиксом группы), не `input-lastName`. Это regression в моих же правилах — abstract tests **поймали** ошибку в правилах. Convention обновлён.

## Run metrics

| target         | tokens   | tool_uses | tsc | smoke | abstract tests pass |
| -------------- | -------- | --------- | --- | ----- | ------------------- |
| core           | 200k     | 95        | 0   | ✅    | 2/63                |
| renderer-react | 187k     | 83        | 0   | ✅    | 1/63                |
| renderer-json  | 207k     | 80        | 0   | ✅    | 2/63                |
| **total**      | **594k** | **258**   | 0   | ok×3  | 5/189 (2.6%)        |

vs iter-16 (628k без shared abstract tests): -5%. Token saving скромнее ожидаемого — sub-agent'ы экономили на e2e generation, но добавили модулярную структуру (core: 5 файлов, renderer-json: 7 файлов).

## Spec coverage (заявлено sub-agent'ами)

| механизм                                       | core   | renderer-react | renderer-json |
| ---------------------------------------------- | ------ | -------------- | ------------- |
| 6 шагов FormWizard                             | ✅     | ✅             | ✅            |
| ~80 полей                                      | ✅ 85  | ✅ 80          | ✅ 80         |
| 8/8 computed                                   | ✅     | ✅             | ✅            |
| applyWhen                                      | 9      | 8              | 7             |
| 3/3 FormArrays                                 | ✅     | ✅             | ✅            |
| async validators / options / InputMask         | ✅ × 3 | ✅ × 3         | ✅ × 3        |
| **testid_convention_followed (per sub-agent)** | yes    | yes            | yes           |

Все 3 sub-agent'а **заявили** что convention соблюдена (по моему wrong правилу). Реально abstract tests показали что POM ожидает другое.

## Patches regression (12 patches от iter-11..16)

Все applied / N/A. Sub-agent'ы используют corrected `JsonFormApp` (callback pattern), pattern() для `string|null`, Record stepValidations. Zero regression на patches.

## Abstract test results (orchestrator-run, Step 3.5)

| target         | smoke pass                                            | full suite pass | failure category                                      |
| -------------- | ----------------------------------------------------- | --------------- | ----------------------------------------------------- |
| core           | 12/?? (быстрый smoke с `--grep @smoke` дал 12 passed) | 2/63            | (c) testId convention violation на ВСЕХ nested fields |
| renderer-react | passed (smoke)                                        | 1/63            | (c) testId convention violation                       |
| renderer-json  | passed (smoke)                                        | 2/63            | (c) testId convention violation                       |

Failures трассируются к одному корню: POM `fillLastName()` обращается к `data-testid="input-personalData-lastName"`, на странице есть `data-testid="input-lastName"` (без префикса группы — sub-agent следовал моему ошибочному правилу).

**Failure attribution**: 100% это категория (c) testId convention violation в **моём же plan'е**. (a) MCP gaps и (b) sub-agent errors — нет.

## Главный gap iter-17 — REGRESSION на моём convention

### G1-iter17 [HIGH] g-testid-convention-wrong-for-nested

- **target**: все 3 (regression в моём правиле)
- **evidence**: в `sub-agent.template.md` (от commit `9283ade`) я написал «Для nested groups (personalData, passportData, registrationAddress): testId = `lastName`, `firstName`, `series` и т.п. (без префикса группы — POM ожидает плоские имена)». Это **неверно**. Реально POM в [credit-form-page.pom.ts:297](projects/react-playground-e2e/tests/pages/complex-multy-step-form/credit-form-page.pom.ts#L297) делает `this.input('personalData-lastName').fill(...)` → ожидает `data-testid="input-personalData-lastName"` (с префиксом).
- **regression**: TRUE — моя ошибка в plan-документе.
- **fix applied** (immediate): обновил sub-agent.template.md — convention для nested fields теперь `parentField-childField` через дефис. См. секцию «Convention testId = path-with-dashes». Array items — без префикса массива (POM ставит индекс сам через `data-testid="input-properties-0-type"`).

## Прочие observations (не critical)

- **core**: 3 med gaps (FormWizard step body API ambiguity, FormArraySection.hasItems как boolean snapshot, FormWizardStep type variability). 3 low.
- **renderer-react**: 1 high (по моей классификации — sub-agent самосообщил, я смотрю как med — отсутствие canonical FormWizard-as-root recipe). 2 med, 3 low. testId leak to DOM — React dev warning.
- **renderer-json**: 1 med (corrected JsonFormApp работает, но recipe boilerplate ещё ~50 LOC), 2 low.

Все эти gaps — кандидаты на iter-18+. Не блокеры.

## Verification

| check                                   | result                                               |
| --------------------------------------- | ---------------------------------------------------- |
| `npx tsc --noEmit -p tsconfig.app.json` | **PASS** (0 errors)                                  |
| Smoke screenshots                       | 3 (1 per target)                                     |
| Sub-agent dev-reports                   | 3                                                    |
| Abstract test JSON results              | core/renderer-react/renderer-json (5/189 total pass) |

## Stop check

- gaps after dedup: 1 high (regression на моём convention — fix applied) + sub-agent gaps
- **decision**: `continue → /iter 18` (regression check после fix convention)

## Next session

1. **Применено в этой сессии**: fix convention testId для nested groups в sub-agent.template.md
2. **iter-18 full-run**: проверить что abstract tests проходят значительно больше (ожидаемо 40+/63 per target после fix convention)
3. Sub-agent'ам в iter-18 — **обязательно** использовать `parentField-childField` testId для nested groups

## Key learning

Новый pipeline (sub-agent smoke + orchestrator abstract tests) **немедленно поймал ошибку в моих собственных правилах**. До оптимизации — sub-agent сам писал e2e под свою же convention, ошибка была не видна. Теперь abstract tests это primary signal.

Принцип: «orchestrator's abstract tests > sub-agent's self-reported coverage» — sub-agent может думать что всё сделал правильно, но abstract tests против объективного POM скажут истину.
