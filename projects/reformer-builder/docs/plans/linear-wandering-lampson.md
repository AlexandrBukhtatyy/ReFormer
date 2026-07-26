# reformer-builder — план реализации (по макету Claude Design + MVP-спеке)

**Статус:** черновик плана · 2026-07-25
**Вход:** макет `.tmp/Reformer-Builder-Cloude-Design/Reformer Builder.dc.html` (+ `reformer-builder-spec.md`), спека [docs/specs/reformer-builder-mvp.md](../specs/reformer-builder-mvp.md), брейншторм [docs/brainstorms/reformer-builder.md](../brainstorms/reformer-builder.md)
**Скелет:** [projects/reformer-builder/](../../) (React 19 + Vite 7 + Tailwind v4 + `@reformer/*` v6, npm workspaces — уже слинковано, `dev:builder`/typecheck включены)

---

## Контекст (зачем)

Есть готовый визуальный макет билдера форм (Claude Design) и MVP-спека. Нужно реализовать сам билдер, **ориентируясь на макет по раскладке/взаимодействиям, но не перенося throwaway-код прототипа** и добавляя реальные фичи из спеки.

Ключевая проблема прототипа: он оперирует **выдуманной** моделью схемы (`{ $schema:"reformer.dev/schemas/form@1", type:"Wizard"|"Form", title, children }`, узлы с `type`/`bindings`/`id`) и генерирует JSON «с нуля» в `toJson()`. Это несовместимо с реальным ReFormer и ломает round-trip. Прототип — один монолитный класс `DCLogic` (инспектор через `switch`, палитра захардкожена, undo/redo снимками).

**Решение:** источник истины редактора — **настоящий `JsonFormSchema`** (`@reformer/renderer-json`), редактируемый иммутабельно на месте; все подсистемы (canvas, инспектор, валидация, preview, принтер) читают ровно этот объект. UI/взаимодействия берём из макета, оболочку строим на **`@reformer/ui-kit`/shadcn**, Runtime-preview — на настоящем `renderer-json`.

**Решения пользователя (зафиксировано):**
- **Объём:** полный MVP сразу, включая Mode B (File System Access API, обнаружение схем, prettier round-trip-принтер, diff-сохранение, детект конфликтов, IndexedDB).
- **Оболочка:** на `@reformer/ui-kit` (переиспользуем компоненты и токены; макет — ориентир по layout, не по пикселям).

---

## Опоры в существующем коде (переиспользуем как есть)

| Что | Где | Роль в билдере |
|---|---|---|
| `JsonFormSchema` + узлы + guards (`isArrayNode/isFieldNode/isContainerNode`) | `packages/reformer-renderer-json/src/types/json-schema.ts` | **источник истины** редактора |
| `convertJsonToM1Tree` + `JsonFormRenderer` + `JsonRendererProvider` + `defineRegistry` | `packages/reformer-renderer-json` | движок **Runtime-preview** |
| `validateFormSchema(schema, {...})` → `{valid, errors}` | `@reformer/renderer-json/validate` | гейт валидации перед save/export |
| `defaultPropSchemas: Record<name, PropsSchema>` (`x-doc.kind`/`x-doc.group`/`x-runtimeProps`) | `packages/reformer-ui-kit/src/meta.ts`, `.../fields/props-schema.ts` | каталог для **палитры + инспектора** |
| Эталон монтирования preview + registry | `projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/{CreditApplicationFormRendererJson,registry}.tsx` | шаблон `preview-runtime/` |
| Эталонная JSON-форма (identity-тест принтера) | `.../complex-multy-step-form-renderer-json/json-schema.json` | round-trip gate-test |
| shadcn-набор оболочки: `resizable`, `tabs`, `collapsible`, `scroll-area`, `command`, `dialog`, `sonner`, `field`/`label`/`switch`/`select`/`slider`, `sheet`, `dropdown-menu`, `tooltip`, `badge`, `spinner`, `kbd` | `@reformer/ui-kit/*` | вся оболочка билдера |
| Токены темы (shadcn): `--background/--foreground/--border/--muted/--primary/--ring/--card/--sidebar-*/--radius`, тёмная тема встроена | `@reformer/ui-kit/styles` | стилизация оболочки |

**В библиотеке отсутствует** и пишется в билдере: **принтер модель→JSON** (round-trip, prettier). Валидатора schema→JSON и meta-схемы — есть (`form-schema.schema.json`, `buildFormSchemaMetaSchema`).

---

## Архитектура

### 1. Модель редактирования = сам `JsonFormSchema`, правится иммутабельно

- Источник истины — объект из `JSON.parse(rawText)`, типизированный как `JsonFormSchema`. Никакого параллельного AST → нет дрейфа с библиотекой и **нет потерь round-trip по построению**.
- **Порядок ключей** сохраняется бесплатно (JS хранит порядок строковых ключей; все ключи ReFormer — строки). **Passthrough неизвестных ключей/операторов** — бесплатно (правки локальные, structural sharing).
- Иммутабельные апдейты — рукописный `updateAt(schema, path, updater)` (клонирует только узлы по пути; без immer — держим контроль идентичности и отдаём объект прямо в `JSON.stringify`/конвертер).

### 2. Идентичность узлов = JSON-путь `(string|number)[]` от корня

- Не WeakMap-uid (теряется на клоне) и не `__uid`-проп (загрязняет артефакт). **Путь** — один локатор для `updateAt`, выделения и подсветки raw-JSON.
- Вложенность ReFormer **неоднородна**: дети в `children[]`, шаги wizard в `componentProps.steps[]`, элемент массива в `item.$template`, обёртка в `wrapper`. Поэтому путь — общий JSON-path, а не индекс ребёнка. Это инкапсулируется в **`node-kind.ts#childSlots(node)`** (см. ниже) — единственное место, знающее про неоднородность.
- Путь не стабилен при структурных правках → каждая структурная операция — чистая функция, возвращающая `{ schema, newPath }`; стор обновляет `selectionPath` из `newPath`, так выделение «следует» за узлом.

### 3. Стор — dependency-free снапшот-стор на `useSyncExternalStore`, дерево — плоский иммутабельный `JsonFormSchema`

> Реализовано без zustand (его нет в билдере, а npm install в песочнице недоступен; плюс это ближе к
> конвенции репо «без state-либы»). API тот же — селекторные подписки, — через `createStore` +
> `useSyncExternalStore`.

- Селекторные подписки дают точечные ре-рендеры (правка пропа в инспекторе перерисовывает только инспектор + затронутый узел canvas + raw-JSON), без провайдера. Вся мутация дерева — в чистом `model/` (тестируется без React). Логика стора — чистые редьюсеры (`store/reducers.ts`), тестируются без React.
- Слайсы: `tabsSlice` (`Record<tabId, TabState>` + `activeTabId`, где `TabState = { schema, past, future, selectionPath, hoverPath, dirty, source }`), `historySlice`, `selectionSlice`, `uiSlice` (preview mode, raw-JSON open, сворачивание панелей), `ioSlice` (Mode B: dir handle, discovery, `lastModified`, конфликты).
- **Undo/redo — полные снимки** (`{past, present, future}` на таб): снимок = ссылка на корень (O(1), память только по изменённому «хребту» из-за structural sharing). Снимок хранит `selectionPath`. Быстрые правки одного пропа коалесцируются в одну запись; глубина ~100. (Патчи — v2, не нужны на этом масштабе.)
- **Raw-JSON** — single-master: `schema` истина; правки raw-JSON парсятся с debounce → валидный парс коммитит снимок, ошибка парса показывается inline и не коммитит.

### 4. Round-trip-принтер (риск №1)

- `print(schema, options) = prettier.format(JSON.stringify(schema), { parser:'json', ...options })` через `prettier/standalone`. Не рукописный форматтер.
- Гарантия формулируется как **стабильность/фикспойнт**: `print(parse(x)) === print(parse(print(parse(x))))` и байт-в-байт на prettier-чистых схемах репо. Полная байт-идентичность держится только если исходник уже prettier-чист.
- **Конфиг в браузере:** репо-конфиг — `.prettierrc.cjs` (CommonJS), `prettier/standalone` его **не выполнит**. Стратегия: билдер несёт свои дефолт-опции как данные, зеркалящие репо (`printWidth 100, tabWidth 2, endOfLine 'lf'`; для `json`-парсера значимы `tabWidth/printWidth/endOfLine/useTabs`). В Mode B читаем только парсимые-как-данные конфиги (`.prettierrc[.json/.yaml]`, `package.json#prettier`, `.editorconfig`); для `.cjs/.js/.mjs` — дефолты + плашка «formatting по умолчанию». Документируем как принятое ограничение MVP.
- **Гейт-тест** (Vitest, `model/printer.test.ts`, принтер — чистая функция): identity на реальном `json-schema.json`, fixpoint на фикстурах с глубокой вложенностью, passthrough неизвестного ключа + `$op(...)`. В CI — до включения save в Mode B. Пишется **первым (TDD)** в M2.

### 5. Runtime-preview

Монтирование по эталону `CreditApplicationFormRendererJson.tsx`: `{registry, model}` → `convertJsonToM1Tree` в try/catch → `<JsonRendererProvider settings={{registry, model}}><JsonFormRenderer .../></JsonRendererProvider>`; при ошибке — `SchemaErrorPanel`.
- `synth-model.ts`: собрать все `$model(path)` (`parseOperator`) → вложенный initial-values → `createModel(initialValues)` (`@reformer/core`). Пути внутри `item.$template` — относительные, их обрабатывает конвертер (не пре-сидим).
- `default-registry.ts`: `defineRegistry` палитрового набора на ui-kit-поля (Input→InputField, …, Box, Section) + `FIELD_WRAPPER`→FormField + `Step`/wizard из `@reformer/cdk/form-wizard` + `AsyncBoundary`.
- `mock-sources.ts`: пред-скан `$dataSource/$fn/$locale` → авто-регистрация пустых заглушек (options `[]`, itemLabel → `''`), чтобы конвертер не падал.
- **Неизвестные `$component(NAME)`** (эталон использует `RendererFormWizard`, `ResidenceAddressSection`, `UnemployedWarning`, …): fallback-плейсхолдер «⚠ NAME — unregistered», рендерящий свои `children` (критерий приёмки «неизвестный компонент → generic box», риск №5). Точность — на dev-сервере разработчика.
- Ремоунт: `{registry, model, form}` в `useMemo` по **счётчику версии** (debounce ~200ms на коммит), поддерево с `key={version}` — чистый ремоунт и dispose прошлого графа сигналов.

### 6. Каталог (палитра + инспектор)

- MVP: `catalog/catalog.ts` адаптирует `defaultPropSchemas` в внутренний `CatalogEntry[]` — **той же формы**, что опишет будущий `component-catalog.schema.json`. `CatalogEntry`/`CatalogProp` (`catalog/types.ts`) вводим сейчас как стабильную границу; сам JSON-контракт + ui-kit-адаптер — M3 (замена источника за неизменным интерфейсом).
- `role.ts`: схема с `value`-seam в `x-runtimeProps` ⇒ **field**; Box/Section (+ `$html`) ⇒ **container**; **array** — синтетическая запись палитры (вставляет array-узел с пустым `$template`).
- `widgets.ts`: скрыть `x-runtimeProps`; виджет по `x-doc.kind` (boolean→switch, text→text, number→number, enum→select из `enum`, readonly→disabled); границы из `minimum/maximum/multipleOf`, дефолт из `default`, подсказка из `description`; секции по `x-doc.group` (Control/Options/Textfield/Behavior/State).
- **Bindings** — из узла (не каталога): `$model` из `value`/`array`, `$dataSource` из пропов; read-only чипы.

---

## Декомпозиция `projects/reformer-builder/src/`

```
app/               оболочка: роуты (Mode A/B), EditorLayout, провайдеры
store/             zustand + слайсы (tabs/history/selection/ui/io) + селектор-хуки
model/             ЧИСТЫЕ операции над JsonFormSchema — без React/браузера
  paths.ts         JsonPath; getAt; updateAt (structural-sharing); toPointer
  node-kind.ts     kindOf(node); childSlots(node) → [{path, slot, nodes}]   ← ключевая абстракция
  query.ts         findByPath, parentOf, collectModelPaths, collectOperatorNames
  mutate.ts        insert/move/remove/duplicate/wrapInHtmlDiv/setProp/setComponent → { schema, newPath }
  normalize.ts     ensure {version,root}; фабрика пустой схемы (Mode A)
  printer.ts       print(schema, prettierOptions)  [risk #1, TESTABLE]
  *.test.ts
catalog/           types.ts (CatalogEntry/CatalogProp), catalog.ts, role.ts, widgets.ts
panels/            FilesPanel/ · PalettePanel/ (DnD-источник) · Inspector/ (каталог-driven + Bindings)
canvas/            SchematicCanvas/ (L2-wireframe через childSlots) · RuntimePreview/ · RawJson/ · PreviewSwitch
io/                fs-access · discovery (glob + json.root-дискриминатор + confidence) · handle-store (IndexedDB)
                   prettier-config · save (diff/conflict/write) · export (Mode A download)
preview-runtime/   default-registry · synth-model · mock-sources · unknown-component
dnd/               drag-drop примитивы (HTML5 DnD или dnd-kit), общие для палитры и canvas
```

**Маппинг прототип → реальное** (идеи операций берём, фейковую модель `{type,bindings}` выкидываем): `normalize/scopeRoot`→`model/normalize.ts`; `findIn`→`query.findByPath/parentOf`; `extractField`(инспектор)→`catalog/` (из `defaultPropSchemas`, не из узла); `handleDrop`→`mutate.insert/move` + `dnd/` (легальность по `role`); `toJson()`→**заменён** `printer.ts` (никогда не регенерим — печатаем сохранённый объект).

---

## Milestones (весь MVP в объёме; порядок исполнения)

### M1 — Ядро редактора + Standalone Mode A (in-memory реальный `JsonFormSchema`; без FS/принтера)
`model/` (paths, node-kind/childSlots, query, mutate, normalize) + юнит-тесты; `store/` zustand (tabs/history-снимки/selection/ui + dirty); `catalog/` (адаптер + role + widgets + типы); `PalettePanel` (DnD), `Inspector` (каталог + Bindings), `FilesPanel` (Mode A список + «новая схема»); `SchematicCanvas` (L2-wireframe через `childSlots`, выделение, drop-цели) + `dnd/`; `RuntimePreview` (`preview-runtime/*`, ремоунт-по-версии, try/catch→SchemaErrorPanel); `RawJson` (textarea/CodeMirror, debounce parse-back); гейт `validateFormSchema` как статус-панель, блокирует export; `io/export.ts`; оболочка/layout/preview-switch/сворачивание панелей — на ui-kit.
**Выход:** собрать форму с нуля, править инспектором, drag палитра→canvas, runtime рендерит, править raw-JSON, undo/redo, валидация, экспорт валидного `JsonFormSchema`. Без ФС и prettier.

### M2 — Mode B: проектная связка и round-trip (рискованный)
`model/printer.ts` + **`printer.test.ts` первым (TDD)** на эталоне (identity/fixpoint/passthrough) как CI-гейт; `io/prettier-config.ts`; `io/fs-access.ts`, `io/handle-store.ts` (IndexedDB + «Переоткрыть»), `io/discovery.ts` (glob + `json.root`-дискриминатор + бейджи уверенности), `io/save.ts` (diff-preview, детект внешних изменений/конфликтов через re-read `lastModified`, защищённая запись); `FilesPanel` Mode B (дерево, бейджи, dirty); Cmd+S → validate → diff → write (HMR — внешний, dev-сервер проекта).
**Выход:** все критерии §14 спеки кроме Monaco/контракта; **round-trip идемпотентность зелёная в CI.**

### M3 — Полировка
`RawJson`→Monaco split-view (двусторонний, path↔range через JSON Pointer, хинты из `form-schema.schema.json`); каталог-контракт (`component-catalog.schema.json` + ui-kit-адаптер `defaultPropSchemas→catalog.json` с явным `role` + `validateCatalog`) за неизменным `CatalogEntry`; полировка бейджей, конфиг globs обнаружения, эргономика diff/merge.

---

## Критические файлы

**Создаём (билдер):** `src/model/{paths,node-kind,query,mutate,normalize,printer}.ts` (+ тесты), `src/catalog/{types,catalog,role,widgets}.ts`, `src/store/*`, `src/panels/{FilesPanel,PalettePanel,Inspector}/*`, `src/canvas/{SchematicCanvas,RuntimePreview,RawJson}/*`, `src/preview-runtime/*`, `src/io/*`, `src/dnd/*`, `src/app/EditorLayout.tsx`. Заменяем boilerplate `src/pages/HomePage.tsx`, дорабатываем `src/App.tsx`.

**Читаем/переиспользуем (не меняем):** `packages/reformer-renderer-json/src/types/json-schema.ts`, `.../src/validate.ts`, `.../src/schema/form-schema.schema.json`, `packages/reformer-ui-kit/src/meta.ts` (+ `fields/props-schema.ts`), эталон `projects/react-playground/.../complex-multy-step-form-renderer-json/*`.

---

## Верификация

- **Юнит (Vitest):** `model/*.test.ts` — mutate возвращает корректный `newPath`; **`printer.test.ts`** — identity на `projects/react-playground/.../json-schema.json`, fixpoint, passthrough (CI-гейт round-trip, M2).
- **MCP (`mcp__reformer__*`):** `validateFormSchema`/`find_recipe`/`get_symbol_docs` для сверки форматов при разработке; при найденных багах интеграции — `report_issue`.
- **Runtime вручную:** `npm run dev:builder` → собрать форму → Runtime-preview рендерит через настоящий renderer-json; сверка со спекой §14 (обнаружение метит `json-schema.json`/`renderer.schema.json`, не метит `form-schema.schema.json`/`package.json`; open→save без правок = нулевой diff; конфликт внешнего изменения; Mode A export).
- **E2E (playwright, позже):** smoke сценариев редактора; скриншоты в `projects/react-playground-e2e/screenshots/` (fullPage).

## Риски

1. **Round-trip-принтер** — чистая функция, гейт-тест на реальных схемах; `.cjs`-конфиг → дефолты + плашка (документированное ограничение).
2. **Идентичность при структурных правках** — каждая op возвращает `newPath`, выделение следует.
3. **Дрейф runtime-registry** — плейсхолдер неизвестного компонента + «точность на dev-сервере».
