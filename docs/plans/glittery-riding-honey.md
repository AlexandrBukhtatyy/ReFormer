# Модуль формы из билдера: разная раскладка для простой формы и визарда

## Context

Кодоген билдера печатал для простой формы и визарда одну плоскую папку. Цель — уникальная
раскладка для каждого типа формы, единая схема имён `form.*` (согласована с каноном MCP) и схема
визарда, разрезанная по шагам, с которой билдер работает как с одним документом.

**Этап 1 — сделан** (коммиты `5ae0cff9`…`62e9ae3a`, `develop`): имена `form.schema.json`,
`form.render.ts`, `form.behavior.ts`, `form.validation.ts`, `wizard.tsx`; у визарда
`steps/index.ts` + `steps/<slug>/{form.validation.ts, form.render.ts}`; правила разложены по шагам;
MCP-канон для всех таргетов допускает `steps/<slug>/form.schema.*`. Схема пока — один файл.

**Этап 2 — схема по шагам** (задача ReFormer-npns). Решения пользователя:
- разбиение — командой редактора «Разбить по шагам» / «Собрать в один файл»; кодоген повторяет
  структуру источника; шаблон «Пошаговая форма» создаёт уже разбитую форму;
- шаг, добавленный в разбитой форме, сразу получает свой файл;
- удалённый шаг — его файл удаляется (при сохранении, см. §B4).

## Формат

```
form.schema.json                          steps/dannye/form.schema.json
{ "$schema": "./form-schema.schema.json", { "$schema": "../../form-step.schema.json",
  "root": { … "$component(Wizard)",         "node": { "component": "$component(Step)",
    "componentProps": { "steps": [                    "componentProps": { "title": … },
      { "$ref": "./steps/dannye/form.schema.json" },  "children": [ … ], "$nodeId": … } }
      { "$ref": "./steps/kontakty/form.schema.json" }
    ] } } }
```

- Ключ `node`, а не `root`: файл шага не открывается и не генерируется как самостоятельная форма
  (`isFormSchema` требует `root`).
- `$ref` — только в `componentProps.steps` визард-хоста (`STEPS_HOST_NAMES`), только относительный,
  цель — файл шага. Смешанный массив (`$ref` + инлайн-узлы) допустим при разборе (ручная правка),
  но билдер в разбитой форме инлайн-шаги сразу выносит (решение «сразу в свой файл»).
- Папка шага фиксируется путём в `$ref`: переименование заголовка файл не двигает. Кодоген берёт
  `StepInfo.dir` из пути `$ref`, а не из слага заголовка — папки кода шага и схемы шага совпадают.
- `$nodeId` уникальны по всей собранной форме.

## Этап 2A — формат и рантайм (без билдера)

1. **renderer-json** `packages/reformer-renderer-json/src/schema/`:
   - вынести сужение (`componentOp` enum, `htmlOp`, `propSchemas`) из `buildFormSchemaMetaSchema`
     в общий помощник; новый `buildFormStepMetaSchema(opts)` — те же `definitions`, корень
     `{ $schema?, node: #/definitions/node }`; `form-step.schema.json` рядом с базовым;
   - базовая мета-схема: элемент `steps` у контейнера может быть `{ $ref: string }` (ref-ветка
     только там — остальной `componentProps` остаётся непрозрачным);
   - `src/compose.ts`: `composeJsonFormSchema(skeleton, parts: Record<string, JsonFormStep | JsonNode>)`
     — заменяет `{ $ref }` в `steps` на `node` части; неизвестный ref — ошибка с путём; тип
     `JsonFormStep`; экспорт из `src/index.ts`. `validateFormSchema` на несобранной схеме с `$ref`
     даёт понятную находку «схема не собрана».
2. **Стек** `packages/reformer-builder-stack-reformer/src/form-model/composite.ts` (чистые функции):
   - `stepRefsOf(schema)` — ссылки в `steps` (путь элемента, спецификатор);
   - `joinFormSchema(skeleton, parts: Map<path, text|object>)` → `{ schema, origins: Map<nodeId, path> }`
     (+ `ensureNodeIds` по собранному, дубли между частями разводятся);
   - `splitFormSchema(schema, origins, { dirOf })` → `{ skeleton, parts: Map<path, JsonFormStep> }`;
     шаг без `origins` получает путь `./steps/<stepDirName>/form.schema.json` (`codegen/steps.ts`,
     дубль → `-2`); обратимость `split∘join` байт-в-байт;
   - `isFormStepSchema(json)`; `node-kind.ts`: `isStepRef` — ref-элементы не молча пропускаются, а
     видны как «несобранный шаг» (для редких мест, где форма не собрана).
3. **Кодоген стека**: `STEP_FILES.schema = 'form.schema.json'`; `PrepareInput.origins?` →
   `layoutOf` берёт `dir` шага из пути `$ref`; `emit/schema.ts`: при `origins` печатает скелет со
   `$ref`; новый `emit/step-schema.ts`; `steps-index.eta` добавляет
   `stepSchemas: Record<ref, JsonFormStep>`; `index-tsx.eta` для разбитой формы собирает
   `composeJsonFormSchema(rawSchema, stepSchemas)`.
4. **Билдер-кодоген** `pipeline/targets.ts`: цель `codegen.step-schema` (`each: 'step'`,
   `steps/{step}/form.schema.json`, derived, `applies` — только когда шаг разбит). `findSchemaIn`
   (`commands/context-menu.ts`) и `schemaOf` (`pipeline/run.ts`) — через `joinFormSchema`, читая
   части с диска/из документов; `formNameOfSchemaPath` не принимает файл шага. Иначе «Сгенерировать
   в папку» затёрло бы разбитый корень собранным.
5. golden: наборы `wizard-split` и `wizard-mixed`; playground `builder-tests/w03` → разбитый
   вариант `w04-split` (компилируется в `tsc` playground).

## Этап 2B — составной документ в билдере

1. **Контракт** `packages/reformer-builder-plugin-api/src/workspace/model/provider.ts`:
   необязательная способность провайдера
   ```ts
   composition?: {
     references(model: M): readonly string[];                 // спецификаторы частей в корне
     compose(root: M, parts: ReadonlyMap<string, string>): { model: M; origins: ReadonlyMap<NodeId, string> };
     decompose(model: M, origins): { root: M; parts: ReadonlyMap<string, string>; origins };
   }
   ```
   `ModelDocument.getComposition?(): { parts: readonly ResourceId[]; origins }` — для кодогена и AI.
   Провайдер editor-schema реализует его через `joinFormSchema/splitFormSchema`.
2. **Оболочка** `shell/platform/workspace/model/composite-document.ts` — реализация
   `ModelDocumentHandle` поверх корневого буфера + частей (переиспользует `history.ts`, логику эха
   и отложенной перерисовки из `model-document.ts`, вынесенную в общий помощник):
   - `attachDocumentModel` выбирает составной вид, если у провайдера есть `composition` и в
     модели есть ссылки; части читаются `workspace.readText` (уже материализованы
     `materializeClosure`);
   - `apply/undo/redo` → `decompose` → `writeText` только изменившихся файлов одним `txId`; эхо —
     по каждой части; одна история снимков на весь документ;
   - внешняя правка части (вкладка части, слияние, `acceptExternal`) — подписка на
     `workspace.onDidChange('written')` по id частей → пересборка; неразбор части → расхождение
     с диагностикой на ресурсе части;
   - новые части создаются `writeText` (создание файла уже поддержано);
   - **удаление**: исчезнувшая часть попадает в `removedParts`; файл удаляется `resource-ops` при
     сохранении документа; отмена до сохранения — просто возврат, после — файл пишется заново.
3. **Изменённость и сохранение**: `DocumentModelsCapability.companionsOf(id)`; `workspace-session`
   / `ui/state/tabs.ts` (`withDirtyFlags`), `boot/ports/files.ts` (`save`), `workspace-save.ts`,
   закрытие вкладки с сохранением — расширяют id корня его частями; конфликты — по частям.
   `workspace.checkSource` получает части открытых составных документов.
4. **Команды редактора** (editor-schema): «Разбить по шагам» (инлайн-шаги → файлы, одна запись
   истории) и «Собрать в один файл» (обратное, файлы частей удаляются при сохранении).
   Доступны на визард-хосте в структурном редакторе и в палитре.
5. **Файл шага отдельно**: открывается как текст; Monaco-подсказка по `form-step.schema.json`
   (провайдер отдаёт вторую подсказку по `$schema`, `editor-monaco/hints/json-schemas.ts`).

## Этап 2C — потребители

- **AI** (`plugins/ai/session/{bridge,apply}.ts`, `model/schema-text.ts`): для составного документа
  база хода — собранная модель; применение — новой операцией `set-schema` через ручку модели
  (одна запись истории, раскладка по файлам делает документ); проверка устаревания и
  снимки отмены/восстановления — по тексту собранной схемы. Простая форма — прежний путь.
- **Валидатор** (`validator-schema`): проверяет собранную модель; находки в узлах из частей
  публикуются на ресурс части (путь — через `origins` + `nodePaths` части), иначе — на весь ресурс.
- **Шаблоны** (`templates/stores/builtin.ts`, `content/files.ts`, `render/render.ts`): «Пошаговая
  форма» печатается разбитой (кодоген с `origins` для всех шагов); `formSchemaFileOf` и
  eta-рендер собирают схему через `joinFormSchema`.
- **Превью, канвас, схематика** — без правок: работают с собранной моделью.
- **MCP/доки**: `06-form-directory-layout.md` — формат `{ node }` и `$ref`; доки renderer-json
  (`composeJsonFormSchema`, `form-step.schema.json`); перегенерация llms и базы знаний билдера.

## Проверка

1. `npx vitest run` в renderer-json, stack-reformer, builder, mcp; golden-манифесты глазами.
2. Юнит: `composeJsonFormSchema`; `split∘join` (байты, `$nodeId`, дубли); составной документ —
   правка шага пишет один файл, перенос узла между шагами — два одним `txId`, отмена откатывает
   оба, новый шаг создаёт файл, удалённый шаг удаляется при сохранении и возвращается отменой,
   внешняя правка части пересобирает модель, битая часть — расхождение.
3. `npx tsc --noEmit` в пакетах и `projects/react-playground/tsconfig.app.json` (разбитый пример).
4. Билдер (`npm run dev:builder`, playwright MCP, скриншоты в
   `projects/react-playground-e2e/screenshots/builder-split/`): шаблон «Пошаговая форма» → файлы
   шагов; правка в канвасе → меняется файл шага, звёздочка у вкладки корня; Ctrl+S сохраняет все;
   «Собрать в один файл» / «Разбить по шагам»; удаление шага; ход ассистента через два шага;
   превью «Далее» работает.
5. `npm run typecheck`, `node scripts/check-mcp-prompts.mjs`, eslint/prettier.

Выпуск — три коммит-серии (2A, 2B, 2C); после каждой билдер рабочий.
