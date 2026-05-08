# iter-14 summary — 2026-05-07 (full-run, 3 targets parallel, reduced scope)

> Полный 3-target цикл с **reduced scope** из обновлённого `sub-agent.template.md` (commit `ff137d4`):
> 6 шагов FormWizard (как в спеке) + 16-24 поля + 1-2 computed + 1 conditional + 1 array + БЕЗ async/InputMask.
> Спека: [`docs/specs/credit-application-form.md`](../specs/credit-application-form.md) (1270 строк, untouched, SHA at start: `ff137d4`).

## Run metrics

| target         | tokens | tool_uses | tsc final | lint own | build | runtime err | screenshots | video   | status |
| -------------- | ------ | --------- | --------- | -------- | ----- | ----------- | ----------- | ------- | ------ |
| core           | 165k   | 81        | 0         | 0        | OK    | 0           | 7           | 379 KB  | ok     |
| renderer-react | 164k   | 88        | 0         | 0        | OK    | 0           | 7           | 258 KB  | ok     |
| renderer-json  | 180k   | 103       | 0         | 0        | OK    | 0           | 7           | 349 KB  | ok     |
| **total**      | 509k   | 272       | 0         | 0        | OK×3  | 0           | 21          | 3 видео | ok×3   |

vs iter-12 (полный full-run без reduction): ~547k tokens. Reduction в **scope** (не в шагах) дала ~7% экономии токенов; основная стоимость — discovery + tsc/build/e2e overhead, не сами поля.

## Patches G1-G5 (iter-11) + G2-G5 (iter-12) — regression check

| patch                                                         | core                               | renderer-react | renderer-json                |
| ------------------------------------------------------------- | ---------------------------------- | -------------- | ---------------------------- |
| G1 (FormField + componentProps в схеме)                       | ✅ applied                         | ✅ applied     | ✅ applied                   |
| G2 (TS2769 overload-error)                                    | ✅ applied (extracted typed local) | ✅ applied     | ✅ applied                   |
| G3 (alias-mapping в find_recipe)                              | ✅ alias hit для compute-from      | ✅             | ✅                           |
| G4 (Recipe 8 enum-literal `satisfies FieldConfig<UnionType>`) | ✅ applied для всех unions         | ✅ applied     | ✅ applied                   |
| G5-iter11 (async-validator recipe)                            | N/A (out of scope)                 | N/A            | N/A                          |
| G2-iter12 (FormWizard onSubmit no-arg)                        | ✅ applied                         | ✅ applied     | ✅ applied                   |
| G3-iter12 (async-options-loading)                             | N/A                                | N/A            | N/A                          |
| G4-iter12 (input-mask)                                        | N/A (out of scope)                 | N/A            | N/A                          |
| G5-iter12 (JsonFormRenderer + closure pattern)                | N/A                                | N/A            | ✅ applied (closure pattern) |

**Все patches либо применены, либо N/A. Регрессий нет.**

## Sandbox audit

| target         | packages/ reads | sibling examples reads | helpers reads | git mutations | App.tsx edits | verdict |
| -------------- | --------------- | ---------------------- | ------------- | ------------- | ------------- | ------- |
| core           | 0               | 0                      | 0             | 0             | 0             | clean   |
| renderer-react | 0               | 0                      | 0             | 0             | 0             | clean   |
| renderer-json  | 0               | 0                      | 0             | 0             | 0             | clean   |

`dangerouslyDisableSandbox: true` использовался для `npm run build` и `npx playwright test` (Unix-сокеты vite/playwright) + для `npm run dev` (core sub-agent — порт 5173/5174 был занят, поднял на 5175). Это infrastructure bypass, не reads запрещённых путей.

## Aggregated MCP gaps (после dedup)

### G1-iter14 [HIGH] g-form-wizard-stepValidations-shape

- **target**: core
- **evidence**: ui-kit `07-form-wizard.md` recipe не документирует shape `STEP_VALIDATIONS` (нужен `Record<number, ValidationSchemaFn<T>>`). Sub-agent написал интуитивно как массив `[step1Validation, step2Validation, ...]`. **FormWizard молча no-op'ит на Next click** (без runtime error, без console warning) — diagnostic time потерян. Truth находится в `core/13-multi-step.md` recipe, но он не cross-linked из `ui-kit/07-form-wizard.md`.
- **proposed patch**: добавить в `packages/reformer-ui-kit/docs/llms/07-form-wizard.md` явный пример с `STEP_VALIDATIONS: Record<number, ValidationSchemaFn<T>> = { 1: step1Fn, 2: step2Fn, ... }`. Опционально — runtime warn в FormWizard если получает array вместо Record.

### G2-iter14 [MED] g-array-field-tuple-format (3-target trifecta!)

- **targets affected**: core (`g-array-field-tuple-format`), renderer-react (`g-form-array-tuple-format`), renderer-json (`g-formschema-array-vs-fieldconfig-confusion`)
- **evidence**: ВСЕ 3 sub-agent'а интуитивно попробовали `properties: { value: [], component: Input }` → TS error `Type 'FieldConfig<PropertyItem[]>' is not assignable to type '[FormSchema<PropertyItem>]'`. Правильный формат `properties: [{ ...item-schema... }]` (tuple) находится только в `core/10-arrays.md` или `get_symbol_docs(FormSchema)`. **`arrays` не в обязательном discovery list** sub-agent.template.md (тоже моя недоработка — после reduction убрал form-array из обязательных).
- **proposed patch**:
  1. Добавить в `core/02-quick-start.md` короткую секцию «Arrays of objects» с canonical `properties: [{ ...item-schema... }]` пример.
  2. Восстановить `find_recipe(topic="form-array")` в обязательный discovery в `sub-agent.template.md` — раз reduced scope включает 1 array section, sub-agent должен про неё знать.
- **regression**: новый gap (от reduction); раньше sub-agent заранее запрашивал arrays.

### G3-iter14 [MED] g-renderercontextprovider-required-for-formwizard-renderbody

- **target**: renderer-json
- **evidence**: `find_recipe(form-wizard)` показывает RenderNode body для FormWizard, но не упоминает обязательную обёртку `<RenderContextProvider>` когда FormWizard рендерит RenderNode subtrees. Runtime-ошибка `useRenderContext must be used within RenderContextProvider (FormRenderer)`.
- **proposed patch**: добавить в `packages/reformer-ui-kit/docs/llms/07-form-wizard.md` секцию «RenderNode body requires RenderContextProvider» с примером wrapping.

### G4-iter14 [MED] g-form-array-section-itemcomponent-prerequisites

- **target**: renderer-react
- **evidence**: `form-array-section` recipe не объясняет, что per-item `component`+`componentProps` берутся из tuple-template (через `createForm`), не из prop `itemComponent`. Confusion на стыке.
- **proposed patch**: в `packages/reformer-ui-kit/docs/llms/08-form-array-section.md` добавить «Item field config comes from form-schema tuple-template, not from itemComponent JSX prop».

### G5-iter14 [LOW] g-formfield-checkbox-data-testid (core)

- minor — Checkbox не выставляет `data-testid="input-<id>"`; e2e нужно через `getByLabel`.

### G6-iter14 [LOW] g-radio-group-component-name (core)

- minor — `RadioGroup` экспортируется только под этим именем (не `Radio`); recipe должен подсказать.

### G7-iter14 [LOW] g-formfield-default-export-not-mentioned (renderer-react)

- standard imports `Section`/`FormField`/`Box` упоминаются только в `overview`, не в каждом feature-recipe.

### G8-iter14 [LOW] g-jsonformrenderer-vs-closure-pattern-canonical-path (renderer-json)

- 3 paths to mount renderer-json forms в discovery (JsonFormRenderer + JsonRendererProvider, JsonFormRenderer alone, closure-pattern). Один canonical должен быть выделен как «recommended for production».

### G9-iter14 [LOW] g-rendererformarraysection-not-in-package (renderer-json)

- acknowledged design choice — `RendererFormArraySection` (~80-150 LOC) копируется из cookbook каждый раз. Long-term: optional sub-package.

## Proposed patches (drafts)

Top-3 для применения в iter-15:

1. **G1-iter14 (HIGH)** — расширить `07-form-wizard.md` с canonical `STEP_VALIDATIONS: Record<number, ValidationSchemaFn<T>>` shape. **Критично**: silent no-op делает дебаг невозможным.
2. **G2-iter14 (MED, 3-target trifecta)** — добавить «Arrays of objects» секцию в `02-quick-start.md` + восстановить `form-array` в обязательный discovery.
3. **G3-iter14 (MED)** — `RenderContextProvider` wrapper note в form-wizard recipe.

## Verification (post-merge)

| check                                                  | result                                           |
| ------------------------------------------------------ | ------------------------------------------------ |
| `npx tsc --noEmit -p tsconfig.app.json`                | **PASS** (0 errors)                              |
| `npm run lint -w react-playground` (own files iter-14) | **PASS**                                         |
| `npm run build -w react-playground`                    | **PASS**                                         |
| App.tsx routes added                                   | 3 (mcca-{core,renderer-react,renderer-json}-v14) |
| screenshots count                                      | 21 (7×3, все fullPage)                           |
| videos count                                           | 3 (986 KB total, gitignored)                     |
| leaked screenshots в repo root                         | 0                                                |

## Сравнение с предыдущими iter

| метрика                  | iter-11 (mini, core)       | iter-12 (full, 3)   | iter-14 (full, 3, reduced scope)    |
| ------------------------ | -------------------------- | ------------------- | ----------------------------------- |
| Targets                  | 1                          | 3                   | 3                                   |
| Tokens (total)           | ~177k                      | ~547k               | **~509k**                           |
| TSC initial errors (avg) | 8                          | 1                   | **0** (упреждающе из patches)       |
| TSC cycles               | 3                          | 1-2                 | **1** (все 3 target)                |
| MCP gaps (deduped)       | 5                          | 8                   | **9** (но 7 LOW; HIGH+MED только 4) |
| Высокие gaps             | 1 (FormField anti-pattern) | 0 (после reduction) | 1 (FormWizard STEP_VALIDATIONS)     |
| Status across targets    | 1/1 ok                     | 3/3 ok              | **3/3 ok**                          |

**Эффект reduced scope**: нет роста токенов (vs iter-12 net), все 3 target прошли в budget без timeout'ов. Главное — освободил место для **обработки edge cases** (array tuple-format, FormWizard config shape, RenderContextProvider).

## Stop check

- gaps after dedup: 9 (1 high, 3 med, 5 low)
- post-merge errors: 0
- iter: 14 / 5 (full-run; MAX_ITER concept оставлен для расширенных циклов с регрессией)
- **decision**: `continue → /iter 15` (после применения patches G1-iter14 + G2-iter14 + G3-iter14)

## Next session

1. **Применить patches** (приоритет HIGH→MED):
   - G1-iter14 (HIGH): `07-form-wizard.md` — canonical `STEP_VALIDATIONS` shape
   - G2-iter14 (MED, trifecta): `02-quick-start.md` — Arrays of objects + восстановить `form-array` в обязательный discovery `sub-agent.template.md`
   - G3-iter14 (MED): `07-form-wizard.md` — RenderContextProvider wrapper для RenderNode body
2. **Регенерировать** `packages/reformer-ui-kit/llms.txt` + `packages/reformer/llms.txt`.
3. **iter-15 full-run** для regression: G1/G2/G3-iter14 должны исчезнуть.

## Files changed in this iter

```
A  projects/react-playground/src/pages/examples/mcp-credit-application-core-v14/{schema.ts, index.tsx}
A  projects/react-playground/src/pages/examples/mcp-credit-application-renderer-react-v14/{schema.tsx, index.tsx, PropertyItemForm.tsx}
A  projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v14/{schema.json, index.tsx}
A  projects/react-playground-e2e/tests/iter/mcp-credit-{core,renderer-react,renderer-json}-v14.spec.ts
M  projects/react-playground/src/App.tsx (3 routes + 3 nav-items)
A  docs/iter-summaries/iter-14.md
```

## Artifacts

- `.tmp/iter-artifacts/iter-14/{core,renderer-react,renderer-json}/{discovery,dev-plan,dev-report}.md` — sub-agent workspaces
- `projects/react-playground/src/pages/examples/mcp-credit-application-{core,renderer-react,renderer-json}-v14/`
- `projects/react-playground-e2e/tests/iter/mcp-credit-{core,renderer-react,renderer-json}-v14.spec.ts`
- `projects/react-playground-e2e/screenshots/mcp-credit-v14/{core,renderer-react,renderer-json}/` — 21 fullPage скриншот (gitignored)
- `projects/react-playground-e2e/videos/mcp-credit-v14/{core,renderer-react,renderer-json}/walkthrough.webm` — 3 видео (gitignored, ~986 KB total)
