# Интеграция ИИ в UI-Builder: «Builder Copilot over MCP»

## Context

Задача — подключить ИИ к визуальному UI-Builder (`projects/reformer-builder/`), чтобы форму
можно было генерировать и редактировать на естественном языке. Билдер — это Vite + React 19 SPA
без бэкенда; источник истины редактора — объект `JsonFormSchema` (`@reformer/renderer-json`),
который правится иммутабельно через единую точку мутации. ИИ-кода в билдере сейчас нет (зелёное
поле), но почти вся инфраструктура для интеграции уже построена: зафиксированный формат вывода
(`JsonFormSchema`), единый commit-funnel с undo/redo, каталог компонентов как «словарь», чистый
гейт валидации, и внешний MCP-сервер `@reformer/mcp` со знаниями DSL и валидацией.

**Выбранная архитектура** (по ответам пользователя на 4 развилки):
- **Транспорт** — «внешний агент через MCP»: LLM и agent-loop живут во внешнем локальном процессе
  (**AI-bridge**), а браузерная чат-панель — тонкий клиент к нему по WebSocket. SPA остаётся без
  ключей и без бэкенд-прокси. (stdio-MCP из браузера недостижим → bridge обязателен.)
- **Режим правок** — **гибрид**: агент сам выбирает полную генерацию схемы (`replaceSchema`) для
  «создай форму»/крупных изменений либо точечные edit-операции (`apply(mutate.*)`) для мелких правок.
- **Объём** — **layout + validation + behavior**: агент владеет и layout-JSON, и companion-TS
  (`validation.ts`, `form.behavior.ts`, `model.ts`).
- **UX** — **чат-панель** в билдере (рядом с инспектором) + node-level «✨ править выделенный узел».

Ожидаемый результат: внутри билдера пользователь пишет запрос → внешний агент (через MCP) генерирует
или правит форму → результат проходит валидацию → применяется через существующий commit-funnel
(бесплатно undo/redo) → канва обновляется.

---

## Как это работает — конвейер

```
NL-запрос + контекст (текущая схема, выделение, каталог, правила DSL)
   → агент (Claude Agent SDK, вне браузера) выбирает: полная генерация | edit-операции
   → результат проходит гейт validateSchema()  ──ошибки──► обратно в агент (авто-починка, ≤2 итер.)
   → применение через editorActions.replaceSchema / apply(mutate.*)  → undo/redo, история
```

Три технических рычага надёжности: (1) **structured output** через
`buildFormSchemaMetaSchema({componentNames})` сужает `$component(...)` до enum реальных компонентов;
(2) **grounding каталогом** — `getCatalog()` как список доступных компонентов и их пропсов;
(3) **валидация как objective-feedback** — `validateSchema()` до коммита, с петлёй авто-починки.

---

## Component architecture (end-to-end)

```
┌─── Browser SPA (reformer-builder) ────────────────────────────────────────────┐
│  EditorLayout · CanvasArea · Inspector · NEW AiPanel (чат, справа)             │
│  editorStore (истина: TabState.schema: JsonFormSchema)                          │
│  src/ai/ : ws-client · context (snapshot) · apply-ops (EditOp[]→mutate.*) ·     │
│            gate (validateSchema) · ai-store                                     │
└──────────────▲──────────────────── WebSocket (JSON-кадры) ─────────────────────┘
               │  (stdio-MCP и LLM-креды недостижимы из SPA → bridge обязателен)
┌──────────────┴─── AI-bridge: локальный Node-процесс (NEW пакет) ───────────────┐
│  Claude Agent SDK query()  — держит ANTHROPIC-креды, agent-loop, стриминг       │
│    default model: claude-opus-4-8                                               │
│  in-process SDK MCP (createSdkMcpServer/tool) — live-edit tools, зовут браузер  │
│    по WS: get_current_schema · get_selection · get_catalog ·                    │
│           replace_schema · apply_edit_ops · write_companion                     │
│  external stdio MCP  — @reformer/mcp как есть: validate_json_schema ·           │
│    check_behaviors · list_symbols · get_symbol_docs · find_recipe +             │
│    prompts to-renderer-json / add-validation / add-behavior + resources docs    │
│  canUseTool(name,input) — авто-approve для read, diff-preview/approve для write  │
└──────────────────────────────── HTTPS → api.anthropic.com ─────────────────────┘
```

**Кастодия секретов**: LLM-ключ живёт **только** в bridge (env / `ant auth login`). Браузер держит
лишь WS к `localhost:<port>` и никогда не общается с Anthropic напрямую.

**Почему Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): это готовый harness (loop, стриминг,
MCP-клиент, `canUseTool`-permission-хук). Поддерживает **обе** нужные MCP-поверхности одновременно:
in-process (`createSdkMcpServer`) для live-edit tools, которым нужен доступ к состоянию браузера,
и external **stdio** — чтобы переиспользовать `@reformer/mcp` дословно.

---

## Ключевые точки интеграции (реальные API, переиспользуем)

| Нужное | Что используем |
|---|---|
| Единый commit-funnel (→ undo/redo) | `editorActions.apply(fn,{coalesceKey})`, `replaceSchema(schema)`, `commit(result)` — [editor-store.ts](../../projects/reformer-builder/src/store/editor-store.ts) |
| Чистые мутации (1:1 с edit-ops) | `insertNode/appendNode/removeNode/moveNode/setComponentProp/groupBlock/wrapInRow…` — [mutate.ts](../../projects/reformer-builder/src/model/mutate.ts) |
| Гейт валидации | `validateSchema(schema) → {valid, errors[]}` — [io/validate.ts](../../projects/reformer-builder/src/io/validate.ts) |
| Structured-output схема | `buildFormSchemaMetaSchema({componentNames})` — экспорт `@reformer/renderer-json` |
| Каталог-словарь + дефолт-узлы | `getCatalog()`, `makeNodeFor(name,role)` — [src/catalog/](../../projects/reformer-builder/src/catalog/) |
| Пути узлов | `JsonPath`, `getAt/updateAt/toPointer` — [model/paths.ts](../../projects/reformer-builder/src/model/paths.ts) |
| Companion-TS «рыбы» + запись | `form-templates.ts`, `save-actions.ts` (`openCodeTab`/`createFile`) |
| Система-промпт + prompts | `@reformer/mcp` шаблон `to-renderer-json.md`, `add-validation`, `add-behavior` |
| Референс-артефакт | `projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v20/` |

---

## Протокол браузер ↔ bridge (WebSocket)

Один персистентный сокет на сессию. Конверт `{v:1, id, type, ...}`. Live-edit tools — это
**запросы bridge→браузер**, на которые браузер отвечает.

**Браузер → bridge** (ход пользователя): `chat.send {id, text, scope:'form'|'node', context:{schemaHash, selectionPath}}`, `chat.cancel {id}`.
Схему целиком в кадре НЕ шлём — bridge подтянет свежую через `get_current_schema` (маленький кадр + нет рассинхрона).

**bridge → браузер** (tool-раунд-трипы): `tool.req {reqId, tool, input}` → `tool.res {reqId, ok, result|errors}`:
- `get_current_schema` → `{schema}`; `get_selection` → `{path, node}`; `get_catalog` → subset `getCatalog()`.
- `replace_schema {schema}` → браузер гейтит; valid → `editorActions.replaceSchema`; invalid → `{ok:false, errors}` (НЕ коммитим).
- `apply_edit_ops {ops}` → фолд in-memory → гейт кандидата → коммит одной записью истории; invalid → `{ok:false, errors, opIndex?}`.
- `write_companion {file, text}` → `openCodeTab` (Mode A) или `createFile` (Mode B).

**bridge → браузер** (стриминг статуса, не результаты): `chat.delta {text}`, `chat.tool {tool, phase}`, `chat.usage`, `chat.done`, `chat.error`.

**Edit-op протокол** — 1:1 с `mutate.ts`; фолдим в ОДИН `MutationResult` = одна запись undo:
```ts
type EditOp =
  | { op:'setComponentProp'; path; key; value }   // mutate.setComponentProp
  | { op:'setComponent';     path; component }     // '$component(Name)'|'$html(div)'
  | { op:'insertNode';       slotPath; index; node } | { op:'appendNode'; slotPath; node }
  | { op:'removeNode';       path } | { op:'moveNode'; fromPath; slotPath; index }
  | { op:'duplicateNode';    path }
  | { op:'groupBlock'; slotPath; start; count; className? } | { op:'ungroupNode'; path }
  | { op:'wrapInRow'|'wrapInColumn'; targetPath; node; side; className? } | { op:'flipDirection'; path };

// src/ai/apply-ops.ts — fold → one commit:
editorActions.apply(schema => applyEditOps(schema, ops), { coalesceKey: `ai:${turnId}` });
```
`node`-пейлоады для insert/append/wrap нормализуются в браузере через `makeNodeFor(name,role)` — дефолты/wrapper берутся из реального каталога, а не из догадки модели. Выбор гибрида **делает сам агент**, выбирая tool: `replace_schema` (создание/крупное) vs `apply_edit_ops` (локальное) — отдельного флага режима не нужно.

---

## Гейт валидации + авто-починка + безопасность

- **JSON-гейт (обязателен, в браузере, до любого коммита)**: `replace_schema` и `apply_edit_ops`
  прогоняют кандидата через `validateSchema()` ДО обращения к стору. Невалид → `{ok:false, errors}`
  агенту; Agent SDK-loop подаёт ошибки назад, агент правит и перезовёт tool. **Кап — 2 итерации**,
  дальше — показать ошибки в панели с выбором «применить всё равно / отменить». (Браузерный гейт —
  авторитетный барьер: он знает project-specific `componentNames` через `collectOperatorNames`.
  `@reformer/mcp` `validate_json_schema` — для самопроверки агента.)
- **Companion-TS**: behavior → `check_behaviors` (детект циклов по декларации, без исполнения);
  типы/синтаксис → диагностика Monaco TS-worker (уже в билдере); полный typecheck в браузере не делаем.
- **⚠️ Безопасность (наивысший приоритет)**: исполнение ИИ-сгенерированного `behavior.ts`/`validation.ts`
  в origin SPA = **RCE-эквивалент**. Правила: (1) дефолтный preview остаётся data-only
  (`build-preview.ts` не трогаем); (2) live-исполнение поведения — только за явным per-session opt-in;
  (3) исполнять companion-TS только в **sandbox** (`sandbox="allow-scripts"` iframe на null-origin или
  Web Worker без DOM, транспиляция esbuild-wasm там же), никогда не `eval` в main-window;
  (4) никакого авто-запуска ИИ-TS — тот же diff-preview/approve, что и для схемы.

---

## Роль `@reformer/mcp` и live-edit tools

- **`@reformer/mcp` переиспользуем как есть** (external stdio из bridge, после ребилда): system-prompt
  из `to-renderer-json.md` (канонический свод правил DSL), prompts `add-validation`/`add-behavior`
  (+`add-form-array`/`add-wizard`), tools `validate_json_schema`/`check_behaviors`/`list_symbols`/
  `get_symbol_docs`/`find_recipe`, resources `reformer://docs/*`.
- **Live-edit tools — как in-process SDK MCP внутри bridge** (рекомендация): им в любом случае нужен
  WS-канал к состоянию браузера, поэтому отдельный stdio-сервер только добавил бы процесс без выгоды.
- **Переиспользуемость для внешних агентов** (Claude Code/Cursor): вынести протокол + логику tools в
  общий `builder-bridge-core` и отдать тот же набор двумя обёртками — in-process (встроенная панель) и
  standalone stdio `@reformer/builder-mcp` (внешние агенты добавляют его в свой `.mcp.json`). Это
  покрывает и «встроенный copilot», и «bring-your-own-agent» одной реализацией. *(Фаза 4, опционально.)*

---

## Companion-TS (validation / behavior / model)

- **Генерация**: агент через MCP-prompts `add-validation` (`defineValidationSchema`) и `add-behavior`
  (`defineFormBehavior`), передавая текущую схему/модель как контекст. Вывод — TS-текст.
- **Куда кладём (реюз готового плюмбинга)**: Mode A (без сохранённой папки) → `editorActions.openCodeTab`
  (Monaco code-вкладка рядом с формой, как уже делает `save-actions.ts`); Mode B (открыта папка проекта)
  → `createFile` соседом `form.json` (`validation.ts`/`behavior.ts`/`model.ts` — уже конвенция).
  Скелеты — из `form-templates.ts`.
- **model.ts**: агент генерит `FormShape`-типы + initial values, консистентные с `$model(path)`-листьями
  (нужно для валидации/поведения и связного экспорт-артефакта; для preview данные и так синтезит `synthMock`).
- **Preview-wiring**: `build-preview.ts` уже принимает `behavior`; будущий `buildLivePreview(schema,{behavior,validation})`
  прогонит `validateModel` — но только под sandbox из раздела безопасности. Дефолтный путь не трогаем.

---

## UX-детали

Новая панель `src/panels/AiPanel/` (по образцу `src/panels/` + `src/store/hooks.ts`):
`AiPanel.tsx` (транскрипт + композер), `MessageList.tsx` (стриминг-дельты, tool-чипы «правлю схему…»/«валидирую…»),
`DiffPreview.tsx` (diff через `src/io/diff.ts`, кнопки Apply/Discard), `useAi.ts`.
- **AI-стор** отдельно (`src/ai/ai-store.ts` на существующем `createStore`) — чтобы состояние ИИ
  (сообщения, стриминг, pending-diff) НЕ попадало в undo-историю и dirty-трекинг `editorStore`.
- **Монтаж в `EditorLayout.tsx`**: четвёртый `ResizablePanel id="ai"` после инспектора под флагом
  `ui.aiOpen`; кнопка «✨ AI» в правом рейле рядом со «Свойства»; хоткей (напр. ⌘⌥A) в существующем
  `onKey`. Флаг `aiOpen`/`toggleAi` — в `UiState` (`store/types.ts`) + `reducers.ts` по образцу
  `rightOpen`/`toggleRight`.
- **Node-level «✨ править узел»**: выделение — `useSelectionPath()`; действие добавить в
  `Inspector.tsx` (шапка) и `FloatingActions.tsx` (канва). Клик шлёт `chat.send {scope:'node', context:{selectionPath}}`;
  агенту сказано предпочесть `apply_edit_ops`, скоупленные к пути.
- **Diff-preview перед применением**: для write-tools — режим «propose»: браузер считает кандидата +
  `validateSchema`, рисует `DiffPreview`, ждёт **Apply**; форсится через `canUseTool` (read — авто, write — prompt).
  Применение — единой записью истории (§edit-ops) → один ход ИИ = один undo.

---

## Стадии внедрения

**Фаза 0 — Разблокировка (prerequisite).** Собрать `@reformer/renderer-json` и `@reformer/ui-kit`,
затем `npm run build -w @reformer/mcp` (`generate:llms && tsc && copy-templates`). Проверить, что в
`dist/tools/` появились `validate-json-schema`/`list-symbols`/`check-behaviors` и что
`validate_json_schema` больше не уходит в graceful-degradation. *Итог*: MCP-сервер годен для любого агента.

**Фаза 1 — Bridge + WS + панель полной генерации (MVP).** Новый пакет `packages/reformer-builder-bridge/`
(Claude Agent SDK `query()`, креды, external stdio `@reformer/mcp`, `to-renderer-json` как
prompt-cached system-prefix). In-process tools: `get_current_schema`, `get_catalog`, `replace_schema`
(гейт → `replaceSchema`). Браузер: `src/ai/{ws-client,context,gate,ai-store}.ts`, `src/panels/AiPanel/*`,
монтаж в `EditorLayout.tsx` + флаг `ui.aiOpen`. Dev-bootstrap: root-скрипт `dev:builder+ai`
(`concurrently` vite + bridge), доки по `ANTHROPIC_API_KEY`/`ant auth login`.
*Демо*: «Создай форму заявки на кредит» → полный `JsonFormSchema` → валидация → `replaceSchema` →
канва рендерит; undo откатывает одним шагом.

**Фаза 2 — Edit-ops + петля валидации + node-level.** `src/ai/{ops,apply-ops}.ts` (фолд → один `apply`
с `coalesceKey`); bridge-tools `apply_edit_ops`, `get_selection`; авто-починка (≤2 итер.); node-level
«✨ править узел» в `Inspector.tsx` и `FloatingActions.tsx`; `canUseTool` + `DiffPreview.tsx` (реюз
`src/io/diff.ts`). *Демо*: выделить поле → «сделай обязательным и добавь плейсхолдер» → `setComponentProp`-ops
→ diff-preview → apply → один undo; невалидные предложения авто-корректируются до коммита.

**Фаза 3 — Companion-TS (validation + behavior + model).** Bridge-tool `write_companion`; агент через
MCP-prompts `add-validation`/`add-behavior` (+`check_behaviors`); размещение через `openCodeTab`/`createFile`;
агент эмитит и `model.ts`. *Демо*: «добавь валидацию email и вычисление greeting из name» → `validation.ts`
+ `behavior.ts` появляются code-вкладками, консистентно с `$model`-путями; behavior проходит `check_behaviors`.

**Фаза 4 — (опционально) Переиспользуемый builder-MCP + sandbox live-preview.** Вынести
`builder-bridge-core`; standalone `packages/reformer-builder-mcp/` (stdio) для внешних агентов;
`buildLivePreview(...)` исполняет companion-TS только в изолированном iframe/Worker за opt-in + approve.

---

## Решения по умолчанию (можно поменять) и риски

**Решения по умолчанию** (закрыты, чтобы не блокировать; легко изменить):
- Companion-sink: Mode A (code-вкладки) без открытой папки, Mode B (файлы) — с открытой (как `save-actions.ts`).
- Кап авто-починки: 2 итерации, дальше — «применить всё равно / отменить».
- Live-исполнение ИИ-TS: вне ядра; дефолтный preview остаётся data-only; live — только Фаза 4 за opt-in.
- Внешний builder-MCP: спроектирован (`builder-bridge-core`), но поставка — Фаза 4.

**Риски**: (1) **ребилд MCP** — первый шаг, иначе новые tools недоступны и `validate_json_schema`
молча деградирует; порядок сборки — в dev-доки/CI. (2) **Исполнение ИИ-TS** — RCE; sandbox + opt-in +
approve, никакого `eval` в main-window. (3) **Новый локальный процесс (bridge)** — как поднимать
(root `npm run` + `concurrently`), порт/handshake, auth-токен на WS (чтобы произвольная локальная
страница не рулила редактором); тот же токен нужен standalone builder-MCP. (4) **Стоимость токенов**
при full-gen — prompt-cache стабильного `to-renderer-json`, предпочтение `apply_edit_ops`, подтягивание
схемы через `get_current_schema` только когда нужно. (5) **Конфликт ИИ-правок с ручными** — ход ИИ =
одна запись истории (фолд ops + `coalesceKey`); `get_current_schema` берёт свежее состояние каждый ход;
при правке пользователем в процессе — re-fetch + re-validate, drift виден в diff-preview. (6) **Стриминг
больших схем** — текст стримим, схему шлём одним tool-кадром и валидируем один раз; enum-constrained
генерация через `buildFormSchemaMetaSchema` снижает мусор и ретраи.

---

## Verification (end-to-end)

1. **Фаза 0**: `npm run build -w @reformer/mcp`; проверить наличие `dist/tools/validate-json-schema.js`
   и что вызов `validate_json_schema` с валидной/невалидной `JsonFormSchema` возвращает `✅/❌` (не «could not load»).
2. **Фаза 1**: поднять `dev:builder+ai`; в панели ввести «Создай форму заявки на кредит из 3 полей» →
   убедиться, что `replace_schema` прошёл `validateSchema`, канва отрисовала форму, `⌘Z` откатил одним шагом.
   Негатив: заставить агента выдать несуществующий `$component(Nope)` → гейт вернул ошибку, коммита нет.
3. **Фаза 2**: выделить поле → «сделай обязательным» → в `DiffPreview` виден `setComponentProp` →
   Apply → один undo-шаг; проверить, что ручная правка во время хода вызывает re-fetch/re-validate.
4. **Фаза 3**: «добавь email-валидацию и greeting из name» → появились `validation.ts`/`behavior.ts`
   code-вкладками; `behavior.ts` проходит `check_behaviors` (без циклов); пути `$model` консистентны.
5. **Регресс**: существующие пути билдера (палитра/DnD/инспектор/undo, экспорт/сохранение) не затронуты;
   `build-preview.ts` остаётся data-only; ИИ-состояние не попадает в undo-историю `editorStore`.
6. **e2e**: smoke-тест панели по образцу `projects/react-playground-e2e/` (скриншоты — в
   `projects/react-playground-e2e/screenshots/`).
