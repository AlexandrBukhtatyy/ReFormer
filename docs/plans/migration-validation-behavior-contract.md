# План миграции: контракты валидации и поведения (core → проект → документация)

## Контекст

За серию итераций мы сошлись на паре **ambient-контрактов** для описания схем формы, раздельных по concern'ам:

- **Валидация** (новый) — схема = обычная функция `(ctx:{model})=>void`; операторы `validate(field,[rules])`,
  `validateAsync(field,[asyncRules])`, `validateWhen(cond,cb)`, `cross(sig,fn)`, `each(arr,itemFn)`, `apply(...schemas)`;
  внешний раннер `validateModel(model, schema)`; identity-обёртка `defineValidationSchema(fn)`. Экспорт — сабпат
  **`@reformer/core/validation`**. Полный листинг + инфраструктура: [schema-contract-validation-apply.md](schema-contract-validation-apply.md).
- **Поведение** (существующий, фиксируем как канон) — ambient `defineFormBehavior(({model,form})=>{ compute/copyFrom/enableWhen/onChange/apply/applyEach })`
  → `createForm({ behavior })`. Листинг: [two-ambient-listing.md §3](schema-contract-two-ambient-listing.md).

Обоснование выбора (адверсариальное исследование 5 семейств контрактов): [schema-contract-simplification.md](schema-contract-simplification.md).

**Цель этого плана** — полная миграция монорепо на эти контракты: ядро → пакеты-интеграции → проекты → MCP → документация.
Идём по фазам последовательно там, где есть зависимость, и параллельно где можно. Прогресс трекаем чек-листом внизу.

---

## Зафиксированные контракты (freeze)

### Валидация — публичный API

Экспорт — сабпат `@reformer/core/validation` (симметрично `@reformer/core/behaviors`).

```ts
type Rule<T> = (v: T) => ValidationError | null;
type AsyncRule<T> = (v: T, ctx: { signal: AbortSignal }) => Promise<ValidationError | null>;  // отмена устаревших
type ValidationSchema<T> = (ctx: { model: FormModel<T> }) => void;

// identity-обёртка (типизация/discoverability; как defineFormBehavior)
defineValidationSchema<T>(fn: ValidationSchema<T>): ValidationSchema<T>

// ambient-операторы (только внутри validateModel-прогона)
validate<T>(sig: PathAwareSignal<T>, rules: Rule<T>[]): void
validateAsync<T>(sig: PathAwareSignal<T>, rules: AsyncRule<T>[]): void
validateWhen(cond: () => boolean, cb: () => void): void
cross<T>(sig: PathAwareSignal<unknown>, fn: (f: T) => ValidationError | null): void
each<U>(arr: ModelArray<U>, itemFn: (im: FormModel<U>) => void): void
apply<T>(...schemas: ValidationSchema<T>[]): void

// внешний раннер (имя validateModel — из @reformer/core/validation; НЕ путать со старым root-движком до его удаления в Ф6)
validateModel<T>(model: FormModel<T>, schema: ValidationSchema<T>): Promise<boolean>
```

Семантика: ambient-коллектор жив только на время синхронного прогона схемы внутри `validateModel`; `owned` на пару
`(model, schema)` гасит поля, ставшие валидными; generation-guard + `AbortSignal` против устаревшего async;
`severity:'warning'` не блокирует. Роутинг ошибок в ноды — через `getNodeForSignal(sig).setErrors(...)`.
Правила-фабрики (`required/min/pattern/...`) — как есть.

### Поведение — публичный API (без изменений, фиксируем)

`defineFormBehavior<T>(({model, form}) => { … })` + операторы `compute/computeFrom/copyFrom/onChange/watchField/enableWhen/
disableWhen/resetWhen/syncFields/transformValue/apply/applyEach/revalidateWhen`. Подключение — `createForm({ behavior })`.
Мост «поведение инициирует валидацию»: `revalidateWhen([deps], () => validateModel(model, schema))`.

### Инвариант миграции (снижает объём работ)

Фабрика конфига визарда **сохраняет сигнатуру** `makeValidationConfig(model) → { validateStep, validateAll }`
(меняется только её внутренность — с локального раннера на `validateModel`). Поэтому **весь слой потребления**
(FormWizard в cdk/ui-kit, инъекция в render-behavior/render-schema, проводка в примерах) **остаётся нетронутым**.

---

## Зафиксированные решения ✅

1. **Имя внешнего раннера** — `validateModel(model, schema)`. ⚠️ Имя занято текущим headless-движком в root `@reformer/core`.
   Разведено сабпатом: новый — из `@reformer/core/validation`, старый — в root (deprecated) до удаления в Ф6, затем имя освобождается.
2. **Путь экспорта** — отдельный сабпат **`@reformer/core/validation`** (симметрично `@reformer/core/behaviors`).
3. **`defineValidationSchema(fn)`** — вводим тонкую identity-обёртку (типизация/discoverability, как `defineFormBehavior`).
4. **Старый движок** (`validateFormModel`/`validateModel`-tree + дерево `{value,validators}`) — на период миграции `@deprecated`,
   **удаляем сразу по завершении работ (Ф6)** — не оставляем как публичный legacy.
5. **AbortSignal в async** — контракт `AsyncRule<T> = (value, { signal }) => Promise<…>`; раннер прокидывает `AbortSignal`
   и отменяет устаревшие ответы (в дополнение к generation-guard).

---

## Фазы

Легенда: **[seq]** — блокирует следующие; **[par]** — можно параллельно внутри фазы. Зависимости указаны явно.

### Фаза 0 — Заморозка контракта **[seq, блокирует всё]**
- 0.1 ✅ 5 решений закрыты (см. «Зафиксированные решения»).
- 0.2 Оформить канонический spec контракта (валидация + поведение) как источник истины — на базе [validation-apply](schema-contract-validation-apply.md) + [two-ambient §3](schema-contract-two-ambient-listing.md). Один файл, на него ссылаются все фазы.
- **Готово когда:** spec-файл контракта оформлен; имена/сигнатуры/семантика/экспорт-путь зафиксированы письменно.

### Фаза 1 — Ядро `packages/reformer/src` **[seq, зависит от Ф0]**
- 1.1 Новый рантайм валидации (новый модуль, напр. `form/validation-runtime.ts`): `validate/validateAsync/validateWhen/cross/each/apply/validateModel` + `ValidationSchema` + ambient-scope + `owned` WeakMap + generation. Переиспользует `getNodeForSignal` ([form/signal-node-registry.ts](../../packages/reformer/src/form/signal-node-registry.ts)), `signal.peek()`, `model.get()`, фабрики из `form/validation/validators/*`.
- 1.2 Экспорт в сабпат `@reformer/core/validation` (+ его entry в `package.json` exports, симметрично `/behaviors`); barrels НЕ смешивать с root (старый `validateModel` там живёт до Ф6). Полный JSDoc (питает `get_symbol_docs`/TypeDoc).
- 1.3 Unit-тесты нового раннера (`packages/reformer/tests/core/model/`): гашение `owned`, `validateWhen`-гейтинг, `validateAsync`+await, generation/stale, `apply`-композиция, `each`-массивы, `cross`-снапшот, warning-неблокирование, `owned` на пару (model,schema).
- 1.4 `@deprecated` на `validateFormModel`/tree-authoring в [validate-model.ts](../../packages/reformer/src/form/validate-model.ts), [validate-model-core.ts](../../packages/reformer/src/form/validate-model-core.ts); убрать осиротевшие legacy-остатки в [types/validation-schema.ts](../../packages/reformer/src/form/types/validation-schema.ts). НЕ удалять (нужен на период миграции).
- 1.5 Аудит поведения: подтвердить, что `defineFormBehavior` + операторы — канон; проверить мост `revalidateWhen(…, () => validateModel(…))`. Код-изменений скорее нет.
- **Готово когда:** `validateModel` работает, unit-тесты зелёные, публичный экспорт есть, JSDoc полный, старый движок помечен deprecated (но рабочий).

### Фаза 2 — Пакеты-интеграции **[par, зависит от Ф1]**
Инвариант сигнатуры конфига делает эту фазу в основном **верификацией**.
- 2a **[par]** CDK: [FormWizard.tsx](../../packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx) / `types.ts` / `error-resolver.tsx` — подтвердить, что `{validateStep,validateAll}` контракт не изменился. Опционально добавить хелпер `makeWizardValidation(model, stepSchemas, formSchema)`, оборачивающий `validateModel` (снимает бойлерплейт per-form).
- 2b **[par]** UI-kit: [form-wizard/variants/base](../../packages/reformer-ui-kit/src/components/form-wizard/variants/base/form-wizard.tsx) — верификация.
- 2c **[par]** renderer-react: [core/render-behavior.ts](../../packages/reformer-renderer-react/src/core/render-behavior.ts) — паттерн инъекции конфига не меняется; обновить golden-пример позже (Ф3).
- 2d **[par]** renderer-json: конвертер + инъекция через `patchProps` — верификация.
- **Готово когда:** сборка пакетов зелёная; конфиг-контракт визарда подтверждён; (опц.) CDK-хелпер добавлен.

### Фаза 3 — Миграция проекта `react-playground` **[зависит от Ф1; par по формам после флагмана]**
- 3.1 **[seq, первый — проверка контракта]** Флагман [complex-multy-step-form/schemas/validation.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/validation.ts): с локального `(m,v)` раннера → на библиотечный `validateModel` + имена `validate/validateAsync/validateWhen/cross/each/apply`; разбить на per-step функции + `apply`; сохранить сигнатуру `makeCreditValidationConfig`. Регресс: `validation/conditional-fields/arrays/happy-path` spec.
- 3.2 **[par]** `mcp-credit-application-core-v20/validation.ts` — дерево `{value,validators}` → новый контракт.
- 3.3 **[par]** `mcp-credit-application-renderer-react-v20/validation.ts` — то же.
- 3.4 **[par]** `mcp-credit-application-renderer-json-v20/validation.ts` — то же.
- 3.5 **[par]** [registration-form-renderer-json/validation.ts](../../projects/react-playground/src/pages/examples/registration-form-renderer-json/validation.ts) — с `(m,v)` локального → `validateModel`.
- 3.6 **[par]** `ValidationExamples.tsx`, `RegistrationForm.tsx`, `ImperativeHandles.tsx` — дерево → новый контракт.
- 3.7 **[par]** Поведение: подтвердить канон флагманского [behavior.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/behavior.ts); в `BehaviorsExamples.tsx` перевести `revalidateWhen(…, () => validateFormModel(…))` → `validateModel`.
- **Готово когда:** tsc + lint чистые; полный e2e `react-playground-e2e` зелёный (поведенчески эквивалентно — как при миграции флагмана на Contract B).

### Фаза 4 — MCP `packages/reformer-mcp` **[par с Ф3/Ф5, зависит от Ф0+Ф1]**
- 4.1 **[приоритет]** `src/prompts/templates/add-validation.md` — переписать на новый контракт (убрать `{value,validators}`/`validateFormModel`); ребилд `dist/`.
- 4.2 `add-behavior.md` — обновить перекрёстные ссылки (`revalidateWhen`→`validateModel`-мост).
- 4.3 `create-form.md`, `to-renderer.md`, `to-renderer-json.md`, `add-wizard.md`, `add-form-array.md`, `plan-form.md` — обновить упоминания валидации.
- 4.4 MCP `llms.txt` + `docs/llms/05-m1-workflow.md`, `01-guide.md`, `02-tools.md` — новый контракт.
- 4.5 [src/tools/find-recipe.ts](../../packages/reformer-mcp/src/tools/find-recipe.ts) — алиасы/комментарии под новые операторы (conditional-validation → `validateWhen`, добавить `validate/validateAsync/apply/cross/each`).
- 4.6 `get_symbol_docs`/`list_symbols` — автоподтянут из JSDoc (обеспечен в 1.2); проверить выдачу.
- 4.7 Ребилд MCP (src→dist), прогнать инструменты.
- **Готово когда:** MCP учит новому контракту; шаблоны src+dist синхронны; `find_recipe`/`get_symbol_docs` отдают новые операторы.

### Фаза 5 — Документация **[par с Ф3/Ф4, финализировать после Ф1]**
Приоритет — «ядровые» страницы контракта. RU рендерится из отдельных `i18n/ru/` файлов — обновлять зеркально.
- 5.1 **[par]** Core пакет: `packages/reformer/llms.txt` + `docs/llms/` — `27-revalidate-when.md` (переосмыслить), `13-multi-step.md`, `03-api-signatures.md`, `04-common-patterns.md`, `31-async-validator-debounce.md`, `18-conditional-fields.md`, `28-submit-and-reset.md`, `05/14/17-mistakes`.
- 5.2 **[par]** Рендереры: `renderer-react/docs/llms/06-validation.md` и `renderer-json/docs/llms/06-validation.md` (полные переписи) + их `llms.txt`.
- 5.3 **[par]** UI-kit/CDK: `docs/llms/07-form-wizard.md`, `03-form-navigation.md`, `04-form-field.md` + `llms.txt`.
- 5.4 **[par]** reformer-doc EN: `docs/validation/{overview,built-in,custom,async,validation-strategies,error-handling}.md`; `docs/core-concepts/schemas/{validation-schema,overview,composition,form-schema}.md`; `patterns/{submit-and-reset,arrays,project-structure}.md`; `getting-started/quick-start.md`; `react/hooks.md`; `packages/core.md`. **Приоритет:** `docs/mcp/examples.md` (содержит удалённый `ValidationSchemaFn`).
- 5.5 **[par]** reformer-doc RU: `i18n/ru/.../current/` — зеркала всех страниц из 5.4.
- 5.6 **[par]** READMEs: корневой `README.md` (большой раздел валидации), `packages/reformer/README.md`, `packages/reformer-ui-kit/README.md`, renderer READMEs.
- 5.7 TypeDoc `docs/api/**` — **не править вручную**; регенерировать из обновлённого JSDoc (Ф1).
- **Готово когда:** ни одна страница не учит старому контракту; RU=EN; README согласованы; TypeDoc перегенерирован.

### Фаза 6 — Депрекация, чистка, финальные гейты **[seq, после Ф3+Ф4+Ф5]**
- 6.1 **Удалить** старый движок (решение #4): `validateFormModel`, старый root-`validateModel`/`validateModelSync`, tree-walk в `validate-model-core`, harvest `validators` из схемы в [create-form.ts](../../packages/reformer/src/form/create-form.ts). Предусловие — grep подтверждает 0 потребителей дерева `{value,validators}`. После удаления имя `validateModel` в root свободно.
- 6.2 Убрать legacy-остатки типов, мёртвый код.
- 6.3 Полный монорепо-гейт: build + unit + lint + e2e зелёные.
- 6.4 Migration guide / changelog для внешних потребителей (`validateFormModel(model, schema)` → `validateModel(model, schema)` + смена авторинга дерева на операторы).
- **Готово когда:** старый контракт удалён/помечен; всё зелёное; гайд миграции опубликован.

---

## Граф зависимостей и параллелизм

```
Ф0 (freeze) ──> Ф1 (core) ──┬──> Ф2 (integration: 2a‖2b‖2c‖2d)
                            │
                            ├──> Ф3 (project: 3.1 → 3.2‖3.3‖3.4‖3.5‖3.6‖3.7)
                            │
              Ф0 ──────────┼──> Ф4 (MCP)         ┐
                            │                      ├─ Ф3‖Ф4‖Ф5 идут параллельно
                            └──> Ф5 (docs: 5.1..5.6 параллельно) ┘
                                                   │
                            Ф3 + Ф4 + Ф5 ─────────> Ф6 (cleanup + гейты)
```

- **Критический путь:** Ф0 → Ф1 → Ф3.1 (флагман, проверка контракта) → остальное Ф3 ‖ Ф4 ‖ Ф5 → Ф6.
- **Максимальный параллелизм** после Ф1: интеграции (4), формы проекта (6), MCP, доки (6 областей) — независимы.
- **Гейт эквивалентности:** e2e `react-playground-e2e` должен оставаться зелёным на каждом шаге Ф3 (миграция поведенчески эквивалентна — как уже проверено при переходе флагмана на Contract B).

---

## Чек-лист прогресса

**Ф0 — Freeze**
- [x] 0.1 Закрыть 5 открытых решений ✅
- [x] 0.2 Канонический spec контракта → [contract-spec.md](contract-spec.md) ✅

**Ф1 — Core** ✅ (тесты: 12 новых + 779 сьют зелёные, tsc/билд зелёные)
- [x] 1.1 Рантайм `validateModel` + операторы → [validation-schema.ts](../../packages/reformer/src/form/validation-schema.ts)
- [x] 1.2 Сабпат `@reformer/core/validation` (vite entry + package.json exports) + JSDoc; общий registry-чанк подтверждён
- [x] 1.3 Unit-тесты раннера → [validate-model-schema.test.ts](../../packages/reformer/tests/core/validation/validate-model-schema.test.ts)
- [x] 1.4 `@deprecated` на `validateFormModel`/`validateModel`(tree)/`validateModelSync` (чистка legacy-типов сворачивается в Ф6)
- [x] 1.5 Аудит поведения: `defineFormBehavior` — канон; мост `revalidateWhen(…, () => validateModel(…))` подтверждён (без изм.)

**Ф2 — Интеграции** ✅ (верификация: конфиг-контракт `{validateStep,validateAll}` не менялся; e2e подтвердил инъекцию в base/renderer/json)
- [x] 2a CDK · [x] 2b UI-kit · [x] 2c renderer-react · [x] 2d renderer-json (опц. CDK-хелпер отложен)

**Ф3 — Проект**
- [x] 3.1 Флагман validation.ts → `@reformer/core/validation`; tsc/lint чисто; **e2e поведенчески эквивалентен** (base: те же 77/15; renderer+json: те же 8 — все предсуществующие, подтверждено stash-baseline)
- [x] 3.2 mcp-core-v20 · [x] 3.3 mcp-react-v20 — мигрированы после gap #1 fix; tsc/lint чисто (iteration-артефакты, свои e2e отсутствуют → верификация tsc+lint)
- [x] 3.4 mcp-**json**-v20 — мигрирован; gap #2 закрыт **без нового оператора**: whole-array валидаторы → плоские `(list)=>error` + `cross` на has-флаге (сообщения дословно). tsc/lint чисто.
- [x] 3.5 registration-json → `@reformer/core/validation`; tsc/lint чисто; **11/11 e2e зелёные** (validate/cross/validateAsync)
- [x] 3.6a RegistrationForm.tsx (split render/validation) — tsc/lint чисто; e2e **поведенчески эквивалентен** (55 passed, те же 3 предсущ. падения old=new через stash-baseline)
- [x] 3.6b ValidationExamples.tsx (split + 12 демо-строк обновлены) — страница рендерится; validators.spec падает **идентично** old=new (~65) → предсуществующая проблема спеки (тестит несуществующие date-демо isDate/minDate/maxDate/futureDate/minAge/maxAge), НЕ регрессия. FOLLOW-UP: починить спеку/добавить демо.
- [x] 3.6c ImperativeHandles.tsx — **форк ЗАКРЫТ.** Рефактор: split render/validation; `focusFirstInvalid` теперь `validateModel` + чтение ошибок из нод (`getNodeForSignal(model.signalAt(path)).errors`) вместо `.errors`-карты — on-theme для демо про императивные handle. e2e **6/6 зелёные** (вкл. IMP-006 focus первого невалидного).
- [x] 3.7 BehaviorsExamples.tsx: `revalidateWhen(…, () => validateModel(model, amountValidation))` + демо-строка обновлена — e2e **100% зелёный** (0 падений)
- [ ] Полный e2e зелёный (после ImperativeHandles + json-v20/gap#2)

**FOLLOW-UP (до Ф6):**
- [x] **Контрактный пробел #1 (nullable-валидаторы) — ЗАКРЫТ.** Оказалось: `min`/`max`/числовые уже были `T|null|undefined`, а строковые/дата (`email`/`pattern`/`url`/`phone`/`is-date`/`past-date`/`future-date`) — только `T|undefined`. Выровнял 7 валидаторов до `T|null|undefined` (type-only, рантайм уже обрабатывал null через `if(!value)`). Контекстный вывод даёт `TField=string|null` из ожидаемого `Rule<string|null>`. Проверено: nullable-тест + 781 сьют зелёные, dist пересобран. Теперь `validate(model.$.optionalStr, [email()])` компилится.
- [x] **Whole-array валидаторы (gap #2) — ЗАКРЫТ без нового оператора.** Оказалось: whole-array валидатор = «хотя бы один» + per-item first-error — упаковка, а не пробел. Решение: плоская функция `(list)=>error` + `cross(model.$.hasFlag, (f)=>validator(f.array))` (read из снапшота, ошибка на has-флаге). Паттерн годится для любой «валидации массива целиком».
- [x] **mcp-*-v20 (×3) — все мигрированы** (core/react после gap #1, json после gap #2).

**Предусловие Ф6 выполнено:** весь `react-playground` **код** сошёл с `validateFormModel` (остались только stale-комментарии/docstring/имена тестов — почистить в Ф5). Проверить `packages/*` код (cdk/renderers/ui-kit) перед удалением в Ф6.

**Ф4 — MCP** ✅ ЗАКРЫТ
- [x] 4.1/4.2/4.3 шаблоны: add-validation, add-behavior, create-form, add-wizard, add-form-array, plan-form, to-renderer, to-renderer-json (src+dist)
- [x] 4.4 MCP docs/llms (05-m1-workflow, 01-guide, 02-tools) + MCP `llms.txt` (регенерён, 16× validateModel) · [x] 4.5 find-recipe алиасы · [x] 4.7 ребилд MCP

**Ф5 — Docs** (tier-1 LLM-рецептов закрыт)
- [x] 5.1a core `llms.txt` (86× validateModel, 0 старых) + docs/llms: `13-multi-step`, `27-revalidate-when`, `04-common-patterns`, `31-async`, `18-conditional`, `28-submit`
- [x] 5.2 renderer-react + renderer-json `06-validation.md` · [x] 5.3 ui-kit `07-form-wizard` + cdk `03-form-navigation`
- [x] 5.4-A1 reformer-doc EN core (8): `validation/{overview,built-in,custom,async,validation-strategies,error-handling}`, `core-concepts/schemas/validation-schema`, `mcp/examples` (древний `ValidationSchemaFn` вычищен) — все `old:0`, кросс-чек ✅
- [x] 5.4-A2 reformer-doc EN остаток (10) — перезапущен после сброса лимита, все `old:0` (core-concepts/schemas/{overview,composition,form-schema}, nodes, patterns/{submit-and-reset,arrays}, quick-start, hooks, packages/core, behaviors/watch)
- [x] 5.5-A3 reformer-doc RU (17 зеркал) — все `old:0`, кросс-чек Grep ✅
- [x] 5.4-A4 финальный батч (19): leftover locale-слоты (`docs/` = RU-дефолт: behaviors/overview, packages/ui-kit, patterns/openapi-generation, ui-kit/form-navigation + их `i18n/ru`-зеркала; RU `packages/ui-kit` физически не существует — n/a) + core docs/llms (03-api-signatures, 05/14/17-mistakes) + READMEs ×7 (root, core, ui-kit, renderer-react, renderer-json, cdk, mcp) — все `old:0`
- [x] 5.4-A5 хвост после сквозного sweep (инлайн, после падения workflow по лимиту): core llms `01-api-reference`, `02-quick-start`, `06-troubleshooting`, `07-complete-import`, `09-formschema`, `10-arrays`, `15-project-structure`, `21-array-operations`, `29-async-preload` (частично успел агент), `30-type-safety-recipes`; mcp llms `03-prompts`, `06-form-directory-layout`; ui-kit llms `01-overview`, `02-text-fields`, `06-troubleshooting`, `09-input-mask`, `10-imperative-handles`; renderer-react `04-troubleshooting`; renderer-json `02-json-schema`; cdk `06-recipes`, `07-troubleshooting`; reformer-doc `patterns/project-structure` (docs+i18n/ru) + `i18n/en/mcp/examples` (EN-слот, `ValidationSchemaFn`)
- [x] 5.1b закрыт в составе A4/A5 · [x] 5.6 READMEs — в A4 · [x] `llms.txt` ×6 регенерированы (`generate:llms`) после миграции исходников · [ ] 5.7 TypeDoc regen — при следующем build docs (docs/api не трекается git, регенерится из уже-починенного JSDoc)

> Итог сквозного sweep: единственные оставшиеся вхождения старых токенов в доках — removal/anti-pattern контексты («УДАЛЕНО», «// NO!», «символа нет») в mistakes/nonexistent-api файлах и их llms.txt-зеркалах — намеренные.

**Ф6 — Cleanup** (C-full ядро ЗАКРЫТО + верифицировано)
- [x] 6.1 **Удалён** старый движок: `validateFormModel` + `validate-model.ts` + `validate-model-core.ts` (tree-walk/validateModel/validateModelSync) + createForm-биндинг (`attachModelValidator`) + `groupNode._modelValidate`. `form.validate()/submit()` теперь отражают состояние нод (валидация внешняя). Экспорты убраны из `form/index.ts`.
- [x] 6.1-tests **Мигрированы/удалены ~25 obsolete-тестов** старого пути: удалены `validate-model.test.ts` (11) + `validate-model-async-severity.test.ts` (7); вырезаны gate/validateFormModel-тесты в in-form-state (1), create-form-arrays (1), create-form-from-model (1), create-form-m1-gate (4).
- [x] 6.3 **Монорепо-гейт:** typecheck (все пакеты+playground) ✅ · **756 unit-тестов** ✅ · eslint (тронутые) ✅ · e2e **поведенчески эквивалентен** (5 падений = предсущ., подтверждено по именам) ✅ · core dist пересобран (107→104kB)
- [x] 6.2a Публичные JSDoc `@example` (`createForm`, `revalidateWhen`) → новый контракт
- [x] 6.2b Stale-sweep закрыт: комментарии/JSDoc поправлены в `form/index.ts`, `src/index.ts`, `types/validation-schema.ts` (модуль + `Validator` помечен `@deprecated`), `types/schema-node.ts`, `group-node.ts` (вкл. осиротевший JSDoc `_modelValidate`), `create-form.ts`, `behaviors.ts`, `validation/index.ts`, cdk `form-wizard/{types.ts,FormWizard.tsx}`, ui-kit `form-wizard/base`, тесты `web-scenarios`/`create-form-from-model` (снят stale-импорт `ModelValidator` + `validators` из схемы). Harvest `validators` в `create-form.ts` уже собирает-и-срезает (легаси-узлы не ломаются) — оставлен как есть с уточнённым комментарием. Типы `Validator`/`SchemaValidator` остаются экспортированными (compat), `ModelValidator` не экспортируется.
- [x] 6.4 Migration guide был написан (`docs/guides/migration-validation-contract.md`: таблица удалено→стало, 9 шагов, семантика раннера), затем **удалён по решению пользователя** (внутренняя миграция завершена, внешних потребителей на старом контракте нет). Суть «удалено→стало» сохранена в `packages/reformer/docs/llms/17-nonexistent-api.md` и `14-extended-mistakes.md`. Changelog — придёт из conventional-commit при коммите (semantic-release, CHANGELOG.md руками не правится).
- Пост-C-full верификация: tsc core ✅, 756 unit ✅ (после sweep)

---

## Полная инвентаризация затрагиваемых файлов

Собрана двумя разведочными проходами (код + документация). Ниже — сжато по категориям; используй как чек-справочник при исполнении фаз.

**Код — ядро (Ф1):** `validate-model.ts`, `validate-model-core.ts`, `types/{validation-schema,schema-node,contracts,index}.ts`, `signal-node-registry.ts`, `error-handler.ts`, `validation/index.ts` + 28 `validation/validators/*`, `create-form.ts`, `nodes/{field-node,group-node}.ts`, `factories/node-factory.ts`, barrels `index.ts`/`form/index.ts`/`state/index.ts`; поведение — `behaviors.ts`, `behaviors-node.ts`, `state/behaviors-value.ts` (не менять).

**Код — авторинг валидации (Ф3):** уже новый стиль — `complex-multy-step-form/schemas/validation.ts`, `registration-form-renderer-json/validation.ts`; старое дерево — `mcp-credit-application-{core,renderer-react,renderer-json}-v20/validation.ts`, `validation/ValidationExamples.tsx`, `registration-form/RegistrationForm.tsx`, `imperative-handles/ImperativeHandles.tsx`.

**Код — потребление (Ф2, в осн. не менять):** cdk `form-wizard/{FormWizard.tsx,types.ts,FormWizardContext,FormWizardActions}`, `validation/error-resolver.tsx`; ui-kit `form-wizard/variants/base/form-wizard.tsx`; renderer-react `core/{render-behavior,render-schema-proxy}.ts`; renderer-json `converter/json-to-render-schema.ts`; проводка в примерах — `RendererFormWizard.tsx`, `*/render-schema.ts`, `*/render-behavior.ts`, `*/renderer.behavior.ts`, `mcp-*-v20/{index.tsx,renderer.schema.ts,registry.ts}`, `registration-form-renderer-json/{form-setup,RegistrationFormRendererJson}.tsx`.

**Код — поведение (Ф3.7):** `complex-multy-step-form/schemas/{behavior,operators,create-form,schema,model}.ts`, `Address/address-behavior.ts`, `mcp-*-v20/form.behavior.ts`, `behaviors/BehaviorsExamples.tsx`.

**Тесты (Ф1/Ф3 гейты):** unit — `tests/core/model/{validate-model,validate-model-async-severity,in-form-state}.test.ts`, `tests/core/nodes/*`, `tests/core/utils/create-form*.test.ts`, `tests/behaviors/*`; e2e — `pages/validation/*`, `pages/complex-multy-step-form/{validation,computed-fields,conditional-fields,dependencies}.spec.ts`, `pages/behaviors/*`, `pages/registration-form-json/*`, `pages/simple-form/registration.spec.ts`, `pages/imperative-handles/*`.

**Docs/MCP (Ф4/Ф5) — приоритетные ядровые:** `docs/core-concepts/schemas/validation-schema.md` (+RU), `docs/validation/*` (+RU), `packages/reformer/llms.txt`, `packages/reformer/docs/llms/27-revalidate-when.md`, `renderer-{react,json}/docs/llms/06-validation.md`, MCP `add-validation.md` (src+dist) + `llms.txt` + `05-m1-workflow.md`, корневой `README.md`, `docs/mcp/examples.md` (удалённый `ValidationSchemaFn` — в первую очередь). Полный список — в разведочном отчёте (см. историю сессии); TypeDoc `docs/api/**` не править (регенерация).
