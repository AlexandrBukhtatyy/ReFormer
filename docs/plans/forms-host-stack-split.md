# Ассистент, генерация кода и шаблоны: общая часть — в `forms/`, ReFormer — вкладом стека

## Context

Пользователь заметил, что плагины `ai`, `codegen` и `templates` по смыслу не принадлежат ReFormer:
ассистент, экспорт кода и шаблоны нужны любому стеку форм. Сейчас все три лежат в домене стека
`.ui_builder/plugins/reformer/` и плотно завязаны на его ядро (`ai` импортирует `core/form-model`
75 раз, `codegen` печатает модуль ReFormer, `templates` — шаблоны ReFormer). Простой перенос папок
отвергнут: плагины в общем домене импортировали бы `reformer/core` в обход границ доменов, а
второй стек (RJSF) не получил бы ничего.

Решение (утверждено пользователем) — по образцу превью (`forms/preview` + `PreviewSurfacePoint` в
SDK + поверхности из `reformer/render` и `rjsf/render`): **общий плагин-хозяин в `forms/`,
контракт точки — в `@reformer/builder-plugin-api`, ReFormer вносит свою часть плагином в
`reformer/`**. По одному плагину, начиная с `ai`; каждый этап самостоятелен и оставляет всё
зелёным.

Пути ниже — от `projects/reformer-builder-playground/.ui_builder/plugins/`; SDK —
`packages/reformer-builder-plugin-api/src`, toolkit — `packages/reformer-builder-toolkit/src`.

## Решения

- **Идентификаторы хозяев не меняются**: `reformer.ai`, `reformer.codegen`, `reformer.templates`
  уезжают в `forms/{ai,codegen,templates}` (как `reformer.kits`/`reformer.preview` в 90886a33).
  Сохраняются настройки и ключ API (`plugin:reformer.ai:*`), команды `ai.*`, словари, права.
  Пакеты хозяев: `@reformer/builder-forms-{ai,codegen,templates}`.
- **Стековые части остаются в прежних каталогах** `reformer/{ai,codegen,templates}` с новыми
  id `reformer.ai-schema`, `reformer.codegen-schema`, `reformer.templates-schema` (образец
  `editor-schema`, `validator-schema`). Так не ломаются 34 `disk.seed({plugins:['reformer/ai']})`
  в e2e, пути чанков корпуса знаний в `.size-limit.json` и импорты `reformer/integration`.
- **Модели в контрактах — `unknown`**, стек сужает их сам (как `PreviewSurface`). Параметры типов
  через хозяина не протягиваются.
- **Выбор стека — по `DocumentRef.providerId`**, как у поверхностей превью; точка читается на
  каждый ход (порядок активации плагинов не важен).
- Чистые помощники, нужные обеим сторонам, — в `@reformer/builder-toolkit` («stack-neutral
  building blocks»). Контракт только внутри ReFormer (`reformer.codegen.printer`) — в
  `reformer/core/contracts/printer.ts`, не в SDK.
- `BUILDER_API_VERSION` — минорный шаг на каждом этапе, добавляющем имена в SDK (1.0.0 → 1.1.0 → …);
  манифесты объявляют `^1`, ничего не ломается.

## Этап 0 — подготовка (3 коммита)

1. **Граница доменов в ESLint** (`eslint.config.js`, `DOMAIN_PLUGIN_BOUNDARY`): добавить шаблон
   `^(?:\.\./)+[^./][^/]*/(?:core|integration|[^./][^/]*/src)(?:/|$)` — ловит `../../../reformer/core/…`,
   не трогает свой `../../core/…`. Сегодня междоменных импортов нет — коммит только правила.
2. **Контракты возможностей в SDK**: `services/form-authoring.ts` — `ModuleGeneratorCapability`
   (`reformer.codegen.generator` 1.0.0) и `FormCreatorCapability` (`reformer.templates.creator`
   1.0.0) с типами запроса/отчёта; реэкспорт из `index.ts`. Локальные копии `ai/src/generator.ts`,
   `ai/src/templates.ts` удаляются, `codegen/workspace.ts` и `templates/workspace.ts` берут типы
   из SDK (урок Э6). `BUILDER_API_VERSION` → 1.1.0.
3. **Помощники в toolkit** (`toolkit/src/assistant/`): `tools/registry.ts` (ajv — ленивый
   `import()`, необязательная peer-зависимость), `tools/tool-surface.ts`, `files/page.ts`,
   `loop/render-budget.ts`, `loop/suggest.ts` — с тестами. `ai` импортирует их из toolkit.

## Этап 1 — ассистент

### 1.1 Контракт SDK: `assistant/form-stack.ts`

Переезжают из `ai/src/model/types.ts` с приставкой `Form*`: `ToolErrorCode`, `ToolError`,
`ChangeOp`, `TurnScope`, `Ask*`, `TemplateInfo`, `CreateForm*`, `TurnWriteResult`,
`ResourceReadResult`. Новое:

- `FormAgentTool<P, C extends FormToolContext>` (`name`, `description`, `inputSchema`,
  `readOnly`, `interactive?`, `textBudget?`, `run`), `FormToolOutcome {ok, text, ops?, error?}`,
  `FormToolContext { turn? }`; `FormToolSlot = FormAgentTool | 'ask_user' | 'generate_code' |
  'create_form'` — стек ставит инструменты хозяина в СВОЙ упорядоченный список (порядок как сейчас).
- `FormTurn { context(); accept(outcome); system(); seed() }` — одна попытка хода.
- `FormStructuredMode { tools; load(doc) → FormLoaded | null; begin(loaded) → FormTurn &
  {result()}; hasChanges(set); land({resource, loaded, set, txId}, {force}) →
  applied{written[], broken?} | conflict | invalid{errors} | failed; rewind(resource, loaded, {files}) }`.
- `FormFilesMode { tools; scopeOf(document); baseline(scope); begin(scope, base, io); normalize(scope, io) }`.
- `FormStackSession { prepare(); recognizes(text); creationPrompt(); refuseWrite(id, form, scope);
  door?(id); structured; files? }`; `FormAssistantStack { id; applies(doc: DocumentRef);
  connect(host: FormStackHost) }`; `FormAssistantStackPoint = defineExtensionPoint('assistant.form-stack')`.
- `FormStackHost` — двери нынешнего `AiHost` без UI, каталога и `scopeOf`: `documentOf`,
  `writeText(id, text, mark?)`, `files?` (read, write, list, exists, resolve, parentOf, pathOf).
- Внутри стека `model/types.ts` расширяет контракт (`ToolOutcome = FormToolOutcome & {schema?,
  rules?}`, `ToolContext extends FormToolContext {draft, base, rules, catalog, validateForm}`) —
  файлы инструментов не меняются.

### 1.2 Без стека

- Документ не взят ни одним стеком или `load` вернул `null` — как сегодня: ход создания формы
  (если есть создатель), иначе `turn.noForm`. Промпт создания — у первого стека.
- Стеков нет вовсе — новый ключ `turn.noStack` (ru/en): «Нет плагина, который правит формы —
  включите стек форм». Панель и настройки канала работают.
- Отложенные правки, чей стек исчез, — существующий путь `turn.notApplied.closed`.
- Изменение поведения: документы чужого провайдера (rjsf) инструменты ReFormer больше не пробуют
  разобрать — запись в журнал решений.

### 1.3 Порядок: сначала шов, потом перенос

**1a — шов внутри одного плагина** (по коммиту на шаг, все 103 случая `bridge.test.ts` зелёные —
меняется только фабрика):
1. `src/stack/` с `createSchemaFormStack(ctx)`; `resolveTarget`, `land`, `restore` идут через
   `structured`.
2. Общий `loop/run-turn.ts` из `runAgentTurn` (`queuedTools` + `streamTurn` + затравка: активная
   форма → `stack.seed()` → ресурсы). `withOutlineSeed`, `renderRulesSeed`, `fileSeed`, промпты —
   в `stack/seed.ts`.
3. Режим файлов через `files`.
4. Составная дверь, каталог (`projectCatalog(KitsCapability)`), знания (`projectFiles`) — в стек;
   `AiHost.catalog` снимается.
5. Промпт создания.
6. Временный `host-purity.test.ts`: модули хозяина не импортируют `core/`, `@reformer/renderer-json`,
   `@reformer/mcp`, `stack/`, `model/*`, `files/{scope,tree,compose,gate,turn}`, `knowledge/`.

**1b — физический раскол** (один коммит, в основном `git mv`): хозяин → `forms/ai`, стек остаётся
в `reformer/ai` с id `reformer.ai-schema`; обвязка и ссылки по чек-листу.

**1c — документы.**

### 1.4 Куда что

- **`forms/ai`** (хозяин, все 99 ключей словаря): `contract`, `main`, `index`, `messages`+`locales`,
  `styles.css`, `plugin.ts` (каналы, сеанс, мост, панель, команды; `requires.optional` — генератор и
  создатель, без `kit.catalog`), `host.ts`, `workspace.ts` (двери спрашивают `stack.door` первой),
  `testing.ts` (фейковый хозяин и «текстовый» стек), `providers/*`, `ui/*` (`useActiveForm` →
  `session.recognizes`), `session/{bridge, session, history, config, resources, contributions,
  turn-writes, stacks (новый), module-path}`, `session/apply.ts` — только `isStale` и предпроверки,
  `loop/{drive, run-turn}`, `tools/{ask-user, generate-code, create-form, read-resource,
  command-tools, contributed-tools}`, `files/journal.ts`; бюджеты хозяина (`TOOL_TEXT_BUDGET`,
  `CONTRIBUTED_TOOL_SURFACE_BUDGET`, `RESOURCE_*`, `ATTACHMENT_BUDGET`).
  `TurnSnapshot.rules` → `loaded: FormLoaded`; `PendingChanges` → `{set, loaded, stackId}`.
- **`reformer/ai`** (стек `reformer.ai-schema`, без словаря): `plugin.ts` (вклад в точку,
  предзагрузка валидатора), `stack/{session, structured, files-mode, door, catalog, seed}`,
  `model/*` (бюджеты `TOOL_SURFACE_BUDGET`, `FILE_TOOL_SURFACE_BUDGET`, `PROMPT_BUDGET`,
  `FILE_*_BUDGET`), `loop/{prompt, file-prompt, gate, introduced}`, `session/rules-file.ts`,
  `session/land.ts` (из `apply.ts`: проверка файла правил, `validateSchema`, `printSchemaText`,
  запись сайдкара тем же `txId`), все инструменты формы (`tools/index.ts` — упорядоченные списки
  `FormToolSlot`), `tools/files/*`, `files/{scope, tree, compose, gate, turn}`, `knowledge/*`.

### 1.5 Разрез `session/bridge.ts`

Остаётся у хозяина без изменений логики: попытки и вторая попытка, `consume`/`report`/заметки,
вопросы, создание формы и `generateOrdered`, записи хода, отмена и «Восстановить»,
`applyPending`/`rejectPending`, вложения. Уходит за адаптер:

| Сейчас | После |
|---|---|
| `parseSchemaText` + `readRulesFile` + `rulesByResource` | `structured.load` (память — в сеансе стека) |
| `formPartRefusal` | `refuseWrite` |
| `applyChangeSet` | предпроверки хозяина + `structured.land`; `broken` — ключ `turn.rules.broken` |
| `restoreRulesFile` / `LandedTurn.rules` | `rewind` |
| `composeForm` | `files.baseline` |
| `createFileTurn` + `runFileTurn` | `files.begin` + `run-turn` |
| `normalizeSchemas` | `files.normalize` |
| `emptySchema` / `systemPrompt` создания | `creationPrompt()` |
| `deps.validateForm` | `prepare()` |

### 1.6 Тесты и храповики

- `forms/ai`: без правок или с тривиальными — `providers/*`, `session/{config, contributions,
  resources}`, `tools/{command-tools, contributed-tools, read-resource}`; фикстуры становятся
  непрозрачными — `session/{history, session, turn-writes}`, `ask-user`, `create-form`,
  `plugin.test`; новый `session/bridge.test.ts` (~25 случаев) на фейковом стеке: нет стека,
  документ не взят, вторая попытка, вопросы, отмена/восстановление с сопутствующими файлами,
  записи плагинов, создание, стек исчез при отложенных правках.
- `reformer/ai`: `model/*`, `prompt`, `file-prompt`, `introduced`, `write-tools`, `tools`,
  `set-*-rules`, `reformer-docs`, `file-tools`, `files.test`, `apply.test` → `land.test`,
  `knowledge`, `workspace.test` → тесты двери/каталога; `tool-surface.test` — лимиты инструментов и
  `PROMPT_BUDGET`.
- `reformer/integration` (видит оба плагина): нынешний `bridge.test.ts` → `assistant-bridge.test.ts`
  (все 103 случая, помощник `composeBridge(hostDeps, createSchemaFormStack)`); `loop.test` +
  `file-loop.test` → `assistant-turn.test.ts`; `assistant-surface.test.ts` —
  `TOOL_SURFACE_BUDGET` 12838 и `FILE_TOOL_SURFACE_BUDGET` 4342 через `toBe` по спискам,
  разрешённым хозяином; живые замеры (`form-scenarios-eval`, `render-rules-eval`,
  `assistant-ab-eval`) — сюда же.
- `forms/integration`: «хозяин ассистента без стека отвечает `turn.noStack`».

## Этап 2 — генерация кода (эскиз, уточняется после этапа 1)

- В toolkit: движок целей из `pipeline/generate.ts` (жетоны пути, `each:'step'`, защиты) и ядро
  доставки с маркерами из `deliver.ts`.
- SDK `services/codegen.ts`: `CodegenTargetPoint` (`'codegen.target'`, `CodegenTarget<Ctx = unknown>`
  + `stack?`), `CodegenStackPoint` (`'codegen.stack'`): `{id, applies(doc), source(doc, io) →
  {view, steps, formName} | {error}, placement(path), targets, snippet?, check?, migrate?, fixture?}`.
- `forms/codegen` (`reformer.codegen`, право `workspace.save`, отдаёт `reformer.codegen.generator`):
  состояние, панель «Экспорт формы», eject, `generate-for`, пользовательские цели, оболочка
  доставки, команды.
- `reformer/codegen` (`reformer.codegen-schema`, отдаёт `reformer.codegen.printer`): `targets`,
  `source`, `rules`, сниппет и раскладка из `run.ts`, команда фикстуры, меню `.schema.json`,
  19 подписей `target.*` (свой словарь).
- Необязательно 2b: RJSF вносит цель `Form.tsx` — второй потребитель доказывает нейтральность.

## Этап 3 — шаблоны (эскиз)

- SDK: `TemplateStorePoint` (`'templates.store'`, приоритеты 10/20/30), типы `FormTemplate`,
  `TemplateStackPoint`: `{id, owns(files), empty(formName), folderFor(formName, near?),
  tokens(formName), view(files), upgrade?(files), formDocumentOf(files)}`.
- `forms/templates` (`reformer.templates`, `workspace.save`, отдаёт `reformer.templates.creator`):
  хранилища проекта и локальное, оболочки `files`/`operations`/`create-for`/`render`, UI, команды.
- `reformer/templates` (`reformer.templates-schema`): `stores/builtin.ts`, `seeds.ts`, хуки стека;
  `requires.optional` printer ^1 и kit ^2.

## Чек-лист ссылок (каждый этап)

- `projects/reformer-builder/application-plugins.json` и `.embedded.json` — путь `forms/<x>`.
- `forms/integration`, `reformer/integration`: `application.ts` (хозяин — в `FORMS_PLUGINS`, стек —
  в `REFORMER_PLUGINS`), `DICTIONARIES`, пороги `structure.test` (`minPlugins`/`minModules`, снять
  устаревшие исключения), `capability-requires.test`, `plugin-styles.test`,
  `assistant-contributions.test`, списки статусов `forms-platform.test`/`rjsf-profile.test`.
- Плейграунд `.ui_builder/settings.json`: новые id стеков в `workspace.plugins.enabled` (под
  собранным билдером плагины приложения включены всегда; список нужен под `vite dev`).
- e2e `tests/shared/playground-disk.ts`: `OPTIONAL_COMPANIONS = {'reformer/ai': ['forms/ai']}`,
  `forms/ai` — необязательный; 34 вызова `seed` не меняются; `plugins.spec.ts`, `SCENARIOS.md`.
- `.size-limit.json` (+ `forms/ai/main.js`, перемерить `reformer/ai/main.js`), `package-lock.json`
  (`npm install`; корневой glob `plugins/*/*` уже покрывает `forms/`).
- Документы: `projects/reformer-builder/docs/{composition, project-structure, plugin-and-shell,
  core-contracts, decisions-log}.md`, README SDK, toolkit и плейграунда. Имена классов Tailwind в
  документах билдера словами не писать.

## Порядок работы

- Перед началом: этот план — в отдельный `docs/plans/<имя>.md`, прежний план ассистента вернуть
  (`git checkout -- docs/plans/rustling-wibbling-kahn.md`); `git status docs/specs/` пуст.
- beads: эпик «Ассистент, кодоген, шаблоны: общая часть в forms, ReFormer — вкладом стека» и задачи
  0, 1a, 1b, 1c, 2, 3; синхронизация `issues.jsonl` по CLAUDE.md.
- Коммиты — по шагам, сообщение через файл + `npx --no commitlint`, `git commit -F … -- пути`;
  push — только по просьбе.
- Этапы 2 и 3 начинаются после зелёного этапа 1; их эскизы уточняются по опыту этапа 1.

## Риски

- **Регрессии в `bridge.ts`** — шов до переноса, 103 случая без изменений на каждом коммите, тест
  чистоты, e2e ассистента (66) после 1a и после 1b.
- **Дрейф порядка инструментов и храповиков** — списки слотов воспроизводят текущий порядок;
  `toBe` в интеграционном тесте ловит любой байт.
- **Потеря настроек и ключа API** — id хозяина прежний; проверка, что ключ хранится под
  `plugin:reformer.ai:secrets`.
- **Проект без нового id стека в `enabled`** — слой приложения включает сам; в слое проекта панель
  честно отвечает `turn.noStack`.
- **Дублирование кода в бандлах** — реестр и ajv грузит только хозяин; проверка `size-limit`.

## Проверка

- После каждого шага: в затронутых плагинах `npm run test`, `npm run typecheck`, `npm run validate`;
  `npx vitest run` в `forms/integration` и `reformer/integration`; SDK и toolkit — `npm run test`
  и `tsc` из каталога пакета.
- Линт из корня: `npx eslint` по затронутым каталогам (включая новое правило границы доменов).
- e2e из `projects/reformer-builder-playground-e2e`: `npx playwright test tests/assistant` после
  1a и 1b; полный прогон в конце этапа; `npx size-limit`.
- Вручную в билдере: ассистент в обоих режимах на форме ReFormer, ключ API и настройки канала
  сохранились; форма RJSF — ассистент честно говорит, что стека нет.
