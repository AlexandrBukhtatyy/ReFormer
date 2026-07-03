# iter-md-1 — paper listing calibration (2026-07-03)

> Dry-run: 3 sub-agent'а в MCP-only sandbox произвели **листинги** кода (без app-кода, без
> tsc/build/Playwright). Сигнал = корректность дизайна через детерминированные текст-проверки
>
> - MCP static checkers (`validate_json_schema`, `check_behaviors`).
>   **Ограничение режима: type/overload/prop-flow ошибки НЕ ловятся** (нет tsc) — см. Type-risk spots.
>
> Спека: `docs/specs/credit-application-form.md` @ `f176d96` · Runner: этот прогон сыграл `orchestrator-md.md`.

## Run metrics

| target         | mcp calls | coverage (fields) | steps | computed | arrays | conditional | json-schema | behaviors | testId viol | gaps h/m/l |
| -------------- | --------- | ----------------- | ----- | -------- | ------ | ----------- | ----------- | --------- | ----------- | ---------- |
| core           | 30        | 94 / ~80          | 6/6   | 8/8      | 3/3    | 8/8         | n/a         | none      | 0           | 1 / 3 / 3  |
| renderer-react | 33        | 92 / ~80          | 6/6   | 8/8      | 3/3    | 8/8         | n/a         | none      | 0           | 2 / 2 / 3  |
| renderer-json  | 32        | 91 / ~80          | 6/6   | 8/8      | 3/3    | 8/8         | **valid**   | none      | 0           | 1 / 2 / 4  |

Coverage > ~80 у всех трёх — спека-строки (~80) разворачиваются в 91–94 leaf-нод (nested-группы, array-item-шаблоны, computed display-поля, + inferred `sameEmail`). Все шаги/computed/массивы/conditional-группы покрыты полностью. Листинги: core 1745 LOC, renderer-react 1610, renderer-json 1315 (5 файлов) — **без элизии** (0 banned-плейсхолдеров).

## Deterministic checks per target (orchestrator-run, независимо от self-report)

| check                                | core                                          | renderer-react         | renderer-json                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 coverage (value-bindings)         | 94 leaf / 125 `value:`                        | 92 leaf / 117 `value:` | 94 `$model(` (91 leaf + 3 array)                                                                                                                                                  |
| C2 testId presence                   | 94/94 ✅                                      | 92/92 ✅               | 91/91 ✅                                                                                                                                                                          |
| C3 testId convention                 | 0 viol                                        | 0 viol                 | 0 viol                                                                                                                                                                            |
| C4 validate_json_schema              | n/a                                           | n/a                    | **valid** (agent 2 runs incl. broken-node probe → deep-walk подтверждён; orchestrator re-parse: well-formed, 94 `$model`/123 `$component`/12 `$dataSource`, все зарегистрированы) |
| C5 check_behaviors                   | none                                          | none                   | none — **orchestrator независимо перепрогнал канонический 10-dep граф → «no cycles»**                                                                                             |
| C6 structural anchors                | 8 computed ✓ · 3 arrays ✓ · 8 cond ✓          | ✓ · ✓ · ✓              | ✓ · ✓ · ✓                                                                                                                                                                         |
| C7 import-origin viol                | 0                                             | 0                      | 0                                                                                                                                                                                 |
| C8 escape-hatch (`as any`/ts-ignore) | 0                                             | 0                      | 0                                                                                                                                                                                 |
| C9 symbol traceability               | 30 calls в discovery.md, self-attested traced | 33 calls               | 32 calls                                                                                                                                                                          |

Композитный сигнал: по всем измеримым осям (полнота, testId, structural, import-origin, escape-hatch, циклы, JSON-schema) **три target'а прошли чисто**. Разница между стеками — в gaps (что MCP не разъяснил), а не в дефектах листинга.

## MCP gaps (aggregated, deduped)

| gap-id                                                                 | severity | targets affected                                   | evidence                                                                                                                                                                                                                                                                                                                                       | proposed fix (packages/reformer-mcp/)                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | -------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **g-phantom-api-in-discovery** (`applyWhen` + `ValidationSchemaFn`)    | **HIGH** | core, renderer-react (+ подразумевается json)      | `get_symbol_docs("applyWhen")` → _not found_; `get_symbol_docs("ValidationSchemaFn")` → _not found_. Оба **прямо перечислены в discovery-list мана**. Consumer, следующий ману буквально, пишет невалидный импорт. Реальные API: `{ when, children }` branch-node + `ModelValidator`.                                                          | **Двойной фикс.** (1) MCP: добавить recipe `conditional-fields` (branch-node `{when,children}` + `enableWhen` + `useFormControlValue` как единый канон) и внести `ModelValidator` в symbol-index (сейчас только текстом в recipe). (2) **Наши промты**: убрать `applyWhen`/`ValidationSchemaFn` из discovery-list в `sub-agent-md.md` и `sub-agent.template.md`, заменить на реальные символы. |
| **g-wizard-shape-divergence**                                          | **HIGH** | renderer-react (+ json: runtime-injection variant) | `renderer-react/overview` → `RendererFormWizard`+`Step`+`children`; `ui-kit/form-wizard` → `FormWizard`+`steps:[{number,title,icon,body}]`; `get_symbol_docs("RendererFormWizard")`/`("Step")` → _not found_. Неясно, какую shape `createForm` harvest'ит; ошибка → silent empty-registry (`null`-поля). Топ-риск корректности renderer-react. | Согласовать `renderer-react/overview` и `ui-kit/form-wizard` на ОДНУ wizard-shape; добавить пример `createForm({model, schema: buildWizardSchema})` с явным harvest полей под wizard-нодой (или явно сказать, что нужна отдельная flat `{children:[]}` схема для валидации).                                                                                                                   |
| **g-json-no-validators**                                               | **HIGH** | renderer-json                                      | `JsonFieldNode` не имеет поля `validators`; `JsonFormRenderer.validate` = только ajv-структура схемы, не значения. Ни один renderer-json recipe не показывает, как валидировать JSON-форму → пришлось изобрести параллельную TS-схему `buildStepValidation` + `validateFormModel`. Консумент легко получит форму **без валидации**.            | Новый recipe `@reformer/renderer-json/06-validation.md`: «валидаторы не в JSON — TS validation-schema поверх model + `validateFormModel` per-step». Явная нота в `02-json-schema.md`, что `JsonFieldNode` не несёт `validators`.                                                                                                                                                               |
| **g-array-node-shape**                                                 | MED      | core (renderer-react/json related)                 | 3 конфликтующих представления array-секции: quick-start `{array,item}`; validation `componentProps.{control,itemComponent}`; CDK `FormArray.Root` (рендер-слой). Нет указания, какую форму `createForm` принимает в едином `schema`.                                                                                                           | Recipe `array-in-schema` с ОДНИМ каноническим shape schema-узла массива + явная связка «schema `{array,item}` ↔ рендер `FormArraySection`»; кросс-линк из quick-start/validation.                                                                                                                                                                                                              |
| **g-formfield-symbol-ambiguous**                                       | MED      | core                                               | `get_symbol_docs("FormField")` → возвращает `@reformer/cdk` **headless** FormField (Root/Label/Control/Error), скрывая `@reformer/ui-kit` one-liner-wrapper, который использует consumer. Коллизия имён.                                                                                                                                       | При коллизии `get_symbol_docs` должен вернуть ОБА (с package-меткой) или поддержать disambiguation `get_symbol_docs(symbol, package)`; в ответе явно упоминать альтернативный экспорт.                                                                                                                                                                                                         |
| **g-array-reduce-to-scalar**                                           | MED      | renderer-react (+ core/json как low/type-risk)     | Нет recipe для реактивной редукции FormArray → скаляр (`coBorrowersIncome = Σ coBorrowers[].monthlyIncome`). `aggregateInto` пишет array→array, не array→scalar. Неясно, авто-трекает ли `compute` изменение вложенного `item.monthlyIncome`.                                                                                                  | Секция в `20-compute-vs-watch.md`: «Computed sum over a FormArray» — точное реактивное чтение, пересчёт при push/remove/edit (или указать `computeFrom` со списком).                                                                                                                                                                                                                           |
| **g-renderer-json-wizard-flow** (per-step validation + runtime-inject) | MED      | renderer-json                                      | `form-wizard` recipe строит step-подсхему `{children:[schema.children[step-1]]}` — предполагает TS-схему с валидаторами (в JSON её нет). Инъекция `form`/`config`/`onSubmit` через `onInit`+`patchProps` документирована фрагментарно (`makeValidationConfig` — псевдокод, `onSubmit` не упомянут).                                            | End-to-end cookbook-рецепт «FormWizard в renderer-json»: JSON-steps + renderBehavior-inject + per-step validation `Record<step, schema>` — единый копипаст-пример.                                                                                                                                                                                                                             |
| **g-fieldconfig-valuesignal-vs-value**                                 | LOW      | core                                               | `FieldConfig` JSDoc: `valueSignal?: Signal<T>` (M1 source) + `value?: T\|null` (legacy). Но ВСЕ recipes пишут `value: model.$.field`. Прямое противоречие doc↔recipes.                                                                                                                                                                         | Привести `FieldConfig` JSDoc в соответствие с recipes (или пометить, что builder нормализует `value`-сигнал в `valueSignal`).                                                                                                                                                                                                                                                                  |
| **g-model-array-clear**                                                | LOW      | core, renderer-json                                | Нет документированного способа очистить массив **на уровне модели** (в `defineFormBehavior`, вне React). CDK `clear()` — на `FormArrayHandle` (рендер-слой), не на value-прокси.                                                                                                                                                               | Добавить `model.<array>.clear()` в recipe/symbol-docs (или подтвердить) + пример «очистка массива в behavior по флагу».                                                                                                                                                                                                                                                                        |
| **g-enablewhen-group**                                                 | LOW      | core                                               | Неясно, резолвит ли `enableWhen`/`disableWhen`/`resetWhen` **group-сигнал** (`model.$.residenceAddress`) в GroupNode, или нужен per-leaf.                                                                                                                                                                                                      | Явно задокументировать поведение enableWhen на group-сигналах.                                                                                                                                                                                                                                                                                                                                 |
| **g-mustBeTrue-validator**                                             | LOW      | renderer-json                                      | Нет встроенного `isTrue()`/`accepted()` для обязательных согласий (checkbox=true). `required()` на boolean-false семантически неоднозначен.                                                                                                                                                                                                    | Добавить `isTrue()`/`accepted()` в `@reformer/core/validators` + упомянуть в validation-recipe.                                                                                                                                                                                                                                                                                                |
| **g-readonly-form-mode**                                               | LOW      | renderer-json                                      | Нет паттерна «вся форма read-only» (`mode='view'`) для JSON-рендерера; `disabled` только per-component.                                                                                                                                                                                                                                        | Recipe «read-only форма»: глобальный флаг в `JsonRendererProvider settings` или renderBehavior-обход всех field-нод с `patchProps({disabled:true})`.                                                                                                                                                                                                                                           |
| **g-renderer-react-array-controls**                                    | LOW      | renderer-react                                     | `componentProps`-контракт нативной array-RenderNode (add/remove/reorder chrome) специфицирован не полностью (`maxItems`, `removeButtonLabel`, `showRemoveOnSingle`); неясно, native-node vs `FormArraySection` — что канон.                                                                                                                    | Документировать полный `componentProps` нативной `ArrayRenderNode` (или указать `FormArraySection` как канон, native-node = layout-only).                                                                                                                                                                                                                                                      |

**Итог по gaps:** 3 HIGH, 4 MED, 6 LOW (после дедупа кросс-target). Топ-3 HIGH — это и есть главный выхлоп калибровки.

## Type-risk spots not provable on paper (union §3.1)

Без tsc эти места невозможно верифицировать — систематический слепой угол paper-режима:

- **core**: смешение field/branch/array-нод в одном `children[]` (unkeyed); резолв `form.properties`→ArrayNode при unkeyed размещении; `model.set(partial)` существование; реактивность array-reduce в `compute`; nested-group-в-array-item сигнальные пути; `enableWhen` overload single-vs-array-signal; `FieldConfig` `value` vs `valueSignal`.
- **renderer-react**: **harvest'ит ли `createForm` поля под `componentProps.steps[].body`** (тот же корень, что g-wizard-shape-divergence — топ-риск); `form.touchAll()` vs `form.markAsTouched()` (одно из имён неверно); `enableWhen`+`resetOnDisable` на compute-target (конфликт reset↔recompute); `label`-prop на RadioGroup/Select.
- **renderer-json**: реактивность `reduce` над массивом в `compute`; форма array-node `{control,itemComponent}` — распознает ли `validateFormModel`; `enableWhen` на группе; **union-widening при обратной записи `RadioGroup.onChange:(string)` в union-сигнал** (в JSON нет `satisfies FieldConfig<Union>`); `FormWizardConfig` сигнатуры колбэков; `model.arr.removeAt`/`length` на value-прокси.

> Эти риски — ровно то, что поймал бы tsc. Для их закрытия нужен либо code-gen прогон (`orchestrator.md`/`-clean`), либо доверие к самодекларации агента. Сильнейший из них (renderer-react wizard harvest) совпадает с HIGH-gap.

## Sandbox audit

| target         | packages reads | examples reads | helpers reads | .d.ts peek | projects write | git mut | verdict   |
| -------------- | -------------- | -------------- | ------------- | ---------- | -------------- | ------- | --------- |
| core           | 0              | 0              | 0             | 0          | 0              | 0       | **clean** |
| renderer-react | 0              | 0              | 0             | 0          | 0              | 0       | **clean** |
| renderer-json  | 0              | 0              | 0             | 0          | 0              | 0       | **clean** |

Все три чисто: ни одного запретного чтения, ни одного `.d.ts`-peek, ни одной записи в `projects/`, ни одной git-мутации. Sandbox-контур выдержал — gaps достоверны (не подделаны подглядыванием в исходники).

## Spec inconsistencies (не MCP-gaps — surface владельцу спеки, спека НЕ редактировалась)

- **`sameEmail`**: behavior-таблица ссылается на флаг `sameEmail` (copy `email`→`emailAdditional`), но поля `sameEmail` нет в field-таблицах Шага 3. Агенты добавили inferred-чекбокс в листинг; спека оставлена нетронутой (read-only). → добавить `sameEmail` в field-таблицу Шага 3, либо убрать copy-поведение.
- **`initialPayment`**: помечено одновременно как условное вводимое (min 20%) И вычисляемое readonly. → уточнить одну семантику.
- **`PropertyType`**: enum явно не перечислен (только пример `'apartment'`). → перечислить допустимые значения.

## Верификация промтов (paper-mode harness)

- Sub-agent: [docs/iter-prompts/sub-agent-md.md](../iter-prompts/sub-agent-md.md)
- Runner: [docs/iter-prompts/orchestrator-md.md](../iter-prompts/orchestrator-md.md)
- Listing template: [docs/iter-prompts/templates/form-listing.template.md](../iter-prompts/templates/form-listing.template.md)
- План: [docs/plans/mcp-staged-moonbeam.md](../plans/mcp-staged-moonbeam.md)

## Artifacts

- Per-target листинги: `.tmp/iter-artifacts/iter-md-1/{core,renderer-react,renderer-json}/form-listing.md`
- Discovery raw: `.tmp/iter-artifacts/iter-md-1/{target}/discovery.md`
- Dev-plans: `.tmp/iter-artifacts/iter-md-1/{target}/dev-plan.md`
- Извлечённый JSON (C4 re-parse): `.tmp/iter-artifacts/iter-md-1/_reference/rj-schema.json`

## Верификация gaps против ground truth (2026-07-03)

3 HIGH-gap'а прогнаны через независимых верификаторов (НЕ в sandbox: исходники + `docs/llms` + golden-примеры + воспроизведение MCP-вызовов). Результат — 2 из 3 переоценены, механизмы уточнены:

| gap                        | вердикт  | severity         | уточнение                                                                                                                                                                                                                                                    |
| -------------------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| g-phantom-api-in-discovery | **REAL** | HIGH подтверждён | `applyWhen`/`ValidationSchemaFn` реально удалены (legacy-движок, `packages/reformer/src/core/validation/index.ts:5-8`); **наши промты сами их предписывали**.                                                                                                |
| g-wizard-shape-divergence  | PARTIAL  | HIGH→**MED**     | «silent empty-registry» **опровергнут** — `harvestFieldConfig` (create-form.ts:63,97-100) shape-agnostic; расхождение всплывает как compile-time unresolved import. Реальный дефект — overview называл каноном несуществующий app-shim `RendererFormWizard`. |
| g-json-no-validators       | PARTIAL  | HIGH→**MED**     | Факты верны (`JsonFieldNode` без `validators`), но механизм инъекции документирован (cookbook `#inject-runtime` + core `13-multi-step.md`) — просто не кросс-линкован.                                                                                       |

## Resolution — все 3 закрыты + промты починены (2026-07-03)

**MCP (product docs):**

- ✅ Создан `packages/reformer/docs/llms/18-conditional-fields.md` (enableWhen + branch-node `{when,children}` + useFormControlValue + callout «applyWhen/ValidationSchemaFn не экспорт») + 7 алиасов в `packages/reformer-mcp/src/tools/find-recipe.ts`. **Проверено: `find_recipe(topic="conditional-fields")` резолвит вживую.**
- ✅ `packages/reformer-renderer-react/docs/llms/01-overview.md` + `05-cookbook.md` — phantom `RendererFormWizard` заменён на канонический ui-kit `FormWizard`+`{number,title,icon,body}` + явный harvest-пример + кросс-линк на `07-form-wizard.md`.
- ✅ Создан `packages/reformer-renderer-json/docs/llms/06-validation.md` (mental-model + build/execute/inject + рабочий пример + anti-patterns) + нота в `02-json-schema.md`. **Проверено: `find_recipe(package="@reformer/renderer-json", topic="validation")` резолвит вживую.**
- ✅ `llms.txt` регенерирован (reformer / renderer-react / renderer-json). `find-recipe.ts` проходит `tsc --noEmit`. Алиасы станут live после пересборки dist + рестарта MCP-сервера (filename-match работает уже сейчас).

**Промты (контаминация будущих прогонов):**

- ✅ `sub-agent-md.md`, `sub-agent.template.md`, `templates/dev-plan.template.md`, `templates/dev-report.template.md` — phantom `applyWhen`/`ValidationSchemaFn`/`topic="hooks"` заменены на реальные API (`enableWhen` + branch-node + `ModelValidator` + `validateFormModel`). Голых предписаний не осталось.

## MED/LOW resolution — все 10 обработаны (2026-07-03)

Все 10 прогнаны через верификаторов (ground truth). Итог: **3 NOT-A-GAP** (paper-агентские misread), **1 ALREADY-CLOSED**, остальные — DOCS + 1 MCP-CODE. Бонус: верификация нашла и починила **дефект в моём же `06-validation.md`** (пример был submit-less).

**MED:**

- ✅ **array-node-shape** → DOCS: `packages/reformer/docs/llms/10-arrays.md` — секция «один массив — три слоя» (createForm `{array,item}` / validation `componentProps.{control,itemComponent}` / render `FormArray.Root`).
- ✅ **formfield-symbol-ambiguous** → **MCP-CODE**: `get-symbol-docs.ts` + `symbols-parser.ts` (`findAllSymbols` + collision-note при коллизии имён между пакетами; `tsc --noEmit` clean). Live после rebuild+restart сервера.
- ✅ **array-reduce-to-scalar** → DOCS: `20-compute-vs-watch.md` — секция «Computed sum over a FormArray» (паттерн реактивен; нюанс value-proxy `model.arr` vs signals-proxy `model.$.arr`).
- ✅ **renderer-json-wizard-flow** → DOCS: новый `renderer-json/docs/llms/07-form-wizard.md` (end-to-end: JSON steps + onSubmit + навигация + hideWhen) + **починен дефект в `06-validation.md`** (полный пример был submit-less).

**LOW:**

- ✅ **readonly-form-mode** → DOCS: паттерн `form.disable()` (каскад) в cookbook renderer-json + renderer-react.
- ✅ **renderer-react-array-controls** → DOCS: полный контракт array-`componentProps` в `renderer-react/docs/llms/02-render-schema.md`; явно: `maxItems`/`showRemoveOnSingle` НЕ существуют (paper выдумал).
- ⚪ **enablewhen-group** → ALREADY-CLOSED (мой `18-conditional-fields.md` верен, тест-backed `facade.test.ts:149-162`) + hardening-note про import-path (`/behaviors` DSL, не корневой).
- ⚪ **fieldconfig-valuesignal** → NOT-A-GAP (harvest нормализует `value`-сигнал в `valueSignal`); добавлен `@remarks` в `deep-schema.ts` про footgun (`valueSignal:` в схеме молча дропает UI-config).
- ⚪ **model-array-clear** → NOT-A-GAP (`model.arr.clear()` есть+типизирован+документирован в `10-arrays.md`); добавлен behavior-context cross-link.
- ⚪ **mustBeTrue-validator** → NOT-A-GAP (`required()` уже трактует boolean `false` как пустое; задокументировано в symbol `required`). Без изменений.

`llms.txt` регенерирован (reformer / renderer-react / renderer-json).

## Code-gen validation of paper-mode accuracy (2026-07-03)

Прогнали code-gen на тех же 3 target'ах (реальный код по **починенным** промтам/recipe, БЕЗ self-tsc), затем один авторитетный `tsc --noEmit` по всему app, атрибуция ошибок по каталогам. Каталоги: `mcp-credit-application-{target}-md-check/`.

| target         | LOC  | **tsc errors** | self-flagged risks                                  | итог                                                                  |
| -------------- | ---- | -------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| core           | 1602 | **0** ✅       | 6 (топ: `enableWhen` array-таргеты)                 | все self-risks — **false positive**, компилируется чисто              |
| renderer-json  | 1278 | **0** ✅       | 5 (топ: `clearModelArray` «HIGH, most likely fail») | все self-risks — **false positive**, компилируется чисто              |
| renderer-react | 1578 | **80** ❌      | 4 (топ: `ArrayRenderNode` контракт)                 | 75 = **не-флагнутый** blind spot + 3 array `__path` + 2 unused-import |

**Разбор 80 ошибок renderer-react:** 75× TS2353 `'validators' does not exist in type 'RenderNode<T>'` (агент вписал `validators:[]` в RenderNode-листья); 3× TS2741 `__path` missing (`ModelArray<T>` → `RenderModelArrayControl` на 3 array-нодах); 2× TS6133 unused import.

### Выводы (что валидация доказала про paper-режим)

1. **Paper-режим систематически ПЕРЕ-флагит type-risks (false positives).** core и renderer-json пометили HIGH-confidence риски (`enableWhen([...])`, `model.arr.clear()/removeAt`), которые на деле **компилируются без ошибок**. Это ровно подтверждает вердикты верификаторов (enableWhen array-capable; `model.arr.clear()` существует и типизирован). Paper не знает, что API работают → флагит из осторожности.
2. **Paper-режим имеет BLIND SPOTS (false negatives), которые он в принципе не видит.** 75-ошибочный `validators`-на-RenderNode в renderer-react **не был self-flagged** — агент уверенно сделал неверное. Ловит только компилятор. Это и есть граница paper-режима: он меряет **дизайн, не типы**.
3. **Фиксы работают end-to-end.** renderer-json скомпилировался **чисто именно потому, что новый `06-validation.md` научил** «JSON=layout, валидация = отдельная TS-схема над моделью» — агент не попал в ловушку `validators`-на-layout. renderer-react использовал канонический `FormWizard`+`body` (наш wizard-фикс). Phantom API (`applyWhen`/`ValidationSchemaFn`) не использован НИГДЕ (промт-фиксы сработали).

### 🔴 Новый gap, обнаруженный code-gen'ом (paper его пропустил)

**g-renderer-react-no-validation-recipe [HIGH]** — у renderer-react НЕТ рецепта «где живёт валидация» (аналога `06-validation.md` у renderer-json). `RenderNode<T>` не несёт `validators` (доказано 75× TS2353); канон (golden) — отдельная TS-схема над моделью + `validateFormModel` + инъекция через render-behavior. Без этого рецепта агент естественно (и ошибочно) инлайнит `validators` в render-схему. **Fix: зеркалировать `06-validation.md` в `packages/reformer-renderer-react/docs/llms/` (validation = model-schema, не RenderNode).** Плюс мелкий: array-node `control` типизация (`ModelArray<T>` vs `RenderModelArrayControl.__path`, 3× TS2741) — нота/тип.

> Мета-инсайт: это идеальная демонстрация ценности связки. Paper-режим (дёшево, без toolchain) дал дизайн/coverage/discoverability-сигнал и поймал phantom-API/wizard/json-validators. Code-gen (дорого, с tsc) поймал то, что paper структурно не может — type-blind-spot (validators-на-RenderNode). Оба нужны.

## Resolution пост-валидации (2026-07-03)

- ✅ **`g-renderer-react-no-validation-recipe` закрыт.** Создан `packages/reformer-renderer-react/docs/llms/06-validation.md` (mental-model «RenderNode = layout, `validators` запрещены → TS2353»; валидация = отдельная model-схема + `validateFormModel` + инлайн-`config` в wizard-узле — golden-паттерн; anti-pattern #1 = validators-на-RenderNode). Плюс ноты в `02-render-schema.md` и `04-troubleshooting.md` (по кодам TS2353/TS2741). `find_recipe(package="@reformer/renderer-react", topic="validation")` резолвит вживую; `llms.txt` регенерирован. Верификация подтвердила content-gap (не discoverability): `find_recipe` до этого возвращал «No recipe found».
- ✅ **Latent type-bug ИСПРАВЛЕН.** В публичный тип `ModelArray<U>` (`packages/reformer/src/core/model/types.ts`) добавлен `readonly __path: string` — рантайм его уже отдаёт (`form-model.ts:299`), прецедент `PathAwareSignal.__path` (types.ts:25). Снимает 3× TS2741 при строгой типизации array-узла (`ModelArray<T>` → `RenderModelArrayControl`), теперь без `as unknown as RenderNode<T>` cast. **Верификация:** `tsc` reformer core rc=0 (внутренне чисто, единственный внешний потребитель — параметр `validation.ts:99`, не конструктор); `@reformer/core` пересобран (dist `types.d.ts:47` несёт `__path`); `tsc` всего app rc=0 — **нулевой ripple**, ни одной ошибки `ModelArray/__path/RenderModelArrayControl`.

## Регрессионная итерация — подтверждение фиксов (2026-07-03)

Повторный code-gen (3 target'а) против **полностью починенного + перезапущенного** MCP (алиасы, collision-note, типы core — live).

| target             | iter-md-1 | регресс  | итог                                                                                                  |
| ------------------ | --------- | -------- | ----------------------------------------------------------------------------------------------------- |
| **renderer-react** | **80**    | **0** ✅ | **фикс подтверждён** — validators в отдельной model-схеме, RenderNode без `validators`; `__path` снят |
| renderer-json      | 0         | 1        | тривиальный TS6133 (unused var) — по сути чисто                                                       |
| core               | 0         | 18       | новый gap (НЕ регрессия): CDK `FormArray.List` render-prop                                            |

**Подтверждено рабочим (агенты, sandbox):** новые recipe (`conditional-fields`, `validation` ×2, `form-wizard`) найдены и применены; alias-роутинг (`compute-from`→`compute-vs-watch`, `enableWhen`→`conditional-fields`) и `get_symbol_docs` collision-note (`FormWizardStep`) сработали; **phantom API нигде**; fallback в `node_modules` нет; core: «no MCP gaps — server sufficient». renderer-react теперь кладёт validators в отдельную model-схему — ровно фикс тех 80 ошибок.

### 🔴 Новый gap (найден регрессией): `g-cdk-formarray-list-generic`

CDK `FormArray.Root`/`FormArray.List` compound связаны через React-контекст, а generic `T` через контекст **не проходит** → в render-prop `FormArray.List` элемент типизируется `FormProxy<object>`, доступ к полям даёт `TS2339` (18×). Типы CDK корректно generic (`FormArrayListProps<T>`, `packages/reformer-cdk/.../types.ts:17`), но `T` не выводится из контекста. Канонический **типизированный** рендер object-массивов — ui-kit `FormArraySection` + `itemComponent` (как в golden `AdditionalInfoForm.tsx:55-90`), НЕ CDK-compound с render-prop (его iter-md-1 core-агент и использовал → 0 ошибок). **Fix:** `form-array` recipe должен (а) показать пиннинг generic (`<FormArray.List<Item>>`), либо (б) рекомендовать `FormArraySection`+`itemComponent` как канон типизированных object-массивов. Вариативность прогона (разные агенты — разный выбор API).

> Мета-вывод: каждая итерация вскрывает РАЗНЫЕ gap'ы (вариативность выбора API агентами) — цикл прогрессивно харденит MCP. Главное здесь — целевой фикс (renderer-react 80→0) подтверждён.

## Remaining (опционально)

- ✅ **`g-cdk-formarray-list-generic` закрыт.** В `packages/reformer-cdk/docs/llms/02-form-array.md` добавлена секция «Typed item access (avoid `FormProxy<object>`)» — симптом (generic не проходит через React-контекст → TS2339) + 3 **эмпирически проверенных** (реальный tsc, 18→0) типизированных пути в порядке приоритета: канон ui-kit `FormArraySection`+`itemComponent`, `useFormArray<T>` (infer), пиннинг `<FormArray.List<T>>` (с caveat). Не баг типов CDK. `find_recipe(topic="form-array")` резолвит вживую; cdk `llms.txt` регенерирован.
- ✅ `-md-check` валидационные каталоги удалены.
- ✅ `@reformer/core` и `@reformer/mcp` пересобраны + **MCP-сервер перезапущен** — все code-path фиксы (алиасы, collision-note, типы core) подтверждены live.
