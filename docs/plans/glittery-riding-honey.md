# Модуль формы из билдера: разная раскладка для простой формы и визарда

## Context

Кодоген билдера (`projects/reformer-builder`, стек `packages/reformer-builder-stack-reformer`) печатает
для простой формы и визарда **одну и ту же плоскую папку** с одинаковыми именами; визард отличается
только файлом `renderer.wizard.tsx`. Шаги визарда размазаны: узлы — внутри `renderer.schema.json`,
правила — `step1..N` внутри одного `validation.ts`, навигация — в `renderer.behavior.ts`. Признак
«визард» считается в четырёх местах (`wizardShimOf`, `submitEvent`, `stepValidationView`,
`renderBehaviorView`) и завязан на наличие адаптера у кита — golden `wizard-no-adapter` печатает
визард как простую форму.

Цель — уникальная раскладка для каждого типа формы и единая схема имён `form.*`, согласованная
с каноном MCP. Решения пользователя:
- простая форма — плоская, переименованная;
- визард — папка `steps/<slug>/` на шаг, **схема тоже режется по шагам** (билдер должен работать
  с такой формой как с одним документом);
- имена: `renderer.schema.json` → `form.schema.json`, `renderer.behavior.ts` → `form.render.ts`,
  `renderer.wizard.tsx` → `wizard.tsx`; остальное без изменений; `README.md` остаётся;
- папка шага — только слаг (без номера), агрегатор — `steps/index.ts`;
- MCP-канон выравнивается сразу, для **всех** таргетов (`form.schema.*`, `form.render.ts`).

Работа идёт в два этапа; этап 1 (структура и имена) выпускается отдельно и не ломает билдер.
Схема в этапе 1 остаётся одним файлом: она же — редактируемый исходник билдера (`findSchemaIn`,
шаблоны), а разбитую схему билдер откроет только после этапа 2.

## Целевая раскладка

```
простая форма                     визард
─────────────                     ──────
index.tsx                         index.tsx
types.ts                          types.ts
model.ts                          model.ts
form.schema.json                  form.schema.json          (этап 2: скелет со $ref на шаги)
registry.ts                       registry.ts
                                  wizard.tsx                (если у кита есть адаптер визарда)
data-sources.ts                   data-sources.ts
form.render.ts                    form.render.ts            onInit(wizard, config), submit, цикл stepRenders
form.behavior.ts                  form.behavior.ts          на шаги не делится (межшаговое по природе)
validation.ts                     validation.ts             apply(...stepValidations) + правила вне шагов + makeValidationConfig
api.ts                            api.ts
README.md                         README.md
                                  steps/
                                    index.ts                derived: stepValidations[], stepRenders[] (этап 2: stepSchemas)
                                    dannye/validation.ts    user+regenerable: export const stepValidation
                                    dannye/form.render.ts   user+regenerable: export function stepRender(schema, { form, model })
                                    dannye/form.schema.json (этап 2)
                                    kontakty/…
```

Экспорты корневых файлов не меняются (`formValidation`, `makeValidationConfig`,
`createJsonRenderBehavior`) — правленный руками старый файл остаётся совместимым.

**Слаг папки шага:** `kebab(title)` через `kebab` из `@reformer/builder-toolkit` (транслитерация);
пустой заголовок или оператор (`$i18n(...)`) → селектор шага без `-section` → `step-<N>`; обрезка
до 32 символов по `-`; дубль → `-2`, `-3`. Порядок шагов задаёт `steps/index.ts`, поэтому
перестановка шагов папки не трогает. Переименование шага даёт новую папку — старая сообщается как
«сирота» (удалять/переносить хост пока не умеет).

## Этап 1 — структура и имена

### 1. Единый источник имён — `packages/reformer-builder-stack-reformer/src/codegen/layout.ts` (новый)
`MODULE_FILES` (schema/types/model/registry/index/wizard/dataSources/render/behavior/validation/
api/readme), `STEPS_DIR`, `STEPS_INDEX`, `STEP_FILES`, `LEGACY_FILES` (`renderer.schema.json`,
`renderer.behavior.ts`, `renderer.wizard.tsx`), `SCHEMA_FILE_NAMES` (канон первым),
`formNameOfSchemaPath(path)` (для канонических имён — имя папки), `importOf(from, to)`.
Экспорт через `codegen/index.ts`. Литералы имён убрать из: `pipeline/targets.ts`,
`commands/context-menu.ts` (`SCHEMA_NAME`, `schemaCandidates`, `nameOfSchemaFile` → `formNameOfSchemaPath`),
`pipeline/run.ts` (`defaultFormName` — сейчас даёт имя формы `renderer`), `codegen/testing.ts:105`,
`preview-runtime/compiling/exports.ts`, шаблонов `.eta` (импорты через `it.layout.imports`).

### 2. Раскладка как часть контекста — `codegen/steps.ts` (новый, stack-reformer)
`StepInfo { index, dir, path, title, selector, nodeId, required, fields, selectors, sections, imports }`,
`ModuleLayout { kind: 'simple' | 'wizard'; steps }`, `stepDirName(...)`, `layoutOf(schema, collected, mock)`.
- `EmitContext.layout` заполняет `prepare()` (`codegen/context.ts`); `CodegenView` получает `layout`
  и `step`.
- `collect.ts`: экспортировать `wizardStepsOf`, расширить `StepRequired` (`fields`, `nodeId`) в том
  же обходе.
- `kind === 'wizard'` ⇔ в схеме есть шаги, **независимо от кита**. `wizardShimOf` решает только
  про `wizard.tsx`; `stepValidationView` (`view/index.ts` ~222) переписать на `layout`.
- Учитывается первый визард в схеме; несколько визардов → `CodegenProblem`.

### 3. Цель на несколько файлов — `projects/reformer-builder/src/plugins/codegen/contract.ts`
В `CodegenTarget`: `each?: 'step'` (путь-шаблон с `{step}`, напр. `steps/{step}/validation.ts`)
и `legacyPaths?: readonly string[]`; `EmitContext.step?: StepInfo`.
- `pipeline/generate.ts`: `selectTargets` проверяет шаблон (`'bad-pattern'`), раскрывает цель в
  экземпляры по `layout.steps`, дубли/выход за папку — на каждом экземпляре; для простой формы
  экземпляров ноль. `bodyOf` отдаёт шаблону `it.step`, `emit` — `ctx.step`.
- `ModuleFile`/`EmittedFileRef` получают `targetId` и `step?` (README группирует по шагам;
  «сгенерировать одну цель» пишет все её экземпляры).
- `pipeline/user-targets.ts` + `stack-reformer/codegen/template-file.ts`: строка `each: step` в
  шапке пользовательского шаблона.
- `applyOverrides`: предупреждение `'override-path-drift'`, если пользовательский шаблон
  переопределяет встроенную цель со старым путём.

### 4. Цели и шаблоны
`pipeline/targets.ts` (id целей не меняются — пользовательские `overrides` сохраняются):
- переименования путей: `codegen.schema` → `form.schema.json`, `codegen.render-behavior` →
  `form.render.ts`, `codegen.wizard` → `wizard.tsx` (у всех `legacyPaths`);
- новые: `codegen.steps-index` (derived, `applies: layout.kind === 'wizard'`),
  `codegen.step-validation` и `codegen.step-render` (`each: 'step'`, user, regenerable).

Шаблоны `packages/reformer-builder-stack-reformer/src/codegen/templates/`:
- `index-tsx`, `registry` (`./wizard`), `render-behavior`, `wizard`, `readme` — имена и импорты
  из вида, заголовки-комментарии по новым именам;
- `validation.eta`: ветка визарда → агрегатор (`apply(...stepValidations)`), ветка простой формы
  без изменений;
- новые `steps-index.eta`, `step-validation.eta`, `step-render.eta` (регистрация в
  `templates/index.ts`); `readme.eta` описывает `steps/` и судьбу папки при переименовании шага.

### 5. Разбиение правил по шагам
- MCP `packages/reformer-mcp/src/core/generate/builders.ts`: выделить
  `buildValidationSchemaTs(rules, opts)`; `buildValidationTs` — обёртка, вывод байт-в-байт тот же.
- `stack-reformer/codegen/emit/rules-bridge.ts`: `stepValidationFromRules` /
  `rootValidationFromRules` — правило к шагу, если его `target` (с учётом `each`) в `step.fields`,
  остальное в корень.
- `view/render-rules.ts`: `renderBehaviorView(ctx, step?)` — render-правило к шагу по
  `step.selectors`.
- Исправляется попутный баг: «визард + правила» сейчас не передаёт `config`, «Далее» не проверяет шаг.

### 6. Доставка — `pipeline/deliver.ts`
`DeliveryResult` + `orphans` (папки `steps/*` на диске, которых нет в наборе — только сообщение,
не удаление) и `legacy` (перенос старых имён: если нового файла нет, а старый есть — правленный
руками user-файл переносится под новым именем, нетронутый печатается заново; старый остаётся,
уведомление предлагает удалить; для схемы — действие «Открыть form.schema.json»).
Уведомления — в `notifyOutcome` и панели экспорта.

### 7. Превью — `projects/reformer-builder/src/plugins/preview-runtime/compiling/`
- `read.ts` `readSidecars`: рекурсивный обход папки формы (глубина ≤ 3, без `node_modules`,
  `.ui_builder`, dot-папок), ключи — относительные пути; `PreviewHost.list?`/`parentOf?`.
- `sources.ts`: `PAGE_ENTRY` исключается только в корне (`steps/index.ts` остаётся), фильтры —
  по базовому имени.
- `entry.ts`: `require` только корневых файлов, шаги подтягивает линкер по импортам
  (`shell/platform/modules/linker.ts` уже резолвит подпути).
- `exports.ts`: `RENDER_BEHAVIOR_FILES = [form.render.ts, ...legacy]`.

### 8. Прочие места с именами
`ai/tools/set-render-rules.ts` (описание инструмента), комментарии в
`builder-toolkit/src/marker.ts`, `stack-reformer/codegen/{context,types,selectors,emit/schema,view/wizard}.ts`,
`generate.ts:238`. Плагин шаблонов (`plugins/templates/`) правок не требует — встроенные шаблоны
печатаются через `BUILTIN_TARGETS` (`ModulePrinterCapability`, `codegen/plugin.ts` ~390); проверить
создание вложенных папок в `content/operations.ts`.

### 9. Канон MCP (все таргеты)
| роль | core | renderer-react | renderer-json |
|---|---|---|---|
| схема разметки | `form.schema.ts` | `form.schema.ts`/`.tsx` | `form.schema.ts`/`.tsx`/`.json` |
| поведение модели | `form.behavior.ts` | `form.behavior.ts` | `form.behavior.ts` |
| поведение разметки | — | `form.render.ts` | `form.render.ts` |
| шим визарда | — | — | `wizard.tsx` (опц.) |
| визард по шагам (опц.) | `steps/index.ts` + `steps/<slug>/{validation.ts, form.render.ts, form.schema.*}` |||

- `builders.ts`: `FORM_LAYOUT_CANON`, новый `STEP_LAYOUT_CANON` (`LayoutFileSpec.scope`),
  `renderLayoutLine`, `buildBundle` печатает `form.schema.ts`/`form.render.ts`.
- `validate/layout.ts`: `concernOf` для новых основ; `LEGACY_STEMS` (`renderer.*`) → всегда
  warning RF011 «переименуйте в …» (из `ALIASES` убрать); вложенные `steps/<slug>/…` и
  `steps/index.ts` — канонические, иная вложенность — ошибка; `extraHint` про шаги,
  `inferLayoutTarget` (по `registry`/`wizard`/`form.render`, догадка проговаривается).
- Документация: `docs/llms/06-form-directory-layout.md` (правило имён, наборы, «шаги инлайном
  **или** `steps/<slug>/`», раздел старых имён); `src/index.ts`, `prompts/create-form.ts`,
  `prompts/templates/{create-form,plan-form}.md`, `tools/{generate-form,validate-form}.ts`,
  `eval/corpus/07-layout.json`; доки renderer-json, renderer-react, form-registry; перегенерация
  `llms.txt`/`llms-index.json` и базы знаний билдера (`npm run generate:knowledge`).
- Последствие: формы, ранее сгенерированные по `renderer.*`, получат предупреждения (не ошибки);
  таргет по имени схемы угадывается хуже — в сообщении советовать явный `target`.

### 10. Тесты этапа 1
- golden (`pipeline/golden.test.ts`, `__golden__/**`): пересобрать; новые наборы `wizard-rules`
  (правило в шаге, межшаговое, render-правило шага) и `wizard-slugs` (кириллица, дубли, пустой
  заголовок); `wizard-no-adapter` меняется намеренно (теперь раскладка визарда).
- юнит: `steps.test.ts`, `generate.test.ts` (`each`, `bad-pattern`, дубли экземпляров, простая
  форма → 0 экземпляров), `deliver.test.ts` (`orphans`, `legacy`), `user-targets`/`template-file`,
  `context-menu`, `run.test.ts` (`defaultFormName`), превью `read/sources/entry/exports/pipeline`,
  шаблоны (встроенный визард пишет `steps/`), MCP `validate-form`/`generate-form`/`get-context`/
  `docs-sections`.
- перегенерировать примеры `projects/react-playground/src/pages/debug/builder-tests/{test-03,test-04-break,w03}`.

## Этап 2 — составной документ (схема по шагам)

Детализируется после этапа 1; зафиксированный дизайн:
- **Формат шага** `steps/<slug>/form.schema.json`: `{ "$schema": ".../form-step.schema.json", "node": <Step> }`
  (не `root` — иначе файл шага откроется и сгенерируется как самостоятельная форма). В корне
  `componentProps.steps: [{ "$ref": "./steps/<slug>/form.schema.json" }]` — `$ref` уже подгружает
  `materializeClosure` (`shell/platform/workspace/materialize.ts`). Мета-схема:
  `buildFormStepMetaSchema()` в `packages/reformer-renderer-json/src/schema/`.
- **Сборка в рантайме**: `composeJsonFormSchema(skeleton, parts)` в `@reformer/renderer-json`;
  сгенерированный `index.tsx` собирает схему из `steps/index.ts` (`stepSchemas`).
- **Билдер**: необязательная способность провайдера `composition` (`references/compose/decompose/
  parsePart/printPart`) в `plugin-api/src/workspace/model/provider.ts`; чистые
  `splitFormSchema/joinFormSchema` в `stack-reformer/src/form-model/composite.ts`; новый
  `shell/platform/workspace/model/composite-document.ts` с интерфейсом `createModelDocument`:
  раздача правок по файлам частей, общий dirty/save пакетом, одна история отмены на все файлы,
  пересборка при внешней правке части. Разбиение/сборка — явные команды редактора; генерация
  повторяет структуру источника.
- **Потребители**: кодоген (`findSchemaIn` собирает части, цель `codegen.step-schema`), AI-плагин
  (`ai/session/{bridge,apply}.ts`, `ai/model/schema-text.ts` — работать с текстом документа, а не
  буфера ресурса), превью (схема уже из модели).

## Проверка

**Этап 1**
1. `npx vitest run` в `packages/reformer-builder-stack-reformer`, `projects/reformer-builder`,
   `packages/reformer-mcp`; diff golden-манифестов просмотреть глазами.
2. `npx tsc --noEmit -p projects/react-playground/tsconfig.app.json` после перегенерации
   `builder-tests/{test-03,w03}` (у визарда компилируются `steps/index.ts` и агрегатор).
3. В билдере (`npm run dev:builder`, playwright MCP, скриншоты в
   `projects/react-playground-e2e/screenshots/builder-layout/`): визард — «Далее» останавливает шаг
   с пустым обязательным полем; генерация в папку со старыми `renderer.*` — уведомление о легаси и
   перенос правленного файла; переименование шага — уведомление о «сироте»; шаблон «Пошаговая
   форма» создаёт `steps/`.
4. MCP `validate_form kind=layout`: новый набор без ошибок, старые `renderer.*` — только
   предупреждения, `steps/<slug>/validation.ts` принят, `lib/x.ts` — ошибка.
5. `node scripts/check-mcp-prompts.mjs`, `npm run typecheck`.

**Этап 2**: юнит-тесты `composeJsonFormSchema`, обратимость `split∘join` (байты и `$nodeId`),
составной документ (правка шага пишет один файл, перенос узла между шагами — два, отмена
откатывает оба, сохранение пакетом), golden `wizard-split`, ручная проверка открытия/сохранения
разбитой формы и AI-правки через два шага.
