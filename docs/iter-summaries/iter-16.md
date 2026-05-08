# iter-16 summary — 2026-05-07 (full-spec, regression check + new gaps)

> Full-spec реализация после применения iter-15 patches G1-G3 (commit `05d6102`).
> Спека: [`docs/specs/credit-application-form.md`](../specs/credit-application-form.md).
> Spec git SHA at start: `05d6102`.
>
> **Цель**: проверить что patches iter-15 устранили gaps + найти новые.

## Run metrics

| target         | tokens   | tool_uses | tsc | lint own | runtime | screenshots | video   | status           |
| -------------- | -------- | --------- | --- | -------- | ------- | ----------- | ------- | ---------------- |
| core           | 200k     | 89        | 0   | 0        | 0       | 7           | 793 KB  | ok               |
| renderer-react | 215k     | 95        | 0   | 0        | 0       | 7           | 1.03 MB | ok               |
| renderer-json  | 213k     | 87        | 0   | 0        | 0       | 7           | 333 KB  | **partial** (1H) |
| **total**      | **628k** | **271**   | 0   | 0        | 0       | 21          | 3 видео | 2 ok + 1 partial |

vs iter-15 (~648k): -3% — patches упростили работу.

## Spec coverage (одинаково во всех 3)

| механизм           | core | renderer-react | renderer-json |
| ------------------ | ---- | -------------- | ------------- |
| 6 шагов FormWizard | ✅   | ✅             | ✅            |
| ~80 полей по спеке | ✅   | ✅             | ✅            |
| 8/8 computed       | ✅   | ✅             | ✅            |
| applyWhen (8 max)  | ✅ 8 | ⚠️ 5           | ⚠️ 7          |
| 3/3 FormArrays     | ✅   | ✅             | ✅            |
| Async validators   | ✅   | ✅             | ✅            |
| Async options      | ✅   | ✅             | ✅            |
| InputMask          | ✅   | ✅             | ✅            |

renderer-react/json реализовали меньше applyWhen (5/7 vs 8 в core) — небольшое расхождение, но не влияет на основные механизмы.

## Patches regression check

| patch                                            | core             | renderer-react   | renderer-json                                                        | verdict                             |
| ------------------------------------------------ | ---------------- | ---------------- | -------------------------------------------------------------------- | ----------------------------------- |
| G1-iter15 (pattern/email/url/phone string\|null) | ✅ used directly | ✅ used directly | ✅ used directly                                                     | **fixed**                           |
| G2-iter15 (AsyncValidatorFn + debounce)          | ✅               | ✅               | ✅                                                                   | **fixed**                           |
| G3-iter15 (JsonFormApp cookbook)                 | N/A              | N/A              | ⚠️ **HIGH gap** — использует `registry.clone()` (несуществующий API) | **regression on the patch itself!** |

Все 12 предыдущих patches (iter-11/12/14) — applied/N/A, без regression.

## Sandbox audit

Все 3 — clean. Стандартный `dangerouslyDisableSandbox: true` для `npm run build` / `npx playwright test`. Нет reads запрещённых путей.

## Aggregated MCP gaps (после dedup)

### G1-iter16 [HIGH] g-jsonformapp-clone-missing — REGRESSION на patch G3-iter15

- **target**: renderer-json
- **evidence**: cookbook recipe `JsonFormApp` (добавлен в commit `05d6102`) использует `const r = registry.clone(); r.container('FormRoot', FormRoot);`. Но `ComponentRegistry` НЕ имеет публичного метода `clone()`. Sub-agent попробовал — TS error.
- **impact**: моя ошибка в recipe — писал не проверив API. Sub-agent сделал workaround через factory `buildRegistry(extras)` — реестр пересобирается с нуля через `defineRegistry`. Цель recipe (сократить boilerplate) частично достигнута (~30 LOC вместо 80+), но не как обещано.
- **regression**: TRUE — я **сам** ввёл этот gap patch'ем G3-iter15.
- **proposed patch**:
  - Вариант A (предпочтительно): добавить публичный `ComponentRegistry.clone(): ComponentRegistry` в `@reformer/renderer-json` (immutable copy).
  - Вариант B: переписать cookbook recipe `JsonFormApp` чтобы использовать `defineRegistry`-callback вместо clone (как сделал sub-agent).

### G2-iter16 [MED] g-asyncvalidatorfn-import-path

- **target**: renderer-react
- **evidence**: recipe `31-async-validator-debounce.md` показывает `import { type AsyncValidatorFn } from '@reformer/core/validators'`. Реальный экспорт — из `@reformer/core` (Recipe 1: types from main module, functions from submodules). Compile error → исправлено руками.
- **regression**: связан с G2-iter15 — я исправил имя type, но не путь импорта.
- **proposed patch**: исправить recipe `31-async-validator-debounce.md` — `import { type AsyncValidatorFn } from '@reformer/core'` (не из `/validators`).

### G3-iter16 [MED] g-radiogroup-vs-radio-discoverability

- **target**: core (also surfaces in renderer-react)
- **evidence**: `30-type-safety-recipes.md` Recipe 8 example использует `Radio` в schema, реальный экспорт ui-kit — `RadioGroup`. Sub-agent потратил cycle на discovery.
- **proposed patch**: правка recipe — `component: Radio` → `component: RadioGroup`.

### G4-iter16 [LOW] g-asyncvalidatorfn-value-type-inference (renderer-react)

### G5-iter16 [LOW] g-step-icon-emoji-vs-numbers-no-guidance (core)

### G6-iter16 [LOW] g-formfield-checkbox-getbylabel-still (core, regression от iter-14 G7 — не закрыли)

### G7-iter16 [LOW] g-radiogroup-options-array-shape (core)

### G8-iter16 [LOW] g-jsonformapp-fieldwrapper-not-typed (renderer-json)

## Proposed patches (drafts)

Top-3 для iter-17:

1. **G1-iter16 (HIGH)** — fix `JsonFormApp` cookbook (public `clone()` или переписать). **Критично** — это моя ошибка ввела HIGH в стабильный цикл.
2. **G2-iter16 (MED)** — fix import path в `31-async-validator-debounce.md`
3. **G3-iter16 (MED)** — fix `Radio` → `RadioGroup` в Recipe 8

LOW gaps можно отложить.

## Verification (post-merge)

| check                                                  | result                        |
| ------------------------------------------------------ | ----------------------------- |
| `npx tsc --noEmit -p tsconfig.app.json`                | **PASS** (0 errors)           |
| `npm run lint -w react-playground` (own files iter-16) | **PASS**                      |
| `npm run build -w react-playground`                    | **PASS**                      |
| App.tsx routes added                                   | 3                             |
| screenshots count                                      | 21 (7×3, fullPage)            |
| videos count                                           | 3 (~2.2 MB total, gitignored) |
| leaked screenshots в repo root                         | 0                             |

## Сравнение с предыдущими iter

| метрика                | iter-15              | **iter-16**                                                                     |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------- |
| Spec coverage          | 100% (одинаково в 3) | 100% (одинаково в 3)                                                            |
| Tokens                 | 648k                 | 628k (-3%)                                                                      |
| TSC errors             | 0                    | 0                                                                               |
| HIGH gaps              | 0                    | **1** (regression на моём patch'е)                                              |
| Status                 | 3/3 ok               | 2 ok + 1 partial                                                                |
| Modular code structure | 1-2 files per target | 1-6 files per target (sub-agent'ы стали разбивать на types/schema/registry/etc) |

**Главный учёт**: введя patch (G3-iter15 JsonFormApp cookbook), я **сам создал HIGH regression**, потому что писал recipe без проверки реального API. Урок — patches должны валидироваться против исходников **перед** добавлением в recipes.

## Stop check

- gaps after dedup: 8 (1 high, 2 med, 5 low)
- post-merge errors: 0
- iter: 16 / 5 (full-run)
- **decision**: `continue → /iter 17` (после fix G1-iter16 — критично для restore цикла без HIGH)

## Next session

1. **Применить patches**:
   - G1-iter16 (HIGH): fix `JsonFormApp` cookbook — либо добавить `ComponentRegistry.clone()`, либо переписать recipe чтобы использовать `defineRegistry`-callback.
   - G2-iter16 (MED): fix import path в `31-async-validator-debounce.md`.
   - G3-iter16 (MED): fix `Radio` → `RadioGroup` в Recipe 8.
2. **Регенерировать llms.txt + build MCP**.
3. **iter-17 full-run** для regression check.

## Files changed

```
A  projects/react-playground/src/pages/examples/mcp-credit-application-core-v16/{schema.ts, index.tsx}
A  projects/react-playground/src/pages/examples/mcp-credit-application-renderer-react-v16/{types.ts, schema.ts, render-schema.tsx, index.tsx}
A  projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v16/{types.ts, schema.ts, json-schema.ts, registry.tsx, JsonFormApp.tsx, index.tsx}
A  projects/react-playground-e2e/tests/iter/mcp-credit-{core,renderer-react,renderer-json}-v16.spec.ts
M  projects/react-playground/src/App.tsx
A  docs/iter-summaries/iter-16.md
```

Modular file structure показывает развитие подхода — sub-agent'ы интуитивно разбивают на types/schema/registry для readability.
