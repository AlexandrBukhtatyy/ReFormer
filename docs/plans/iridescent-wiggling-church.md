# Проброс runtime-конфигурации UI-Builder при локальном старте

## Context

Билдер (`projects/reformer-builder`, пакет `@reformer/builder`) сегодня — **prebuilt SPA**, который раздаётся zero-dependency launcher'ом [bin/reformer-builder.mjs](../../projects/reformer-builder/bin/reformer-builder.mjs). Каталог компонентов **вшивается в бандл на этапе сборки** через `import uiKitCatalog from '@reformer/ui-kit/catalog'` в [contract.ts:19](../../projects/reformer-builder/src/catalog/contract.ts#L19). Runtime-конфигурации у билдера **нет вообще**: bootstrap синхронный ([main.tsx](../../projects/reformer-builder/src/main.tsx)), а всё поведение (категории палитры, порядок разделов, дефолты UI, discovery проекта, seed-схема, брендинг) захардкожено в разных местах.

Нужно: клиент, запуская билдер локально (`npx reformer-builder`), передаёт **2 JSON-файла** — (1) каталог компонентов (формат уже существует — контракт `component-catalog.schema.json`), (2) конфиг UI-Builder (новый). Билдер должен подхватить их **в рантайме, без пересборки**.

**Решения (согласованы с пользователем):**
- **Доставка** — CLI-флаги launcher'а `--catalog <path>` / `--config <path>` (+ авто-подхват одноимённых файлов из cwd, если флаги не заданы).
- **Область конфига** — всё: палитра, доступные компоненты, дефолты UI + брендинг, работа с проектом.
- **Отсутствие файла** — fallback на встроенные (файлы опциональны; билдер всегда стартует и без них работает как сейчас).

**Итог:** launcher читает файлы с диска и отдаёт их SPA по фиксированному URL; SPA на бутстрапе их фетчит, валидирует и применяет; при отсутствии — работает на вшитых дефолтах.

---

## Архитектура механизма

```
npx reformer-builder --catalog c.json --config b.json
  └─ bin: читает файлы → держит в памяти → отдаёт GET /__reformer-builder/runtime.json = { catalog, config }
       │
       ▼ (браузер)
  main.tsx (async boot):
    1) fetch(BASE_URL + '__reformer-builder/runtime.json')   // 404/нет launcher → {} → fallback
    2) validate: catalog → validateCatalog() (уже есть, AJV); config → новый runtime-config.schema.json (AJV)
       └─ невалидно → экран BootError (fail visible); отсутствует → тихий fallback
    3) set module-state: clientCatalog + activeConfig
    4) DYNAMIC import ./App  ← store и catalog init происходят ПОСЛЕ шага 3
```

**Ключевой риск (учтён):** `editorStore = createStore(R.initialState())` в [editor-store.ts:15](../../projects/reformer-builder/src/store/editor-store.ts#L15) исполняется на импорте модуля, `getCatalog()` мемоизируется при первом вызове ([index.ts:22](../../projects/reformer-builder/src/catalog/index.ts#L22)). Поэтому `App` (и весь граф `store`/`catalog`) **обязан импортироваться динамически после** установки конфига — иначе `initialUi()`/каталог прочитают дефолты. Статические импорты хойстятся, поэтому именно `await import('./App')`.

---

## Новый слой `src/config/`

| Файл | Содержимое |
|---|---|
| `types.ts` | `RuntimeConfig` — все секции опциональны (`palette?`, `components?`, `ui?`, `project?`, `branding?`, `version?`). |
| `runtime-config.schema.json` | JSON Schema draft-07 контракта конфига (владелец — билдер, как `component-catalog.schema.json`). `resolveJsonModule` уже включён. |
| `state.ts` | Module-level `activeConfig: RuntimeConfig` (деф. `{}`) + `clientCatalog: CatalogJson \| null`; геттеры `getRuntimeConfig()`/`getClientCatalog()` + сеттеры. Лист графа зависимостей (без импортов store/catalog). |
| `load.ts` | `loadRuntimeBundle()`: fetch runtime.json (не-OK/не-JSON → `{ catalog:null, config:null }`); валидация config (AJV по схеме) + catalog (реюз `validateCatalog` из `contract.ts`); **throw** при невалидном → BootError. Ставит `state`. |
| `boot.ts` | `bootRuntime()` — оркестратор для `main.tsx`; применяет `document.title` из `branding.title`. |
| `BootError.tsx` | Минимальный экран ошибки (список ошибок валидатора), рендерится вместо `App`. |

**Семантика merge** (документируется в схеме): карты (`palette.categoryByName`, `palette.glyphs`) и списки-безопасных-дефолтов (`project.ignoreDirs`, `project.skipFiles`, `project.formSchemaMarkers`) — **объединяются** с дефолтами (клиент расширяет); `palette.order`, `palette.collapsedByDefault`, `components.include/exclude`, `ui.*`, `branding.*`, `project.seedSchema` — **замещают** дефолт при наличии. Пустой/отсутствующий конфиг ⇒ поведение 1:1 как сейчас.

### Пример `reformer-builder.config.json`
```json
{
  "$schema": "./node_modules/@reformer/builder/runtime-config.schema.json",
  "version": "1.0",
  "branding": { "productName": "Acme Builder", "title": "Acme Forms", "logoUrl": "data:image/svg+xml;..." },
  "palette": {
    "categoryByName": { "AcmeRating": "Поля ввода" },
    "order": ["Поля ввода", "Выбор и переключатели", "Контейнеры", "Действия"],
    "collapsedByDefault": ["HTML", "Типографика"],
    "glyphs": { "AcmeRating": "Ar" }
  },
  "components": {
    "exclude": ["Chart", "Carousel"],
    "synthetic": { "html": true, "htmlTags": ["div", "section", "fieldset"], "formArray": true, "wizard": false }
  },
  "ui": { "theme": "light", "leftPanel": "palette", "rightOpen": true, "preview": "wire" },
  "project": { "ignoreDirs": ["fixtures"], "seedSchema": null }
}
```

---

## Точки внедрения конфига (паттерн: `getRuntimeConfig().<секция>?.X ?? <существующий литерал>`)

Изменения аддитивны — существующие литералы остаются fallback'ом.

- **Каталог-override** — [contract.ts:117](../../projects/reformer-builder/src/catalog/contract.ts#L117) `loadCatalogJson()`: источник `getClientCatalog() ?? uiKitCatalog`; применить фильтр `components.include/exclude` к `supplied.components`; пробросить `components.synthetic` в `syntheticRecords()`.
- **Синтетические записи** — [synthetic-entries.ts:59](../../projects/reformer-builder/src/catalog/synthetic-entries.ts#L59) `syntheticRecords()`: читать `components.synthetic` (фильтр `htmlTags`, тоглы `formArray`/`wizard`/`html`).
- **Категории палитры** — [contract.ts:106](../../projects/reformer-builder/src/catalog/contract.ts#L106) `categoryOf()`: слить `CATEGORY_BY_NAME` с `palette.categoryByName`.
- **Порядок/свёрнутость/глифы** — [PalettePanel.tsx](../../projects/reformer-builder/src/panels/PalettePanel.tsx): `CATEGORY_ORDER` (:19), дефолт `collapsed` (:155), `GLYPH_BY_NAME`/`HTML_GLYPH` (:40,:75) читают `palette.order/collapsedByDefault/glyphs`.
- **Дефолты UI** — [reducers.ts:50](../../projects/reformer-builder/src/store/reducers.ts#L50) `initialUi()`: каждое поле `getRuntimeConfig().ui?.X ?? <текущий литерал>`.
- **Discovery проекта** — [discovery.ts:25,42,57](../../projects/reformer-builder/src/io/discovery.ts#L25) `FORM_SCHEMA_MARKERS`/`IGNORE_DIRS`/`SKIP_FILES`: union с `project.formSchemaMarkers/ignoreDirs/skipFiles`.
- **Seed-схема (Mode A)** — [EditorLayout.tsx:152](../../projects/reformer-builder/src/app/EditorLayout.tsx#L152): `project.seedSchema` (объект → кастомный seed; `null` → пустая схема через `emptySchema()`; отсутствует → текущий `seedSchema()`).
- **Брендинг** — `src/app/AppToolbar.tsx` (место рендера названия продукта — найти и подставить `branding.productName`/`logoUrl`); `document.title` ставится в `bootRuntime()` из `branding.title`.

---

## Launcher `bin/reformer-builder.mjs`

- `parseArgs` (:54): добавить `--catalog <path>` / `--config <path>` (+ `=`-форма), деф. `null`.
- После парса: если флаг не задан — авто-детект `process.cwd()/component-catalog.json` и `.../reformer-builder.config.json`.
- Чтение: helper `readJsonFile(path, { explicit })`. Явный флаг с нечитаемым/битым файлом → `console.error` + `exit(1)` (явная ошибка клиента). Авто-детект: `ENOENT` → тихо пропустить; существует, но битый JSON → `exit(1)` (файл явно предназначен к использованию).
- Держать `{ catalog, config }` в памяти; в `createRequestHandler` **перехватывать** `GET /__reformer-builder/runtime.json` **до** резолва static/dist → отдать `application/json` с `{ catalog, config }` (каждое `null`, если не передано). Пробросить bundle в фабрику: `createRequestHandler(indexHtmlPath, runtimeBundle)`.
- `printHelp` (:78) + шапка-комментарий + консоль-лог «loaded catalog from … / config from …».

**Валидация структуры — в SPA** (реюз `validateCatalog` + AJV конфига), не в bin: launcher zero-dependency, ловит только JSON-синтаксис (fail fast с путём файла), структурные ошибки показываются в браузерном `BootError`.

---

## `main.tsx` — async boot

Переписать на динамический импорт `App` **после** `bootRuntime()`:
```tsx
const root = createRoot(document.getElementById('root')!);
(async () => {
  const { bootRuntime } = await import('./config/boot');
  try { await bootRuntime(); }
  catch (err) {
    const { BootError } = await import('./config/BootError');
    root.render(<BootError error={err} />); return;
  }
  const { default: App } = await import('./App'); // store/catalog init здесь, конфиг уже установлен
  root.render(<StrictMode><App /></StrictMode>);
})();
```
`boot.ts`/`load.ts` тянут только `validateCatalog` (чистый, без store) и `config/state` — граф store/catalog не инициализируется преждевременно; `getCatalog()` по-прежнему строится лениво при рендере `PalettePanel`.

---

## Тесты (реюз существующих + новые)

- Новые: `src/config/load.test.ts` (валидация, fallback при 404/невалидном, merge-семантика), `src/config/state.test.ts`.
- Обновить: [contract.test.ts](../../projects/reformer-builder/src/catalog/contract.test.ts) и [catalog.test.ts](../../projects/reformer-builder/src/catalog/catalog.test.ts) — override клиентским каталогом, `include/exclude`, тоглы synthetic; [discovery.test.ts](../../projects/reformer-builder/src/io/discovery.test.ts) — markers/ignore из конфига; тест `initialUi()` из конфига.
- Launcher: точечный node-тест `parseArgs` + endpoint `/__reformer-builder/runtime.json` (bin-теста сейчас нет — добавить лёгкий).
- Прогон: `node ../../scripts/run-vitest.mjs` (скрипт `test` пакета).

## Документация

- [README.md](../../projects/reformer-builder/README.md): новые флаги, пример `reformer-builder.config.json`, ссылка на схему.
- Опубликовать `runtime-config.schema.json` для клиентов: добавить в `files` [package.json](../../projects/reformer-builder/package.json) и subpath-export `"./runtime-config.schema.json"` (по образцу `@reformer/ui-kit`'s `"./catalog"`).

---

## Verification (end-to-end)

1. **Unit:** `cd projects/reformer-builder && node ../../scripts/run-vitest.mjs` — все тесты зелёные (включая новые config-тесты и обновлённые catalog/discovery).
2. **Fallback (без файлов):** `npm run dev` → палитра, дефолты UI, seed-схема, брендинг = как сейчас (регресса нет).
3. **С файлами (dev-прокси-эквивалент):** временно положить `public/__reformer-builder/runtime.json` c `{catalog, config}` → проверить, что палитра переупорядочилась, `exclude`-компоненты пропали, тема/панели/заголовок вкладки применились, seed сменился. Убрать после проверки.
4. **Launcher e2e:** `npm run build` (без `BUILDER_BASE`) → `npx reformer-builder --catalog ./sample-catalog.json --config ./sample.config.json --no-open --port 4321` → `curl http://127.0.0.1:4321/__reformer-builder/runtime.json` возвращает bundle; открыть в Chromium — конфиг применён. Затем `npx reformer-builder --no-open` из папки с одноимёнными файлами → авто-детект работает; из пустой папки → билдер стартует на дефолтах.
5. **Ошибки:** битый `--config` → launcher падает с путём файла; структурно-невалидный конфиг → браузерный `BootError` со списком ошибок AJV.
6. **Скриншоты** (по правилам репо, `fullPage`): `projects/react-playground-e2e/screenshots/builder-runtime-config/{fallback,configured,boot-error}.png`.
