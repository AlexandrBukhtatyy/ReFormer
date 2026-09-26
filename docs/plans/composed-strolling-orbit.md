# Билдер по доменам: ядро домена внутри домена, киты — платформа, стек RJSF, сборка под организацию

Разбор против `develop` на 2026-09-25, актуализирован после `d90e3a31`. Перед Ф1 и Ф3 (массовые
переносы) рабочая копия должна быть чистой — сейчас в ней чужая правка
`plugins/editor-monaco/ui/MonacoEditor.tsx`.

### Что изменилось в проекте с первого разбора (`653e40c0..d90e3a31`)

| Коммит     | Что                                                                   | Влияние на план                                                                                    |
| ---------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `9a271d9c` | `mountReact` снимает поверхность в два хода (свой элемент `display: contents` уходит сразу, корень — микрозадачей), как `plain` | образец для поверхности RJSF (Ф6); `surfaces.browser.test.tsx` обновлён — новый describe Ф4 ложится в него |
| `0213e9e0` | `ApplyOptions.write` в SDK — пометка правки модели для журнала        | команды RJSF-редактора могут передавать пометку; иначе не влияет                                   |
| `6e1f432b` | находки валидатора во вкладке файла шага (`shell/boot/ports/monaco.ts`, `project/document-models.ts`) | новых импортов нет; пути `@/plugins/editor-monaco` в Ф1 — те же                                    |
| `ceb8c6fc`, `e14ce6b3`, `90526a17`, `f6261c8d`, `29a2d5d9` | ui-kit визард, MCP, сайт, eval, таймауты тестов | не пересекаются                                                                                    |

Связанные открытые задачи, которых не было в плане: `ReFormer-twlf` (компоненты кита теряют
`className` — токены живого вида) → Ф0; `ReFormer-3ybp` (`revalidate()` не зовётся при смене кита)
→ Ф2; `ReFormer-29kx.23` (ленивость kits: токен в лист) — снимается Ф2 (токен уходит в SDK);
`ReFormer-mmy` (каталог генерируется в ui-kit) — продолжается самодекларацией кита в Ф2.

## Контекст

Цель — билдер (`projects/reformer-builder`, `@reformer/builder`), который собирается из плагинов
по-разному под задачи организаций: ReFormer со своими плагинами редактирования и рендера схемы,
RJSF, способный рисовать любой кит, HexaUI-кит внешним плагином. Разбор показал: платформа
(профили, возможности, внешние плагины, настройки проекта) это почти умеет, но домен ReFormer разорван
между `packages/reformer-builder-stack-*` и `src/plugins/*`, кит — под-ось стека ReFormer и
подключается только правкой композиции, превью теряет адаптеры полей, другого рендера нет,
организация не может объявить свой состав и свои умолчания.

### Решения (из обсуждения)

1. **Один билдер + конфиг.** Домены — папки внутри билдера; организация собирает состав конфигом
   запуска и внешними плагинами. Отдельных дистрибутивов нет.
2. **Ядро домена — внутри домена** (`plugins/<домен>/core`). Пакеты `stack-*` упраздняются. Пакетами
   остаётся только нейтральное и рантайм-библиотеки, нужные вне билдера: SDK, toolkit, `renderer-*`,
   `ui-kit`, `cdk`, `ui-kits/*`, новый `rjsf-kit-theme`.
3. **Чужой домен расширяют только возможностями с версиями**; код домена во внешние плагины не
   вкладывается (CLI перестаёт вкладывать стеки).
4. **Контракт кита — в SDK**: киты стали общими для доменов и для внешних кит-плагинов.
5. **RJSF рисует любой кит автотемой из каталога.**
6. **HexaUI — только внешний плагин.**

## Архитектура

```text
projects/reformer-builder/src/plugins/<домен>/                id плагинов НЕ меняются
  base/      files, editor-monaco, editor-markdown, plugin-manager, preview (хост)
  kits/      registry                 reformer.kits — реестр китов (нейтральный)
  reformer/  core/                    ← бывший @reformer/builder-stack-reformer (без контракта кита)
             editor ← editor-schema · render ← preview-runtime · validator ← validator-schema
             codegen · templates · ai
  rjsf/      core/                    формат rjsf-form/1, операции, проверки, печать экспорта
             editor (reformer.rjsf.editor) · render (reformer.rjsf.render)
  plain/     core/ ← stack-plain · demo ← plain (reformer.plain)
packages/
  reformer-builder-plugin-api  SDK + контракт кита (точка, возможность, типы, дескриптор; схема и валидатор — tooling)
  reformer-builder-toolkit     нейтральные помощники печати (Eta, маркер, имена) — остаётся
  rjsf-kit-theme               НОВЫЙ рантайм: тема RJSF из любого кита (нужна и экспортированным формам)
  ui-kits/reformer-hexa-ui     домен hexa-ui: библиотека + внешний плагин kit-hexa-ui
```

Правила (линтер + храповики `structure.test.ts`):

- плагин видит SDK, `core` СВОЕГО домена и библиотеки; не видит соседние плагины, чужие `core`, `@/shell`;
- `core` — чистый: без React, без рантайма SDK (только `import type`), без `@/shell`/`@/plugins/*`
  кроме своего `core`;
- междоменное и внешнее — через SDK (точки, возможности); оболочка не видит `@/plugins/*/core`
  (замена правила `denyStack`);
- в папке домена — папки плагинов (`manifest.json` + `index.ts`) и необязательный `core/`.

Составы: `reformer.builder` = base + kits + reformer; `rjsf.builder` = base + kits + rjsf; HexaUI —
внешним плагином к любому; свой профиль и умолчания — в конфиге запуска.

## Шаг 0. beads

Новый эпик «Билдер по доменам» (`bd dep relate` с `ReFormer-s0j`, `ReFormer-es12`), задачи Ф0–Ф8;
существующие `ReFormer-twlf` и `ReFormer-3ybp` не дублировать — привязать к Ф0 и Ф2
(`bd dep add`/`--parent`). Зависимости: Ф1←Ф0; Ф2←Ф1; Ф3←Ф2; Ф4←Ф2; Ф5←Ф4; Ф6←Ф2 (и Ф3 для `plugins/rjsf/core`); Ф7←Ф1.
В конце — `bd export -o .beads/issues.jsonl`. Коммит/пуш — только по явной просьбе (удобно по фазе).

## Ф0. Адаптеры полей в превью (баг, первым)

`isolateComponent` (`plugins/preview-runtime/runtime/stubs.tsx:36-40,131`) не копирует
`reformerAdapter`; рендерер берёт адаптер с обёртки (`renderer-react/src/core/render-node.tsx:197`),
`resolveFieldAdapter` билдер не передаёт → `Input` пишет в модель событие, `Checkbox` получает
`value` вместо `checked` (с 19.09, `80202f98`).
- `stubs.tsx`: `'reformerAdapter'` в `CONTRACT_STATICS` (экспорт для храповика).
- `runtime/stubs.test.ts` (статики переживают обёртку; храповик по статикам экспортов ui-kit) и
  `runtime/field-adapters.browser.test.tsx` (ввод → строка, клик → boolean; красный до правки).
- Та же регрессия 19.09 с другой стороны — `ReFormer-twlf`: живой вид пишет «ни один узел формы не
  помечен классом-токеном» (`plugins/editor-schema/ui/LiveView.tsx:390`). Токен кладётся в
  `componentProps.className` (`preview-runtime/schema/annotate.ts`) и должен доехать до корня
  компонента или блока поля; `isolateComponent` `className` передаёт — искать в ui-kit (обёртка поля,
  `withFieldTooltip`, `strip` адаптеров). Браузерный тест: у `Input`, `Checkbox`, `Box` в DOM есть
  `rbnode-*`; красный до правки.

## Ф1. Папки доменов (только перенос плагинов)

- `git mv` плагинов по дереву выше; манифесты, словари, ключи настроек — без изменений.
- Пути: `application/composer/builtin-plugins.ts`, `shell/boot/{boot,composition}.ts`,
  `shell/boot/ports/{files,markdown,monaco}.ts`, `shell/boot/integration/*`, `builtin-plugins.test.ts`.
- `src/structure.test.ts:139-189` — обход `plugins/<домен>/<плагин>`, правила выше, исключение
  `'plugins/ai/tools'` → `'plugins/reformer/ai/tools'`.
- `vite.config.ts:27-29,142-146` — владелец чанка из `/src/plugins/<домен>/<плагин>/` →
  `assets/plugins/<домен>-<плагин>-*.js`.
- `eslint.config.js` — правила доменов (выше); `@/plugins/*` ловит глубокие пути по журналу v4 —
  перепроверить на `@/plugins/reformer/editor`.
- Живые документы: `docs/project-structure.md`, `docs/plugin-and-shell.md`.
- Приёмка: `npx tsc -b`, `npm test`, `npm run test:browser`, `npm run lint` зелёные; набор чанков
  `npm run build` тот же (переименованы только `assets/plugins/*`); диф манифестов пуст.

## Ф2. Киты — платформа: контракт в SDK, нейтральный реестр

**SDK** (`packages/reformer-builder-plugin-api`), новый каталог `src/kits/`, экспорт из `index.ts`
(относительные импорты с `.js`):
- `catalog.ts` — типы JSON-контракта из `stack-reformer/catalog/types.ts` и `kits/types.ts`:
  `CatalogJson`, записи, `KitDescriptorJson`, `CATALOG_CONTRACT_VERSION`; `propsSchema` —
  структурный JSON Schema (`@reformer/ui-kit/meta` в SDK не тянем); контракт 2.1, аддитивно:
  `kit.infra.fieldFrame`, `kit.renderers.rjsf { widgets?, templates? { field?, object?, submit? } }`;
- `descriptor.ts` — `KitDescriptor`, `toDescriptor(json)` без неявных умолчаний (поле
  `compoundTemplates` с `JsonNode` удаляется — дескриптор его не заполняет, `descriptor.ts:139`);
- `source.ts` — `CatalogLoader`, `KitSource { catalog; kit?; namespace? }` (`options` не переносится,
  если подтвердится, что не используется), `KitSourcePoint = defineExtensionPoint('reformer.kit.source')`,
  `declaredKitId`;
- `service.ts` — нейтральный `KitsService` (`activeId`, `descriptor`, `catalogJson`, `available`,
  `activate`, `onDidChange`, `namespace`, `onDidLoadNamespace`, `activeOrigin`, `Frame`,
  `onDidChangeAvailable`) и `KitsCapability = defineCapability({ id: 'reformer.kit.catalog',
  version: '2.0.0' })` — мажор: ReFormer-проекция `catalog()` уходит из контракта;
- `field-frame.ts` — `KitFieldFrameProps { id?; label?; description?; required?; errors?;
  inlineLabel?; hidden?; className?; children? }`; в JSDoc контракта — требование к любому киту:
  корневой элемент компонента принимает `className` (иначе не работают выбор узла кликом и
  подсветка — урок `ReFormer-twlf`);
- `ui/plugin-scope.ts` — `PLUGIN_SCOPE_ATTRIBUTE`, `pluginScopeAttributes(pluginId)`;
  `shell/platform/plugin/styles.ts` реэкспортирует константу (литерал один; оболочка использует
  атрибут только для CSS — пометка чужого поддерева безопасна);
- `tooling`: `component-catalog.schema.json` и `loadCatalogValidator()` (ajv — новая зависимость
  SDK, грузится лениво); `reformer-plugin validate` проверяет каталог кит-плагина;
- тесты перенесённых дескриптора и контракта, `source.test.ts`, валидатор на 2.0/2.1.

**Встроенный кит объявляет себя сам.** `packages/reformer-ui-kit/scripts/generate-catalog.ts` пишет
полный блок `kit` (id, label, package, infra с `fieldFrame`, adapters, palette, styles, codegen) и
флаги записей (`preview: limited` у оверлеев, `subpath`, `leaf`) — данные из
`stack-reformer/kits/legacy-reformer-ui-kit.ts`, который удаляется вместе с «неявным китом».
Эквивалентность стережёт `catalog-equivalence.test.ts` (снимок дескриптора не меняется).
Плюс `FieldFrame` в `src/components/field/variants/frame/field-frame.tsx` (каталог `field` не
палитровый — `scripts/generate-catalog.ts:68`), экспорт из барреля и `@reformer/ui-kit/field`.

**Реестр китов** (`plugins/kits/registry`): регистрирует SDK-шный `KitsCapability`; `buildCatalog`
больше не зовёт — `catalogJson()` отдаёт сырой каталог кита, `descriptor()` — `toDescriptor`.
- `syncContributed` по `ctx.extensions.get(KitSourcePoint)` + `observe`; владелец —
  `Contribution.pluginId`; наблюдатель не бросает никогда (иначе падает `contribute()` чужого плагина).
- Внесённый кит обязан объявить id (`no-id`); совпадение id — побеждает встроенный, затем первый по
  реестру (`duplicate`); каталог проходит `loadCatalogValidator()` (`invalid-catalog` → пустой);
  отказы → уведомление `pluginMessageKey(ctx.id, 'problem.rejected')`.
- Активный: `stored() ?? (есть activeId ? activeId : defaultId)` после каждой синхронизации — выбор
  появился → переключиться без записи настройки; плагин выключили → умолчание, настройка цела.
- `Frame` — стабильный компонент службы: `<div {...pluginScopeAttributes(owner)} data-rb-kit={id}
  className="contents"><Provider>…</Provider></div>`, провайдер — `namespace[adapters.provider.symbol]`,
  граница ошибок; у встроенного кита атрибута нет.
- Тесты `service.test.ts`/`plugin.test.ts` (добавление/снятие, дубликат, без id, поздний выбор,
  выключение/возврат, стабильность снимков, `activeOrigin`, невалидный каталог, namespace, порядок
  активации не важен), браузерный тест `Frame`.

**ReFormer-проекция уходит к потребителям.** `projectCatalog(json, descriptor)` — мемо по
идентичности `json`: записи `CatalogEntry` с `makeNode`, синтетика `$html`/`FormArray` (пока в
`stack-reformer/catalog`, в Ф3 — `reformer/core/catalog`). Адаптеры `host-from-context.ts` плагинов
editor, render, validator, codegen, templates, ai берут `catalog()`/склеенный JSON через неё и
`KitsCapability` из SDK — структурные копии возможности удаляются; манифесты требуют `^2`.

**Загрузчик плагинов греет ленивые модули оболочки** (`shell/platform/plugin/loader.ts:353` греет
только движок TS; `@reformer/cdk/*`, `@reformer/ui-kit` — `lazyBuiltin`, `plugin-modules.ts:125-135`):
`PluginLoaderDeps.warm?(files)` параллельно с `prepare`, отказ → `code-failed`; `boot.ts` — в обоих
`createPluginLoader`; тест в `loader.test.ts`.

**Перепроверка документов при смене кита** (`ReFormer-3ybp`): у оркестратора есть `revalidate()`
(`shell/platform/services/validation/orchestrator.ts:361`), но его никто не зовёт, а плагину он
недоступен. В SDK — `ValidatorContribution.onDidChangeInputs?(cb): Disposable`: валидатор, чей
результат зависит не только от документа, сообщает о смене входа; оркестратор перепроверяет
документы, к которым он применим. Валидатор схемы ReFormer подписывает его на
`KitsCapability.onDidChange` — кит, внесённый плагином позже открытия вкладки, сразу даёт
`schema.unknown-component`. Тест оркестратора + интеграционный.

Приёмка Ф2: редактор, палитра, инспектор, валидатор, превью, кодоген, ассистент ведут себя как до
фазы (полный прогон тестов + живой прогон `reformer.builder`); `reformer.kits` не импортирует
`stack-reformer`; смена кита перепроверяет открытые формы.

## Ф3. Ядра доменов вместо пакетов stack-*

- `git mv packages/reformer-builder-stack-reformer/src/{form-model,catalog,codegen,form-mock,form-fixture,form-inspect,testing}`
  → `projects/reformer-builder/src/plugins/reformer/core/` (тесты, фикстуры, снимки, `.eta` —
  шаблоны грузятся через `?raw`, в Vite билдера работает как есть); `stack-plain/src` →
  `plugins/plain/core/`.
- Импорты `@reformer/builder-stack-reformer/<м>` → `@/plugins/reformer/core/<м>` (441 строка в
  197 файлах — механически); react-playground `debug/ui_builder` → `@builder-src/plugins/reformer/core/…`
  (алиас уже есть и используется для `shell/platform/modules`).
- Зависимости: из `package.json` билдера убрать оба стека (нужные ядру `@reformer/mcp`, `ajv`,
  `renderer-json`, `core`, `ui-kit`, toolkit у билдера уже есть); алиасы стеков в `vite.config.ts`,
  `vitest*.config.ts`, `tsconfig.app.json` — удалить.
- CLI: `PLUGIN_BUNDLED_PACKAGES` = только `@reformer/builder-toolkit`; `build.test.ts` — стек больше
  не вкладывается (отказ `module-unavailable`).
- Корень: `typecheck`, `.github/workflows/test.yml`, scope в `commitlint.config.js`/`CONTRIBUTING.md`.
- npm: `@reformer/builder-stack-reformer@1.0.0-beta.1` опубликован — `npm deprecate` делать ТОЛЬКО с
  явного согласия владельца (внешнее действие).
- Приёмка: гейты билдера зелёные, `packages/reformer-builder-stack-*` нет, линтер держит правила
  `core`, playground собирается.

## Ф4. Рендер ReFormer в рамке кита

- `plugins/reformer/render/{host,host-from-context,testing}.ts`: `Frame`, `activeOrigin` из
  `KitsCapability` (SDK).
- `runtime/RuntimeView.tsx`, `compiling/CompilingView.tsx`: `<JsonRendererProvider>` внутри
  `kits.Frame`; `Highlight` снаружи.
- `compiling/kit-imports.ts`: `kitImportOverrides` — `descriptor.codegen.importSpecifier → namespace`
  только для кита с владельцем-плагином; `mergeOverrides(kit, fixture)` — фикстура побеждает;
  `CompilingView` → `isolation.overrides` (линковщик применяет их первыми для любого спецификатора).
- Тесты: `kit-imports.test.ts`; в `surface/surfaces.browser.test.tsx` — форма внутри
  `[data-rb-plugin="fixture-kit"]` провайдера, у встроенного атрибута нет, `overrides` доходят до
  `modules.load`; `shell/boot/integration/kit-styles.browser.test.tsx` — стиль плагина действует
  только внутри превью.

## Ф5. HexaUI — внешний плагин (зависит только от SDK)

`packages/ui-kits/reformer-hexa-ui/`:
- `manifest.json`: `id "kit-hexa-ui"`, `version` = `package.json`, `apiVersion "^1"`,
  `main "src/builder-plugin.ts"`, `styles { file "src/builder-plugin.css", isolation "scoped" }`,
  `requires.required [{ id "reformer.kit.catalog", range "^2" }]`;
- `src/builder-plugin.ts`: `export default definePlugin(…)` → `contribute(KitSourcePoint,
  { catalog, namespace: () => import('./namespace').then(m => m.HEXA_UI_NAMESPACE) }, { id: 'hexa-ui' })`
  (`./namespace` статически не импортировать — ~4 МБ исполняются только по запросу namespace);
- `src/builder-plugin.css`: `@import '@kaspersky/hexa-ui/design-system/global-style/styles.css';`
  (CLI бандлит `@import` из node_modules);
- `src/provider.tsx`: импорт CSS → `src/index.ts`, убрать `div.rb-kit-scope` (скоуп ставит `Frame`);
  `src/field-frame.tsx` на HexaUI `Field` → `namespace.ts`, `catalog.json` (`infra.fieldFrame`,
  `$schema` на схему SDK);
- `package.json` (devDependencies SDK, CLI, `typescript`, `vitest`; скрипты `test`, `typecheck`,
  `plugin:validate|build|dev`), `tsconfig.json`, `vitest.config.ts`, `README.md`;
- `src/builder-plugin.test.ts`: id = манифест; вклад в точку; namespace не грузится при активации;
  каталог проходит валидатор SDK; все символы каталога есть в `namespace.ts`.
- Сквозной `shell/boot/integration/external-kit-plugin.test.ts` (образец `external-editor-plugin.test.ts`):
  фикстурный плагин с верхнеуровневым `require('@reformer/cdk/form-field')` → включить → кит в
  `available()` с `owner` → активировать → каталог и namespace доехали → выключить → умолчание →
  включить → снова активен.
- Приёмка: `reformer-plugin validate|build` чисто, сухая активация проходит; HexaUI нет в
  зависимостях билдера.

## Ф6. Домен rjsf

- `plugins/rjsf/core/` (чистое): `RjsfForm { $schema: 'rjsf-form/1'; schema; uiSchema? }`
  (заголовок — `schema.title`), `RJSF_PROVIDER_ID = 'rjsf.form'`; `parse.ts`, `ops.ts`
  (`add/remove/rename/move/set-field`, `set-title` с обратными; `required ⊆ properties`, `ui:order`
  полон или с `'*'`, `uiSchema[name]` едет с полем, `apply(apply(f, op).inverse) ≡ f`), `check.ts`
  (`empty-name`, `required-unknown`, `order-unknown`/`order-missing` — error, `enum-empty`,
  `widget-unknown`), `defaults.ts`, печать `Form.tsx` (`@rjsf/core` + `@rjsf/validator-ajv8`,
  toolkit `renderTemplate` + `withMarker`); тесты — круг разбор↔печать, пробы не пересекаются с
  ReFormer и plain, инварианты, печать.
- `packages/rjsf-kit-theme` (`@reformer/rjsf-kit-theme`, private; peer `react`, `@rjsf/core`,
  `@rjsf/utils`, `@reformer/core`; от пакетов билдера не зависит):
  `createKitTheme({ namespace, components, slots, widgets, templates }) → { theme, problems }`;
  сопоставление по умолчанию: TextWidget←Input · PasswordWidget←InputPassword|Input ·
  TextareaWidget←Textarea · CheckboxWidget←Checkbox|Switch · SelectWidget←Select|NativeSelect ·
  RadioWidget←RadioGroup · RangeWidget←Slider · UpDownWidget←InputNumber · DateWidget←DatePicker;
  мост `WidgetProps` → `bindFieldProps(getFieldAdapter(C), { value, onChange, onBlur }, { id,
  disabled, placeholder, required, options: enumOptions→{value,label}[], 'data-testid' })`; каждый
  полевой компонент кита — ещё и виджет под своим именем (`"ui:widget": "Switch"`); шаблоны:
  `FieldTemplate` → `infra.fieldFrame` (подпись скрыта у `inline-label`; нет рамки — своя
  минимальная), `ObjectFieldTemplate` → `Box`, `SubmitButton` → `Button`; `renderers.rjsf`
  перекрывает; без кита — стандартная тема RJSF; тесты node + браузерные (ui-kit через мост).
- `plugins/rjsf/editor` (`reformer.rjsf.editor`, lazy, `workspace.save`, optional
  `reformer.preview.live ^1`, `reformer.kit.catalog ^2`): провайдер (`peek` + `looksLikeRjsfForm`,
  `nodePaths`), валидатор (`reformer.rjsf.editor:<code>`), редактор (приоритет 100; поля + инспектор;
  виджет — стандартные RJSF + полевые компоненты активного кита; живая форма через
  `PreviewLiveCapability.mount`), команды `rjsf.new|addField|undo|redo|export`, меню, словари.
- `plugins/rjsf/render` (`reformer.rjsf.render`, lazy, optional `reformer.kit.catalog ^2`):
  поверхность (`applies: providerId === RJSF_PROVIDER_ID`, `createRoot` + ленивый `RjsfPreview`,
  `hitTest:false`; снятие в два хода — свой элемент `display: contents` уходит сразу, корень
  размонтируется микрозадачей, как `mountReact` в `preview-runtime/surface/mount.ts` после
  `9a271d9c`) — `withTheme(createKitTheme(<catalogJson + namespace>).theme)` внутри `kits.Frame`,
  `formData`/`keepValues`, ошибки → `ctx.report`.
- Состав: две ленивые записи; `rjsf.builder` = `builder.base` + `reformer.kits`,
  `reformer.rjsf.editor`, `reformer.rjsf.render`; храповики исключений стеков — из профилей;
  `i18n-completeness`; devDependencies билдера `@rjsf/core|utils|validator-ajv8 ^6.10.1` (peer
  `react >=18`), `rjsf-kit-theme`; `npm ls ajv` (нужен `^8.20`); `optimizeDeps.include`.
- Тесты: `editor/plugin.test.ts`, `render/surface.browser.test.tsx`,
  `shell/boot/integration/rjsf-profile.test.ts` (владельцы точек, пробы трёх форматов не
  пересекаются, совмещённый профиль reformer+rjsf собирается).

## Ф7. Сборка под организацию — конфигом

- `profiles?: { id; name; extends?; plugins; providers? }[]` в конфиге запуска: разбор с `problems`
  (`shell/boot/runtime-config.ts`), `runtime-config.schema.json` + тест согласия; совпадение id со
  встроенным — проблема и пропуск; имена плагинов — через таблицу псевдонимов (`canonicalOverrides`).
  `fromProfile(profile, overrides, lookup = findProfile)`; `applicationFromRuntime` ищет `preset`
  сначала в профилях конфига; отказ — предупреждение и полный профиль.
- `defaults.settings?: Record<string, unknown>` → слой «умолчания запуска» в
  `shell/platform/services/settings.ts`: проект → пользователь → запуск → умолчание плагина
  (второй `registerDefault` бросает — поэтому слой). Кит организации:
  `"plugin.kits.active": "hexa-ui"` — реестр переключится сам, когда плагин внесёт кит.
- Dev-эндпоинт: `vite.config.ts` (`configureServer`) отдаёт `{ config }` из `REFORMER_BUILDER_CONFIG`
  или `<cwd>/.ui_builder/config.json` по `/__reformer-builder/runtime.json` (сейчас SPA-фолбэк →
  `null`). Лаунчер конфиг не валидирует — новые поля проходят.
- `runtime-config.schema.json`: описание `preset` называет все встроенные профили (+ храповик).
- Руководство `projects/reformer-builder/docs/composition.md`: ReFormer + HexaUI; RJSF + ui-kit; свой
  профиль; проект организации с `.ui_builder/plugins/kit-hexa-ui/` и `.ui_builder/settings.json`
  (`"workspace.plugins.enabled": ["kit-hexa-ui"]`).

## Ф8. Документация и задачи

`docs/decisions-log.md` — «Ядро домена внутри домена» (почему не пакеты: разорванный домен,
вложенные копии без проверки совместимости, церемония; чем отличается от удалённого `src/lib`),
«Киты — платформа», «Тема RJSF из кита», «Сборка под организацию конфигом»; `docs/plugin-and-shell.md`
(`reformer.kit.catalog` 2.0, `reformer.kit.source`, `pluginScopeAttributes`, умолчания запуска);
`docs/project-structure.md`; README SDK, CLI, `rjsf-kit-theme`, HexaUI. beads: `s0j.16` — заменена
точкой и `defaults.settings`; `s0j.12` — доставкой плагином; `s0j.17` — после Ф5; `twlf` — после
Ф0; `3ybp` — после Ф2; `29kx.23` — снята (токен кита в SDK, «лист» не нужен; eager у `reformer.kits`
остаётся ради параллельной загрузки каталога); `mmy` — заметка о самодекларации кита; заметки в
`s0j.9`, `s0j.4`; перепроверить `s0j.18`.

## Проверка

Гейты — из каталога пакета (корневой `tsc -b` эмитит .js): SDK, toolkit, `rjsf-kit-theme` —
`npx tsc --noEmit -p tsconfig.json` + `npm test`; ui-kit — тесты + генерация каталога; HexaUI —
`npm run typecheck`, `npm test`, `npx reformer-plugin validate|build`; билдер — `npx tsc -b`,
`npm test`, `npm run test:browser`, `npm run lint`, `npm run build` (раскладка `dist/assets`, `@rjsf`
и HexaUI вне стартового графа); playground — сборка; корень — `npx prettier --check`.

Вживую — матрица составов (Playwright MCP; `npm run dev` в фоне, логи `.tmp/dev-logs/`; проект
`.tmp/kit-demo/` через подмену `showDirectoryPicker` каталогом OPFS — приём из decisions-log
2026-09-05; скриншоты с абсолютным `filename` в `projects/react-playground-e2e/screenshots/builder-domains/<состав>/`):

| Состав                                     | Что проверить                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `reformer.builder` + ui-kit                | ввод в превью — строка, чекбокс — boolean; всё как до переносов                        |
| `reformer.builder` + `kit-hexa-ui`         | превью в HexaUI и его теме; chrome не изменился (`getComputedStyle` до/после); выпадашка Select; компилирующая поверхность без «модуль недоступен»; выключить/включить плагин |
| `rjsf.builder` + ui-kit                    | новая форма, правка полей, превью компонентами ui-kit, отмена, экспорт `Form.tsx`, находка `order-missing` |
| `rjsf.builder` + `kit-hexa-ui` + `defaults.settings` | RJSF рисует HexaUI, кит выбран умолчанием организации                        |
| свой профиль из `profiles`                 | состав собрался поимённо; опечатка — предупреждение и полный профиль                   |

## Риски

1. Массовые переносы (Ф1, Ф3) конфликтуют с параллельной работой — чистая рабочая копия, отдельные
   коммиты без правок поведения.
2. Нейтрализация реестра китов (Ф2) трогает шесть плагинов ReFormer — эквивалентность стерегут
   `catalog-equivalence` и полный прогон; самодекларация каталога ui-kit меняет опубликованный JSON
   (аддитивно).
3. Мажор `reformer.kit.catalog` 2.0.0 — внешних потребителей нет, встроенные переходят в той же фазе.
4. HexaUI и React 19 — частично; глобальные эффекты HexaUI мимо скоупа (`:root{--color-*}` без
   пересечений с токенами, `body.theme-dark`, одно `h3{}`) — проверка chrome в матрице.
5. Мост RJSF опирается на соглашения китов (опции `{value,label}`, адаптеры-статики) — расхождения
   уточняет `renderers.rjsf`, видны в `problems` темы. RJSF v6: имена пропсов сверить по типам.

## Не входит (завести задачами)

1. Публичные возможности домена reformer для внешних расширений (цель кодогена, валидатор, инструмент
   ассистента) и дом для их типов — когда появится первый внешний потребитель.
2. Экспорт RJSF-формы с темой кита (`Form.tsx` импортирует `@reformer/rjsf-kit-theme` и пакет кита).
3. Кодоген ReFormer печатает провайдер кита в `index.tsx` (`s0j.11`); подпути кита в компилирующей
   поверхности; политика `importSpecifier` приватных китов.
4. RJSF: вложенные объекты/массивы (шаблон массива на `FormArray` кита), `jsonSchema()` для Monaco,
   ассистент.
5. Конфиг запуска заранее доверяет плагинам каталога/npm — решение о границе доверия.
6. `reformer-plugin create --template kit|domain`; раздел настроек «Киты»; MCP `generate_form` под
   другие киты; `npm deprecate` пакета `@reformer/builder-stack-reformer` (с согласия владельца).
