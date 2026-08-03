# MCP `generate_form` — генерация JSON-форм с поведением

## Context — зачем это

Сегодня MCP-сервер `@reformer/mcp` работает как **справочник по библиотеке**: 6 tools
(`get_symbol_docs`, `find_recipe`, `list_symbols`, `validate_json_schema`, `check_behaviors`,
`report_issue`) + 11 промптов (`create-form`, `plan-form`, `to-renderer-json`, `add-validation`,
`add-behavior`, `add-wizard`, …). Промпты **направляют LLM-клиента**, но сам артефакт (форму)
производит клиент, а не сервер — качество зависит от клиента и ничем не гарантировано.

Цель: сделать так, чтобы MCP **сам производил готовую, провалидированную форму** с её поведением,
которую разработчик кладёт файлами в проект (scaffolding). Новый tool `generate_form`.

### Ключевое архитектурное ограничение (определяет всю форму решения)

В ReFormer **JSON несёт только layout**. Контракт `JsonFormSchema` из `@reformer/renderer-json`
(`packages/reformer-renderer-json/src/types/json-schema.ts`) — это `{ version?, root: JsonNode }`, где
`JsonNode = JsonFieldNode | JsonArrayNode | JsonContainerNode`, а привязки — строковые операторы
`$model(path)`, `$component(Name)`, `$html(tag)`, `$dataSource(NAME)`, `$fn(name)`, `$locale(key)`
(`packages/reformer-renderer-json/src/operators.ts`).

**Поведение — валидация, вычисляемые поля, условная видимость, wizard-навигация, submit — в JSON НЕ
выразимо by design.** Оно живёт в отдельных TS-DSL артефактах над той же моделью:
`defineValidationSchema` (`@reformer/core/validation`), `defineFormBehavior`
(`packages/reformer/src/form/behaviors.ts`: `compute`/`computeFrom`/`copyFrom`/`enableWhen`/…),
`RenderBehaviorFn` (`hideWhen`/`onInit`/`onComponentEvent`/`patchProps`, `@reformer/renderer-react`).

Поэтому «JSON-форма с поведением» = **бандл**: layout JSON + набор TS-файлов. Это ровно то, что уже
делает `projects/reformer-builder` (генерирует `form.json` + `model.ts` + `validation.ts` +
`behavior.ts` + `ui.ts`). Контракт `renderer-json` **не меняем**.

### Решения (подтверждены пользователем)

- **Выход = бандл** (layout JSON + TS-DSL), контракт renderer-json не трогаем.
- **Механизм = новый tool `generate_form`** (не промпт): сам валидирует и возвращает артефакт.
- **Потребитель = разработчик**: tool возвращает манифест файлов, клиент пишет их в репо через свой
  Write + permission-гейт (сервер на диск не пишет — см. «Почему манифест»).
- **v1 покрывает wizard** (Step-контейнеры + Wizard-шим + `validateStep`), плюс плоские формы,
  Section/Box, FormArray, полную валидацию/вычисления/видимость.
- **Первый срез = детерминированное ядро**: `FormIntent → бандл + валидация + cross-check` без LLM.
  sampling (`description → FormIntent`) добавляется вторым слоем.

---

## Целевой выход — бандл

`generate_form` возвращает **манифест** (tool отдаёт контент, файлы пишет клиент):

```
{ files: [{ path, content }], validation: { schemaValid, crossCheck }, warnings: [] }
```

Файлы бандла (директория формы в проекте разработчика):

| Файл | Что несёт | Источник структуры |
|---|---|---|
| `json-schema.json` | layout (`JsonFormSchema`) | эталон `seed-schema.ts` билдера |
| `model.ts` | `interface <FormShape>` + `initialFormModel` | `modelTsTemplate()` |
| `validation.ts` | `defineValidationSchema` (required/email/min/cross/each/async/validateWhen) | `validationTsTemplate()` |
| `behavior.ts` | `defineFormBehavior` (compute/computeFrom/copyFrom/enableWhen/…) | `behaviorTsTemplate()` |
| `registry.ts` | `defineRegistry` — маппинг всех `$component`/`$dataSource`/`$fn`/`$locale` имён | reference `registry.ts` |
| `ui-behavior.ts` | `RenderBehaviorFn` (hideWhen/patchProps/wizard `validateStep`) | `uiTsTemplate()` |

`ui-behavior.ts` эмитится, **только если есть** видимость/wizard-поведение (иначе мёртвый файл).
Эталон TS-DSL (не импортируем — другой проект, но копируем структуру):
`projects/reformer-builder/src/app/form-templates.ts`.

**Почему манифест, а не запись на диск сервером:** stdio-MCP работает в своём процессе со своим CWD и
не знает корень репозитория клиента; `outputDir` из модели может уехать в path-traversal. Возврат
контента отдаёт запись клиенту (Claude Code) через его Write + permission-гейт — это и есть
scaffolding-контракт. Согласуется с остальными tools (никто не пишет на диск) и делает tool чистым и
юнит-тестируемым.

---

## FormIntent — промежуточный контракт

Новый файл `packages/reformer-mcp/src/generators/form-intent.ts` (чистые типы + нормализаторы).
Разделение: **плоский реестр** сущностей (поля/массивы/правила/поведение → драйвит `.ts`-файлы) +
**layout-дерево**, которое ссылается на них по id (→ драйвит `json-schema.json`). Именно это делает
кросс-консистентность проверяемой.

```ts
interface FormIntent {
  formName: string; interfaceName: string;      // PascalCase
  layout: 'minimalist' | 'folders'; target: 'renderer-json';
  layoutRoot: LayoutNode;                        // аранжировка; листья ссылаются на fields/arrays по id
  fields: FieldIntent[]; arrays: ArrayIntent[]; wizard?: WizardIntent;
  validation: ValidationRuleIntent[]; behavior: BehaviorIntent[]; visibility: VisibilityIntent[];
  dataSources: DataSourceIntent[]; fns: FnIntent[]; locale?: LocaleEntry[]; warnings: string[];
}
type LayoutNode =
  | { kind: 'field'; ref: string }
  | { kind: 'array'; ref: string }
  | { kind: 'container'; component: string; htmlTag?: string; title?: string;
      componentProps?: Record<string, unknown>; children: LayoutNode[] }
  | { kind: 'step'; title: string; icon?: string; children: LayoutNode[] };   // wizard
```

`FieldIntent` (name/modelPath/tsType/component/componentProps/label/initialValue/optionsSource/selector),
`ArrayIntent` (name/modelPath/itemInterfaceName/itemFields/`initialValue` **обязателен**/itemLabelRef),
`ValidationRuleIntent` (target/`each?`/`when?`/rules[]), `BehaviorIntent`
(kind/target/sources[]/expr?/options?), `VisibilityIntent` (selector/kind/condition?/event?/props?),
`DataSourceIntent`, `FnIntent`, `WizardIntent` (steps + per-step валидируемые поля).
Плюс `normalizeIntent(partial): FormIntent` (заполняет `selector ??= name`, дедуп dataSources/fns,
`warnings: []`), `deriveInterfaceName(formName)`.

---

## Пайплайн `generate_form`

Вход: `{ description?, specPath?, intent?, layout?, outputDir? }`.

- **Шаг A — получить `FormIntent`** (`generators/infer-intent.ts`):
  1. `args.intent` → `normalizeIntent(...)` (детерминированная дверь для тестов; **это и есть первый срез**).
  2. Иначе — текст из `specPath`/`description`; если `server && isSamplingSupported(server)` →
     `inferFormIntent(...)` по образцу `deepAnalyzeSpec` (`sampling-helpers.ts`): строгий «reply JSON
     only», парсинг + **валидация распарсенной формы**, при сбое → `null` (никогда не throw).
  3. Fallback без sampling → `scaffoldIntentFromSpec(text)` (переиспользует `analyzeSpec` из
     `plan-form.ts`) — валидный минимальный скелет + видимый `warnings`: «sampling недоступен —
     скелет, заполни компоненты/валидацию/поведение».
- **Шаг B — детерминированная сборка** (каждый билдер — чистая `(intent) => string`, без IO):
  `buildLayoutJson` (обход `layoutRoot` → `JsonFormSchema`, каталог-aware node-фабрики; wizard →
  `$component(RendererFormWizard)` + `componentProps.steps[]` из `$component(Step)`),
  `buildModelTs`/`buildValidationTs`/`buildBehaviorTs`/`buildRegistryTs`/`buildUiBehaviorTs`
  (**plain TS template-функции**, как `form-templates.ts` — типизируются, без Handlebars/copy-templates).
- **Шаг C — quality-гейты**: `crossCheckBundle` (ниже) + реальный `validateFormSchema` (lazy-import
  `@reformer/renderer-json/validate` + prop-схемы из `@reformer/ui-kit/meta` — копия паттерна из
  `validate-json-schema.ts`), с известными именами `componentNames`/`dataSourceNames`/`fnNames`/
  `localeKeys` из intent (+ `FIELD_WRAPPER`, `RendererFormWizard`, `Step`).

---

## Cross-consistency гейт (`generators/cross-check.ts`) — главный контроль качества

`crossCheckBundle(intent, layoutJson): CrossCheckReport`. Один обход JSON строит индексные множества,
потом диффит против intent. Ловит классический дрейф мультифайловой генерации детерминированно, без LLM:

- **C1** каждый `$model(path)` из JSON есть в `model.ts` (FormShape) — иначе привязка в никуда.
- **C2** каждый `$component(Name)` из JSON зарегистрирован в `registry.ts`.
- **C3** каждый `$dataSource`/`$fn`/`$locale` из JSON есть в registry/locale.
- **C4** каждый `validation.target` (с префиксом массива при `each`) — реальный model-путь.
- **C5** каждый `behavior.target` и `sources[]` — реальные model-пути.
- **C6** каждый `visibility.selector` присутствует как `node.selector` в JSON (иначе render-behavior
  молча no-op).
- **C7** граф `compute`/`computeFrom`/`copyFrom`/`syncFields` без циклов (переиспользуем `findCycle`).
- **C8** `initialValue` каждого array-узла есть **и** его ключи совпадают с `itemFields` (проверка,
  которую `validateFormSchema` сделать не может).
- **C9** (warnings) поле в model без привязки в JSON; dataSource/fn объявлен, но не используется.

`ok = errors.length === 0`; warnings не блокируют.

---

## Модульная декомпозиция (`packages/reformer-mcp/src/`)

Новые файлы: `tools/generate-form.ts` (tool def + оркестратор `generateFormTool(args, server?)`),
`generators/{form-intent,infer-intent,component-catalog,build-layout-json,build-model-ts,
build-validation-ts,build-behavior-ts,build-registry-ts,build-ui-behavior-ts,cross-check,index}.ts`.

**Извлечения для переиспользования (без изменения поведения существующих tools):**
- `findCycle` из `tools/check-behaviors.ts:117` → новый `utils/graph.ts`, реимпорт назад в
  `check-behaviors.ts` и в `cross-check.ts`.
- `analyzeSpec` из `prompts/plan-form.ts:58` → новый `utils/spec-analyzer.ts`, реимпорт в `plan-form.ts`
  и в `infer-intent.ts` (fallback).
- Загрузчик prop-схем + lazy `validateFormSchema` из `tools/validate-json-schema.ts:32-48,115-130` →
  общий util, используется в `generate_form` шаг C.
- Каталог: `@reformer/ui-kit/catalog` (JSON, optional peer) через
  `createRequire(import.meta.url)('@reformer/ui-kit/catalog')` в try/catch → `null` при отсутствии.
  `REGISTRY_IMPORT_MAP` — курируемая таблица имя→импорт (`Input→InputField`, `Select→SelectField`,
  `Box→Box`, `Section→Section`, `FIELD_WRAPPER→FormField`, `RendererFormWizard→…`, `Step→…`, ~12 шт.);
  неизвестный компонент → строка `reg.component('X', /* TODO import */)` + warning.

---

## Интеграция в `index.ts` (минимальная)

Диспетчер `CallToolRequestSchema` (`index.ts:129`) — замыкание над **module-level `server`**
(`index.ts:89`), тем же, что получают промпты. Поэтому проброс — однострочник:

1. импорт `generateFormToolDefinition, generateFormTool` (`index.ts:36-51`);
2. добавить `generateFormToolDefinition` в массив `ListTools` и в union-тип (`index.ts:107-122`);
3. `case 'generate_form': return await generateFormTool(args as GenerateFormArgs, server);` в switch;
4. реэкспорт из `tools/index.ts`.

Сигнатуру `async (request) => {…}` и другие tools не трогаем.

---

## Дефолты для мелких развилок

- **Именование файлов**: следуем бандлу билдера (`json-schema.json` / `model.ts` / `validation.ts` /
  `behavior.ts` / `registry.ts` / `ui-behavior.ts`).
- **Нет каталога `@reformer/ui-kit`**: деградация до `Input`-компонентов + warning (как
  `validate-json-schema` с опциональной meta), не hard-fail.
- **Галлюцинации данных**: если `spec`/`description` содержит канонические строки — метки берём из
  спеки; иначе значения/метки dataSource помечаем `TODO`.
- **`target`**: v1 фиксирован на `renderer-json` (бандл с `registry.ts` — renderer-json-специфичен).

---

## Порядок работ

1. **Ядро (детерминированное, первый поставляемый срез):** `form-intent.ts` + `utils/graph.ts` +
   `utils/spec-analyzer.ts` (извлечения) + все `build-*.ts` + `cross-check.ts` + `component-catalog.ts`.
   Вход — явный `intent`. Гейты C + `validateFormSchema`. Регистрация tool в `index.ts`.
2. **Wizard в ядре:** `WizardIntent`, `step`-узлы в `buildLayoutJson`, Wizard-шим в `registry.ts`,
   `validateStep` в `ui-behavior.ts`; `RendererFormWizard`/`Step` в известных именах cross-check.
3. **Слой sampling:** `infer-intent.ts` (`inferFormIntent` по образцу `deepAnalyzeSpec` +
   `scaffoldIntentFromSpec` fallback); проброс `server` уже готов.

---

## Verification — как проверить

**Тесты (vitest, как `tests/find-recipe.test.ts`):**
- `tests/generate-form.build.test.ts` — из hand-authored `FormIntent` (2–3 поля, Select+dataSource,
  одно validation-правило, один `computeFrom`): манифест содержит ожидаемые пути; `model.ts` содержит
  `interface <interfaceName>` и поля; JSON содержит нужные `$model`/`$component`/`$dataSource`.
- `tests/cross-check.test.ts` — намеренно несогласованный intent+json: `$model(foo)` без поля (C1),
  `visibility.selector` вне JSON (C6), цикл `a→b→a` (C7), мёртвый dataSource (C9-warning) — проверяем
  точные коды.
- `tests/generate-form.validate.test.ts` — layout из валидного intent прогоняем через **реальный**
  `validateFormSchema` → `valid: true`; graceful-skip, если `renderer-json` не собран.
- `tests/infer-intent.test.ts` — мок `server.createMessage`: хороший ответ парсится/валидируется;
  битый → `null` и fallback на `scaffoldIntentFromSpec` с warning.
- `tests/generate-form.wizard.test.ts` — intent с `wizard`: JSON содержит `$component(RendererFormWizard)`
  + `componentProps.steps[]`; registry содержит Wizard-шим; `ui-behavior.ts` содержит `validateStep`.

Мокаем только `server.createMessage`; всё остальное (билдеры, cross-check, `findCycle`,
`validateFormSchema`) гоняем реально. Сеть и диск не трогаем.

**E2E-проверка руками:** сгенерировать бандл для формы заявки на кредит (эталон
`seed-schema.ts`), положить файлы в `projects/react-playground/src/pages/examples/…`, смонтировать
через `JsonRendererProvider` + `JsonFormRenderer` + `convertJsonToM1Tree`, убедиться что форма рендерится,
валидация/вычисления/видимость работают.

**Регрессия существующего:** `check_behaviors` и `plan-form` после извлечения `findCycle`/`analyzeSpec`
дают тот же результат (снапшоты `scripts/snapshot-prompts.mjs` не меняются).

---

## Ключевые файлы

- Создать: `packages/reformer-mcp/src/tools/generate-form.ts`,
  `packages/reformer-mcp/src/generators/*.ts`, `packages/reformer-mcp/src/utils/{graph,spec-analyzer}.ts`,
  тесты `packages/reformer-mcp/tests/*.test.ts`.
- Изменить: `packages/reformer-mcp/src/index.ts` (регистрация + `server` в tool),
  `packages/reformer-mcp/src/tools/index.ts` (реэкспорт),
  `packages/reformer-mcp/src/tools/check-behaviors.ts` и `src/prompts/plan-form.ts` (реимпорт извлечённого).
- Эталоны (только чтение): `projects/reformer-builder/src/app/form-templates.ts`,
  `projects/reformer-builder/src/app/seed-schema.ts`,
  `packages/reformer-renderer-json/src/types/json-schema.ts`, `.../src/validate.ts`.
