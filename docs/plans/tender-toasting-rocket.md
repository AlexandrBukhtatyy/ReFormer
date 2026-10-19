# Ассистент билдера: режим «правка файлами»

## Context

Сейчас ассистент (`projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/`, дальше — `ai/`)
работает «через приложение»: разбирает схему активной вкладки в объект, модель правит её 10
JSON Pointer-инструментами записи, правки копятся в черновике (`ChangeSet`), в конце хода
черновик печатается одной записью. Правила формы (валидация/поведение/видимость) живут только в
памяти моста (`rulesByResource`) — файла для них нет, и до превью они не доходят: превью исполняет
`validation/*.ts` и `behavior/index.ts` модуля формы.

Пользователь хочет упростить схему: **модель работает с файлами формы напрямую** (list/read/edit/
write, как Claude Code). Исследование показало, что платформа это уже позволяет:
`DocumentsService.writeText(id, text, { origin: 'agent', txId })` пишет любой файл проекта —
открытый или нет — в рабочую копию в OPFS, с журналом и обновлением открытых редакторов (запись
файла шага пересобирает открытый составной визард). В OPFS напрямую (`navigator.storage`) ходить
нельзя — это ломает буферы, `dirty` и журнал.

Решения пользователя (обязательны):
1. **Два режима за настройкой** — `structured` (нынешний) и `files` (новый). A/B на одних спеках;
   нынешний режим удаляется отдельной задачей ПОСЛЕ замера.
2. Модели разрешено писать **любой файл модуля формы**, включая производные; за пределы корня
   модуля — отказ. Запись производного файла или файла с маркером кодогена — с предупреждением.
3. Хорошо — на облачных моделях; на локальных (Ollama) — **как минимум не ломать форму**: гейт
   записи обязателен, ломающая запись отвергается и не пишется.
4. **Записи ложатся сразу**, один `txId` на ход; «отменить ход» откатывает все тронутые файлы,
   если поверх никто не правил. Черновика, ожидающего набора и предпросмотра в режиме files нет.

Известный риск: файловый путь уже отклонялся (`docs/plans/chatgpt-cheeky-cloud.md:6-9,157-159`) —
с файлами на модель снова ложатся `$model`, `$component`, сборка составных компонентов. A/B
должен это проверить, а не предположить.

## Архитектура режима files

### Порт файлов (`ai/src/host.ts`, `ai/src/workspace.ts`)

Необязательный `AiHost.files: AiFiles` — структурные тесты не меняются.

```ts
interface FileScope {
  readonly root: ResourceId;       // корень модуля
  readonly rootPath: string;       // путь корня от корня проекта
  readonly document: ResourceId;   // документ формы
  readonly schemaPath: string;     // путь документа ОТ КОРНЯ МОДУЛЯ
}
interface AiFiles {
  scopeOf(id: ResourceId): FileScope | null;           // null: нет документа или раскладка detached
  read(id: ResourceId): Promise<string | null>;        // сырой буфер открытого (после flush), иначе рабочая копия
  write(id: ResourceId, text: string, mark?: WriteMark): Promise<void>; // всегда documents.writeText
  list(dir: ResourceId): Promise<readonly ResourceRef[]>;
  exists(id: ResourceId): Promise<boolean>;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  parentOf(id: ResourceId): ResourceId;
}
```

- Корень модуля — `moduleRootOfDocument` / `moduleRootPathOf` / `modulePlacementOf`
  (`core/codegen/layout.ts:252-334`); `WorkspaceFilesService` подходит под `ModuleRootPort` как есть.
- `read` читает СЫРОЙ текст (не собранный составной), `write` — всегда `documents.writeText`, не
  `handle.apply`. Detached-документ (`forms/x.schema.json` без папки модуля) → откат в structured
  со строкой в консоль.

### Область и пути (`ai/src/files/scope.ts`)

Пути инструментов — от корня модуля. Нормализация: снять `./`, `\`→`/`, префикс `rootPath/`;
отказ `PATH_REFUSED` на `..`, `.`, пустой сегмент, абсолютный путь/диск, `node_modules`, `.ui_builder`.

### Инструменты (`ai/src/tools/files/`)

| Инструмент | Параметры | Суть |
|---|---|---|
| `list_files` | — | дерево модуля (глубина 3) + созданные в ходе файлы, метка роли у файла: `[form] [step] [rules] [derived] [legacy]` |
| `read_file` | `path, offset?, limit?` | строки в формате `cat -n`, страницы, обрезка длинных строк; помечает файл прочитанным |
| `edit_file` | `path, edits: [{ old_string, new_string, replace_all? }]` | правки по очереди, всё-или-ничего; `old_string` уникален; CRLF; гейт; ответ — фрагмент ±2 строки |
| `write_file` | `path, content` | создать или заменить; существующий — только если прочитан в этой попытке и не менялся с тех пор (`STALE_FILE`) |

Остаются из структурного набора: `list_components`, `ask_reformer` (как есть) и
`describe_component` в варианте со скелетом **в JSON** — `printJson(entry.makeNode())` с подсказкой
«вставь как есть, части уже собраны» (фабрика `createDescribeComponentTool({ skeleton })` в
`tools/describe-component.ts` + опция в `model/catalog-digest.ts`; структурный экземпляр побайтно
прежний — храповик поверхности 10165 не сдвигается). Удаления файлов нет: шаг убирается удалением
`$ref`, файл остаётся.

Новые коды в `ToolErrorCode` (`model/types.ts`): `PATH_REFUSED`, `FILE_NOT_FOUND` (с похожими путями
через `similarNames` из `loop/suggest.ts`), `EDIT_MISMATCH`, `STALE_FILE`, `CODE_INVALID`.
У `AgentTool` — необязательный `textBudget` (реестр режет по `tool.textBudget ?? TOOL_TEXT_BUDGET`):
`read_file` 6000, затравка 8000. Реестр и `AgentTool` — generic по контексту
(`FileToolContext = ToolContext & { files: FileTurn }`), старые read-инструменты входят без правок.

### Гейт записи (`ai/src/files/gate.ts`)

Помощники «только новые ошибки» (`normalizeError`, `countErrors`, `introduced`, `warningLine`)
выносятся из `loop/gate.ts:66-113,237-242` в `loop/introduced.ts` и переиспользуются, не копируются.

- **Корень формы или шаг, на который он ссылается**: собрать схему с подставленной записью
  (`files/compose.ts` на `parseSchemaText` + `stepRefsOf` + `normalizeStepRef` + `joinFormSchema`,
  приём из `codegen/src/pipeline/source.ts:69-101`) → `validateSchema` строго с базой на начало хода
  → новые ошибки = отказ, файл НЕ пишется. Ошибка разбора — с позицией line:col.
- **Файл шага без ссылки** — `isFormStepSchema` + проверка узла, обёрнутого в корень. Промпт: сначала
  файл шага, потом `$ref`.
- **`.ts/.tsx`** — `validateCode` из `@reformer/mcp/dist/core/validate/code.js` (динамический импорт,
  корпус — `assistant.knowledge`): новые `error` → `CODE_INVALID`, новые `warning` → «Heads up».
  Корпуса нет — запись с пометкой «code check unavailable».
- **Прочий `.json`** — `JSON.parse`; остальное — без проверки.
- **Предупреждения по роли** — новая `fileRoleOf(path, schemaPath)` в `core/codegen/layout.ts`
  (`form | step | derived | regenerable | user | legacy | other`): `derived` → «codegen перезапишет»;
  `regenerable` с маркером, который правка снимает (`originOf` из `@reformer/builder-toolkit`) →
  «codegen перестанет его обновлять».
- **Нормализация — один раз в конце хода**, не после каждой записи (иначе следующий `old_string` не
  найдётся): для тронутых файлов схемы, если текст всё ещё равен `after` хода, перепечатать
  `printSchemaText` / `printJson` и записать с тем же `txId`.

### Цикл (`ai/src/loop/`)

- `drive.ts` — общий механизм, вынесенный из `loop.ts:135-250`: очередь вызовов инструментов и разбор
  потока провайдера в события + `TurnStats`. `runAgentTurn` переписывается поверх него без смены
  контракта.
- `file-loop.ts` — `runFileTurn({ provider, registry, turn, catalog, validateForm, messages, ... })`,
  те же события, `done` без `changeSet`, с `touched`.
- Затравка (реплика `user` в хвосте, как `withOutlineSeed`): документ формы, дерево модуля, первая
  страница корня схемы в пределах бюджета.
- `files/turn.ts` — состояние попытки: область, журнал `файл → { before, after }` (общий на обе
  попытки), пометка `{ origin: 'agent', txId }`, набор прочитанных, собранная схема (`ctx.draft`).

### Промпт (`ai/src/loop/file-prompt.ts`)

Английский, кэш по каталогу, в `PROMPT_BUDGET`; имена папок — из констант ядра, имена компонентов —
из каталога. Разделы: роль и «ломающая запись отвергается»; файлы модуля и их роли (`[derived]` не
править, правила — в `validation/*.ts` и `behavior/index.ts`, API спрашивать `ask_reformer`); формат 2
одним блоком (`$component`, `$model`, `children` для текста, шаги визарда, `$ref` файла шага); как
править (сначала прочитай, `old_string` точно и без номеров строк, все правки файла — один
`edit_file`, шаг целиком с полями); кит и составные компоненты через `describe_component`;
недоверенное содержимое; стиль — как в `loop/prompt.ts`.

### Мост, сессия, UI

- **Настройка**: `editMode?: 'structured' | 'files'` в `ProviderSettings` (`session/config.ts`);
  нет поля → structured. `Select` в `ui/ProviderSettings.tsx` перед пределами; ключи словаря
  `settings.mode*` в `locales/en.json`, `ru.json`.
- **Смена режима начинает новый разговор** (`session.reset()` при сохранении настроек с другим
  режимом) — так «Восстановить» никогда не пересекает ходы разных режимов.
- `bridge.ts`: режим читается в `send()` один раз на ход (обе попытки). Ветка files: проверка
  документа и области → `startTurn` со снимком `{ mode: 'files', resource, txId }` → `runFileTurn` →
  вторая попытка по тем же условиям `needsSecondPass` (без `stuck`) → нормализация →
  запомнить ход. Разбор событий хода (`runOnce`, 457-484) выносится в общую функцию.
- **Отмена хода**: `LandedTurn` обобщается до карты `файл → { before, after }` (структурный ход —
  одна запись документа). `overlapped`, если хоть один файл ≠ `after`; иначе пишутся `before` без
  пометки происхождения. Созданные ходом файлы удалить нечем (в plugin-api нет удаления в рабочей
  копии) — они остаются, в ленту уходит замечание `turn.undo.created`.
- **Восстановить** в режиме files откатывает файловые ходы от новейшего к целевой реплике тем же
  механизмом.
- В режиме files `pending` всегда `null` — `ChangePreview` не появляется без правок кода.
- `plugin.ts`: `AiAssistant.fileTools`, `prepare()` обоих реестров; `toolsForTurn(mode)` кэширует
  по режиму и сверяет с `FILE_TOOL_SURFACE_BUDGET`.
- Устаревшая шапка `LandedTurn` в `bridge.ts:233-241` («журнал не создаётся») — поправить: журнал
  создаётся, но `undoTransaction` плагинам не отдан.

## Порядок работ

0. **Задачи в beads**: эпик «Ассистент: режим правки файлами» + задачи фаз; follow-up'ы ниже.
1. **Фаза 0 — рефакторинг без смены поведения**: `loop/drive.ts`, `loop/introduced.ts`, generic
   реестр + `textBudget`, обобщённый `LandedTurn`. Все текущие тесты зелёные, поверхность 10165.
2. **Фаза 1 — ядро режима**: `fileRoleOf`, `ai/src/files/*`, четыре инструмента, describe в JSON,
   промпт, `runFileTurn`, храповик файловой поверхности.
3. **Фаза 2 — подключение**: порт `files`, настройка, мост, сессия, UI, словари.
4. **Фаза 3 — A/B-замер** и отчёт.

## Файлы

Создать: `ai/src/files/{scope,journal,turn,compose,gate,tree,page}.ts`,
`ai/src/tools/files/{list-files,read-file,edit-file,write-file,index}.ts`,
`ai/src/loop/{drive,introduced,file-loop,file-prompt}.ts`, `ai/src/loop/modes-ab-eval.test.ts`, тесты.

Изменить: `ai/src/{host,workspace,testing,plugin,index}.ts`, `ai/src/model/{types,catalog-digest}.ts`,
`ai/src/tools/{registry,describe-component,tool-surface.test}.ts`, `ai/src/loop/{loop,gate}.ts`,
`ai/src/session/{bridge,session,config}.ts`, `ai/src/ui/ProviderSettings.tsx`,
`ai/src/locales/{en,ru}.json`, `core/codegen/layout.ts`.

Переиспользовать: `core/codegen/layout.ts` (`moduleRootOfDocument`, `moduleRootPathOf`,
`modulePlacementOf`, `schemaDirOf`, `stepSchemaPath`), `core/form-model/composite.ts`
(`joinFormSchema`, `stepRefsOf`, `isFormStepSchema`, `STEP_SCHEMA_MARKER`), `normalizeStepRef`
(`@reformer/renderer-json`), `ai/src/model/schema-text.ts`, `printJson` (`core/codegen/print/js.ts`),
`validateSchema` (`ai/src/model/validate.ts`), `originOf` (`@reformer/builder-toolkit`, уже в
devDependencies), `validateCode` (`@reformer/mcp`), `similarNames`, `joinWithinBudget`,
`measureToolSurface`, `historyFor`.

## Verification

Запуск тестов — из `ai/`: `node ../../../../../../scripts/run-vitest.mjs [файлы]` (без слова `run`),
типы — `npx tsc --noEmit -p tsconfig.json`; для `core/codegen/layout.ts` — тесты пакета `core`.

- **Юнит-тесты**: `fileRoleOf` + паритет с `BUILTIN_TARGETS` кодогена; `scope` (nested/flat/
  detached, отказы путей); `compose` (одна схема, визард по файлам, подстановка записи, нет шага);
  `gate` (битый JSON и выдуманный компонент → отказ без записи; старая ошибка не вменяется при
  сдвиге индексов; `$ref` на несуществующий шаг; TS: RF002 → `CODE_INVALID`, предупреждение →
  пометка, корпуса нет → пропуск; предупреждения derived/маркера); `introduced`; каждый инструмент;
  `file-loop` (затравка, последовательные вызовы, эталон «мастер 3×4»: `describe_component` +
  один `edit_file` → валидная форма за 2 вызова); `file-prompt` (побайтовая стабильность, бюджет);
  храповик файловой поверхности; `config` (`editMode` туда-обратно).
- **Мост**: новый `describe('режим файлов')` в `bridge.test.ts` — записи сразу с одним `txId` на две
  попытки, нормализация одной записью и только без чужой правки, отмена всех файлов, `overlapped`,
  созданный файл остаётся с замечанием, «Восстановить», `pending` не появляется, detached →
  structured; существующие тесты не меняются.
- **Интеграция** на настоящей сессии (по образцу `integration/templates-port.test.ts`): запись
  незагруженного файла; запись шага пересобирает открытую составную форму; `flush` частей.
- **Сборка**: `npm run build:dist` плагина — `validateCode` не попал в главный чанк;
  `scripts/check-no-node-globals.mjs`.
- **Живая проверка**: playground, режим files в настройках, ход «добавь email с валидацией» на
  шаблоне `reformer-multi-step-form` — поле в схеме, правило в `validation/*.ts`, превью его
  исполняет, «отменить ход» возвращает все файлы. Скриншоты — в
  `projects/react-playground-e2e/screenshots/builder-files-mode/`.
- **A/B-замер** (`ai/src/loop/modes-ab-eval.test.ts`, по образцу `tools/render-rules-eval.test.ts`,
  пропускается без `EVAL_MODEL`; переменные `EVAL_KIND`, `EVAL_BASE_URL`, `EVAL_API_KEY`,
  `EVAL_MODES`, `EVAL_RUNS`, вывод в `.tmp/ab-eval/`): сценарии — A форма по спеке кредитной заявки
  с нуля (задание как в `.tmp/builder-spec-run/full.run.ts`), B «добавь валидацию и условную
  видимость» на `reformer-multi-step-form`, C детерминированный эталон 3×4. Метрики: время,
  `TurnStats`, вызовы по именам, отказы по кодам, `$model`-полей и доля ожидаемых ключей спеки
  (перенос `check-fields.mjs`/`analyze.mjs`), строгая `validateSchema` итога (0 ошибок). Модели:
  `qwen3.8:27b` (Ollama) ×3 на режим, одна облачная ×1–2. Критерии записываются ДО прогона:
  облако — полнота полей в files ≥ structured при токенах ≤ +30 %; локальная — 0 сломанных форм
  в files. Отчёт — `docs/mcp-eval/builder-files-mode.md`.

## Follow-up (в beads, вне этого плана)

- Снять режим structured по итогам замера (если files выиграл).
- `DocumentsService.discard(id)` поверх `Workspace.revert`, чтобы отмена удаляла созданные файлы.
- `Workspace.list` не показывает новые подкаталоги до сохранения.
- Синтаксическая проверка TS транспиляцией хоста; `search_files`, если замер покажет много
  подкачки страниц; отмена хода через `Journal.undoTransaction`.

## Риски

- Слабые модели на сыром JSON: гейт удерживает форму от поломки, но не гарантирует результат —
  ответ даст замер.
- Размер бандла от `validateCode` — только динамический импорт, проверка сборкой.
- Правила нового шага (`validation/<step>.ts`) подключаются производным кодом только после
  повторной генерации — назвать в промпте.
