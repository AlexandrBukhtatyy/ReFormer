# Полный каталог HexaUI из типов: общий генератор каталогов, все поля и визард

## Context

Билдер умеет работать с разными UI-китами: кит вкладывается в точку `reformer.kit.source`
(SDK `packages/reformer-builder-plugin-api/src/kits/source.ts`), служба `reformer.kit.catalog`
(`.ui_builder/plugins/forms/kits/src/service.ts`) держит активный кит, а палитра, инспектор,
кодоген, превью, ИИ, валидатор и RJSF-тема читают его каталог через `projectCatalog`.

У `@reformer/ui-kit` каталог полный — `packages/reformer-ui-kit/component-catalog.json` (364 записи,
контракт 3.0, генерируется из TS-типов скриптом `scripts/generate-catalog.ts`). У плагина HexaUI
(`projects/reformer-builder-playground/.ui_builder/plugins/kit-hexa-ui/`) каталог ручной: 21
запись, контракт 2.1, 6 полей, `wizard: null`. В HexaUI ~140 экспортов, полей ввода ~20. Поэтому
форму на HexaUI собрать целиком нельзя: части полей нет, визард и шаг — заглушки. Плюс дефект
билдера: шаблоны составных компонентов (`COMPOUND_TEMPLATES`) рассчитаны на ui-kit и
вставляют части (`CardHeader`, `AlertTitle`), которых у HexaUI нет.

Цель — пользоваться в билдере разными китами на равных. Решения пользователя: адаптеры для ВСЕХ
полей HexaUI; визард HexaUI по протоколу 3.0 в этом же плане; ОБЩИЙ генератор каталога для любых
китов (HexaUI — первый потребитель); в каталоге все экспорты HexaUI по ролям.

## Подход

### 1. Общий генератор каталога — `@reformer/builder-plugin-cli`

Новая команда `reformer-plugin catalog [каталог] [--config <файл>] [--check]` и программный API
`@reformer/builder-plugin-cli/catalog` (`generateKitCatalog`, `checkKitCatalog`, `diffCatalogs`).
В CLI, а не в SDK: SDK — контракт данных без TypeScript в рантайме; CLI уже зовёт
`loadCatalogValidator` из `@reformer/builder-plugin-api/tooling` и проверит результат той же
ajv-проверкой, что и реестр китов. `typescript` — необязательная peer-зависимость, грузится
динамически из каталога кита (`createRequire`).

Модули `packages/reformer-builder-plugin-cli/src/catalog/`: `config.ts` (тип
`KitCatalogConfig`, `defineKitCatalog`, пресеты; подпуть `./catalog-config` без зависимостей),
`load-config.ts` (`catalog.config.mjs` с `// @ts-check` или `.json`), `program.ts`,
`introspect.ts`, `policy.ts`, `records.ts`, `emit.ts`, `drift.ts`, `index.ts`; команда
`src/commands/catalog.ts` по образцу `validate.ts`; `cli.ts` (USAGE, `accepted.catalog`);
`findings.ts` (коды `catalog-config-invalid`, `catalog-drift`, `catalog-symbol-missing`,
`typescript-missing`).

Логика переносится с обобщением из ui-kit (сами скрипты ui-kit не трогаем; их перевод на ядро —
отдельная задача): `scripts/introspect-props.ts` (`unwrapComponentFunction`, `pickDeclaration`,
`jsdocDefault`, `declaredUnionOrder`, `jsonTypeOf`, сбор `domEvents`), `scripts/props-policy.ts`
(`keepProp`, `skipReason`, `inheritsOf`, `packageOf`), `scripts/generate-catalog.ts`
(`propToSchema`, `buildProperties`, `requirePaletteRecord`, сериализация).

Ключевые правила:
- **Интроспектируется вход пакета кита** (`entry: './src/index.ts'`) — запись описывает тот
  символ, который импортирует кодоген и рисует превью. Пропсы обёрток — из их типов (обёртки
  обязаны иметь точные типы; запасной путь `records[X].propsFrom`).
- **Владение пропсами**: `kit` (исходники кита) и `own` (`ownership.packages`:
  `@kaspersky/hexa-ui`, `hexa-ui-core`) → `properties`; чужие (antd, rc-*) → `x-inherits.packages`
  (нужные возвращает белый список `props.pick`); `@types/react` → `x-inherits.react`. aria/data,
  DOM-события, `NEVER_KEEP`, `className` — как в ui-kit. `@deprecated` пропускаются.
- **Тип пропсов**: первый параметр сигнатуры, иначе разбор аннотации (`FC`/`VFC`/`ForwardRef`/
  `memo`/`StyledComponent<C,T,O>`/пересечения) — без этого теряются `Calendar`, `RangePicker`,
  `Skeleton`, `GridItem`, `Nav` (нет `VFC` в `@types/react` 19, нет `@types/styled-components`).
- **Роль field**: экспорт со свойством `reformerAdapter`; тип значения задаёт конфиг
  `fields[name].value` (самодостаточный TS-тип); биекция «статика ↔ `fields`» обязательна.
  `properties` поля = пропсы обёртки − шов (`value/onChange/onBlur/disabled` + `seam`) + пресет
  обёртки поля `'reformer'` (`label`, `required`, `description`, `labelTooltip`, `testId`,
  `tooltip`); `x-runtimeProps` — пресет шва + `value`/`onChange` из конфига. Группы `x-doc.group`
  по имени пропса (пресет `groupByName`), `optionsProp` для `options/items`.
- **Статики** (`Textbox.Masked`, `Tabs.TabPane`, …) находятся автоматически и требуют решения в
  `statics` (`ignore` либо плоский экспорт кита). **Части** — только явно (`parts`), префиксное
  правило ui-kit выключено (`CheckboxGroup` ≠ часть `Checkbox`).
- **Классификация** по конфигу: палитра (поля, раскладка, отображение); `limited` с причиной
  (оверлеи, навигация, таблица/дерево/тяжёлое); `service` → `palette: false` (провайдеры,
  `Field`, `FormWizard`, легаси); функции, хуки, константы, сырой `Wizard` — вне каталога.
- **Отказы генерации**: имя из конфига без записи; конфликт с синтетикой билдера (`Wizard`,
  `Step`, `FieldArray`, `$html`); символ записи/`infra`/`adapters` не экспортирован входом; у
  палитровой записи нет пропсов; нарушена биекция полей; непереносимый тип значения.
- **Детерминизм**: сортировка по кодовым точкам (не `localeCompare`), фиксированный порядок
  ключей, снятие `import("…").` и ограничение длины `tsType`, без переноса описаний из прошлой
  версии файла. `--check` сравнивает разобранный JSON структурно (форматирование не влияет).

SDK (`packages/reformer-builder-plugin-api/src/kits/catalog.ts`): только типы словаря
`CatalogPropGroup`, `CatalogPropDoc`, `CatalogRuntimePropDoc`, `CatalogInherits`;
`component-catalog.schema.json` — версия 3.0 в описании.

### 2. Поля HexaUI — адаптеры для всех

Имена записей — паритет с ui-kit (на них держатся одна схема на два кита, `fieldKindOf`, RJSF
`DEFAULT_WIDGET_CANDIDATES`, затравки шаблонов). Адаптеры — чистые данные
`src/fields/adapters.ts` (тестируются в node), обёртки — `src/fields/*.tsx`.

| Запись | HexaUI | Значение модели | Особенность |
| --- | --- | --- | --- |
| Input / InputPassword / Textarea | Textbox / .Password / .Textarea | `string \| null` | есть |
| InputMask | Textbox.Masked | `string \| null` | проп `mask` → `maskOptions` |
| InputSearch | Search | `string \| null` | textAdapter |
| InputNumber | Textbox.Number | `number \| null` | `''`/NaN → `null` |
| Select / SelectMulti | Select (+`multiple`) | `string \| null` / `string[] \| null` | `null` → `undefined` для placeholder; пресет мультивыбора |
| Combobox(Multi) | Select `showSearch` | как Select | паритет с затравками |
| ComboboxTree(Multi) | TreeSelect | `string \| null` / `string[] \| null` | `nodes` → `treeData` |
| Checkbox (exportName CheckboxWithLabel) | Checkbox | `boolean` | точный тип пропсов обёртки |
| CheckboxGroup | CheckboxGroup | `string[] \| null` | `options {label,value}` |
| RadioGroup | Radio | `string \| null` | значение из antd-события |
| Switch (SwitchWithLabel) | Toggle | `boolean` | `onChange(check, e)`, inline-подпись |
| Toggle (ToggleButton) | ToggleButton | `boolean` | обёртка `selected` |
| ToggleGroup / ToggleGroupMulti | SegmentedButton radio/checkbox | `string \| null` / `string[] \| null` | `options` → `items` |
| ToggleButtonGroup | ToggleButtonGroup | `string[] \| null` | мультивыбор |
| DatePicker | Calendar (date-fns, `Date \| null` — подтверждено `DateInputValue`) | `Date \| null` | `dateFormat` → `format` |
| DatePickerRange | RangePicker | `[Date, Date] \| null` | частичный диапазон → `null` |
| TimeInput / TimeRange | TimeInput / RangeTimeInput | `string \| null` / `[string, string] \| null` | обёртка сводит start/end |
| FileUpload / FileUploadDropzone | Uploader `manual` | `File[] \| null` | `File` ↔ `UploadFile`, без XHR |
| WeeklySchedule | WeeklySchedule | `Record<string, number[]> \| null` | неуправляемый — пересоздание по `key` |
| RichTextEditor / CodeEditor | RichTextEditor / CodeViewer | `unknown[] \| null` / `string \| null` | ленивая загрузка, пересоздание по `key` |

`Separator`→Divider, `Spinner`→Loader, `Progress`→ProgressBar сохраняются. В `KitProvider`
добавить `PopupConfigProvider` с контейнером внутри рамки кита — иначе поповеры (Calendar,
TreeSelect, Tooltip) уходят в `document.body` мимо scoped-стилей. `validationStatus`/`invalid`
убрать из полей (`omit['@field']`).

### 3. Визард HexaUI по протоколу 3.0

`src/wizard.tsx` + чистая логика `src/wizard-steps.ts` (порядок шагов по `selector`, сверка
потока — копия `orderedNodes`/`flowStepsMismatch` из ui-kit
`src/components/form-wizard/variants/base/form-wizard.tsx`, кит от ui-kit не зависит).
`FormWizard` со статикой `__selfManagedChildren = true`: сборка из `useFormBundleContext()`
(`@reformer/core/react`), поток `bundle.flow` (иначе позиционный), шаги HexaUI `Wizard`
(`view="page"`, управляемый `activeStep`) строятся из `children` через `renderNode`;
`onNext` всегда возвращает `false` и зовёт `flow.next()` либо на последнем шаге
`bundle.submission.submit(onSubmit)` — переход делает поток, а не HexaUI (иначе двойной шаг);
`onStepChange` → `flow.goTo`. Тело шага — `Step` из `@reformer/cdk/form-wizard` (как в кодогене).
Подписи кнопок передаются явно (`submitLabel`/`nextLabel`/`backLabel`). Каталог → `3.0`,
`kit.adapters.wizard: { symbol: 'FormWizard' }`, запись `FormWizard` с `palette: false`, сырой
`Wizard` — вне каталога. Манифест (`requires reformer.kit.catalog ^2`) не меняется.

### 4. Билдер: шаблоны составных компонентов и вид значения из каталога

- `.ui_builder/plugins/reformer/core/catalog/make-node.ts`: `compoundTemplatesFor(records)` —
  шаблон остаётся, только если корень есть в каталоге и все его части — записи с
  `compoundParent === корень`; `contract.ts` `buildCatalogFromJson` передаёт
  `compoundTemplates: compoundTemplatesFor(json.components)`. Для ui-kit все части есть
  (гарантируют тесты `make-node.test.ts`) — снапшот `catalog-equivalence` не меняется.
  Под HexaUI `Card`/`Alert` вставляются контейнером.
- `.ui_builder/plugins/reformer/core/form-mock/index.ts`: `fieldKindOf(node, valueTypeOf?)` —
  после наборов имён разбирается `x-runtimeProps.value.type` (`boolean`, `number`, `string[]`,
  `Date`, `[Date, Date]`, `File[]`, иначе `raw`). Таблицу строит `codegen/collect.ts`
  (`ctx.kit.catalog`). Для ui-kit golden-снимки кодогена не меняются.

### 5. Перестройка плагина kit-hexa-ui

- `src/components.ts` — явный список реэкспортов HexaUI (не `export *`: codemirror/xterm/slate в
  namespace), `src/fields/`, `src/wizard.tsx`, `src/compound.ts` (плоские экспорты статик, напр.
  `TabPane`), `src/heavy.ts` (тяжёлое — только во входе приложения); `src/index.ts` = CSS + всё.
- `src/namespace.ts` — без тяжёлых и `limited`-записей; сверка ключей через TS checker.
- Ленивый каталог в `builder-plugin.ts`: `catalog: () => import('../catalog.json')` + шапка
  `kit: { id: 'hexa-ui', label, package }` (CLI `dry-run` сверяет шапку).
- `catalog.config.mjs` (конфиг генератора), `catalog.json` генерируется (3.0, `$schema` исправлен
  через `schemaRef`), скрипты `catalog` / `catalog:check`.

## Фазы и коммиты

Работа ведётся задачами beads (эпик + задачи по фазам), коммиты — по пакету, с `Refs:`.

| Фаза | Что | Коммит |
| --- | --- | --- |
| Ф0 | Спайк (без коммита): браузерный тест каждого кандидата-поля и `Wizard` под React 19; падающие → `limited` «несовместим с React 19» | — |
| Ф1 | Типы словаря каталога и описание схемы 3.0 | `feat(reformer-builder-plugin-api)` |
| Ф2 | Ядро генератора, команда `catalog`, тесты, README | `feat(reformer-builder-plugin-cli)` |
| Ф3а | Шаблоны составных компонентов по частям кита | `fix(reformer-builder-playground)` |
| Ф3б | Вид значения поля из каталога | `feat(reformer-builder-playground)` |
| Ф4а | Вход, namespace, ленивый каталог HexaUI | `refactor(reformer-hexa-ui)` |
| Ф4б | Поля и адаптеры | `feat(reformer-hexa-ui)` |
| Ф4в | Визард | `feat(reformer-hexa-ui)` |
| Ф4г | Конфиг, сгенерированный `catalog.json` 3.0, тест дрейфа, README | `feat(reformer-hexa-ui)` |
| Ф5 | Интеграционные тесты билдера под полный каталог HexaUI | `test(reformer-builder-playground)` |
| Ф6 | e2e кита | `test(reformer-builder-playground-e2e)` |
| Ф7 | `projects/reformer-builder/docs/composition.md` — рецепты «HexaUI» и «Свой кит: каталог из типов» | `docs(reformer-builder)` |

После плана — отдельные задачи: перевод генератора ui-kit на ядро CLI; шаблоны составных
компонентов от самого кита (`record.template`, контракт 3.1).

## Verification

- CLI: юнит-тесты генератора на фикстурах (`CompilerHost` в памяти: мини-`@types/react` без
  `VFC`, пакет `@acme/ds` с `FC`/`VFC`/`forwardRef`/`memo`/`StyledComponent`/статиками/
  `@deprecated`/чужим пакетом, обёртка с `reformerAdapter`): владение и `x-inherits`,
  `pick/omit/override`, порядок enum, отказы, детерминизм (два прогона одинаковы), `--check`
  код 1 с диффом, результат проходит `loadCatalogValidator`; `cli.test.ts` — разбор `catalog`.
- Кит: 5 существующих тестов (адаптированы), тест дрейфа `catalog:check`, `adapters.test.ts`
  (`bindFieldProps` с реальными формами эмитов), `wizard-steps.test.ts` (настоящий
  `createFormFlow`), браузерные тесты обёрток и визарда в `FormRenderer` + `createForm({ flow })`;
  `npm run validate` и `build:dev` кита; `reformer-plugin dry-run`.
- Билдер: `make-node`/`contract` (кит без `CardHeader` → контейнер), `catalog-equivalence`
  без пересъёмки, golden кодогена без изменений, `form-mock`/`collect` (вид значения из
  каталога), `builtin-templates` и `templates-seeds-validate` (визард доступен под HexaUI),
  `playground-forms`; тесты плагинов (`npm run test -w …/plugins/reformer -w …/plugins/forms`).
- e2e `projects/reformer-builder-playground-e2e/tests/kit.spec.ts`: под HexaUI в палитре есть
  DatePicker и он живой в превью; форма из шаблона-визарда — шаг не пускает дальше с пустым
  обязательным полем, после заполнения переходит.
- Корневой `npm run typecheck`, `npx eslint .`, `size-limit`; ручная проверка в билдере
  (`preset:hexa-ui`): палитра полная, форма с полями и визардом собирается и экспортируется.

## Риски

React 19 против antd 4 / styled-components 5 (спайк Ф0, `limited` для падающих); размер namespace
(явный список, тяжёлое лениво; ориентир ≤ 3,5 МБ) и каталога (ленивая загрузка, «только свои
пропсы»); дрейф при обновлении TS/HexaUI (тест падает — перегенерировать осознанно); записи,
бывшие `additionalProperties: true` (Card, Panel), станут строгими — проверить формы playground;
временное дублирование логики интроспекции с ui-kit (задача на перевод).
