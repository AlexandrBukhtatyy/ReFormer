# Сменные UI-kit'ы и их версии в ReFormer Builder

## Context

Билдер жёстко привязан к одному UI-kit одной версии — той, что вкомпилирована на этапе сборки.
Метаданные уже отчуждаемы: контракт `component-catalog.schema.json` принадлежит билдеру,
`@reformer/ui-kit` генерирует под него `component-catalog.json`, лаунчер подменяет его флагом
`--catalog`. Но **React-компоненты приходят из статических импортов**
([known-components.ts:18-26](projects/reformer-builder/src/preview-runtime/known-components.ts#L18-L26)),
поэтому подменённый каталог даёт палитру и инспектор, но не живое превью — всё нерезолвящееся
деградирует в заглушку «предпросмотр ограничен». RFC-0001 классифицирует это как точку расширения
**E7: «код, не конфигурация, расширяет только форк»**.

Требуется: выбирать UI-kit и версию в билдере и **рендерить превью на компонентах активного кита**.

Ось версий реальна: на npm опубликовано 10 стабильных мажоров `@reformer/ui-kit`
(`1.0.0 … 12.2.0`, latest — `12.2.0`), монорепа сейчас на `6.0.0`.

Решения, зафиксированные с пользователем:

| Развилка | Решение |
| --- | --- |
| Источник кода кита | **Гибрид**: вшитый дефолт + киты из `node_modules` через лаунчер + опционально CDN |
| Одновременность | **Один активный кит**, переключение с перезагрузкой SPA |
| Охват | `@reformer/ui-kit` разных версий + внутренние форки по тому же контракту |
| Изоляция превью | открытая — решается в §3.3 |

---

## 1. Пять фактов, определивших план

**F1. У `@reformer/ui-kit` нет собранного CSS вообще.** `exports["./styles"]` указывает на
`src/styles/theme.css` — это **исходник Tailwind v4** (`@theme inline`, `@custom-variant dark`,
`:root { --background: … }`), а не стайлшит. В `dist/` нет ни одного `.css`. Утилитарные классы
(`flex h-9 rounded-md …`), которыми размечены компоненты внутри `dist/*.js`, генерирует **сборка
потребителя** — у билдера это `@source "../../../packages/reformer-ui-kit/src"` в
[index.css:6](projects/reformer-builder/src/index.css#L6).
→ Кит, загруженный динамически в рантайме, отрендерится **без стилей**. Динамический ESM и CDN
заблокированы не браузерным API, а отсутствием CSS-артефакта у кита. Это апстрим-задача.

**F2. Chrome билдера сам сидит на ui-kit — 17 модулей.** `PalettePanel`, `Inspector`, `FilesPanel`,
`FilesDialogs`, `TemplatesPanel`, `TemplateCombobox`, `OptionsField`, `CanvasArea`, `CloseTabDialog`,
`FloatingActions`, `SaveDialog`, `TabBar`, `EditorLayout`, `AppMenuBar`, `HelpDialogs`,
`save-actions`, `Shortcut` — barrel плюс 13 subpath'ов.
→ Активный кит **не может** быть китом chrome. Архитектура обязана разделить *chrome-kit* (вшит,
неизменен) и *preview-kit* (переключаемый). Это, наоборот, упрощает изоляцию: скоупить надо только
поддерево превью.

**F3. Поверхность контракта различается между мажорами.** v5.0.3 объявляет `@radix-ui/react-slot`,
`@radix-ui/react-select`, `lucide-react` отдельными peer'ами; v6/v12 — унифицированный `radix-ui` в
`dependencies`. v12.2.0 добавляет `@reformer/renderer-react` в peers. `exports["./catalog"]` и
`["./styles"]` есть у 12.2.0, но **отсутствуют** у опубликованных 5.0.3 и 6.0.0 (17 экспортов против 79).
→ Список externals кита обязан быть **данными дескриптора**, а не допущением билдера. И реестр китов
обязан уметь брать каталог out-of-band (вшитый, `--catalog`, файл конфига), а не только из пакета.

**F4. Синглтонов на импорте четыре, не два.** Кроме `getCatalog()`
([catalog/index.ts:35-40](projects/reformer-builder/src/catalog/index.ts#L35-L40)) и `KNOWN_COMPONENTS`
([known-components.ts:84](projects/reformer-builder/src/preview-runtime/known-components.ts#L84)) есть
`KNOWN_COMPONENT_NAMES` ([known-names.ts:37](projects/reformer-builder/src/preview-runtime/known-names.ts#L37)),
`propSchemasCache` ([io/validate.ts:26](projects/reformer-builder/src/io/validate.ts#L26)) и —
самое неприятное — **побочный эффект на импорте модуля** в
[canvas/monaco-setup.ts](projects/reformer-builder/src/canvas/monaco-setup.ts):
`jsonDefaults.setDiagnosticsOptions({ schemas: [{ schema: metaSchema() }] })`, где `metaSchema()`
дёргает `getCatalog()`.
→ Реактивный сброс синглтонов при смене кита даёт класс багов «где-то остался старый каталог»,
который диагностируется отвратительно. Reload надёжнее.

**F5. Прецедент против import-map уже зафиксирован в репо.** `docs/plans/majestic-floating-karp.md`
проектирует резолв модулей **статическими** импортами `@reformer/*` с формулировкой: «Без
blob/import-map (бандл голых `@reformer/*` спецификаторов + второй инстанс — недопустимы)».

**F6 (измерено спайком S1, 2026-08-07). Зависимости двух мажоров уживаются, а контракт с рантаймом — нет.**
После `npm i "@reformer/ui-kit-v12@npm:@reformer/ui-kit@12.2.0" -w @reformer/builder` в дереве оказалось
**ровно по одной копии** `react@19.2.1`, `react-dom`, `radix-ui@1.6.2`, `lucide-react@0.553.0`,
`@preact/signals-core@1.14.1` — диапазоны deps у мажоров совпадают, а `legacy-peer-deps=true` не даёт
ставить peer'ы вложенно. Риск дублей Radix-контекста **не материализуется**.

Зато `import('@reformer/ui-kit-v12')` падает **на линковке**:
`The requested module '@reformer/renderer-react' does not provide an export named 'useModelArrayItems'`
(главный barrel, `./form-array`, `./list`; `./form-field` и `./input` грузятся). Вся поверхность
зависимости кита от рантайма — **11 символов**, из них локально нет двух: `resolveInitialValue` и
`useModelArrayItems` (сами функции есть в
[render-node.tsx:296](packages/reformer-renderer-react/src/core/render-node.tsx#L296) и
[:322](packages/reformer-renderer-react/src/core/render-node.tsx#L322), но не реэкспортированы из
`src/index.ts`).

Причина — **расхождение веток, а не архитектура**: `develop` впереди `main` на 57 коммитов и отстаёт
на 11, тег `ui-kit-v12.2.0` только на `main`, а опубликованный `renderer-react@11.0.0` оба символа
экспортирует. Заодно выяснилось, что **версии в `package.json` недостоверны** (`6.0.0` при
опубликованных 11–12): в `.releaserc.json` нет `@semantic-release/git`, версия живёт в git-теге —
поэтому `host-versions.ts` этапа 3 нельзя генерировать из `package.json`.

---

## 2. Ключевое следствие: «кит» тянет за собой рантайм

Превью-стек — пять связанных пакетов: `@reformer/core` → `@reformer/cdk` → `@reformer/ui-kit`, плюс
`@reformer/renderer-react` и `@reformer/renderer-json`. Компоненты кита (`FormField`, `FormArray`,
`FormWizard`) построены на cdk, cdk — на сигналах core, а рендерер проверяет `instanceof Signal`.
Поэтому `react`, `@preact/signals-core` и `@reformer/core` обязаны быть **одним инстансом** — ровно
для этого существует `dedupe` в [vite.config.ts:17-23](projects/reformer-builder/vite.config.ts#L17-L23).

Значит: подключаемый кит не тянет свой `core`/`cdk`/`react` — он получает их от билдера. Кросс-мажорный
кит (ui-kit, требующий `core@8`, при билдере на `core@6`) в этой архитектуре **не поддерживается**;
вместо тихой поломки нужен явный semver-гейт и понятный отказ (§3.2). Долгосрочный запасной путь —
iframe (§8).

---

## 3. Решения по развилкам

### 3.1 Источник кода кита — bundled-адаптеры сначала, ESM с лаунчера потом, CDN за явным флагом

Этапы 1–6 делаются на **вкомпилированных адаптерах**: набор китов (включая несколько версий одного
пакета через npm-алиасы) собирается в билдер, каждый — за `import()`, то есть отдельным чанком Vite.
Динамический ESM с локального лаунчера — отдельный необязательный этап 7 поверх уже готового контракта.

Почему такой порядок:

- **Hosted-режим — живая цель.** `.github/workflows/deploy-docs.yml` собирает билдер с
  `BUILDER_BASE=/ReFormer/builder/` и кладёт в GitHub Pages, где Node нет. Там работают только
  вшитые киты.
- **Офлайн — заявленное свойство продукта** (`description`: «a bundled offline SPA you run via npx»).
- **F1 блокирует динамику технически.** Пока кит не публикует собранный CSS, динамическая загрузка
  даёт нестилизованный DOM. Bundled-путь позволяет прописать `@source` на dist каждого вшитого кита
  при сборке билдера и получить рабочее превью, **не трогая релизный цикл ui-kit**.
- **Несколько версий закрываются уже на bundled-пути** — npm-алиасами
  (`"@reformer/ui-kit-v12": "npm:@reformer/ui-kit@12.2.0"`), и мажоров для этого достаточно (10 штук).

CDN откладывается и включается только явным флагом: превью живёт **в одном realm с chrome билдера**
и с File System Access-хендлами проекта пользователя (не iframe и не Shadow DOM — это осознанно, ради
хит-теста и DnD). Исполнение стороннего сетевого кода в этом realm противоречит принципу **P4 «No
remote code»** RFC-0001. Киты из `node_modules` (этап 7) — другой уровень доверия, сопоставимый с
`npm run dev`, и потому допустимы.

Цена bundled-подхода — размер: `dist/assets/App-*.js` уже 2.69 МБ. Митигация обязательная: адаптер
кита подключается **только через `import('./adapters/…')`**, чтобы Vite вынес его в отдельный чанк и
грузил лишь активный.

### 3.2 Синглтоны рантайма — «один realm, одно ядро», кит externalится на хост

Билдер владеет единственными инстансами `react`, `react-dom`, `@preact/signals-core`,
`@reformer/core`, `@reformer/cdk`, `@reformer/renderer-react`, `@reformer/renderer-json`. Для
bundled-китов это делается расширением уже существующего `resolve.dedupe` — никакой новой машинерии.

**Политика совместимости — отказ, а не попытка, и гейт СИМВОЛЬНЫЙ, а не semver.** Спайк S1 (факт F6)
показал, что semver-гейт этот класс поломок не ловит вовсе: ui-kit@12.2.0 объявляет
`@reformer/renderer-react: ">=1.0.0"`, хост отдаёт `6.0.0`, диапазон проходит — а дальше жёсткая
ESM-ошибка линковки. Открытые диапазоны в peerDeps не выражают реальный контракт.

Поэтому гейт проверяет **символы**: список того, что кит импортирует из host-пакетов, сверяется с
фактическим namespace до активации. Поверхность мала и проверка дешёвая — у ui-kit@12 это ровно
11 символов (`core{useFormControl}`, `cdk{useValidationErrorResolver}`, `cdk/async-boundary{AsyncBoundary,
useAsyncBoundaryContext}`, `cdk/file-upload{FileUpload,useFileUploadContext}`, `cdk/form-array{FormArray}`,
`cdk/form-field{FormField,useFormFieldContext}`, `cdk/form-wizard{FormWizard}`,
`renderer-react{RenderNodeComponent,resolveInitialValue,useModelArrayItems}`). Для вшитых китов
проверка делается на сборке, для загружаемых — на активации. При провале — fail-visible экран в стиле
[config/BootError.tsx](projects/reformer-builder/src/config/BootError.tsx) с именем символа и пакета,
а не `link error` в консоли. `kit.peerRanges` остаётся как информационная подсказка, но решение
принимает символьная проверка.

Два ядра рядом по-прежнему не вариант: второй инстанс `@preact/signals-core` ломает `instanceof Signal`,
а `createForm`/`convertJsonToM1Tree` через границу инстансов дадут молчаливое «No form node for
signal …» вместо рендера. Честный отказ лучше тихо сломанного превью.

Для этапа 7 import map реалистичен (`transformIndexHtml` + `injectTo: 'head-prepend'`, шимы отдельными
Rollup-входами со стабильными именами файлов), причём **состав мапы берётся из дескрипторов** — прямое
следствие F3. Но до этапа 7 он не нужен.

### 3.3 CSS-изоляция — chrome пришпилен, у кита скоупятся токены, утилиты общие

Рекомендуемое решение — двухслойное:

1. **Chrome не тематизируется никогда** (следствие F2): рендерится вшитым ui-kit, его токены живут
   на `:root`.
2. **Каждый вшитый кит поставляет token-блок, переписанный со `:root` на `[data-rb-kit="<id>"]`** —
   небольшим шагом Vite-плагина на сборке билдера. `@theme inline { … }` остаётся на верхнем уровне
   (Tailwind этого требует), скоупится только блок значений `:root { --background: … }` и `.dark`-вариант.
3. [RuntimePreview.tsx:303-305](projects/reformer-builder/src/canvas/RuntimePreview.tsx#L303-L305) уже
   вешает на хост превью `data-rb-preview` и `data-rb-scope` — туда же добавляется
   `data-rb-kit={activeKit.id}`. Кастом-свойства наследуются вниз, поэтому `bg-background`
   (→ `var(--color-background)` → `var(--background)`) внутри превью берёт токены активного кита, а
   снаружи — токены chrome. Это ровно тот механизм, которым уже работает `.dark`.
4. **Утилитарные классы Tailwind остаются одни на всё приложение**: один `@import 'tailwindcss'` в
   `src/index.css`, а `@source` перечисляет dist каждого вшитого кита. Это жёсткое требование:
   пользователь пишет `className` руками в `componentProps`, и `flex gap-2` обязан работать в превью.

Почему не альтернативы:

- **Tailwind `prefix()`** — ломает требование выше: пользовательский `className="flex gap-2"`
  перестанет работать.
- **`@scope`** — решает не ту задачу. Проблема не в специфичности селекторов, а в *значениях*
  кастом-свойств на `:root`, которые наследуются. Переобъявление свойств на контейнере — нативный
  механизм нулевого риска; `@scope` добавил бы совместимостный риск без выгоды.
- **Каскадные слои** — упорядочивают правила, но не изолируют токены. Остаются как вспомогательный
  тай-брейкер для base-ресетов кита.
- **iframe / Shadow DOM** — ломают хит-тест, DnD и подсветку, завязанные на общий DOM (класс-токены
  `rbnode-*`, `preview-hit-test.ts`, `MutationObserver`, CSS-правила
  [index.css:22-33](projects/reformer-builder/src/index.css#L22-L33)). Спека уже отклоняла iframe
  (`docs/specs/reformer-builder-mvp.md:174-177`), а требование «один активный кит» не создаёт нужды в нём.

Два остаточных риска, оба проверяются спайком: **Radix-порталы** рендерятся в `document.body`, вне
`[data-rb-kit]` — экспозиция мала (все 10 оверлеев уже в `OVERLAY_LIMITED` и рисуются стабом), для
остального (контент `Select`) либо задать portal container внутрь хоста превью, либо продублировать
атрибут на `<body>`. И **чужая дизайн-система с другими именами токенов** — для неё вводится
`kit.styles.mode: 'tokens' | 'standalone'`, где `standalone`-кит поставляет самодостаточный CSS,
подключаемый `<link>` в `@layer rb-kit`. Для «несколько версий ui-kit» достаточно режима `tokens`.

Важный практический вывод: для сценария «ui-kit v6 ⇄ v12» токены, скорее всего, идентичны, поэтому
**рабочее переключение с живым превью появляется уже на этапе 3, до CSS-работ этапа 4**.

### 3.4 Контракт — опциональный блок `kit` внутри catalog-JSON + отдельный реестр китов

Это две разные сущности, их нельзя смешивать:

| | Что описывает | Где живёт | Владелец |
| --- | --- | --- | --- |
| **Kit descriptor** | «что это за кит и как его рендерить» | опциональный блок `kit` в `component-catalog.json` | кит |
| **Kit registry** | «между какими китами можно выбирать» | `kits[]` в `reformer-builder.config.json` + вшитый список | билдер/клиент |

Разделение вынуждено фактом F3: у опубликованных ui-kit@5/6 нет `exports["./catalog"]`, значит реестр
обязан указать, откуда взять каталог, независимо от самого пакета.

Дескриптор (всё опционально; отсутствие = сегодняшнее поведение):

```jsonc
kit: {
  id, label, package, version,
  peerRanges: { "@reformer/core": ">=1.1.0", "react": "^18 || ^19" },   // §3.2
  resolve:    { fieldSuffix: "Field" },                                  // было: правило в коде
  infra:      { fieldWrapper: "FormField", asyncBoundary: "AsyncBoundary", list: "List" },
  adapters:   { wizard: { symbol: "FormWizard", subpath: "form-wizard" }, step: null },
  palette:    { categoryByName: {}, order: [], glyphs: {} },              // было: CATEGORY_BY_NAME
  compoundTemplates: { Alert: {} },                                      // было: COMPOUND_TEMPLATES
  codegen:    { importSpecifier: "@reformer/ui-kit", subpathBySymbol: {} },
  styles:     { mode: "tokens" | "standalone", href, tokenScope }        // §3.3
}
```

На уровне записи компонента добавляются: `exportName` (точечный override правила резолва), `subpath`
(где искать символ — заменяет 5 статических subpath-импортов и половину `SUBPATH_LIMITED`),
`preview: { mode: 'live' | 'limited', reason? }` (переносит `OVERLAY_LIMITED` и `SUBPATH_LIMITED` из
билдера в кит), `leaf: true` (заменяет `LEAF_COMPONENT_NAMES`).

**Версионируются два независимых числа:** существующий `version` (сейчас `"1.0"`) — версия *контракта
каталога*, владелец билдер, бампается до `"2.0"`; `kit.version` — версия пакета дизайн-системы,
владелец кит, показывается в переключателе и штампуется в схему.

**Обратная совместимость через «неявный кит»:** каталог без блока `kit` (сегодняшний
`component-catalog.json` и любой клиентский `--catalog`) достраивается до дескриптора сегодняшними
захардкоженными таблицами билдера, вынесенными в `src/kits/legacy-reformer-ui-kit.ts`. Поведение
байт-в-байт прежнее, что закрепляется снапшот-тестом.

Почему не отдельный файл дескриптора: одна сущность = один fetch, одна AJV-валидация, один флаг
`--catalog`, один `exports["./catalog"]`. Добавление одного опционального свойства аккуратнее второго
контракта с собственным жизненным циклом.

### 3.5 Формат документа — `meta.kit`, advisory, никогда не блокирует

`JsonFormSchema.meta` в `@reformer/renderer-json`
([types/json-schema.ts:139-143](packages/reformer-renderer-json/src/types/json-schema.ts#L139-L143),
сейчас `{ name?, description? }`) расширяется до `meta.kit?: { id, version? }`. Аддитивно,
опционально, конвертер не трогает.

Почему `meta.kit`, а не соседний с `$schema` ключ: `$schema` уже занят discovery
([io/discovery.ts:26,42](projects/reformer-builder/src/io/discovery.ts#L26)) как маркер «это форма».
Нереализованный **Q28** спеки хочет по `$schema` резолвить *проектную мета-схему* → enum компонентов →
каталог. Механизмы не конкурируют, а дополняются: `$schema` отвечает «какой каталог применим к проекту»,
`meta.kit` — «каким китом собран этот файл». Q28 остаётся открытым и совместимым.

UX при несовпадении — три уровня, ни один не блокирует открытие:

1. Немодальный закрываемый **баннер** над canvas: «Схема собрана на `ui-kit@12.2.0`; активен
   `ui-kit@6.0.0`» + кнопки «Переключить кит» / «Остаться».
2. Компоненты, которых нет в активном каталоге, получают существующую amber-плашку
   `makeUnknownComponent` — в её текст добавляется «нет в активном ките `<id>@<ver>`», чтобы была
   видна *причина*, а не только факт.
3. Инспектор показывает чип «компонент отсутствует в активном ките» вместо пустого списка пропсов.

Штамповка консервативная: `meta.kit` пишется для **новых** схем и обновляется при сохранении файла,
**у которого он уже был**. В файл, где его не было, ничего не инжектится — round-trip нетронутых
файлов это явный инвариант (`model/normalize.ts`, `io/diff.ts`). Тумблер — `project.stampKit`.

### 3.6 Переключение — полный reload с сохранением черновиков

`setActiveKit(id)` → сохранить выбор в IndexedDB → сфлашить черновики → `location.reload()`.
На бутстрапе `bootRuntime()` читает выбор, резолвит дескриптор, `await import()` адаптера, ставит
namespace в module-state — **и только потом** `import('./App.tsx')`.

Почему не реактивный сброс: синглтонов четыре (F4), один из них — побочный эффект импорта модуля.
Инвалидация потребовала бы сброса `getCatalog()`, `KNOWN_COMPONENTS`, `KNOWN_COMPONENT_NAMES`,
`propSchemasCache`, кэшей `catalog/compound.ts`, пересоздания monaco-диагностики и всех React-мемо,
закрывшихся над каталогом (`Inspector`, `PalettePanel`, `QuickAddDialog`, `dnd/resolve-drop`).

Reload-путь уже существует и протестирован: `main.tsx` делает async-boot **именно потому**, что конфиг
обязан быть установлен до инициализации графа, а [io/draft-store.ts](projects/reformer-builder/src/io/draft-store.ts)
существует **именно для того**, чтобы вкладки переживали перезагрузку. Бонус: `known-components.ts`
остаётся module-level синглтоном, просто наполняется из namespace, положенного при boot — правка
минимальная, а не переписывание в реактивный слой.

Единственный реальный риск: `draft-store` хранит только вкладки `source: 'new' | 'template'`, значит
reload **закроет вкладки, привязанные к файлам проекта** (`dirHandle` в `handle-store` переживает,
список открытых файлов — нет). Лечение: сначала подтверждение с предложением сохранить грязные
файловые вкладки, позже — новое IDB-хранилище `session` с путями и восстановлением.

---

## 4. Целевая архитектура

```
src/kits/                          ← НОВЫЙ слой
  types.ts                    KitDescriptor, KitRecordExt, KitRef
  descriptor.ts               catalog-JSON → KitDescriptor (v1 → «неявный кит»)
  legacy-reformer-ui-kit.ts   сегодняшние таблицы билдера как дескриптор по умолчанию
  registry.ts                 listKits(): вшитые адаптеры + kits[] из runtime-конфига
  active.ts                   getActiveKit / getActiveNamespace / setActiveKit  (+ IDB)
  host-versions.ts            (генерируется) версии core/cdk/react, вшитые в билдер
  compat.ts                   semver-гейт peerRanges → ok | { reason }
  adapters/
    reformer-ui-kit-6.ts      () => import('@reformer/ui-kit')      + subpaths → namespace
    reformer-ui-kit-12.ts     () => import('@reformer/ui-kit-v12')  + subpaths → namespace

boot: main.tsx → bootRuntime() → [config] → [resolve kit] → await adapter.load()
                              → setActiveKit(...) → import('./App.tsx')

catalog/contract.ts    ─ читает дескриптор вместо CATEGORY_BY_NAME
preview-runtime/*      ─ namespace и политику берёт из активного кита
canvas/RuntimePreview  ─ data-rb-kit=<id> на хосте (скоуп токенов)
chrome (panels/, app/) ─ НЕ трогаем: пришпилен к вшитому ui-kit
```

---

## 5. Этапы

### Этап 0 — спайки · ~2 дня

Пять экспериментов, каждый ≤ полдня. Этапы 1+ не начинать без S1 и S3.

| # | Вопрос | Как проверить | Если провал |
| --- | --- | --- | --- |
| **S1** ✅ | Уживаются ли два мажора ui-kit в одном бандле? | Выполнено 2026-08-07 — см. F6 | **Дублей нет** (по одной копии react/radix-ui/lucide-react/signals-core). Но кит v12 не линкуется с локальным рантаймом: не хватает 2 экспортов в `renderer-react`. Причина — `develop` отстаёт от `main` на 11 коммитов. Дельта размера не измерена (заблокирована линковкой) |
| **S2** | Что делает второй `@source` с размером CSS? | Добавить `@source` на dist v12, замерить дельту от текущих ~162 КБ | > +100 % → делить CSS по китам |
| **S3** ✅ | Переживает ли Tailwind v4 переписывание `:root` → `[data-rb-kit="x"]`? | Выполнено 2026-08-07, `.tmp/kit-spike/s3/run.mjs` (postcss + `@tailwindcss/postcss` над настоящим `theme.css`) | **ПРОХОДИТ 7/7.** Компиляция цела, токены не утекают на `:root`, dark-вариант скоупится, утилиты живы. Ключ: из-за `@theme inline` правило выходит как `.bg-background { background-color: var(--background) }` — ссылка на голое свойство, поэтому переобъявление на контейнере работает. Fallback с подменой `<link>` не нужен |
| **S4** | Утекают ли Radix-порталы за пределы скоупа? | Отрендерить контент `Select` внутри скоупленного контейнера | Portal container внутрь хоста либо дубль атрибута на `<body>` |
| **S5** | Что с открытыми файловыми вкладками при reload? | Открыть проект, файловую вкладку, `location.reload()` | Подтверждает необходимость `session`-хранилища |

### Этап 1 — контракт дескриптора v2 + «неявный кит» · ~3 дня · ✅ ВЫПОЛНЕНО 2026-08-07

Чистый рефактор, **нулевое изменение поведения**, мержится сам по себе.
Проверено: `vitest` 517 passed (+35 новых), `tsc --noEmit`, `eslint`, `prettier` — чисто.

Два отступления от буквы плана, оба осознанные:

- **`COMPOUND_TEMPLATES` не переехал.** Он тянет фабрики узлов (`partNode`/`defaultPartText`), и его
  переезд создал бы цикл `kits → make-node → node-kind → kits`. В дескрипторе поле
  `compoundTemplates` опционально: `undefined` = встроенные шаблоны билдера. Переезд — этап 2,
  вместе с переключением потребителей.
- **Слияние, а не замена, для `previewPolicy`/`leafComponents`.** Дефолты билдера остаются базой,
  per-record поля переопределяют точечно. Иначе кит, который завёл блок `kit`, но ещё не перенёс
  `preview` в записи, внезапно начал бы рисовать оверлеи вживую — то есть невидимыми узлами на
  canvas. Для `palette.categoryByName` — наоборот, замещение целиком: мешать категории чужого кита
  с картой ui-kit бессмысленно.

Ещё одна деталь, важная для этапа 2: реэкспорт констант из исходных модулей сделан как
`import { X } from '../kits/…'; export { X };`, а **не** `export { X } from '…'` — `node-kind` и
`known-names` используют эти константы внутри модуля, а форма `export … from` локальной привязки
не создаёт.

Меняется: [catalog/component-catalog.schema.json](projects/reformer-builder/src/catalog/component-catalog.schema.json)
(опциональный `kit`; в `components[].items` — `exportName`, `subpath`, `preview`, `leaf`;
`additionalProperties: false` сохраняем) и [catalog/types.ts](projects/reformer-builder/src/catalog/types.ts).

Создаётся: `src/kits/types.ts`, `src/kits/descriptor.ts` (`toDescriptor(catalogJson)`),
`src/kits/legacy-reformer-ui-kit.ts` — сюда **переезжают данными** `CATEGORY_BY_NAME`
([contract.ts:30-106](projects/reformer-builder/src/catalog/contract.ts#L30-L106), 85 имён),
`OVERLAY_LIMITED` + `SUBPATH_LIMITED` ([render-policy.ts:22-49](projects/reformer-builder/src/preview-runtime/render-policy.ts#L22-L49)),
`LEAF_COMPONENT_NAMES` ([node-kind.ts:98-104](projects/reformer-builder/src/model/node-kind.ts#L98-L104)),
`COMPOUND_TEMPLATES` ([make-node.ts:95-261](projects/reformer-builder/src/catalog/make-node.ts#L95-L261)),
`INFRA_NAMES`, `NEEDS_SHIM`.

Тесты: `kits/descriptor.test.ts`; **снапшот-тест эквивалентности** (самый важный на этапе) — `getCatalog()`
до и после рефактора даёт идентичный массив, включая отдельные снимки `entry.makeNode()`;
параметризация `catalog/contract.test.ts`.

### Этап 2 — параметризация рантайма через дескриптор · ~5 дней · ✅ ВЫПОЛНЕНО 2026-08-07

Всё ещё без переключателя: активный кит один, legacy. Ценность — снятие всех блокеров.
Проверено: `vitest` 528 passed (+11), `tsc`, `eslint`, `prettier`, `vite build` — чисто.

Три вещи, выясненные по ходу и важные для этапа 3:

- **Состояние кита разделено надвое.** `kits/active.ts` держит ДЕСКРИПТОР и остаётся React-free,
  `kits/runtime.ts` — NAMESPACE. Иначе `model/node-kind` и `preview-runtime/render-policy`,
  которые обязаны работать в node-тестах, потянули бы за собой ui-kit и React. По той же причине
  барел `kits/index.ts` намеренно не реэкспортирует `runtime`/`adapters`.
- **`OVERLAY_LIMITED` и `SUBPATH_LIMITED` — разные вещи, сливать их нельзя.** Оверлей — жёсткий
  запрет, проверяется ДО резолва (Radix-корень без триггера рисует невидимый узел). Subpath-only —
  лишь причина, когда компонент не нашёлся; если кит его поставит, он обязан отрисоваться. В
  дескрипторе это два поля: `previewPolicy` и `unresolvedReason`. Первая версия дескриптора их
  слила — расхождение поймали снапшот-тесты этапа 1.
- **Раскладка чанков поехала.** Суммарный вес всех чанков вырос на 10.4 кБ (это сам слой `kits/`),
  реального роста кода нет. Но ленивый `assets/validate.js` (ajv, ~132 кБ) слился с `App`, то есть
  стал грузиться сразу. Отдельная задача; удобно закрывать вместе с этапом 3, где адаптеры станут
  динамическими `import()` и раскладка всё равно изменится.

Создаётся: `src/kits/active.ts` (лист графа зависимостей, как `config/state.ts`),
`src/kits/adapters/reformer-ui-kit-6.ts` (сюда переезжают статические импорты из
`known-components.ts:18-26`), `src/kits/host-versions.ts` + генератор.

Меняется:
- `preview-runtime/known-components.ts` — `PREVIEW_UIKIT` → `getActiveNamespace()`, `INFRA_LOOKUP`
  из `descriptor.infra`; `KNOWN_COMPONENTS` остаётся module-level, наполняется после boot;
- `preview-runtime/render-policy.ts` — allowlist'ы становятся геттерами от активного кита,
  **экспорты сохранить** (их импортирует `codegen/ui-kit-imports.ts:10` и два теста); `fieldSuffix`
  и `exportName` из дескриптора — шов готов, namespace уже приходит аргументом;
- `preview-runtime/known-names.ts` — `KNOWN_COMPONENT_NAMES` из `const` в функцию (3 места вызова);
- `catalog/contract.ts` — `categoryOf()` берёт карту из дескриптора;
- `catalog/make-node.ts`, `model/node-kind.ts` — compound-шаблоны и leaf из дескриптора;
- `preview-runtime/wizard-preview.tsx:24`, `preview-step.tsx` — `FormWizard` из
  `descriptor.adapters.wizard` через namespace; кит без визарда → синтетика `wizard` гасится сама.

Тесты: `render-policy.test.ts`, `registry-drift.test.ts`, `catalog.test.ts`, `make-node.test.ts` —
параметризовать по фикстуре кита, добавить вторую фикстуру (5 компонентов, свой `fieldSuffix`, своя
preview-политика). Новый `kits/active.test.ts`. Общий `vitest.setup.ts` с `setActiveKit(legacy)`.

### Этап 3 — реестр, переключатель, reload · ~5 дней · ✅ ВЫПОЛНЕНО 2026-08-07 → **оба требования закрыты**

Проверено в браузере: переключение `workspace → 11.0.0`, перезагрузка, выбор сохранился, живое
превью нарисовало `Select`/`Input`/`Textarea`/`Checkbox`, а network показал загрузку модулей
`@reformer/ui-kit-v11` — рисует именно код v11, а не откат. Скриншоты:
`projects/react-playground-e2e/screenshots/builder-kits/`.

Вторым китом взят **v11**, а не v12: мажоры 9/10/11 требуют от рантайма всего шесть символов, и все
они локально есть, тогда как v12 падает на линковке (F6). Каталог для v11 генерируется скриптом
`scripts/gen-kit-catalog.mjs` из `./meta` + `package.json#exports` — у v11 нет `exports['./catalog']`,
и это ровно тот случай, ради которого дескриптор и реестр китов разведены.

Отступления от плана, оба осознанные:

- **Выбор кита в `localStorage`, а не в IndexedDB.** Значение нужно синхронно на бутстрапе, и это
  предпочтение оболочки — там же, где раскладка панелей. IndexedDB несёт то, что в localStorage не
  влезает: handle каталога, шаблоны, черновики вкладок.
- **Несовместимый кит даёт тост и откат на дефолтный, а не экран `BootError`.** Билдер обязан
  остаться рабочим — тот же graceful degradation, что у отсутствующего runtime-bundle.

Побочный выигрыш: адаптеры ушли в отдельные чанки (`reformer-ui-kit` 698 кБ, `reformer-ui-kit-11`
179 кБ), главный `App` упал с 2872 до **1780 кБ**. Эагерная загрузка стала лучше baseline (2689 кБ):
теперь это `App` + чанк активного кита. Заодно Rollup назвал причину загадки этапа 2 дословно:
`validate.js is dynamically imported by index.js but also statically imported by src/io/validate.ts`.

Создаётся: `src/kits/registry.ts`, `src/kits/compat.ts`,
`src/kits/adapters/reformer-ui-kit-12.ts` (по итогам S1), `src/app/KitSwitcher.tsx` (комбобокс
«кит + версия» в `AppToolbar`; несовместимые задизейблены с причиной в tooltip),
`src/io/settings-store.ts` (IDB DB_VERSION 3 → 4).

Меняется: `package.json` билдера (npm-алиас второй версии), `vite.config.ts` (`dedupe` расширить
на `@reformer/core`, `@reformer/cdk`, `@reformer/renderer-react`, `@reformer/renderer-json`,
`radix-ui`, `lucide-react`), `config/boot.ts` (резолв кита → compat-гейт → `await adapter.load()` →
`setActiveKit`; провал резолва **не фатален** — тост и откат на кит по умолчанию, тот же паттерн, что
`fetchRuntimeBundle → null`), `config/BootError.tsx` (ветка «кит несовместим»), `config/types.ts` +
`runtime-config.schema.json` (секция `kits`), `app/AppToolbar.tsx`.

Тесты: `kits/compat.test.ts` (таблица semver-случаев), `kits/registry.test.ts`, `config/boot.test.ts`
(сохранённый кит применяется; неизвестный id → дефолт + предупреждение; несовместимый → BootError).

> Если токены между версиями совпадают (вероятно), **живое превью на компонентах активного кита
> работает уже здесь**. Этапы 4–6 — качество и полнота.

### Этап 4 — CSS-скоупинг токенов · ~4 дня

Vite-плагин `scopeKitTokens()`: для каждого вшитого кита `:root` → `[data-rb-kit="<id>"]`,
`.dark` → `[data-rb-kit="<id>"].dark, [data-rb-kit="<id>"] .dark`. `src/index.css` — `@source` на dist
каждого кита, token-блок chrome остаётся на `:root`. `RuntimePreview.tsx:303-305` — `data-rb-kit`.
Портальный кейс — по итогам S4. Тесты: сборочный (в выходном CSS нет второго `:root` с токенами) +
визуальный smoke через Playwright.

### Этап 5 — `meta.kit` и UX несовпадения · ~3 дня

`packages/reformer-renderer-json/src/types/json-schema.ts` и `schema/form-schema.schema.json` —
`meta.kit`. `model/normalize.ts` (`emptySchema` принимает kit), `app/{seed-schema,form-templates,
wizard-templates}.ts` (штамп для новых), `io/save.ts` + `app/save-actions.ts` (обновлять только если
уже был; тумблер `project.stampKit`). Новый `canvas/KitMismatchBanner.tsx`.
`preview-runtime/unknown-component.tsx` — причина в тексте плашки. `panels/Inspector.tsx` — чип.
Тест-инвариант: round-trip файла **без** `meta.kit` не добавляет ключ.

### Этап 6 — codegen и шаблоны под активный кит · ~3 дня

[codegen/emit-registry.ts:35](projects/reformer-builder/src/codegen/emit-registry.ts#L35) — литерал
`'@reformer/ui-kit'` → `descriptor.codegen.importSpecifier`;
[codegen/ui-kit-imports.ts:24,36](projects/reformer-builder/src/codegen/ui-kit-imports.ts#L24) —
`NEEDS_SHIM` и правило символа из дескриптора; `app/form-templates.ts:275,311` и
`wizard-templates.ts:98,150` — параметризовать; `app/form-templates.test.ts:11`
(`expect(src).toContain("from '@reformer/ui-kit'")`) — параметризовать по активному киту.
Здесь же добить `session`-хранилище открытых файловых вкладок (S5), если не сделано на этапе 3.

### Этап 7 — динамический ESM с лаунчера · ~10 дней, необязательный

Только после того, как киты начнут публиковать собранный CSS (апстрим-задача в
`packages/reformer-ui-kit/vite.config.ts` — следствие F1).

`bin/reformer-builder.mjs`: флаг `--kits-from-node-modules`, резолв пакета в `node_modules` проекта,
раздача его `dist/` по `/__reformer-builder/kits/<pkg>@<ver>/…` с тем же path-traversal-гардом, что в
`resolveFsPath()`. Vite-плагин `importmap` (`transformIndexHtml` + `injectTo: 'head-prepend'`, шимы
отдельными Rollup-входами со стабильными именами; состав мапы — из дескрипторов, F3).
`src/kits/adapters/remote.ts` — `import(/* @vite-ignore */ url)`. Явное подтверждение пользователя
перед первой активацией внешнего кита (RFC-0001 P3 «deny by default»).

---

## 6. Что ломается и как обеспечить совместимость

| Что | Последствие | Митигация |
| --- | --- | --- |
| В `component-catalog.schema.json` (`additionalProperties:false`) добавляется `kit` | Каталог v2 отвергнет **старый** билдер | `kit` опционален; билдер принимает `version: "1.0"` вечно. Билдер в `0.0.0` — до-1.0 приемлемо |
| `KNOWN_COMPONENT_NAMES` из `const` в функцию | 3 внутренних вызова | Правятся одним коммитом; публичного API у билдера нет |
| `OVERLAY_LIMITED`/`SUBPATH_LIMITED` перестают быть литералами | Импортируются `codegen/ui-kit-imports.ts:10` и двумя тестами | Экспорты **сохранить**, переопределить геттерами от активного кита |
| Существующий `--catalog` пользователя | Не должен сломаться | «Неявный кит» (этап 1); `config/load.test.ts` параметризовать v1/v2 |
| Reload закрывает файловые вкладки | Потеря контекста при переключении | Этап 3 — подтверждение и сохранение; этап 6 — `session`-хранилище |
| `io/idb.ts` DB_VERSION 3 → 4 | Миграция IDB | `onupgradeneeded` уже аддитивный (`if (!contains) createObjectStore`) |
| `meta.kit` в `JsonFormSchema` | Мета-схема формы | Аддитивное опциональное поле; **не** писать в файлы, где его не было |
| Размер бандла | `App-*.js` уже 2.69 МБ | Адаптеры **только** через `import()`; контроль размера в CI |

---

## 7. Риски

| # | Риск | Тяжесть | Проверка |
| --- | --- | --- | --- |
| ~~R1~~ | ~~Два мажора кита не уживаются (дубли Radix-контекста)~~ | **Снят** S1 | Дублей нет: по одной копии react/react-dom/radix-ui/lucide-react/signals-core (F6) |
| **R10** | Кит требует host-символ, которого нет в рантайме билдера — жёсткий ESM link error, semver его не ловит | **Высокая**, материализовалась в S1 | Символьный гейт §3.2. Прежде чем бандлить второй кит — синхронизировать `develop` с `main` (отстаёт на 11 коммитов), иначе `renderer-react` не отдаёт `resolveInitialValue`/`useModelArrayItems` |
| **R11** | Версии в `package.json` недостоверны (`6.0.0` при опубликованных 11–12) | Средняя | `host-versions.ts` этапа 3 генерировать не из `package.json`, а из git-тега/установленного пакета |
| ~~R2~~ | ~~Токены разных китов конфликтуют глобально~~ | **Снят** S3 | Скоупинг `:root` → `[data-rb-kit]` компилируется и работает; `@theme inline` даёт утилитам ссылку на голое свойство (F6/S3) |
| R3 | Взрыв размера CSS от нескольких `@source` | Средняя | S2 |
| R4 | Radix-порталы за пределами скоупа | Средняя | S4 |
| R5 | Потеря файловых вкладок при reload | Средняя | S5 |
| R6 | Кит без собранного CSS (F1) блокирует этап 7 | Высокая для 7, нулевая для 1–6 | Апстрим-задача в ui-kit |
| R7 | Дескриптор превращается в свалку «всё, что было в билдере» | Средняя, архитектурная | Правило: в дескриптор идёт только то, что **реально различается** между китами; каждое поле — с примером двух китов с разными значениями. `WizardPreview`/`PreviewStep` остаются кодом билдера (это адаптеры над рендерером, а не код кита) |
| R8 | Расхождение палитры и реестра при новом ките | Средняя | `registry-drift.test.ts` параметризовать по всем вшитым китам — он уже проверяет ровно этот инвариант |
| R9 | Кросс-мажорный рантайм кита | Средняя | semver-гейт §3.2; долгосрочно — §8 |

---

## 8. Запасной путь: iframe

Если появится потребность в **произвольных сторонних китах** (MUI, AntD) или в **кросс-мажорных
версиях рантайма**, единственное решение — вынести превью в iframe со своим полным стеком
(`react` + `core` + `cdk` + рендерер + кит), а наружу отдавать только JSON схемы/модели и координаты
узлов: агент внутри iframe делает хит-тест локально (у него есть DOM с `rbnode-*`) и постит в родителя
`{ token, rect }`, а оверлей и DnD рисуются в родительском документе. Осознанно отложено: текущий
охват его не требует, а стоимость — переписывание всего слоя редактирования превью.

---

## 9. Оценка

| Этап | Дни | Даёт |
| --- | --- | --- |
| 0 — спайки | 2 | Знание, реализуем ли план в bundled-варианте |
| 1 — контракт дескриптора | 3 | Отчуждаемый контракт, ноль изменений поведения |
| 2 — параметризация рантайма | 5 | Все блокеры сняты, кит подменяем в коде |
| 3 — реестр + переключатель + reload | 5 | **Оба требования пользователя закрыты** |
| 4 — CSS-скоупинг | 4 | Киты с разными токенами |
| 5 — `meta.kit` + UX | 3 | Схемы не теряют происхождение |
| 6 — codegen/шаблоны | 3 | Экспорт кода соответствует активному киту |
| **Итого 0–3** | **15** | Минимально полезный результат |
| **Итого 0–6** | **25** | Полный результат |
| 7 — динамический ESM (опц.) | 10 | Киты из `node_modules` пользователя |

---

## 10. Верификация

1. **Юниты**: `npm test --workspace @reformer/builder` — новые `kits/*.test.ts`, снапшот-тест
   эквивалентности каталога (этап 1), параметризованные `registry-drift`, `render-policy`,
   `catalog/contract`, `config/boot`.
2. **Сборка и размер**: `npm run build --workspace @reformer/builder` — проверить, что адаптеры
   вынесены в отдельные чанки и главный чанк не вырос сверх бюджета.
3. **Упаковка ui-kit** (если трогали): `npm run check:packaging --workspace @reformer/ui-kit`.
4. **Ручной сценарий мультиверсионности**: поставить `@reformer/ui-kit` двух мажоров через npm-алиасы,
   запустить билдер, переключить активный кит и убедиться, что палитра, инспектор и **живое превью**
   сменились, а черновики пережили reload.
5. **E2E (playwright)**: спека в `projects/react-playground-e2e/tests/` — смена кита, перезагрузка,
   восстановление черновика из IndexedDB, живой рендер `Input`/`Select` активного кита; скриншоты в
   `projects/react-playground-e2e/screenshots/builder-kits/`.
6. **Регресс hosted-режима**: сборка с `BUILDER_BASE` и проверка, что без лаунчера билдер работает на
   вшитом ките без ошибок в консоли.
