# Environment-agnostic reformer-builder → VSCode-плагин (ports & adapters)

## Context

Идея: встроить визуальный form-билдер `projects/reformer-builder/` в VSCode как плагин (Custom Editor
для `*.form.json`). Прямой путь «обернуть SPA в webview» работает, но оставляет билдер жёстко завязанным
на браузер: доступ к файлам через File System Access API (Chromium-only), Monaco-воркеры через Vite
`?worker`, тосты через DOM, а **браузерные хэндлы протекают прямо в ядровой стор** — что делает состояние
несериализуемым вне браузера.

Решение (по итогам анализа 5 архитектурных агентов): сделать билдер **environment-agnostic через
гексагональную архитектуру (ports & adapters)**, где VSCode-webview становится просто ещё одним набором
адаптеров рядом с browser и in-memory (тесты). Выбранный масштаб — **полная гексагонализация (Фазы 0–4)
внутри `projects/reformer-builder/`** (без выделения отдельного пакета сейчас), затем **vscode-адаптер +
extension-проект (Фаза 5)**. Каждая фаза оставляет текущую GitHub Pages сборку рабочей.

Итог: одно ядро (стор + модель + интерфейсы портов) работает в браузере, в VSCode и в тестах;
интеграция в плагин перестаёт быть «мостом-костылём» и становится штатным адаптером.

## Целевая архитектура

Гексагональная модель с **одним composition root** — `PlatformAdapter`, — агрегирующим все capability-порты
и создающимся один раз на входе (per-entry). Ядро оперирует только путями-строками, opaque-`DocumentRef`
и чистыми типами схемы. Всё, что тянет `lib.dom` (хэндлы, `Blob`, `document`, `window`), Vite `?worker`,
IndexedDB или `@reformer/ui-kit/sonner`, — на адаптерной стороне.

```
   main.tsx (browser)   webview-entry.tsx (vscode)   createBuilderCore (tests)
        └──────── resolvePlatform(id) → PlatformAdapter ────────┘
   ┌─────────── ENVIRONMENT-AGNOSTIC CORE (нет lib.dom / ?worker / toast) ───────────┐
   │  store/ (create-store, reducers, editor-store, project-store)                   │
   │  model/ (mutate, normalize→ensureSchema, printer, serializeSchema)              │
   │  ports/ (только интерфейсы) · util SchemaSyncBridge (echo-guard)                │
   │  seam: editorActions.openTab/replaceSchema/commitSaved · editorStore.subscribe  │
   └───────────────────────────────▲────────────────────────────────────────────────┘
                                    │ инъекция через PlatformAdapter
   ┌────────────────────────────────┼─────────────────────────────────────────────┐
   │  adapters/browser/     adapters/vscode/ (Фаза 5)      adapters/in-memory/      │
   │  FS Access API         postMessage ↔ extension host    Map<path,{text,mtime}>  │
   │  IndexedDB · Blob+<a>  workspace.fs · blob-URL worker  buffer · no-op          │
   │  Vite ?worker · sonner vscode.window.show* · themes    collect[]              │
   └────────────────────────────────┼─────────────────────────────────────────────┘
   ┌────────────────────────────────┼─────────────────────────────────────────────┐
   │  UI SHELL (React+DOM, webview-only): EditorLayout · panels/* · canvas/*        │
   │  SchemaCodeEditor (использует SchemaSyncBridge) · monaco-setup(initMonaco(host))│
   └───────────────────────────────────────────────────────────────────────────────┘
```

**Прокидывание сервисов — гибрид** (компромисс с текущим module-singleton-подходом, `editorStore`
импортируется прямым импортом в ~20 файлах, ломать разом нельзя):
- один `PlatformAdapter` на инстанс, создаётся в composition root `createBuilderApp`;
- модульный синглтон-провайдер `getPlatform()`/`initPlatform()` — для не-React потребителей (`save-actions`, `adapters/*`, `SchemaSyncBridge`);
- тонкий `PlatformProvider` + `usePlatform()` — для React-компонентов;
- **`editorStore`/`projectStore` остаются синглтонами**. Жёсткое правило: платформа владеет io/host/document-портами, стор владеет состоянием; стор не читает адаптеры напрямую, адаптеры не держат состояние стора; `save-actions` — единственная легальная точка пересечения.

**Раскладка (внутри `projects/reformer-builder/`, пакет не выделяем):**
- `src/ports/` — только интерфейсы (types, нулевой рантайм). Environment-agnostic.
- `src/adapters/browser/` — перенос **как есть** [io/fs-access.ts](projects/reformer-builder/src/io/fs-access.ts), [io/fs-ops.ts](projects/reformer-builder/src/io/fs-ops.ts), [io/handle-store.ts](projects/reformer-builder/src/io/handle-store.ts), DOM-часть [io/export.ts](projects/reformer-builder/src/io/export.ts), walk-часть [io/discovery.ts](projects/reformer-builder/src/io/discovery.ts). Три копии `as unknown as Fs*Handle`-кастов схлопнуть в один модуль.
- `src/adapters/in-memory/` — `Map`-бэкенд для тестов.
- `src/adapters/vscode/` — Фаза 5.
- Ядро (`store/`, `model/`, `SchemaSyncBridge`) физически остаётся в `src/`, но не импортирует ничего DOM-специфичного.

## Порты (11 активных) → адаптеры

| Порт | browser | vscode-webview (Фаза 5) | in-memory |
|---|---|---|---|
| **WorkspacePort** (pick/restore корня + `capabilities` + выдаёт FS) | `showDirectoryPicker`; restore = IndexedDB + `ensurePermission` | `showOpenDialog` (host); restore = `workspaceFolders[0]` | fixture-корень |
| **FileSystemPort** (path CRUD + `list()` + `watch?()`) | перенос fs-ops за интерфейс; `Map<path,handle>` кэш; `watch:false` | RPC → `vscode.workspace.fs`; discovery через `findFiles`; `watch`=`FileSystemWatcher` | `Map<path,{text,lastModified}>` |
| **StoragePort** (key-value) | IndexedDB (opaque handle) + localStorage (скаляры) | webview `getState` / extension `Memento` | `Map` |
| **DocumentHost** (`openInitial`/`open`/`export`) | `readFile`+`ensureSchema`; export=`downloadSchema` | `TextDocument`/CustomEditor init; save→`workspace.fs` | `seedSchema()`; map lookup |
| **SchemaDocument** (`getText`/`applyEdit(text,token)`/`onDidChange`/`save`) | poll `lastModified`; save через `prepareSave`/`commitSave` | host шлёт `{init/update,text,revision}`; `applyEdit`→post `{edit}` | ручной эмиттер |
| **ExporterPort** («сохранить как» без DOM) | `Blob`+`URL.createObjectURL`+`<a download>` | `showSaveDialog`+`fs.writeFile` | буфер |
| **WorkerHostPort** (фабрика Monaco-воркеров) | `new jsonWorker()`/`new editorWorker()` (`?worker`) | blob-URL-shim `importScripts(absUrl)` под `worker-src 'self' blob:` | no-op |
| **ThemePort** (режим + `monacoTheme()` + `canToggle`) | store-тоггл → `.dark`; `canToggle:true` | `body.vscode-*` + `onDidChangeActiveColorTheme`; `canToggle:false` | фикс. `light` |
| **NotificationPort** (info/error/success/rich) | `sonner` `toast.*` | `vscode.window.show*` (политика «лёгкое в webview / критичное хосту») | collect[] |
| **DialogPort** (prompt/confirm/diff) | radix Dialog / SaveDialog | `showInputBox`/`showWarningMessage`/`vscode.diff` | предзаданные ответы |
| **CommandRegistry** (`{id,run,keybinding,scope}` + `ownsGlobalKeybindings`) | владеет `window.keydown` | global-хорды → `contributes.keybindings`; webview слушает `scope:'canvas'` | `exec(id)` программно |

`HostShell` — фасад над портами 7–11; `SchemaSyncBridge` — не порт, а утилита (вынесенный из
`SchemaCodeEditor` echo-guard: debounce + `isFormSchema`-guard + revision-token).

## Migration-path (каждая фаза держит GitHub Pages сборку зелёной)

**Фаза 0 — чистый рефактор без смены поведения:**
1. `src/ports/` с интерфейсами (нулевой рантайм).
2. **Унифицировать два сериализатора.** Сейчас панель «Код»/Mode A показывают `serializeSchema` (JSON 2sp, [io/export.ts](projects/reformer-builder/src/io/export.ts)), а Mode B пишет `print` (prettier, [model/printer.ts](projects/reformer-builder/src/model/printer.ts)) — панель показывает **не то**, что уходит на диск. Свести к одному источнику (`SchemaDocument` владеет каноническим текстом: `printer` когда есть prettier-config, иначе `serializeSchema`).
3. **Вынести `SchemaSyncBridge`** из [SchemaCodeEditor.tsx](projects/reformer-builder/src/canvas/SchemaCodeEditor.tsx) в чистую утилиту (token вместо `focusedRef` — для async postMessage focus не работает). Регресс-гейт: e2e на редактирование в панели «Код».

**Фаза 1 (keystone) — убрать хэндлы из стора:**
4. Удалить `handle?: FileSystemFileHandle` из `TabSource` ([types.ts:42](projects/reformer-builder/src/store/types.ts#L42)), `handle` из `TreeEntry` ([discovery.ts:103](projects/reformer-builder/src/io/discovery.ts#L103)), `dirHandle` из `ProjectState` ([project-store.ts:15](projects/reformer-builder/src/store/project-store.ts#L15)). Файл адресуется `{path, name, lastModified, rawText}`; хэндлы живут в реестре browser-адаптера (`Map<path,handle>` или ленивый резолв от корня — `fs-ops` уже так резолвит каталоги). **Инкрементально:** добавить `path`/`ref` рядом с `handle`, перевести читателей (`openSchemaFile`, `openCodeFile`, `saveCodeTab`, `prepareSave`, `confirmSave`) на резолв через реестр, затем удалить `handle`. Делает стор сериализуемым — снимает главный блокер для vscode/electron.

**Фаза 2 — маршрутизация оркестрации через порты:**
5. [save-actions.ts](projects/reformer-builder/src/app/save-actions.ts) импортирует порты через `getPlatform()`, а не `fs-access`/`fs-ops`/`handle-store`/`export` напрямую. Browser-адаптер = перенесённый код за интерфейсом.
6. Заменить `fsAccessSupported()` (save-actions.ts:82, FilesPanel.tsx:388) на `platform.capabilities.pick` (инициализируется той же функцией — один источник истины).
7. `discovery.walkTree` → на `FileSystemPort.list()`+`readFile()` вместо `dir.values()`/`getFile()`, сохранив `IGNORE_DIRS`/`SKIP_FILES`/`MAX_TREE_ENTRIES`. Открывает юнит-тесты discovery/save/rename без Chromium.
8. Нормализовать `DOMException`/`AbortError` (`isAbort`, save-actions.ts:47) в типизированный `PickCancelled` на границе порта.

**Фаза 3 — host-ui порты:**
9. `NotificationPort`: заменить ~20 прямых `toast()` в save-actions + `validation-toast.tsx` на `host.notify.*` (`rich(node)` сохраняет кликабельные пути валидации).
10. `WorkerHostPort`: вынести `MonacoEnvironment.getWorker`+`loader.config` из module-level side-effect ([monaco-setup.ts:36-43](projects/reformer-builder/src/canvas/monaco-setup.ts#L36)) в явный `initMonaco(host.worker)`, вызываемый **после** `initHost()`. `jsonDefaults.setDiagnosticsOptions` (in-memory) остаётся.
11. `CommandRegistry`: свести `window.keydown` (EditorLayout), `AppMenuBar` `MenubarShortcut` и `QuickAddDialog` к единой таблице; заменить хрупкий `el.closest('.monaco-editor')` на явный scope.
12. `ThemePort`+`DialogPort`: `CodeEditor`/`RawJsonEditor` берут `monacoTheme()` из порта; `SaveDialog` унифицировать через `DialogPort`.

**Фаза 4 — bootstrap:**
13. `createBuilderApp(platform, mount)`; [main.tsx](projects/reformer-builder/src/main.tsx) → тонкий (`resolvePlatform('browser')`→`createBuilderApp`); [App.tsx](projects/reformer-builder/src/App.tsx) оборачивает `EditorLayout` в `<PlatformProvider>`. Синглтон-стор не трогаем — новый код мигрирует на `usePlatform()` постепенно.

**Фаза 5 — VSCode extension (поверх готового env-agnostic ядра):**
14. `src/adapters/vscode/` — реализация всех портов через postMessage-RPC к extension host. `SchemaDocument` = мост document↔webview (host шлёт `{init/update,text,revision}`, webview `applyEdit`→post `{edit}`); `ownsUndo/ownsDirty=true`, `ownsGlobalKeybindings=false`.
15. `src/vscode/webview-entry.tsx` + `webview.html` + `vite.config.webview.ts` (`base:'./'`, `outDir:'dist-webview'`, **скопировать `resolve.dedupe`**). Рендерит `<PlatformProvider platform={resolvePlatform('vscode')}><EditorLayout/></PlatformProvider>`; react-router в рантайме не нужен.
16. Новый проект `projects/reformer-vscode/` (npm workspace): `package.json` (манифест — `engines.vscode`, `contributes.customEditors` для `*.form.json`, `activationEvents`), `src/extension.ts` (`CustomTextEditorProvider`: `resolveCustomTextEditor` → webview `enableScripts`/`localResourceRoots`, HTML с CSP+nonce и `asWebviewUri`, host-сторона RPC для всех портов, echo-guard через сравнение с `document.getText()`), `src/html.ts`, `esbuild.mjs`, `.vscode/launch.json` (F5). Webview-бандл собирается в билдере и копируется в `media/` (git-ignored).
17. **Monaco в webview** — начать без него (`WorkerHostPort` no-op в single-document режиме, raw-JSON панель скрыта; визуальному canvas Monaco не нужен), затем добавить blob-shim (`importScripts(asWebviewUri)` + `worker-src blob:`, инъекция хэшированных URI воркеров через `window.__MONACO_WORKERS__`).

**Переиспользуется как есть (не переписывать):** `editorActions.openTab`/`openCodeTab`/`replaceSchema`/`markSaved`/`commitSaved`, `editorStore.subscribe`, `R.activeTab`, `ensureSchema`/`isFormSchema`/`emptySchema`, `serializeSchema` (чистая функция), echo-guard-паттерн `SchemaCodeEditor` (переезжает в `SchemaSyncBridge`, логика та же).

## Разрешение пересечений (из синтеза)

- `WorkspacePort` поглощает `WorkspaceHost.readFile/writeFile` (это методы выданного `FileSystemPort`).
- `ExporterPort` — единственная операция «сохранить как»; `DocumentHost.export()` делегирует ему.
- `HostShell` — авторитет для UI-портов; grubой `HostPort` из bootstrap-оси отвечает только за композицию.
- Убрать `TabSource.handle` — общая правка осей io и document (Фаза 1), не конфликт.

## Риски и стратегия тестирования

| Риск | Как снимаем |
|---|---|
| **CSP / Monaco воркеры** (cross-origin/blob Worker блокируется) | `initMonaco(host.worker)` после `initHost()`; PoC без Monaco, затем blob-URL-shim под `worker-src 'self' blob:` |
| **Дедуп синглтонов** (2-я копия React/Radix/signals ломает `instanceof Signal`) | пакет не выделяем (внутри projects/); `vite.config.webview.ts` копирует `resolve.dedupe`; smoke `instanceof Signal` + Radix Dialog |
| **Эхо-петля синка** | `SchemaSyncBridge` с revision-token; host-guard `editFromWebview`+`lastSentText`; юнит-тест на in-memory `SchemaDocument` |
| **Невалидный JSON** | `isFormSchema`-guard не коммитит; webview ставит визуальный редактор на паузу с баннером, не пишет `edit` |
| **Дрейф форматирования** | канон в `SchemaDocument` (Фаза 0); round-trip тест open→save без правок = 0 изменений |
| **Конфликт хоткеев** | `ownsGlobalKeybindings=false` в webview → global-хорды через `contributes.keybindings` с `when`-clause; webview слушает `scope:'canvas'` |
| **Контракт `lastModified`** | в порту — монотонное число только для сравнения (не абсолютное время) |
| **Мерцание темы** | `ThemePort` резолвит режим синхронно из `body.vscode-dark` до первого пейнта |
| **Регресс GH Pages** | `main.tsx`-путь эквивалентен по монтированию; полный прогон e2e (POM `CreditFormPage`, 9 spec) на каждой фазе; проверка `BUILDER_BASE` |

**По средам:** browser — существующие e2e как регресс-гейт на каждой фазе (browser-адаптер = строгий перенос);
in-memory — новый слой юнит-тестов (discovery/save/rename/echo-loop без DOM); vscode — интеграционный тест в
реальном webview на CSP-воркеры и форвардинг хоткеев (Фаза 5).

## Верификация (end-to-end)

- **После каждой фазы 0–4:** `cd projects/react-playground-e2e && npx playwright test` (POM `CreditFormPage`, 9 spec) — браузерный билдер работает без регресса; `npm run build:builder` с `BUILDER_BASE=/ReFormer/builder/` собирается; ручная проверка Mode A (export) + Mode B (открыть папку, save с diff-модалкой).
- **Новые in-memory юнит-тесты (Фаза 2+):** discovery-обход, конфликт `lastModified`, rename→read по новому пути, echo-loop bridge — все без Chromium.
- **Фаза 5 (VSCode):** в `projects/reformer-vscode` — `npm run build` (webview-бандл → `media/` + esbuild extension), **F5** → Extension Development Host → открыть `sample.form.json`: (1) открывается визуальным билдером; (2) правка в canvas → dirty → ⌘S пишет валидный JSON; (3) ручная правка текста файла → билдер подхватывает; (4) VSCode Undo откатывает и прилетает в webview; (5) невалидный JSON → баннер-пауза без падения; (6) idle round-trip без спонтанного diff.
