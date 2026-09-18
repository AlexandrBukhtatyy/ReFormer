# Builder: `src/lib` → пакеты стека, оболочка без знания о стеке, второй стек как доказательство

Разбор сделан против ветки `develop`, `projects/reformer-builder`, по состоянию на 2026‑09‑18.
Предшественник — `docs/plans/builder-v4-plugin-platform-plan.md` (фазы 0–10 закрыты); этот план
продолжает его по новой оси.

## Контекст

Владелец хочет, чтобы билдер работал не только с ReFormer: другой ui‑kit с рендерером ReFormer
и другой ui‑kit с ДРУГИМ способом отрисовки (и другим форматом схемы) — наборами плагинов.
Решения владельца (2026‑09‑18): единица замены — **стек** (схема + редактор + превью + кодоген +
валидатор + инструменты ассистента); общий код стека — **workspace‑пакеты в `packages/`**;
оболочка **оставляет ReFormer как собственную UI‑технологию** (chrome на `@reformer/ui-kit`,
форма настроек плагинов на `renderer-json`), но перестаёт импортировать предметный код;
объём первого шага — **раскол плюс минимальный второй стек**.

Что показал разбор:

- `src/lib` (7 модулей: `form-model`, `catalog`, `kits`, `codegen`, `form-mock`, `form-fixture`,
  `form-inspect`) объявлен в `docs/project-structure.md:146` как «общие чистые библиотеки
  (домен ReFormer)». Критерий раскладки в проекте — «чистое/без состояния → lib, состояние →
  плагин + сервис», а не «ReFormer / не ReFormer». Плагины не импортируют друг друга (eslint),
  поэтому общий чистый код семи плагинов сегодня может лежать ТОЛЬКО в `lib/`.
- Завязка `lib/` на экосистему узкая по пакетам и глубокая по семантике: `@reformer/renderer-json`
  (`JsonFormSchema`, операторы `$component/$model/$html/$dataSource`, guards) — в 128 импортах
  вне `lib`; типы `PropsSchema` из `@reformer/ui-kit/meta`; `@reformer/core` в `form-inspect`;
  два глубоких импорта `@reformer/mcp/dist/core/generate/*` (`form-model/rules.ts`,
  `codegen/emit/rules-bridge.ts`). `renderer-react` и `cdk` в `lib/` не импортируются.
- Стек ReFormer — семь плагинов из одиннадцати: `editor-schema` (51 файл на `form-model`), `ai`
  (38), `preview`, `codegen`, `templates`, `validator-schema`, `kits`. Нейтральны: `files`,
  `editor-monaco`, `editor-markdown`, `plugin-manager`.
- Платформа модели не знает (`DocumentModelProvider<unknown>`), `shell/platform` не импортирует
  `lib/` ни разу. Но `shell/boot` знает стек: порты `ports/schema.ts`, `ports/preview.ts`,
  `ports/live-surface.ts`, `ports/kit-namespace.ts` типизированы `CatalogEntry`/`KitDescriptor`/
  `JsonFormSchema`; `ports/monaco.ts` зовёт `indexNodePaths` из `form-model`; `boot.ts:156`
  импортирует значение `PreviewSessionsCapability` из плагина превью;
  `settings/PluginSettingsForm.tsx` и `settings/chrome-registry.tsx` берут `form-mock` и
  `form-model/query`.
- Точки подмены уже есть: `document.model`, `validator`, `codegen.target` (структурная копия в
  плагине), `preview.surface` (структурная копия в `plugins/preview/contract.ts`, в SDK не
  вынесена «до второго поставщика поверхностей» — он появляется здесь), профили с `extends`
  и `providers`, возможности с версиями.
- Внешние npm‑плагины `@/lib` не видят вовсе (его нет в линковщике `shell/boot/plugin-modules.ts`
  и в `PLUGIN_RUNTIME_MODULES`). `projects/react-playground` импортирует `lib/*` по алиасу
  `@builder-src` на физический путь (`tsconfig.app.json:32,47-49`).
- Сценарий «другой ui‑kit с рендерером ReFormer» уже спроектирован (дескриптор кита v2,
  контракт каталога 2.0, `KitSource`, кит HexaUI в `packages/ui-kits/reformer-hexa-ui`, эпик
  ReFormer‑s0j 8/21). Его долги (захардкоженные дефолты ReFormer‑кита в `make-node`,
  `form-mock`, `legacy-reformer-ui-kit`) — не предмет этого плана, см. «Не входит».

## Целевая архитектура

```text
packages/
  reformer-builder-plugin-api/        контракт (как сейчас) + PreviewSurfacePoint, shell.models, shell.modules
  reformer-builder-toolkit/           НЕЙТРАЛЬНОЕ ядро для любого стека: paths (JSON Pointer, updateAt),
                                      node-id, node-token (rbnode-*), naming, printer (Eta, marker,
                                      template-file), sandbox (ambient fetch/Date/Math, deepMerge)
  reformer-builder-stack-reformer/    СТЕК ReFormer: form-model, catalog, kits, form-mock, form-fixture,
                                      form-inspect, codegen (+ .eta), общие токены стека (KitsServiceToken…)
  reformer-builder-stack-plain/       ДЕМО‑СТЕК: схема {fields:[…]}, parse/print/ops, defaults, печать Form.tsx

projects/reformer-builder/src/
  shell/         не импортирует @reformer/builder-stack-* (линтер + храповик); свои формы настроек
                 рисует renderer-json — это UI‑технология билдера, а не редактируемый домен
  plugins/       нейтральные: files, editor-monaco, editor-markdown, plugin-manager, preview (ХОСТ)
                 стек reformer: kits, validator-schema, editor-schema, preview-runtime, ai, codegen, templates
                 стек plain:    plain
  application/   профили: builder.base → reformer.builder (= base + стек reformer), plain.builder,
                 minimal, ai-builder
  lib/           УДАЛЁН
```

Принципы, по которым режется:

1. Ось «стек» добавляется к оси «чистое/состояние», а не заменяет её: чистое общее для стека —
   в пакете стека; состояние — по‑прежнему в плагине и через сервис.
2. Общие ТОКЕНЫ стека (`KitsServiceToken`, capability живого вида, точка целей кодогена) живут в
   пакете стека: два плагина одного стека импортируют один пакет, а не друг друга.
3. Что нужно ДВУМ стекам, идёт в toolkit; что нужно одному — остаётся в его пакете. Каталог и
   киты остаются в стеке ReFormer: у демо‑стека китов нет, и «на будущее» их не выносим.
4. Оболочка отдаёт стеку недостающее ВОЗМОЖНОСТЯМИ (`shell.models`, `shell.modules`), а не
   портами, собранными в `boot` — иначе `boot` собирает порты для всех стеков сразу
   (то самое «названо незакрытым» из v4, Ф2).
5. Идентификаторы плагинов и служб не переименовываются (persisted‑ключи); новые сущности
   получают новые имена.

Имена пакетов — предложение, владелец может переименовать до Ф1:
`@reformer/builder-toolkit`, `@reformer/builder-stack-reformer`, `@reformer/builder-stack-plain`.

## Фазы

```text
Ф1 Пакеты и переезд lib ─► Ф2 Стек как единица состава (профили, раскол превью, точка поверхностей в SDK)
                                   └─► Ф3 Оболочка без стека (порты → возможности) ─► Ф4 Демо‑стек plain ─► Ф5 Доки, beads
```

Каждая фаза заканчивается зелёными `tsc -b`, `eslint`, `vitest` (node + browser) и живым dev‑сервером;
проверки — только из каталога пакета/проекта (корневой `tsc -b` эмитит `.js`).

### Ф1. Пакеты и переезд `src/lib` (~1.5 недели)

1. **Два пакета по образцу `packages/reformer-builder-plugin-api`**: `package.json` (`type: module`,
   `exports` с `types`/`import`, `sideEffects: false`, `files: dist`), `vite.config.ts` (lib‑сборка,
   `vite-plugin-dts`, `external` — предикат по regex: `react`, `@reformer/*`, `eta`, `ajv`),
   `tsconfig.json`, `vitest.config.ts`, `.releaserc.json` (`tagFormat: builder-toolkit-v…` /
   `builder-stack-reformer-v…`). Шаблоны `.eta` едут в пакет стека и импортируются `?raw`, как
   сейчас в `lib/codegen/templates/index.ts`; в `dts` для них нужна декларация модуля `*.eta?raw`.
2. **Раскладка toolkit** (только то, что стек‑нейтрально И понадобится демо‑стеку/оболочке):
   `paths/` ← `lib/form-model/paths.ts`; `node-id/` ← `node-id.ts` (обобщить тип узла до
   `Record<string, unknown>`, ключ `$nodeId` — параметр); `node-token/` ← `node-token.ts`;
   `naming/` ← `form-model/naming.ts` + `codegen/naming.ts`; `printer/` ← `codegen/render.ts`,
   `template-file.ts`, `marker.ts`; `sandbox/` ← `form-fixture/ambient.ts`, `merge.ts`
   (`deepMerge`), путевые помощники из `form-fixture/paths.ts`. Тесты едут вместе.
3. **Раскладка stack-reformer** — остальное `lib/` под теми же подкаталогами (`form-model/`,
   `catalog/`, `kits/`, `form-mock/`, `form-fixture/`, `form-inspect/`, `codegen/`), импорты
   на toolkit там, где модуль уехал. Вход `.` — курируемый список (сегодняшние публичные
   символы, у `lib/` не было барелей — потребители импортировали пофайлово; сохранить подпути
   через `exports` `./form-model`, `./catalog`, … чтобы переезд был заменой префикса
   `@/lib/` → `@reformer/builder-stack-reformer/`). Вход `./testing` — фикстуры
   (`sample-schema`, `builtin-catalog`, `codegen/__fixtures__/kit`), которые тянут тесты билдера.
4. **Билдер резолвит оба пакета в исходники** — те же три конфига и `tsconfig.app.json`, что у
   plugin-api (`vite.config.ts:184-191`, `vitest.config.ts:27-34`, `vitest.browser.config.ts:53-60`,
   `tsconfig.app.json:33-36`); подпути перед корнем. `devDependencies` билдера: `"*"`.
5. **Codemod переезда** (ts-morph, скрипт в `.tmp/reorg/`, как при модуляризации core):
   `@/lib/<mod>/<file>` → `@reformer/builder-stack-reformer/<mod>` либо `@reformer/builder-toolkit/<mod>`
   по таблице. Затрагивает ~180 файлов в `plugins/**`, `shell/boot/**` (тесты и порты),
   `react-playground/src/pages/debug/ui_builder/*` (алиас `@builder-src/lib/*` → пакеты;
   `@builder-src/shell/platform/modules/*` не трогаем — вне темы).
6. **Линтер** (`projects/reformer-builder/eslint.config.js`): удалить зону `src/lib/**` и
   `denyFromLib`; в шапке — новая таблица слоёв. Запреты для `shell/**` на стек — в Ф3.
7. **Линковщик**: `shell/boot/plugin-modules.ts` BUILTINS + `PLUGIN_RUNTIME_MODULES`
   (`packages/reformer-builder-plugin-api/src/plugin/runtime-modules.ts`) получают
   `@reformer/builder-toolkit` и `@reformer/builder-stack-reformer` (+ подпути `exports`) —
   иначе внешний плагин стека ReFormer не соберётся CLI (`build` отказывает по `@reformer/*`
   вне списка). Тест сверки списков уже есть.
8. **CI и выпуск**: `.github/workflows/test.yml` (сборка и тесты пакетов ДО билдера, порядок:
   toolkit → stack-reformer → builder), `release.yml` (оба списка), `align-versions.yml`;
   `commitlint.config.js` scope‑enum: `reformer-builder-toolkit`, `reformer-builder-stack-reformer`,
   `reformer-builder-stack-plain`; `scripts/check-dist-deps.mjs` — убедиться, что новые пакеты
   проходят проверку «dist ↔ manifest».
9. **`src/lib` удалён.** `structure.test.ts` — пороги пересчитать (счёт каталогов ≥40 и модулей
   ≥300 после переезда: проверить, что «проверка не пуста» остаётся истинной).

Критерии: `grep -r "@/lib" projects/reformer-builder/src` пуст; состав чанков `vite build`
совпадает с состоянием до фазы (список файлов `dist/assets` до/после); все тесты зелёные в трёх
местах (два пакета, билдер); playground компилируется.

**Сделано 2026‑09‑18.** Переезд — кодмодом на TypeScript Compiler API (`.tmp/stack-split/codemod.mjs`):
для каждого имени, импортированного из `lib`, он шёл по цепочке реэкспортов до последнего файла
`lib` и по нему выбирал модуль пакета; 388 объявлений в 189 файлах, ни одного нерешённого имени.
Потребители импортируют по модулю (`/form-model`, `/catalog`, …), а не по файлу. Отступления:

- **toolkit меньше задуманного**: печать (`render`), маркер и имена. JSON‑адресация, `node-id`,
  `node-token` и песочница фикстур остались в стеке — по правилу самого плана («нужно двум
  стекам»): второму стеку они не нужны, `node-id` типизирован схемой ReFormer, а тест путей
  держится на фикстуре схемы ReFormer.
- **Линковщик и `PLUGIN_RUNTIME_MODULES` не тронуты (п. 7).** Статическая регистрация втянула бы
  стек в стартовый граф оболочки — ровно то, что снимает Ф3. Внешние плагины `@/lib` и раньше
  не видели, так что ничего не потеряно; правильный путь — разрешить CLI вкладывать чистые
  пакеты стеков в сборку плагина (токены ключуются по `id`, второй экземпляр функций безвреден).
  Заведено задачей.
- Пакет стека видит toolkit через `dist`, как все пакеты монорепо (путь к исходникам ломал
  `rootDir` при выпуске деклараций); CI собирает toolkit раньше.
- Барель кодогена больше не реэкспортирует печать и маркер: у имени один адрес.

Состав чанков тот же; общие чанки бывшего `lib` называются по пакету (`vendor/reformer-builder-*`),
стартовый чанк +105 байт.

### Ф2. Стек как единица состава (~1.5 недели)

1. **Точка поверхностей превью → SDK** (закрывает отложенный п. 6 Ф0 плана v4):
   `PreviewSurfacePoint`, `PreviewSurface`, `PreviewCapabilities`, `PreviewProblem`, `PreviewContext`
   переезжают в `@reformer/builder-plugin-api`; `PreviewContext` обобщается —
   `model(): unknown | null` и `providerId` вместо `schema(): JsonFormSchema | null`,
   `mock(): unknown | null`. Поверхность стека сужает тип по `providerId` (тот же приём, что у
   `SchemaEditorHost.modelOf` в `shell/boot/ports/schema.ts`). `plugins/preview/contract.ts`
   реэкспортирует из SDK, как обещано в его шапке.
2. **Раскол плагина превью**: `reformer.preview` остаётся ХОСТОМ (панель, выбор поверхности
   `surface/selection.ts`, состояния `state/`, контекст `surface/context.ts`, диагностики,
   переключатель) и уходит в `builder.base`; новый плагин стека `reformer.preview-runtime`
   (`plugins/preview-runtime/`) вносит поверхности `runtime/` и `compiling/`, панель модели
   (`ui/ModelPanel.tsx`, `form-inspect`), `schema/annotate.ts`, `runtime/mock.ts`. Идентификатор
   хоста не меняется — на нём висят ключи настроек и панелей. `titleKey` поверхности
   разрешается в пространстве имён ВНЁСШЕГО плагина (замечание из `contract.ts`) —
   поправить в переключателе.
3. **Мост живого вида → плагин‑хост превью**: `shell/boot/ports/live-surface.ts` целиком
   переезжает в `plugins/preview` как реализация возможности `reformer.preview.live`
   (`LivePreviewPort` из `plugins/editor-schema/host.ts` становится её типом, объявленным в
   пакете стека). Редактор схемы берёт её `ctx.capabilities.get(...)`, деградация без превью —
   как сегодня (`live?` необязателен). `boot.ts:156` перестаёт импортировать
   `PreviewSessionsCapability`.
4. **Профили** (`application/profiles/`): `builder.base` = `reformer.files`, `reformer.editor-monaco`,
   `reformer.editor-markdown`, `reformer.plugin-manager`, `reformer.preview`;
   `reformer.builder` = `extends: builder.base` + `reformer.kits`, `reformer.validator-schema`,
   `reformer.editor-schema`, `reformer.preview-runtime`, `reformer.ai`, `reformer.codegen`,
   `reformer.templates`. `minimal`/`ai-builder` — без изменений. Тест состава
   (`composer/builtin-plugins.test.ts`, `profile.test.ts`) — поимённые списки обновить.
5. **Манифесты**: `preview-runtime/manifest.json` (`lazy`, `requires: reformer.kit.catalog` optional,
   `provides` — нет); у `preview` `provides: reformer.preview.live 1.0.0`, `reformer.preview.sessions`.
6. **Порт `PreviewHost`** в Ф2 ещё собирается в `boot` и передаётся `preview-runtime` (типы стека
   в `shell/boot` пока допустимы) — снимается в Ф3.

Критерии: `builder.base` поднимается, панель превью для формы говорит «нечем показать» словами;
`reformer.builder` не отличим от сегодняшнего: browser‑тесты `SchemaEditor.browser`, `schema-keys`,
`markdown-view`, `surfaces.browser` зелёные; состав чанков не изменился, кроме появления файла
`preview-runtime`.

**Сделано 2026‑09‑18.** Отступления и добавления названы:

- **Панели превью к этому времени уже не было**: форма — представление редактора схемы (живой
  вид). Поэтому хост превью — это правило выбора, состояния, выделение, находки и возможность
  живого вида, а не панель; критерий «панель говорит словами» проверен иначе — живой вид основы
  отвечает «показывать нечем» (`shell/boot/integration/base-profile`).
- **`DocumentRef.providerId`** — добавлено в SDK сверх плана: без него поверхность и валидатор
  стека ReFormer брались бы за `.json` другого стека. Модельные документы платформы несут поле
  сами; валидатор схемы и поверхности узнают свой документ по `form.schema`
  (`isFormSchemaDocument` в пакете стека) — медиатипная проверка снята, как и обещала её шапка.
- **Возможность `reformer.preview.sessions` снята**: её единственным внешним потребителем был
  мост в `boot`, уехавший в плагин. Опубликованную форму панель модели читает через
  `PreviewLiveService.formOf` — реестр состояний остался внутренним делом хоста.
- **`PreviewSurface.title()` вместо `titleKey`**: имя переводит внёсший плагин — ключ разрешался
  в словаре хоста, которому чужие строки не принадлежат.
- **Оба плагина превью ленивые**: довод статичности хоста (порт живого вида собирала композиция
  из его функций) снят вместе с мостом. Стартовый чанк −35 КБ.
- **Порт превью пока один на двоих** (`BuiltinPluginsOptions.preview`): хост берёт из него адрес
  документа и права источника (`PreviewHostPort`), поверхности — остальное. Снимается в Ф3.
- Фабрика контекста поверхности над буфером (`createPreviewContext`) удалена: после ухода панели
  её звал только её тест.

### Ф3. Оболочка не знает стека (~2–3 недели, самая тяжёлая)

Цель: `BuiltinPluginsOptions` = `{ files, monaco, markdown }`; в `src/shell/**` нет ни одного
импорта `@reformer/builder-stack-*` и ни одного импорта плагинов стека.

1. **Возможность оболочки `shell.models`** (токен в SDK, провайдер — `platform/services/host-capabilities`):
   `handleOf(id): ModelDocumentHandle<unknown> | null` (`providerId`, `getModel`, `getSyncState`,
   `apply`, `flush`, `onDidChange`), `onDidChangeHandles`. Тип — `shell/platform/workspace/model/model-document.ts:145`
   с `M = unknown`. Это «`reformer.workspace.models`» из Ф5 плана v4, шаги 7 и 9, — не сделанные.
2. **Возможность оболочки `shell.modules`** — загрузчик модулей с прогретым компилятором
   (`PreviewModules` из `plugins/preview/host.ts` = `ModuleLoader` + `PrimedCompile`). Провайдер —
   оболочка. Закрывает п. 10 из §1.2 плана v4 («компилирующая поверхность недоступна внешним»).
3. **`WorkspaceFilesService.capabilities()`** → `{ write, executesCode }` (сегодня `executesCode`
   читается только портом превью через `sourceOf`).
4. **Monaco `locateNodes`**: `DocumentModelProvider` в SDK получает необязательный
   `nodePaths?(model: M): ReadonlyMap<string, readonly (string | number)[]>`; провайдер `form.schema`
   реализует его через `indexNodePaths`; порт Monaco (`ports/monaco.ts`) берёт ручку из
   `shell.models` и зовёт `provider.nodePaths` — импорт `form-model` из оболочки исчезает.
   Кэш по модели (`WeakMap`) переезжает к провайдеру.
5. **Порт редактора схемы удаляется**: `modelOf` → `shell.models`; `catalog/categoryOrder/onCatalogChange`
   → `KitsServiceToken` из пакета стека напрямую; `live` → `reformer.preview.live` (Ф2);
   `useTranslate/useDiagnosticMessage/useQuickFixTitle` → `ctx.i18n` и `useTranslate` из SDK
   (уже есть с Ф5 v4). `createSchemaHost`, `SchemaHostDeps` — удалить.
6. **Порт превью удаляется**: `documentOf/useActiveDocument` → `shell.documents`; `siblings/readText`
   → `shell.workspaceFiles`; `sourceOf` → п. 3; `modules` → п. 2; `catalog/kit/onDidChangeKit` →
   `KitsServiceToken`; **`kitNamespace`** — загрузчик `ports/kit-namespace.ts` переезжает в плагин
   китов: `KitSource.namespace?: () => Promise<KitNamespace>` (встроенный кит грузит
   `@reformer/ui-kit` лениво сам), `KitsService` получает `namespace()` и `onDidLoadNamespace`.
   `createPreviewHost`, `PreviewHostDeps` — удалить.
7. **Настройки плагинов в оболочке**: `settings/PluginSettingsForm.tsx` и `settings/chrome-registry.tsx`
   получают локальный `settings/initial-values.ts` (обход `$model`/операторов через `parseOperator`
   из `renderer-json`, ~40 строк) вместо `form-mock`/`form-model/query`. Дублирование с
   `form-mock` принимается сознательно и записывается в decisions-log: форма настроек — UI
   билдера, а не редактируемый домен; `renderer-json` здесь — та же «своя технология», что
   `@reformer/ui-kit` в chrome (решение s0j §3.3).
8. **Карта состава** (`application/composer/builtin-plugins.ts`): записи стека теряют `options.*`;
   `BuiltinPluginsOptions` и `composition.ts` — только `files`, `monaco`, `markdown`. Причины
   `eager` у `kits`/`preview` пересмотреть: порты, ради которых они статичны, исчезли — измерить,
   можно ли `lazy` (ReFormer‑29kx.23).
9. **Граница — тестом и линтером**: в `eslint.config.js` зона `src/shell/**` получает запрет
   `@reformer/builder-stack-*`; храповик в `application/composer/builtin-plugins.test.ts`:
   «`src/shell/**` не импортирует плагины, которых нет в `builder.base`» (список выводится из
   профилей, не пишется руками), проверен мутацией — как храповик стартового графа.

Критерии: `grep -rE "builder-stack-|@/plugins/(kits|editor-schema|preview-runtime|validator-schema|ai|codegen|templates)" src/shell` — только в `shell/boot/integration/**`;
профиль `builder.base` не тянет в entry ни одного файла стека (сверка чанков); `reformer.builder`
проходит те же browser‑тесты, что в Ф2; интеграционные тесты `capability-requires`,
`host-capabilities` расширены на `shell.models` и `shell.modules`.

### Ф4. Демо‑стек `plain` (~1 неделя)

Смысл — доказать швы, а не сделать продукт: другой формат схемы, другой рендер, свой экспорт,
ни одного импорта `@reformer/renderer-json` и `@reformer/core`.

1. **`packages/reformer-builder-stack-plain`** (`private: true`, не публикуется, в release не
   входит; в `test.yml` — сборка и тесты): `schema.ts` — `PlainForm { $schema: 'plain-form/1',
   fields: PlainField[] }`, `PlainField { name, label, type: 'text'|'number'|'checkbox'|'select', options? }`;
   `parse.ts` (`isPlainForm`, `parse`, `print`); `ops.ts` (`EditOp` → добавить/удалить/переименовать поле);
   `defaults.ts` (начальные значения); `print-form.ts` (печать `Form.tsx` на нативных `<input>`
   через `@reformer/builder-toolkit/printer` и один `.eta`). Не больше шести модулей.
2. **`plugins/plain/`** (id `reformer.plain`, `lazy`, `permissions: ["workspace.save"]`) вносит:
   провайдер `document.model` с `id: 'plain.form'` (`applies` — по `peek` на `"$schema": "plain-form/1"`);
   поверхность `preview.surface` `plain.native` (React‑корень с нативными полями,
   `interactive: true`, `hitTest: false`, `dragSource: false`, `executesCode: false`, `sameRealm: true`);
   вклад в `ValidatorPoint` (пустое имя, дубликат имени поля); команды `plain.new` (создать
   `contact.plain.json` из заготовки) и `plain.export` (записать `Form.tsx` рядом через
   `WorkspaceSaveCapability`); словари ru/en.
3. **Профиль** `plain.builder` = `extends: builder.base` + `reformer.plain`; выбирается конфигом
   запуска `"preset": "plain.builder"` (`applicationFromRuntime`, `application/builder-application.ts:40`).
4. **Тесты**: юниты пакета; `shell/boot/integration/plain-profile.test.ts` — профиль разрешается,
   провайдер/поверхность/валидатор зарегистрированы, `builder.base` без `plain` открывает
   `.plain.json` текстом; проверка `package.json` пакета — в `dependencies` нет `@reformer/renderer-json`,
   `@reformer/core`, `@reformer/builder-stack-reformer`; browser‑тест
   `plugins/plain/plain.browser.test.tsx` — открыть документ, панель превью показывает нативные
   поля, ввод меняет значения, валидатор подчёркивает дубликат.

Критерии: `npm run dev` с `preset: plain.builder` — создать форму командой, увидеть превью,
экспортировать `Form.tsx`; скриншоты в `projects/react-playground-e2e/screenshots/stack-split/plain/`.

### Ф5. Документация и учёт (~3 дня)

- `projects/reformer-builder/docs/project-structure.md`: таблица слоёв (`lib/` → пакеты, ось
  «стек»), §«Библиотека и плагин — не одно и то же» (дополнить: общее для стека — пакет стека,
  общее для стеков — toolkit), §«Раскладка», §«Как проверяется», §«Что переезжало» (справка).
- `docs/plugin-and-shell.md`: §«Возможности ОБОЛОЧКИ» (+ `shell.models`, `shell.modules`),
  контракт поверхности превью — теперь в SDK; README трёх пакетов; README plugin-api — новые
  модули линковщика.
- `docs/decisions-log.md`: запись «ось стека», решение про формы настроек на `renderer-json`,
  отказ выносить каталог/киты в toolkit.
- `docs/plans/builder-v4-plugin-platform-plan.md`: пометки «Сделано» у Ф0 п. 6 и §1.2 п. 10.
- beads: эпик «Builder: стеки», задачи по фазам; follow‑ups из раздела ниже.

## Не входит (заводится задачами)

- Дефолты ReFormer‑кита, зашитые в код стека: `COMPOUND_TEMPLATES` и `LEAF_COMPONENT_NAMES`
  (`catalog/make-node`, `kits/legacy-reformer-ui-kit`), множества `FILE/MULTI/BOOLEAN_COMPONENTS`
  и ветка `Slider` в `form-mock` (с чужим китом ломается молча — все поля получают `''`),
  `DEFAULT_CATEGORY_ORDER`, оверрайды виджетов по имени пропа в `catalog/widgets`. Место —
  дескриптор кита; относится к эпику ReFormer‑s0j.
- Раскол кодогена на нейтральный хост (доставка, eject, пользовательские цели) и печатник стека;
  ассистент как нейтральный хост с инструментами стека. В этом плане оба — плагины стека ReFormer.
- Типы `PropsSchema/PropDoc/PropWidget` — владение контрактом каталога у билдера, а не у
  `@reformer/ui-kit/meta` (сегодня импорт только типов, переезд не блокирует).
- Глубокие импорты `@reformer/mcp/dist/core/generate/*` — вынести в объявленные подпути
  `exports` пакета mcp.
- Киты как вклады в точку расширения (`kits.source`) вместо `options.sources` — ReFormer‑s0j.16.
- Установка стека как набора плагинов из npm одним действием (мета‑пакет/пресет) — поверх Ф9–Ф10 v4.
- `react-playground` продолжает брать `shell/platform/modules/*` по алиасу — отдельная тема.

## Верификация

1. Пакеты (из каталога каждого): `npx tsc -b`, `npm test`, `npm run build`; `dist` содержит
   объявленные `exports`.
2. Билдер (`cd projects/reformer-builder`): `npm run lint`, `npm test`, `npm run test:browser`,
   `npm run build`; сравнить список `dist/assets/*.js` с сохранённым до Ф1 (ожидаемые отличия:
   `preview-runtime`, `plain`).
3. Храповики: мутационная проверка каждого нового запрета — внести нарушение, увидеть отказ,
   убрать (`eslint` через stdin, как в шапке `eslint.config.js`; тест состава — подложенный импорт).
4. Живой прогон: `npm run dev` в трёх профилях (`.ui_builder/config.json` → `preset`):
   `reformer.builder` — открыть форму примера, палитра/превью/экспорт как раньше;
   `builder.base` — форма открывается текстом, превью говорит «нечем показать»;
   `plain.builder` — сценарий Ф4. Скриншоты — `projects/react-playground-e2e/screenshots/stack-split/<profile>/`.
5. CLI: `reformer-plugin build` на шаблонном плагине с импортом `@reformer/builder-stack-reformer/form-model`
   собирается (externals из обновлённого списка), «сухая» активация проходит.
6. Playground: `cd projects/react-playground && npx tsc -b` — страница `debug/ui_builder`
   компилируется против пакетов.

## Открытые вопросы (не блокируют; выбраны умолчания)

1. Имена пакетов — умолчания выше; переименование до Ф1 бесплатно, после — миграция импортов.
2. Публиковать ли `@reformer/builder-stack-plain` — умолчание: нет (`private`), это демо и фикстура тестов.
3. Идентификатор плагина стека‑превью — `reformer.preview-runtime`; хост сохраняет `reformer.preview`,
   чтобы не мигрировать ключи настроек и панелей.
