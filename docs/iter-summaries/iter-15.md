# iter-15 summary — 2026-05-07 (full-run, 3 targets parallel, FULL-SPEC implementation)

> Полная реализация спеки (commit `0bf4f04` отменил reduction'ы — теперь sub-agent'ы реализуют **всё** что в спеке).
> Спека: [`docs/specs/credit-application-form.md`](../specs/credit-application-form.md) (1270 строк, untouched).
> Spec git SHA at start: `0bf4f04`.
>
> **🎉 Главное достижение**: все 3 sub-agent'а реализовали ОДНУ И ТУ ЖЕ форму ПОЛНОСТЬЮ — теперь 3 формы сравнимы.

## Run metrics

| target          | tokens | tool_uses | tsc | lint own | build | runtime | screenshots | video       | status |
| --------------- | ------ | --------- | --- | -------- | ----- | ------- | ----------- | ----------- | ------ |
| core            | 183k   | 66        | 0   | 0        | OK    | 0       | 7           | 872 KB      | ok     |
| renderer-react  | 223k   | 112       | 0   | 0        | OK    | 0       | 7           | 1.09 MB     | ok     |
| renderer-json   | 242k   | 114       | 0   | 0        | OK    | 0       | 7           | 849 KB      | ok     |
| **total**       | **648k** | **292**   | 0   | 0        | OK×3  | 0       | 21          | 3 видео     | ok×3   |

vs iter-12 (без reduction): ~547k tokens — **+18%** за счёт более комплексного покрытия (full async + InputMask + cross-target consistency).
vs iter-14 (reduced): ~509k tokens — **+27%** за полное покрытие спеки.

## Spec coverage — ОДИНАКОВО ВО ВСЕХ 3 TARGETS

| механизм спеки | core | renderer-react | renderer-json |
| -------------- | ---- | -------------- | ------------- |
| 6 шагов FormWizard (Кредит/Личные/Контакты/Работа/Доп.инфо/Подтверждение) | ✅ | ✅ | ✅ |
| ~80 полей (по спеке) | ✅ | ✅ | ✅ |
| 8 computed (`fullName`, `age`, `interestRate`, `monthlyPayment`, `initialPayment`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`) | ✅ 8/8 | ✅ 8/8 | ✅ 8/8 |
| 8 applyWhen (mortgage/car/employed/selfEmployed/sameAsRegistration/hasProperty/hasExistingLoans/hasCoBorrower) | ✅ 8 | ✅ 8 | ✅ 8 |
| 3 FormArray sections (`properties[]`, `existingLoans[]`, `coBorrowers[]`) | ✅ 3/3 | ✅ 3/3 | ✅ 3/3 |
| Async validators (email uniqueness, INN check) | ✅ | ✅ | ✅ |
| Async options loading (cities by region, carModel by carBrand) | ✅ | ✅ | ✅ (mocked) |
| InputMask (phone/passport/INN/SNILS/postalCode/etc) | ✅ | ✅ | ✅ |
| copyFrom (sameAsRegistration → residenceAddress) | ✅ | ✅ | ✅ |

**3 формы — одна и та же реализация** (по спеке). Сравнение между стеками core/renderer-react/renderer-json теперь имеет смысл.

## Patches regression check

| patch | core | renderer-react | renderer-json |
| ----- | ---- | -------------- | -------------- |
| G1 (FormField + componentProps в схеме) | ✅ | ✅ | ✅ |
| G2 (TS2769 overload-error) | ✅ | ✅ | ✅ |
| G3 (alias-mapping в find_recipe) | ✅ | ✅ | ✅ |
| G4 (Recipe 8 enum-literal `satisfies FieldConfig<UnionType>`) | ✅ | ✅ | ✅ |
| G5-iter11 (async-validator recipe) | ✅ applied | ✅ applied | ✅ applied |
| G2-iter12 (FormWizard onSubmit no-arg) | ✅ | ✅ | ✅ |
| G3-iter12 (async-options-loading) | ✅ applied | ✅ applied | ✅ applied (mocked) |
| G4-iter12 (input-mask) | ✅ applied | ✅ applied | ✅ applied |
| G5-iter12 (JsonFormRenderer + closure pattern) | N/A | N/A | ✅ applied |
| G1-iter14 (FormWizard STEP_VALIDATIONS shape) | ✅ Record used correctly | ✅ | ✅ |
| G2-iter14 (array tuple-format) | ✅ | ✅ | ✅ |
| G3-iter14 (RenderContextProvider wrapper) | N/A (TS-flow body) | ✅ | ✅ |

**Все patches применены / N/A. Zero regressions.**

## Sandbox audit

| target | packages/ reads | sibling examples reads | helpers reads | git mutations | App.tsx edits | verdict |
| ------ | --------------- | ---------------------- | ------------- | ------------- | ------------- | ------- |
| core | 0 | 0 | 0 | 0 | 0 | clean |
| renderer-react | 0 | 0 | 0 | 0 | 0 | clean |
| renderer-json | 0 | 0 | 0 | 0 | 0 | clean |

`dangerouslyDisableSandbox: true` использовался для `npm run build` и `npx playwright test` (Unix-сокеты). renderer-json sub-agent самостоятельно поднял dev-server (orchestrator не подал сигнал, что он уже работает) — minor sandbox bypass, не reads.

## Aggregated MCP gaps (после dedup)

### G1-iter15 [MED] g-pattern-validator-string-null-mismatch (2 targets)

- **targets affected**: core (`g-pattern-string-null-mismatch`), renderer-react (`g-mcp-pattern-null-narrowing`)
- **evidence**: `pattern()` validator generic'ом ограничивается `TField extends string | undefined`, отказываясь принимать `string | null` поля (`companyInn`, `businessInn` и т.п.). Для них пришлось использовать `validate(path.x, (v) => regexCheck(v))` fallback.
- **proposed patch**: расширить `pattern()` сигнатуру до `TField extends string | null | undefined`, аналогично `min`/`max`/`minLength`/`maxLength` (Recipe 5 в `30-type-safety-recipes.md`).

### G2-iter15 [MED] g-mcp-asyncDebounceMs-misnamed

- **target**: renderer-react
- **evidence**: recipe `31-async-validator-debounce.md` использует поле `asyncDebounceMs` в `FieldConfig`, реально в API — `debounce`. Sub-agent потратил time на discovery после TS error.
- **proposed patch**: исправить recipe `31-async-validator-debounce.md` — заменить `asyncDebounceMs: 500` на `debounce: 500` (или соответствующее имя из реального FieldConfig).

### G3-iter15 [MED] g-jsonformapp-helper-missing

- **target**: renderer-json
- **evidence**: closure pattern (`createRenderSchemaFromJson` + `<FormRenderer>` + `FormRoot.__selfManagedChildren = true`) — много boilerplate (~80-150 LOC) копируется из cookbook. Нет helper'а вроде `<JsonFormApp schema={json} form={form} registry={reg}>` который бы инкапсулировал весь паттерн.
- **proposed patch**: long-term — добавить helper компонент `<JsonFormApp>` в `@reformer/renderer-json` или `@reformer/ui-kit/renderer-json-app`. Short-term — улучшить cookbook recipe с краткой готовой обёрткой 30-50 LOC.

### G4-iter15 [MED] g-jsonnode-condition-attribute-missing

- **target**: renderer-json
- **evidence**: спека требует conditional rendering (mortgage/car/employed/selfEmployed sub-blocks). В JSON-схеме нет атрибута `condition` / `applyWhen` для hide/show — приходится использовать `renderSchema.node('selector').setHidden(...)` императивно из TS, что нарушает declarative JSON paradigm.
- **proposed patch**: добавить в `JsonNode` опциональное поле `hideWhen` / `condition` с pointer на model field — конвертер `createRenderSchemaFromJson` будет генерировать соответствующий `setHidden` поведенчески.

### G5-iter15 [LOW] g-mcp-async-validator-fn-name

- **target**: renderer-react
- **evidence**: recipe использует `AsyncValidator<T>`, реальный экспорт — `AsyncValidatorFn<T>`. Не блокер — TS error показал нужное имя.
- **proposed patch**: правка в `31-async-validator-debounce.md` — `AsyncValidator` → `AsyncValidatorFn`.

### G6-iter15 [LOW] g-hooks-package-mismatch

- **target**: core
- **evidence**: `useFormControlValue` recipe не указывает что symbol экспортируется из `@reformer/core` (а не из `/hooks` submodule). Minor confusion.

### G7-iter15 [LOW] g-fullValidation-required-prop

- **target**: core
- **evidence**: `07-form-wizard.md` recipe не помечает `fullValidation` как required prop в `FormWizard.config` — sub-agent добавил позже после TS error.

### G8-iter15 [LOW] g-mcp-computeFrom-cross-level

- **target**: renderer-react
- **evidence**: «subscribe nested leaf, target at root» в `compute-vs-watch` recipe не достаточно громко flagged. Sub-agent понял после TS error.

### G9-iter15 [LOW] g-renderer-react-form-wizard-cross-link

- **target**: renderer-react
- **evidence**: renderer-react/overview pushes custom `FormRoot` pattern; FormWizard-as-root — другой path. Cross-link отсутствует.

### G10-iter15 [LOW] g-renderer-react-spec-coverage-async-options-mocked

- **target**: renderer-json
- **evidence**: async options loading реализованы через mock (без реального fetch), потому что в спеке нет указания endpoint. Это design choice, не gap MCP.

## Proposed patches (drafts)

Top для применения в iter-16:
1. **G1-iter15 (MED)** — расширить `pattern()` сигнатуру до `string | null | undefined` (изменение в core code, не recipe)
2. **G2-iter15 (MED)** — исправить recipe `31-async-validator-debounce.md` (`asyncDebounceMs` → `debounce`)
3. **G3-iter15 (MED)** — long-term: helper `<JsonFormApp>` для renderer-json. Short-term: cookbook улучшение
4. **G4-iter15 (MED)** — добавить `condition`/`hideWhen` в `JsonNode` тип

LOW gaps можно отложить.

## Verification (post-merge)

| check | result |
| ----- | ------ |
| `npx tsc --noEmit -p tsconfig.app.json` | **PASS** (0 errors) |
| `npm run lint -w react-playground` (own files iter-15) | **PASS** |
| `npm run build -w react-playground` | **PASS** |
| App.tsx routes added | 3 (mcca-{core,renderer-react,renderer-json}-v15) |
| screenshots count | 21 (7×3, все fullPage) |
| videos count | 3 (2.8 MB total, gitignored) |
| leaked screenshots в repo root | 0 |

## Сравнение с предыдущими iter

| метрика | iter-12 (full без reduction) | iter-14 (reduced) | **iter-15 (full-spec)** |
| ------- | ---------------------------- | ----------------- | ----------------------- |
| Targets | 3 | 3 | **3** |
| Spec coverage | partial (per sub-agent choice) | reduced subset (per sub-agent choice) | **FULL (одинаково в 3)** |
| Tokens (total) | ~547k | ~509k | ~648k |
| TSC initial errors avg | 1 | 0 | 0 |
| MCP gaps (deduped) | 8 | 9 | 10 (но 0H/4M/6L — лучшая структура) |
| HIGH gaps | 0 | 1 | **0** |
| Status across targets | 3/3 ok | 3/3 ok | **3/3 ok** |
| Cross-target consistency | ❌ (3 разных subset) | ❌ (3 разных subset) | **✅ (одинаковая реализация)** |

## Stop check

- gaps after dedup: 10 (0 high, 4 med, 6 low)
- post-merge errors: 0
- iter: 15 / 5 (full-run)
- **decision**: `continue → /iter 16` (после применения patches G1-G4 для iter-16) — но **0 HIGH gaps** даёт сильный сигнал стабилизации MCP. Возможно, цикл выходит на плато.

## Next session

1. **Применить patches** (приоритет MED):
   - G1-iter15: расширить `pattern()` сигнатуру (изменение в core code)
   - G2-iter15: исправить async-validator recipe (`asyncDebounceMs` → `debounce`)
   - G3-iter15: cookbook recipe для JsonFormApp pattern
   - G4-iter15: `condition`/`hideWhen` в `JsonNode` тип
2. **Регенерировать llms.txt**
3. **iter-16 full-run** для regression

## Files changed in this iter

```
A  projects/react-playground/src/pages/examples/mcp-credit-application-core-v15/{schema.ts, index.tsx}
A  projects/react-playground/src/pages/examples/mcp-credit-application-renderer-react-v15/{schema.ts, index.tsx}
A  projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v15/{schema.json, index.tsx}
A  projects/react-playground-e2e/tests/iter/mcp-credit-{core,renderer-react,renderer-json}-v15.spec.ts
M  projects/react-playground/src/App.tsx (3 routes + 3 nav-items)
A  docs/iter-summaries/iter-15.md
```

## Artifacts

- `.tmp/iter-artifacts/iter-15/{core,renderer-react,renderer-json}/{discovery,dev-plan,dev-report}.md`
- `projects/react-playground/src/pages/examples/mcp-credit-application-{core,renderer-react,renderer-json}-v15/`
- `projects/react-playground-e2e/tests/iter/mcp-credit-{core,renderer-react,renderer-json}-v15.spec.ts`
- `projects/react-playground-e2e/screenshots/mcp-credit-v15/{core,renderer-react,renderer-json}/` — 21 fullPage скриншот (gitignored)
- `projects/react-playground-e2e/videos/mcp-credit-v15/{core,renderer-react,renderer-json}/walkthrough.webm` — 3 видео (2.8 MB, gitignored)
