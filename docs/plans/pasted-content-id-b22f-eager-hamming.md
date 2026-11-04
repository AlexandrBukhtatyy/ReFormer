# MCP берёт знание о ките и ядре из их сгенерированных JSON, а не из своих таблиц

> Актуализировано 2026-11-04. Учтены коммиты до `8a646a10` и незакоммиченная работа параллельной сессии
> `reformer-fb`: новый `operator-catalog.ts` и правки в `form-intent.ts`, `builders.ts`, `intent-grammar.ts`,
> `form-build.ts`, `generate-form.ts`, `cross-check.ts`, `validate/code.ts`.

## Context

MCP держит рукописные копии данных, источник которых — другие пакеты. Расхождение ловят тесты.

1. **Компоненты ui-kit.** В [ui-kit-components.ts](packages/reformer-mcp/src/core/generate/ui-kit-components.ts)
   три таблицы:
   - `UI_KIT_FIELD_EXPORTS` — registry-имя поля → экспорт;
   - `UI_KIT_CONTAINER_EXPORTS` — Box, Section, FieldArray;
   - `UI_KIT_SUBPATH_IMPORTS` — экспорты, которых нет в корне пакета.

   Кит сам генерирует `component-catalog.json` (`@reformer/ui-kit/catalog`), и все три таблицы выводятся
   из него один в один: 30 записей `role: 'field'`, 13 значений `subpath`.
2. **Операторы ядра.** В [operator-catalog.ts](packages/reformer-mcp/src/core/generate/operator-catalog.ts)
   (параллельная сессия, ещё не закоммичен) лежат:
   - `CORE_VALIDATORS` — 27 фабрик правил, у каждой образец вызова и группа;
   - `VALIDATOR_HELPERS`;
   - `BEHAVIOR_AUTHORING`.

   Ядро публикует `llms-index.json`: он генерируется из исходников, лежит в npm-пакете, и MCP уже грузит
   его на всех платформах (`Knowledge.index`). Из индекса выводятся:
   - **список фабрик** — символы `entries: ['./validators']`, сигнатура `…): Rule<…>`; помощники отсекаются
     сами;
   - **образец вызова** — первый вызов в `@example`, без опций `{ code }`: `minAge(18)`,
     `fileType('image/*,.pdf')`, `maxFileSize(5 * 1024 * 1024)`, `pattern(/…/)`. Проверено на всех 27.
   - **все имена операторов ядра** — экспорты `./validators`, `./validation`, `./behaviors`.

   Не выводится только группа: у `required`, `minLength`/`maxLength` и шести файловых правил тип
   `Rule<unknown>`.

**Цель:** MCP читает актуальные данные кита и ядра во время работы. Своих копий этих данных нет.

**Решено с пользователем:**

- Кит или индекс ядра не найден → MCP работает без них. Запасного снимка нет.
- Группа правила задаётся тегом в JSDoc фабрики ядра и попадает в `llms-index.json`. Тега нет → группа
  выводится из типа правила.

**Что остаётся кодом MCP и почему.** Ключи `kind` поведения (`MODEL_BEHAVIOR_KINDS`, `NODE_BEHAVIOR_KINDS`),
`VALIDATION_OPERATORS` и `BEHAVIOR_KEY_OPERATORS` — это язык intent. За каждым стоит печать в генераторе,
поэтому новый оператор ядра, прочитанный в рантайме, MCP всё равно не напечатает. Это не копия данных, а
список возможностей компилятора. Их сверку с ядром оставляет тест, тот же CI-сторож.

## Подход

### 1. Справочники в ядре MCP

**ui-kit** — `core/generate/ui-kit-components.ts`, таблицы заменяются:

```ts
export interface UiKitComponents {
  readonly found: boolean;                              // false — имена идут в код как есть
  readonly fields: Readonly<Record<string, string>>;   // role: 'field' → exportName ?? name
  readonly exports: Readonly<Record<string, string>>;  // любая запись → экспорт
  readonly subpaths: Readonly<Record<string, string>>; // экспорт → подпуть, если его нет в корне
}
export const NO_UI_KIT: UiKitComponents;
export function uiKitFromCatalog(json: unknown): UiKitComponents; // структурный разбор, мусор → NO_UI_KIT
```

- **Разбор.**
  - Из записей берутся только `name`, `role`, `exportName` и `subpath`. Поэтому подходит и JSON кита, и
    `{ components: ctx.catalog }` конструктора.
  - Схема своя, минимальная. Зависеть от `@reformer/builder-plugin-api` нельзя: там `react` в peer, и пакет
    собирается после MCP.
- **Функции.**
  - `groupUiKitImports(names, kit)` берёт подпути из `kit.subpaths`.
  - `normalizeFieldComponent(component, fieldType, props, kit = NO_UI_KIT)`: обратная таблица «экспорт →
    registry-имя» строится из `kit.fields`. Правила `Input`→`InputNumber`/`InputSuggest` и
    `FileUpload`+`variant` остаются кодом.
- **Что уходит.** `UI_KIT_CONTAINER_EXPORTS` и литералы `FormWizard: 'FormWizard'`: `FormWizard` есть в
  каталоге. Заодно любой контейнер кита (`Card`, `Tabs`…) получает верный импорт, а не TODO.
- **Без кита.**
  - Имя импортируется как есть из `@reformer/ui-kit` с одним предупреждением «каталог ui-kit не найден».
  - Если кит найден, имя вне каталога, как и сейчас, даёт TODO и warning.

**Операторы ядра** — новый `core/generate/core-operators.ts`:

```ts
export interface CoreRule { name: string; call: string; group: string }
export interface CoreOperators {
  readonly found: boolean;
  readonly rules: ReadonlyMap<string, CoreRule>; // фабрики @reformer/core/validators
  readonly names: ReadonlySet<string>;           // значения из ./validators, ./validation, ./behaviors
}
export const NO_CORE_OPERATORS: CoreOperators;
export function coreOperatorsFromIndex(index: MergedIndex): CoreOperators;
```

- **Фабрика.** Символ `@reformer/core`, у которого `entries` содержит `./validators`, `kind: 'function'`, а
  сигнатура после нормализации пробелов — `…): Rule<…>`.
- **`call` (образец вызова).**
  - Берётся первый вызов `name(…)` из `example`.
  - Последний аргумент-объект с `code:` отбрасывается. Пустые скобки → голое имя (`required`), как сейчас в
    грамматике.
  - В примере вызова нет → заглушки по обязательным параметрам сигнатуры: `number` → `n`, `Date` →
    `new Date(…)`, `RegExp` → `/re/`, `string` → `'…'`.
- **`group`.**
  - Источник — поле `appliesTo` символа (см. п. 2).
  - Поля нет → группа из `Rule<T>`: `number` → `number`, есть `Date` → `date`, только `string` → `text`,
    иначе `any`.
  - Порядок и подписи групп — презентация грамматики, они остаются в MCP: `any` (без подписи), `text`
    «строки и списки», `number` «числа», `date` «даты», `file` «файлы». Незнакомое значение печатается как
    есть. Внутри группы порядок по алфавиту.
- **`names`.** Все символы-значения (`function`/`const`) `@reformer/core` с `entries` из `./validators`,
  `./validation` и `./behaviors`. Заменяет `CORE_NAMES` в cross-check, поэтому уходят `BEHAVIOR_AUTHORING`
  и литералы `defineValidation`/`validateModel`.
- **Что уходит из `operator-catalog.ts`.** `CORE_VALIDATORS`, `VALIDATOR_HELPERS`, `BEHAVIOR_AUTHORING` и
  `renderValidatorList()`; последний становится `renderRuleList(core)`.
- **Что остаётся там же как язык intent.** `VALIDATION_OPERATORS`, `MODEL_BEHAVIOR_KINDS`,
  `NODE_BEHAVIOR_KINDS` и `BEHAVIOR_KEY_OPERATORS`. Шапку модуля переписать.

**Общий контекст генератора** — `core/generate/catalogs.ts`:

- `FormCatalogs { uiKit; core }` и `NO_CATALOGS`;
- `catalogsOf(k): Promise<FormCatalogs>` через `memoize`:
  - `core` синхронно из `k.index`;
  - `uiKit` через загрузчик платформы (п. 3).

### 2. Ядро и генератор индекса: тег группы правила

- **Ядро.** В JSDoc каждой из 27 фабрик в `packages/reformer/src/form/validators/*.ts` добавить тег
  `@appliesTo <any|text|number|date|file>`. Это собственный тег: `@category` на уровне модуля уже занят
  категориями TypeDoc (`Validators`).
- **Генератор индекса.** В [index-builder.js](scripts/generate-llms-txt/index-builder.js) `buildSymbolEntry`
  (`:334`) добавить поле `appliesTo: tag('appliesTo')[0]?.text.trim() || undefined`.
  - Поле добавочное, `schemaVersion` не меняется: MCP строго сверяет версию (`merge.ts:46`).
  - Перегенерировать `llms-index.json` и `llms.txt` ядра: `npm run generate:llms` в `packages/reformer`.
- **MCP.** Добавить `IndexedSymbol.appliesTo?: string`
  ([core/index/types.ts:51](packages/reformer-mcp/src/core/index/types.ts#L51)).

### 3. Источник каталога кита — платформа (по образцу `symbolsFallback`)

- **Ядро MCP** ([core/knowledge.ts](packages/reformer-mcp/src/core/knowledge.ts)):
  `KnowledgeSources.uiKitCatalog?: () => Promise<unknown>`. Нет источника или загрузка вернула `undefined`
  → `NO_UI_KIT`. Ядро по-прежнему без `fs`.
- **CLI.** Загрузчик `loadUiKitCatalog(bases)` по образцу `loadCompiler`
  ([form-workspace.ts:70](packages/reformer-mcp/src/platform/cli/form-workspace.ts#L70)).
  - Вызов: `createRequire(join(base, 'package.json'))('@reformer/ui-kit/catalog')`.
  - Порядок баз:
    1. корень проекта — `REFORMER_TYPECHECK_ROOT`, иначе `detectProjectStack(cwd).projectRoot`; логику
       `createCliFormWorkspace` (`:203`) вынести в общий хелпер;
    2. расположение самого MCP.
  - Подключается в `cliKnowledge()`.
- **Браузер.** `BrowserKnowledgeInput.uiKitCatalog?: unknown` — JSON, который уже загрузил хост.
- **Воркер** ([build-worker.mjs](packages/reformer-mcp/scripts/build-worker.mjs)):
  - каталог кита урезать до `{ components: [{ name, role, exportName, subpath }] }` (около 10 КБ) и вшить
    `.txt`-файлом в `corpus()`;
  - кита нет — предупреждение;
  - индекс ядра уже в корпусе, поле `appliesTo` пройдёт само.

### 4. Протянуть `catalogs` через синхронный генератор

Модульные константы, построенные из таблиц, становятся поиском по `catalogs`.

- **Чтение intent** ([form-intent.ts](packages/reformer-mcp/src/core/generate/form-intent.ts)):
  - `ReadIntentOptions` (`:611`) получает `catalogs?: FormCatalogs`;
  - `readIntent` (`:1407`) передаёт его в `normalizeIntent(partial, opts?)` (`:347`), а тот — в
    `normalizeFieldComponent` (`:384`);
  - `COMPONENT_BY_KEY` (`:748`) строится по `uiKit.fields`, `componentOfType` (`:753`) получает его через
    `ReadCtx`;
  - параметр необязательный: `rules-bridge` конструктора зовёт `normalizeIntent` без полей.
- **`intentFromAnalysis(analysis, target, catalogs?)`** — [from-spec.ts:150](packages/reformer-mcp/src/core/generate/from-spec.ts#L150).
- **Генераторы файлов.**
  - Параметр **обязательный**, чтобы забытое место ловил `tsc`:
    - `buildBundle(intent, catalogs)` — [builders.ts:2092](packages/reformer-mcp/src/core/generate/builders.ts#L2092);
    - `buildRegistryTs` (`:1721`);
    - `buildFormSchemaTs` — [schema-emit.ts:455](packages/reformer-mcp/src/core/generate/schema-emit.ts#L455).
  - `COMPONENT_IMPORTS` (builders.ts:1676) и `UI_KIT_IMPORTS` (schema-emit.ts:316) превращаются в поиск по
    `uiKit`. `TsImports` получает поле `uiKit` для `tsExpression` (`:372`).
- **Импорт валидаторов** (`collectValidators`, builders.ts:440).
  - Сейчас: `Object.hasOwn(CORE_VALIDATORS, name)`; станет: `core.rules.has(name)`.
  - Без индекса ядра (`found: false`) любое имя, не объявленное в `operators`, импортируется из ядра. Так было
    до C12; дальше его проверит `tsc`.
  - Для `buildValidationSchemaTs` параметр необязательный: им пользуется `rules-bridge` конструктора.
- **Cross-check** ([cross-check.ts](packages/reformer-mcp/src/core/generate/cross-check.ts)):
  - `CORE_NAMES` (`:463`) заменяется на `core.names`;
  - C12 (`:492`) спрашивает `core.rules`;
  - без индекса ядра правило C12 «не валидатор ядра» пропускается;
  - `catalogs` приходит параметром функции проверки.
- **Грамматика** ([intent-grammar.ts:371](packages/reformer-mcp/src/core/generate/intent-grammar.ts#L371)):
  константа `INTENT_GRAMMAR` становится функцией `intentGrammar(catalogs)`.
  - `- component:` (`:384`) — ключи `uiKit.fields`.
  - `- rules` (`:409`) — `renderRuleList(core)`.
  - Без кита или без индекса ядра в строке стоит честный текст, что каталог не найден.
- **Код** ([validate/code.ts:584](packages/reformer-mcp/src/core/validate/code.ts#L584)): шаблон «`message` в
  опциях правила» строится по `coreOperatorsFromIndex(k.index)`; у `validateCode` уже есть `k`. Без индекса
  ядра шаблон не применяется.
- **Свойства компонентов.** `checkComponentProps(…, uiKit)`
  ([ui-kit-props.ts:117](packages/reformer-mcp/src/core/generate/ui-kit-props.ts#L117)).
- **Реэкспорт.** `core/intent.ts` (`:48`) реэкспортирует `uiKitFromCatalog`, `coreOperatorsFromIndex`, `NO_*`
  и типы.

### 5. Инструменты

- **`form_build`** ([form-build.ts](packages/reformer-mcp/src/core/tools/form-build.ts)): в начале
  `const catalogs = await catalogsOf(k)`, затем передать его в:
  - `intentGrammar` (`:154`);
  - `readIntent` (`:166`);
  - `buildBundle` (`:174`);
  - cross-check;
  - `checkComponentProps` (`:246`).
- **`generate_form`**:
  - добавить `k` в `generateFormTool(args, k)` ([generate-form.ts:186](packages/reformer-mcp/src/core/tools/generate-form.ts#L186));
  - добавить `k` в диспетчер ([tool-catalog.ts:147-149](packages/reformer-mcp/src/core/server/tool-catalog.ts#L147));
  - протянуть `catalogs` в `buildManifest` (`:212`).
- **`plan_form`** → `intentFromAnalysis(…, catalogs)`.
- **`validate_form`**:
  - `kind=bundle` → `normalizeIntent(…, { catalogs })` (`validate-form.ts:222`) и cross-check;
  - `kind=code` — см. `code.ts` выше.

### 6. Конструктор (потребитель `@reformer/mcp/intent`)

[build-form/index.ts:110](projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/tools/build-form/index.ts#L110):

```ts
readIntent(raw, {
  forDocument: true,
  catalogs: { uiKit: uiKitFromCatalog({ components: ctx.catalog }), core: NO_CORE_OPERATORS },
})
```

Если build-form зовёт cross-check или сборку правил, проверить, есть ли у плагина индекс ядра (его
`knowledge/index.ts` собирает `createBrowserKnowledge` с индексом). Если есть — передать
`coreOperatorsFromIndex`.

## Тесты

- **Помощник** `tests/support/catalogs.ts` — `monorepoCatalogs()`:
  - `uiKit` из `packages/reformer-ui-kit/component-catalog.json`;
  - `core` из `cliKnowledge().index`;
  - с `precondition`.
- **Главная регрессия.**
  - Golden-снимки `tests/__golden__/generate-form/*` должны остаться **байт в байт** с `monorepoCatalogs()`.
    Сравнивать с состоянием прямо перед правкой.
  - Это доказывает, что каталог и индекс дают те же импорты, что рукописные таблицы.
- **[ui-kit-components.test.ts](packages/reformer-mcp/tests/ui-kit-components.test.ts):**
  - сверку таблицы заменить тестами `uiKitFromCatalog` на фикстуре: поля, подпути, мусор → `NO_UI_KIT`;
  - режим без кита;
  - контейнер с подпутём (`Carousel`).
- **`core-operators.test.ts`** (новый, вместо сверки `CORE_VALIDATORS` в
  [operator-catalog.test.ts](packages/reformer-mcp/tests/operator-catalog.test.ts)):
  - на индексе монорепо ровно 27 фабрик;
  - помощники `isFileLike`/`matchesFileAccept`/`toFileArray` в список не попадают;
  - группы совпадают с прежним распределением, кроме порядка внутри группы;
  - образцы `minAge(18)`, `required`, `fileType('image/*,.pdf')`;
  - **у каждой фабрики есть `appliesTo`** — сторож для автора нового правила в ядре;
  - на фикстуре: заглушки по сигнатуре, когда в примере нет вызова, и группа из `Rule<T>`, когда нет тега.
- **`operator-catalog.test.ts`:**
  - сверка ключей `kind` и ключей валидации с исходниками ядра остаётся;
  - authoring-операторы (`behaviors/context.ts`) отсекаются в самом тесте по файлу, а не таблицей;
  - проверки грамматики переходят на `intentGrammar(monorepoCatalogs())`.
- **Генератор индекса:** тест или проверка вывода — `appliesTo` попадает в символ, а без тега поля нет.
- **Остальные вызовы перевести на `catalogs`:**
  - `form-build.test.ts` (там же `toBe(INTENT_GRAMMAR)`) и `ui-kit-props.test.ts`;
  - `generate-form*.test.ts`, `form-from-spec.test.ts`;
  - `intent-inline-array.test.ts` и `intent-lift.test.ts` (имя компонента в `type`: по каталогу и без кита);
  - `unified-contract.test.ts`, `validate-form.test.ts`.
- **CLI-загрузчик кита:**
  - поддельный `node_modules/@reformer/ui-kit` во временном каталоге → найден;
  - базы без кита → `undefined`.

## Проверка

1. Ядро: `npm run generate:llms` в `packages/reformer`. Проверить `git diff packages/reformer/llms-index.json`:
   добавились только поля `appliesTo` у 27 символов.
2. Из `packages/reformer-mcp`:
   - `npm test`;
   - `npx tsc --noEmit -p tsconfig.json`;
   - `npm run typecheck:tests`;
   - `npm run build`, включая `build-worker` и `check-no-node-globals`.
3. Golden без изменений: `git diff --stat packages/reformer-mcp/tests/__golden__` пуст.
4. Живая проверка через MCP:
   - `form_build` без intent: в грамматике полный список полей кита и 27 правил по группам с образцами из
     ядра;
   - форма renderer-json с `Calendar`/`Combobox` и правилами `minAge(18)` и `fileType(…)`: импорты из
     подпутей кита и из `@reformer/core/validators` верные, ✓ от сборки.
5. Конструктор: `build-form.test.ts` плагина `reformer/ai` и `rules-bridge.test.ts`.
6. Тесты ядра не нужны: меняются только комментарии. Достаточно `tsc` пакета `packages/reformer`, запущенного
   из каталога пакета.

## Вне рамок (завести задачи в bd)

- **`COMPONENT_VALUE_TYPE`** ([form-intent.ts:732](packages/reformer-mcp/src/core/generate/form-intent.ts#L732))
  — тип значения компонента. В каталоге он есть: `x-runtimeProps.value.type`. Но вывод из каталога изменит
  поведение: `DatePickerRange` и `FileUpload*` станут `array`, а значение `FileUpload` атомарное. Нужно
  решение о правилах сопоставления.
- **Предупреждение о несовпадении версий.** Ядро экспортирует оператор поведения, которого нет среди `kind`
  intent (ядро новее MCP). В рантайме это видно по индексу, и грамматика могла бы назвать оператор с
  подсказкой «вызывай через `kind: "call"`».
- **`check:catalog` ui-kit не запускается в CI.** Устаревший закоммиченный каталог пройдёт незамеченным.
- **[project-detector.ts:204](packages/reformer-mcp/src/platform/cli/project-detector.ts#L204)** советует
  импорт `DatePicker` из корня, хотя он есть только в подпути.
- **Проверка `componentProps`** идёт по `@reformer/ui-kit/meta`, а не по `propsSchema` каталога: они не
  равны.
- **Что остаётся в коде:**
  - имя пакета `@reformer/ui-kit`;
  - `FormField`;
  - `DEFAULT_COMPONENT` (form-intent.ts:722);
  - локальный список `VALIDATION_OPERATORS` в `validate/code.ts:56`.

## Перед началом

- **`operator-catalog.ts` ещё не закоммичен**, и сессия `reformer-fb` сейчас занята. Через `SendMessage`
  договориться: она коммитит свою работу, мы начинаем после. Её изменения не откатывать.
- **Перед правкой** перепроверить номера строк: они сдвигаются от каждого коммита.
- **Задача в bd:** завести (`bd create`), а при начале работы взять (`bd update --claim`).
- **Коммит** — только по явной просьбе пользователя.
