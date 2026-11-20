# План: уровни UI над общей моделью — тема, язык, таблица

## Context

Сейчас ReFormer отвечает за поведение форм. Пользователь хочет, чтобы он отвечал за поведение всего
UI: кроме прокси форм должны появиться прокси для таблиц, языка и темы.

Фундамент для этого уже есть:

- **Модель.** `createModel` в `packages/reformer/src/model/**` — универсальный реактивный контейнер
  с двумя прокси: прокси значений `model.x` и прокси сигналов `model.$.x`.
- **Уровни.** В документации ядра ([levels.mdx](../../projects/reformer-doc/docs/core-concepts/levels.mdx))
  уровень определён так: «набор прокси и состояния поверх модели; модель об уровнях не знает».
  Форма — один из уровней.
- **Стор.** `createStore`/`createScope` в [scope.ts](../../packages/reformer/src/model/scope.ts)
  уже делают модель стором приложения (эпик ReFormer-lywn).
- **Проект таблицы.** Контракт доменного модуля и проект `createTable` описаны в
  [snappy-bouncing-rossum.md](snappy-bouncing-rossum.md) (§ контракт, § table). Пути в том плане
  устарели: модель теперь живёт в `src/model/**`.

Чего не хватает:

- **Тема.** Контроллера темы нет ни в одном пакете. Единственный — `createThemeService` в билдере.
- **Язык.** Язык (`@reformer/core/i18n`) построен на listener-сторе, а не на сигналах. Сменить язык
  можно только пропом `lang` у `I18nProvider`.
- **Таблица.** Состояние `DataGrid` из ui-kit заперто в React `useState`, запросы не отменяются.
- **Правила между уровнями.** Общего DSL для них нет: `defineFormBehavior` привязан к форме.

Цель: три новых уровня ядра над общей моделью, общий `defineBehavior` для правил между уровнями
и перевод на них реальных потребителей — `DataGrid` из ui-kit, темы и языка билдера.

### Решения пользователя

- Охват: тема, язык, таблица и перевод потребителей.
- Таблица: один контроллер с двумя режимами — клиентский (над массивом модели) и серверный
  (`dataProvider(query, { signal })`). Режим задаётся конфигом.
- Inline-редактирование строк — позже, отдельным сабпатом `@reformer/core/table/edit`. Сейчас
  оставить только шов для него.
- Связка уровней: независимые уровни над одной моделью приложения плюс общий `defineBehavior`.
  Корневого `createApp` нет.
- Сохранение выбора темы и языка: опция `storage` у `createTheme`/`createLanguage` и публичный тип
  `StorageAdapter`. Публичного `persist()` в `/model` нет: решение lywn «без persistence» не
  нарушаем.
- Серверный режим таблицы строится на `resource()`. Поэтому перед таблицей делается задача
  ReFormer-lywn.4 по её утверждённому плану ([rosy-cooking-walrus.md](rosy-cooking-walrus.md), P2).

## Архитектура

### Что значит «прокси уровня»

Каждый уровень отдаёт **лицо** (face): объект с членами-`ReadonlySignal` и привязанными командами.
Идентичность лица стабильна, дочерние лица создаются лениво и кэшируются. Это тот же контракт, что
у прокси формы ([form-proxy-builder.ts](../../packages/reformer/src/form/form-proxy-builder.ts)).

Настоящий `Proxy` нужен только там, где пространство ключей задаёт пользователь. Поэтому общий
`buildLevelProxy` не выносим — механизм без потребителя не заводится (принцип из
[decisions-log.md](../decisions-log.md)).

| Уровень | Чтение                                               | Запись                                          |
| ------- | ---------------------------------------------------- | ----------------------------------------------- |
| тема    | `theme.resolved.value`, `theme.preference.value`     | `theme.set('dark')` или `app.settings.theme = 'dark'` |
| язык    | `language.code.value`, `language.t('key')`           | `language.set('ru')` или `app.settings.lang = 'ru'`   |
| таблица | `table.columns.name.sort.value`, `table.rows.value`  | `table.columns.name.toggleSort()`, `table.setPage(2)` |

**Привязка к модели.** Любой кусок состояния уровня можно привязать к полю общей модели:
`createTheme({ preference: app.$.settings.theme })`. Тогда форма настроек над `app.settings` меняет
тему и язык через общий сигнал, без всякого поведения. Прокси значений модели становится путём
записи, а лицо уровня отдаёт производное состояние.

### Пакеты и границы

- Новые сабпаты `@reformer/core/theme`, `@reformer/core/language`, `@reformer/core/table`. Новых
  пакетов нет — это прежнее решение snappy и rosy.
- Имя `/language` выбрано потому, что `./locale` уже занят словарями, а `Locale` в ядре означает
  данные (`FormLocale`). `/i18n` остаётся слоем «данные и чистые функции».
- Общий фундамент кладём в `/model`: `defineBehavior`, `signalFrom`, внутренний `OwnedSignal`.
- ESLint ([eslint.config.js](../../eslint.config.js), блок около l.232–256): в существующий блок
  model добавляется запрет `**/{theme,language,table}/**`. Отдельным блоком для
  `src/{theme,language,table}/**` запрещаются form, platforms, react и взаимные импорты уровней
  (с исключением для `src/table/edit/**` на будущее). Новый паттерн в существующий блок вписывается
  внутрь него: отдельный блок молча снимает границу.
- DOM, `matchMedia`, `localStorage` и `navigator` доступны только через адаптеры с безопасными
  умолчаниями для SSR. Корень ядра остаётся UI-агностичным, React — только в `/react`.

## Фазы

### U0. Фундамент в `@reformer/core/model`

1. **`OwnedSignal`.** Перенести `form/nodes/state/owned-signal.ts` в
   `src/model/owned-signal.ts` как внутренний модуль. Форма импортирует его оттуда (направление
   form→model разрешено). Это состояние, которое снаружи только читается, а пишет владелец уровня.
2. **`signalFrom(read, subscribe)`.** Публичный, поднять из билдера
   ([signal-store.ts:64](../../projects/reformer-builder/src/shell/platform/primitives/signal-store.ts)).
   Условие rosy W1 «три и более места» выполнено. Подписка снимается через `onScopeDispose`.
   `toSource` и политика ошибок подписчиков остаются в билдере.
3. **`defineBehavior<Ctx>(setup, { name? })`** → `Behavior<Ctx>` с методом `attach(ctx)`,
   возвращающим идемпотентную отписку. Файл — `src/model/behavior.ts`.
   - `attach` создаёт дочернюю `createScope()` (владелец находится сам, `scope.ts:62`) и выполняет
     в ней `setup(ctx, scope)`.
   - При исключении область снимается, ошибка бросается дальше.
   - Внутри `setup` работают value-операторы модели (они уже владеются областью через
     `ownedByScope`), `scope.effect` и создание уровней.
   - Правило рецепта: чтение между уровнями — через `computed` и привязки, а `defineBehavior` — для
     побочных эффектов и записи в чужой уровень.
4. **Внутренний помощник уровней** `src/level-kit/` (сабпата нет, импортируют только уровни):
   - `storage.ts`: тип `StorageAdapter { get, set, subscribe? }`, `webStorage(storage?)` (JSON,
     безопасно для SSR) и внутренний `bindStorage(signal, adapter, key, parse)`.
   - `bindStorage` при старте записывает в сигнал валидное сохранённое значение, дальше эффект
     пишет сигнал в хранилище, пропуская эхо, а внешняя правка (`subscribe`) возвращается в
     сигнал.
   - `StorageAdapter` и `webStorage` реэкспортируются из `/theme` и `/language` из одного файла,
     поэтому попадают в общий чанк.
5. **ESLint-границы** — как в разделе «Пакеты и границы».
6. **Тесты:** `tests/model/{behavior,signal-from}.test.ts`, `tests/level-kit/storage.test.ts`,
   `src/model/behavior.type-test.ts`.
7. **U0.4 (по желанию, отдельный коммит).** Запускать `defineFormBehavior` на отвязанной области:
   в `__run` ([context.ts:238-269](../../packages/reformer/src/form/behaviors/context.ts)) вместо
   голого `runWithoutScope(setup)` создать область через `runWithoutScope(() => createScope())`,
   выполнить в ней `setup` и поставить её `dispose` первым в `ctx.cleanups`.
   - Эффект: `behavior.attach(...)` внутри поведения формы снимается вместе с формой.
   - Публичный API не меняется.
   - Гейты: бенч 2o1j и `hooks.leaks.test.tsx`. При регрессии шаг откладывается — остальное от него
     не зависит.

### U1. Тема — `@reformer/core/theme`

- **API:**
  - `createTheme({ preference?: Signal<ThemePreference>, initial?, system?, target?, storage?,
    storageKey? })` → `Theme { preference, system, resolved, set, toggle, dispose }`.
  - Адаптеры: `mediaQuerySystemTheme()`, `fixedSystemTheme(initial?)` (для тестов и SSR),
    `documentTheme({ root?, attribute: 'class' | 'data-theme', colorScheme? })`.
  - `'class'` ставит `.dark`. `'data-theme'` ставит `data-theme="dark|light"`. Оба варианта
    совпадают с `@custom-variant dark` в
    [theme.css:15](../../packages/reformer-ui-kit/src/styles/theme.css).
- **Реализация** — перенос из билдера
  ([theme.ts:114-194](../../projects/reformer-builder/src/shell/platform/services/theme.ts)):
  `computed` «предпочтение × система» и `scope.effect` → `target.apply`. Мусорное предпочтение
  трактуется как `'system'`. Уровень сам регистрирует `dispose` в активной области.
- **React:** новых хуков нет, хватает `useSignalSnapshot(theme.resolved)`. Sonner в ui-kit не
  трогаем: контракт между темой и китом — DOM, и `useAppTheme` его уже читает.
- **Документация:** рецепт `docs/llms/43-ui-theme.md`, в том числе inline-скрипт против мигания
  темы до гидратации. Правило MCP `ui-theme` в
  [api-decision.ts](../../packages/reformer-mcp/src/core/decide/api-decision.ts).
- **U1b. Билдер** (после закрытия lywn.3 — тот же файл):
  - `createThemeService` внутри переходит на `createTheme({ preference,
    storage: settingsAdapter(settings), system, target: documentTheme({ root }) })`.
  - `onDidChange` строится на `watchField(theme.resolved, emit)`.
  - Сигнатура сервиса, его 15 тестов и контракт
    [plugin-api theme.ts](../../packages/reformer-builder-plugin-api/src/services/theme.ts)
    не меняются.
  - Локальный `signalFrom` билдера заменяется ядерным во всех трёх местах.

### U2. Язык — `@reformer/core/language`

- **Загрузку не дублируем.** Внутри лежит `createLocaleStore`
  ([locale-store.ts:68](../../packages/reformer/src/i18n/locale-store.ts)), состояние читается через
  `signalFrom(store.getState, store.subscribe)`. Хэндл `createI18n` уже мемоизирован по локали.
- **API:** `createLanguage({ lang?: Signal<string>, initial?, fallback = 'en', load, supported?,
  detect?, storage?, storageKey?, document?, onError? })` → `Language`:
  - `lang` — запрошенный язык; `code` — показанный;
  - `locale`, `i18n` (`computed(createI18n(...))`), `pending`, `error`, `dir`;
  - `t(key, values?, defaultMessage?)` — реактивен внутри `computed`;
  - `set(lang): Promise<void>`, `retry()`, `dispose()`.
  - Адаптеры: `browserLanguage({ supported })`, `documentLang()` (ставит `<html lang dir>`).
- **Начальный язык:** хранилище → привязка → `detect()` → `fallback`. Сохраняется показанный
  язык, поэтому язык, который не загрузился, не переживёт перезагрузку. `dir` берётся из
  `Intl.Locale#getTextInfo`, с запасным списком RTL-языков.
- **React:** третий режим `I18nProvider({ language, fallback? })` в
  [provider.ts](../../packages/reformer/src/platforms/react/i18n/provider.ts) (диспетчер около
  l.180). Контекст тот же, поэтому страж `check-i18n-singleton` не меняется. Существующие режимы
  `{lang, load}` и `{locale}` работают как прежде.
- **Документация:** рецепт `44-ui-language.md`, правило MCP `ui-language`.
- **U2b. Билдер:**
  - `I18nService` получает `Language` с загрузчиком
    `createLocaleLoader([loadKitUiLocale, hostSource])`.
  - `locale` = `language.code`, а `setLocale` = `await language.set(code)` плюс прежний `notify`.
  - В [BuilderRoot.tsx:55-83](../../projects/reformer-builder/src/shell/boot/BuilderRoot.tsx)
    мост `useSyncExternalStore` уходит, вместо него — `<I18nProvider language={…}>`.
  - В билдере остаются пространства имён плагинов, маркеры `⟦key⟧`, `forPlugin` и порядок
    «применить → записать настройку».

### lywn.4. `resource()` — `@reformer/core/resource`

Существующая задача, делается по плану [rosy-cooking-walrus.md](rosy-cooking-walrus.md) P2, рецепт
41. Блокирует только U3: тема и язык идут параллельно с ней. Таблица — второй потребитель
`resource()`, поэтому в него закладываются `AbortSignal`, отсев устаревших ответов и
`keepPrevious`.

### U3. Таблица — `@reformer/core/table`

- `rowKeyOf` переносится из `form/schema/row-key.ts` в `src/model/row-key.ts`: зависимостей от формы
  у него нет. TanStack и React в ядре не используются. Форма запроса совпадает с `TableQuery`
  нынешнего DataGrid
  ([table-data-grid.tsx:45](../../packages/reformer-ui-kit/src/components/table/variants/data-grid/table-data-grid.tsx)).
- **Конфиг:**
  `createTable<Row, const C>({ columns, getRowKey?, pageSize?, selection?: 'none'|'single'|'multiple',
  multiSort?, locale?: () => string, state?: { sorting?, pageIndex?, pageSize?, selected?, hidden? } })`.
  - Плюс одно из двух: `data` (`ModelArraySignals`, сигнал массива или массив) → клиентский режим,
    или `dataProvider(query, { signal })` → серверный.
  - `ColumnDef`: `id`, `value?(row)` (для сортировки и фильтра, не для рендера), `sortable`,
    `filterable`, `compare?(a, b, collator)`, `match?(value, filter)`, `filter?: Signal`,
    `initialFilter`, `visible`, `meta`.
- **Лицо таблицы:**
  - `table.columns.<id>` — ключи типизированы из `const`-конфига, лица кэшируются. Сигналы `sort`,
    `sortIndex`, `filter`, `visible`; команды `toggleSort({ multi })` (цикл asc → desc → нет),
    `setSort`, `setFilter`, `clearFilter`, `setVisible`.
  - `table.rows` — текущая страница. `table.row(key)` → `{ key, value, model?, selected,
    select(on?), toggle() }`.
  - Сигналы: `sorting`, `filters`, `pageIndex`, `pageSize`, `pageCount`, `total`, `visibleColumns`,
    `status`, `refreshing`, `error`. `query` — `computed`: ключ загрузки и источник для
    синхронизации с URL.
  - `selection`: `keys`, `rows` (включая строки других страниц), `allOnPage`, `someOnPage`, команды
    `toggleAllOnPage()` и `clear()`.
  - Команды таблицы: `setPage`, `nextPage`, `prevPage`, `setPageSize` (сбрасывает на первую
    страницу), `setSorting`, `clearFilters`, `reload`, `dispose`.
- **Клиентский режим:** цепочка `filtered → sorted → paged` на `computed`. Сравнение —
  `Intl.Collator(locale(), { numeric: true })` с кэшем по коду языка.
- **Серверный режим:** поверх `resource()`. Смены ключа загрузки собираются в одну микрозадачу:
  одно действие — один вызов провайдера (проверяется тестом).
- **Ключ строки:** если есть `getRowKey` — он. В клиентском режиме над массивом модели —
  `rowKeyOf(фасад)`, он стабилен при `move`/`swap`. Иначе — индекс и предупреждение в dev. Keyed
  `arrayOf` (lywn.5) не блокирует.
- **Правила** — эффекты области таблицы, нужны для внешних записей в привязанные поля:
  - **R1.** Сменились фильтры → `pageIndex = 0`; первый прогон пропускается.
  - **R2.** Номер страницы ограничивается значением `pageCount - 1`.
  - **R3.** Клиентский режим: из выбора убираются ключи, которых больше нет в данных. Серверный
    режим без `getRowKey`: выбор сбрасывается на каждой загрузке, как сейчас в DataGrid.
  - Команды пишут в `batch` и держат инварианты сами.
- **Шов для `/table/edit`:** `TableRow.model` (фасад строки), `meta` у колонки, свой внутренний
  `WeakMap` расширений таблицы (не `formSlot` ноды модели). Позже — `withEditing(table, { schema })`
  поверх `createForm({ model: row.model })`. Правки пишут в те же сигналы, поэтому таблица
  пересортируется сама.
- **Документация:** рецепт `45-data-table.md`, правило MCP `data-table`.

### U4. DataGrid из ui-kit как вид над уровнем таблицы

- Пропсы `DataGridProps = { settings } | { table, columns }` — изменение аддитивное.
- В режиме `settings` вид сам создаёт таблицу через `useStore(() => createTable({ dataProvider, … }))`.
  Смена `pageSize` → `table.setPageSize`; смена состава колонок → пересоздание через `key`.
- Рендер читает сигналы через `useSignalSnapshot`/`useComputed`. `onSelectionChange` подключается
  через `watchField(table.selection.rows)`. В `TableColumn` добавляется `value?` для клиентской
  сортировки.
- `@tanstack/react-table` уходит из DataGrid. Необязательный peer снимается отдельным коммитом.
  Типы `TableQuery`/`TablePage`/`TableFilters` реэкспортируются из ядра под теми же именами.
- Паритет: существующий `table-data-grid.dom.test.tsx` проходит без правок. Добавляются тесты
  клиентского режима и отмены запроса.
- Нижняя граница peer `@reformer/core` поднимается до версии с `/table`.
- Билдер: в `lazyModules` (`application/runtime/forms.ts:60`) добавить
  `'@reformer/core/table'`, иначе превью получит вторую копию ядра.
- Демо сайта ([examples/table.tsx](../../projects/reformer-doc/src/components/demo/examples/table.tsx)):
  серверный пример, клиентский над `createModel({ users: arrayOf(...) })` и правило между
  уровнями.

### U5. Документация и правила между уровнями

- Обновить [levels.mdx](../../projects/reformer-doc/docs/core-concepts/levels.mdx): уровни темы,
  языка и таблицы, контракт «лица уровня», привязка к модели.
- Рецепт `46-cross-level-rules.md` и правило MCP `cross-level-rule`. Реальные потребители
  `defineBehavior`:
  - смена языка → `table.reload()` у серверной таблицы (сервер сортирует своей коллацией);
  - синхронизация таблицы с URL — `watchField(table.query, …)`;
  - тема и язык из формы настроек над `app.settings` — через привязку, поведение не нужно.
    Рецепт показывает этот путь первым.
- `npm run generate:llms`. Описание пакета («form and application state») согласовать с lywn.7.

### Позже (вне этого плана)

U6 — `@reformer/core/table/edit`, отдельная задача. Зависит от U3, желательно после lywn.5.

## Подключение каждого нового сабпата (чек-лист)

1. `packages/reformer/vite.config.ts`: entry и общий чанк, чтобы `.`, `/model` и уровни делили
   один рантайм.
2. `package.json#exports` и `scripts/check-exports-dist.mjs`.
3. `external` у потребителей: проверить, что правило `/^@reformer\//` покрывает сабпат.
4. typedoc `entryPoints` в `projects/reformer-doc/docusaurus.config.ts` (около l.150).
5. `knip.json`.
6. `.size-limit.json` — лимит по первому замеру. Оценка: theme ≤ 1.5 kB, language ≤ 2 kB,
   table ≤ 4 kB.
7. Расширить `tests/model/subpath-single-runtime.test.ts`: уровень, созданный внутри
   `createStore`, снимается вместе со стором, и идентичность `Signal` одна.
8. JSDoc с `@param`/`@returns`/`@example`/`@group` на каждом публичном символе.

## Задачи beads (создать при старте реализации)

Эпик «Уровни UI: тема, язык, таблица над общей моделью», связан с ReFormer-lywn.

| Задача | Зависит от |
| ------ | ---------- |
| U0 фундамент | — |
| U0.4 поведения формы на отвязанной области | U0 |
| U1 тема | U0 |
| U1b ThemeService билдера | U1, lywn.3 |
| U2 язык | U0 |
| U2b I18nService билдера | U2 |
| U3 таблица | U0, lywn.4 |
| U4 DataGrid, демо, билдер | U3 |
| U5 документация и MCP | U1–U4, согласовать с lywn.7 |

После работы — `bd export -o .beads/issues.jsonl` по правилам CLAUDE.md. Коммиты — только по явной
просьбе, по одному пакету на коммит, через `commitlint`.

## Верификация

Каждая фаза ядра:

```bash
npm test -w packages/reformer          # покрытие на файл: строки ≥ 80, ветки ≥ 70
npm run typecheck
npm run lint                           # плюс негативный кейс границы ESLint
npm run build -w packages/reformer && npm run check:exports-dist && npm run check:dist-deps && npm run size:check
```

Дополнительно:

- **U2 и U4:** `npm run check:i18n-singleton`.
- **U0.4:** `npm run test:e2e -w projects/react-playground-e2e` и бенч 2o1j.
- **U1b и U2b:** unit-тесты билдера, `npm run test:browser -w projects/reformer-builder`,
  `npm run test:e2e -w projects/reformer-builder-playground-e2e`.
- **U4:** `npm test -w packages/reformer-ui-kit`, затем проверить демо таблицы на сайте в браузере:
  оба режима, отмену запроса, сброс страницы при фильтре, выбор между страницами.
- **MCP:** `api-decision.test.ts`.
- **Сквозной сценарий:** в демо одна модель `app` — форма настроек меняет `app.settings.theme` и
  `app.settings.lang`. Класс `.dark` на корне, `<html lang>`, подписи DataGrid и порядок сортировки
  обновляются без перезагрузки.

## Листинги кода

Наброски. Имена и сигнатуры — целевые; детали (dev-предупреждения, JSDoc, крайние случаи)
дописываются при реализации. Опираются на реальные API: `createScope`/`createStore`/
`onScopeDispose` ([scope.ts](../../packages/reformer/src/model/scope.ts)), `watchField`
([behaviors-value.ts:103](../../packages/reformer/src/model/behaviors-value.ts)),
`createLocaleStore` ([locale-store.ts:68](../../packages/reformer/src/i18n/locale-store.ts)),
`resource()` из плана lywn.4.

### A. Код приложения

#### A1. Модель приложения и уровни в одном сторе

```ts
// app/store.ts
import { arrayOf, createModel, createStore } from '@reformer/core/model';
import { createTheme, webStorage, type ThemePreference } from '@reformer/core/theme';
import { createLanguage } from '@reformer/core/language';
import { createTable } from '@reformer/core/table';
import { createLocaleLoader } from '@reformer/core/i18n';
import { loadKitLocale } from '@reformer/ui-kit/locale';
import { appMessages } from './messages';

export type User = { id: number; name: string; email: string; role: 'admin' | 'user' };
export type App = {
  settings: { theme: ThemePreference; lang: string };
  users: User[];
};

export const app = createStore(() => {
  const model = createModel<App>({
    settings: { theme: 'system', lang: 'ru' },
    users: arrayOf(() => ({ id: 0, name: '', email: '', role: 'user' })),
  });
  const storage = webStorage(); // localStorage, безопасно для SSR

  // Тема и язык привязаны к полям модели: их правит форма настроек, а уровни только читают.
  const theme = createTheme({ preference: model.$.settings.theme, storage });
  const language = createLanguage({
    lang: model.$.settings.lang,
    load: createLocaleLoader([loadKitLocale, appMessages]),
    supported: ['ru', 'en'],
    storage,
  });

  // Клиентская таблица над массивом модели.
  const users = createTable({
    data: model.$.users,
    columns: [
      { id: 'name', value: (u: User) => u.name, sortable: true, filterable: true },
      { id: 'email', value: (u: User) => u.email, filterable: true },
      { id: 'role', value: (u: User) => u.role, sortable: true },
    ],
    getRowKey: (u) => u.id,
    pageSize: 20,
    selection: 'multiple',
    locale: () => language.code.value, // сортировка по коллации языка: сменили язык — пересортировалось
  });

  return { model, theme, language, users };
});

// app.dispose() снимает уровни, эффекты, подписки на matchMedia и storage.
```

#### A2. React: провайдер языка, переключатели темы и языка

```tsx
// main.tsx
import { I18nProvider, useSignalSnapshot } from '@reformer/core/react';
import { Button } from '@reformer/ui-kit/button';
import { NativeSelect } from '@reformer/ui-kit/native-select';
import { app } from './app/store';

createRoot(el).render(
  <I18nProvider language={app.language} fallback={<Spinner />}>
    <Shell />
  </I18nProvider>
);

function ThemeToggle() {
  const resolved = useSignalSnapshot(app.theme.resolved);
  return <Button onClick={app.theme.toggle}>{resolved === 'dark' ? 'Светлая' : 'Тёмная'}</Button>;
}

function LanguageSwitch() {
  const lang = useSignalSnapshot(app.language.lang);
  const pending = useSignalSnapshot(app.language.pending);
  return (
    <NativeSelect
      value={lang}
      disabled={pending}
      onChange={(e) => void app.language.set(e.target.value)}
    >
      <option value="ru">Русский</option>
      <option value="en">English</option>
    </NativeSelect>
  );
}
```

#### A3. Форма настроек управляет темой и языком — без поведения, через привязку

```ts
import { createForm } from '@reformer/core';
import { RadioGroup } from '@reformer/ui-kit/radio-group';
import { Select } from '@reformer/ui-kit/select';

const settings = createForm<App['settings']>({
  model: app.model.settings, // форма над частью модели приложения
  schema: (m) => ({
    children: [
      {
        model: m.$.theme,
        component: RadioGroup,
        componentProps: { options: ['light', 'dark', 'system'] },
      },
      { model: m.$.lang, component: Select, componentProps: { options: ['ru', 'en'] } },
    ],
  }),
});

// Выбор «dark» в форме → app.model.settings.theme → theme.resolved → класс .dark на <html>.
// Выбор «en» → language.lang → загрузка словаря → <html lang="en">, подписи ui-kit на английском.
// Запись напрямую тоже работает: app.model.settings.theme = 'dark'.
```

#### A4. Таблица: заголовки с сортировкой, строки с выбором (headless, без DataGrid)

```tsx
import { useSignalSnapshot } from '@reformer/core/react';
import type { TableColumnFace, TableRow } from '@reformer/core/table';

function UsersTable() {
  const { users } = app;
  const rows = useSignalSnapshot(users.rows);
  const pageIndex = useSignalSnapshot(users.pageIndex);
  const pageCount = useSignalSnapshot(users.pageCount);
  return (
    <>
      <input onChange={(e) => users.columns.name.setFilter(e.target.value)} placeholder="Имя" />
      <table>
        <thead>
          <tr>
            <SortHeader column={users.columns.name}>Имя</SortHeader>
            <th>Почта</th>
            <SortHeader column={users.columns.role}>Роль</SortHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <UserRow key={row.key} row={row} />
          ))}
        </tbody>
      </table>
      <button disabled={pageIndex === 0} onClick={users.prevPage}>Назад</button>
      {pageIndex + 1} / {pageCount}
      <button disabled={pageIndex + 1 >= pageCount} onClick={users.nextPage}>Вперёд</button>
    </>
  );
}

function SortHeader({ column, children }: { column: TableColumnFace; children: ReactNode }) {
  const sort = useSignalSnapshot(column.sort); // 'asc' | 'desc' | null
  return (
    <th aria-sort={sort === null ? 'none' : sort === 'asc' ? 'ascending' : 'descending'}>
      <button onClick={(e) => column.toggleSort({ multi: e.shiftKey })}>{children}</button>
    </th>
  );
}

function UserRow({ row }: { row: TableRow<User> }) {
  const selected = useSignalSnapshot(row.selected); // перерисуется только эта строка
  return (
    <tr>
      <td>
        <input type="checkbox" checked={selected} onChange={() => row.toggle()} />
        {row.value.name}
      </td>
      <td>{row.value.email}</td>
      <td>{row.value.role}</td>
    </tr>
  );
}
```

#### A5. Серверная таблица и DataGrid как вид

```tsx
import { createTable, type TablePage } from '@reformer/core/table';
import { DataGrid } from '@reformer/ui-kit/table';

type Order = { id: string; number: string; customer: string; total: number };

const orders = createTable({
  dataProvider: async (query, { signal }) => {
    const res = await fetch(`/api/orders?${toSearchParams(query)}`, { signal }); // отмена устаревших
    return (await res.json()) as TablePage<Order>;
  },
  columns: [
    { id: 'number', sortable: true },
    { id: 'customer', sortable: true, filterable: true },
    { id: 'total', sortable: true },
  ],
  getRowKey: (o: Order) => o.id,
  selection: 'multiple',
});

// Новый режим DataGrid: вид над готовой таблицей. Колонки вида — только рендер.
<DataGrid
  table={orders}
  columns={[
    { id: 'number', header: '№', accessor: (o) => o.number },
    { id: 'customer', header: 'Клиент', accessor: (o) => o.customer },
    { id: 'total', header: 'Сумма', accessor: (o) => formatMoney(o.total), align: 'right' },
  ]}
/>;

// Прежний режим не меняется: DataGrid сам создаёт таблицу из settings.
<DataGrid settings={{ dataProvider, columns, pageSize: 20, rowKey: (o) => o.id }} />;
```

#### A6. Правила между уровнями — `defineBehavior`

```ts
import { defineBehavior, watchField } from '@reformer/core/model';
import type { Language } from '@reformer/core/language';
import type { Table } from '@reformer/core/table';

// Серверная таблица сортирует коллацией сервера: при смене языка перезапросить страницу.
export const reloadOnLanguage = defineBehavior<{ language: Language; table: Table<Order> }>(
  ({ language, table }) => {
    watchField(language.code, () => table.reload());
  },
  { name: 'reloadOnLanguage' }
);

// Состояние таблицы в адресной строке.
export const tableInUrl = defineBehavior<{ table: Table<unknown>; param: string }>(
  ({ table, param }, scope) => {
    scope.effect(() => {
      const url = new URL(window.location.href);
      url.searchParams.set(param, JSON.stringify(table.query.value));
      window.history.replaceState(null, '', url);
    });
  }
);

// Подключение — внутри createStore(...): правила снимаются вместе со стором.
reloadOnLanguage.attach({ language, table: orders });
tableInUrl.attach({ table: orders, param: 'orders' });
```

### B. Наброски реализации

#### B1. `defineBehavior` — `src/model/behavior.ts`

```ts
import { createScope, type Scope } from './scope';

/** Правило между уровнями: `attach(ctx)` подключает его и возвращает отписку. */
export interface Behavior<Ctx> {
  readonly name?: string;
  attach(ctx: Ctx): () => void;
}

export function defineBehavior<Ctx>(
  setup: (ctx: Ctx, scope: Scope) => void,
  options: { name?: string } = {}
): Behavior<Ctx> {
  return Object.freeze({
    name: options.name,
    attach(ctx: Ctx): () => void {
      // Дочерняя к активной области: внутри createStore правило снимется вместе со стором.
      const scope = createScope();
      try {
        // Операторы модели (watchField, computeFrom, …) и scope.effect попадают в эту область.
        scope.run(() => setup(ctx, scope));
      } catch (error) {
        scope.dispose(); // сборка упала — снять то, что setup успел создать
        throw error;
      }
      return () => scope.dispose(); // идемпотентно
    },
  });
}
```

#### B2. `signalFrom` — `src/model/signal-from.ts` (поднят из билдера)

```ts
import type { ReadonlySignal } from '../signals';
import { OwnedSignal } from './owned-signal';
import { onScopeDispose } from './scope';

type Unsubscribe = (() => void) | { dispose(): void };

/** Сигнал над событийным источником. Снаружи только чтение, подписка снимается с областью. */
export function signalFrom<T>(
  read: () => T,
  subscribe: (onChange: () => void) => Unsubscribe
): ReadonlySignal<T> {
  const value = new OwnedSignal(read());
  const subscription = subscribe(() => value.set(read()));
  onScopeDispose(
    typeof subscription === 'function' ? subscription : () => subscription.dispose()
  );
  return value;
}
```

#### B3. Хранилище уровней — `src/level-kit/storage.ts` (внутренний модуль)

```ts
import type { Signal } from '../signals';
import { watchField } from '../model/behaviors-value';
import { onScopeDispose } from '../model/scope';

/** Где уровень хранит выбор: localStorage, настройки билдера, cookie. */
export interface StorageAdapter {
  get(key: string): unknown;
  set(key: string, value: unknown): void | Promise<void>;
  /** Внешняя правка ключа (другая вкладка, панель настроек). */
  subscribe?(key: string, onChange: () => void): () => void;
}

export function webStorage(storage: Storage | null = defaultStorage()): StorageAdapter {
  return {
    get(key) {
      try {
        const raw = storage?.getItem(key);
        return raw == null ? undefined : JSON.parse(raw);
      } catch {
        return undefined; // битый JSON — как будто ничего не сохранено
      }
    },
    set(key, value) {
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        /* квота, приватный режим — выбор просто не сохранится */
      }
    },
    subscribe(key, onChange) {
      if (typeof window === 'undefined') return () => {};
      const listener = (event: StorageEvent) => event.key === key && onChange();
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
  };
}

/** @internal Сигнал ↔ ключ хранилища. Вызывать внутри области уровня. */
export function bindStorage<T>(
  target: Signal<T>,
  storage: StorageAdapter,
  key: string,
  parse: (raw: unknown) => T | undefined
): void {
  let synced: T | undefined;
  const restore = (): void => {
    const stored = parse(storage.get(key));
    if (stored === undefined) return;
    synced = stored;
    target.value = stored;
  };
  restore();
  // Первый прогон watchField пропускает; запись, пришедшая из restore, — эхо, её не пишем.
  watchField(target, (value) => {
    if (Object.is(value, synced)) return;
    synced = value;
    void storage.set(key, value);
  });
  const stop = storage.subscribe?.(key, restore);
  if (stop) onScopeDispose(stop);
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // доступ к localStorage запрещён политикой
  }
}
```

#### B4. Тема — `src/theme/theme.ts`

```ts
import { computed, signal, type ReadonlySignal, type Signal } from '../signals';
import { createStore } from '../model/scope';
import { signalFrom } from '../model/signal-from';
import { bindStorage, type StorageAdapter } from '../level-kit/storage';

export type ThemeKind = 'light' | 'dark';
export type ThemePreference = ThemeKind | 'system';

export interface SystemThemeSource {
  current(): ThemeKind;
  subscribe(onChange: () => void): () => void;
}
export interface ThemeTarget {
  apply(theme: ThemeKind): void;
}

export interface ThemeOptions {
  /** Поле модели с предпочтением: `app.$.settings.theme`. Без него — свой сигнал. */
  preference?: Signal<ThemePreference>;
  initial?: ThemePreference; // 'system'
  system?: SystemThemeSource | null; // по умолчанию mediaQuerySystemTheme(); null → 'light'
  target?: ThemeTarget | null; // по умолчанию documentTheme(); null — DOM не трогать (SSR, тесты)
  storage?: StorageAdapter | null;
  storageKey?: string; // 'reformer.theme'
}

export interface Theme {
  readonly preference: ReadonlySignal<ThemePreference>;
  readonly system: ReadonlySignal<ThemeKind>;
  readonly resolved: ReadonlySignal<ThemeKind>;
  set(preference: ThemePreference): void;
  toggle(): void;
  dispose(): void;
}

export const isThemePreference = (v: unknown): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

export function createTheme(options: ThemeOptions = {}): Theme {
  return createStore((scope) => {
    const raw = options.preference ?? signal<ThemePreference>(options.initial ?? 'system');
    if (options.storage) {
      bindStorage(raw, options.storage, options.storageKey ?? 'reformer.theme', (v) =>
        isThemePreference(v) ? v : undefined
      );
    }
    // В привязанном поле может оказаться что угодно: непонятное значение — «как в системе».
    const preference = computed(() => (isThemePreference(raw.value) ? raw.value : 'system'));

    const source = options.system === undefined ? mediaQuerySystemTheme() : options.system;
    const system: ReadonlySignal<ThemeKind> = source
      ? signalFrom(() => source.current(), (cb) => source.subscribe(cb))
      : signal<ThemeKind>('light');

    const resolved = computed<ThemeKind>(() =>
      preference.value === 'system' ? system.value : preference.value
    );

    const target = options.target === undefined ? documentTheme() : options.target;
    if (target) scope.effect(() => target.apply(resolved.value));

    return {
      preference,
      system,
      resolved,
      set: (next: ThemePreference) => void (raw.value = next),
      toggle: () => void (raw.value = resolved.peek() === 'dark' ? 'light' : 'dark'),
    };
  });
}

/** Системная тема из `prefers-color-scheme`; `null`, если спросить некого (SSR, воркер). */
export function mediaQuerySystemTheme(): SystemThemeSource | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  return {
    current: () => (query.matches ? 'dark' : 'light'),
    subscribe(onChange) {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
  };
}

/** Применить тему к корню документа — тем же маркером, что читает `@custom-variant dark` ui-kit. */
export function documentTheme(
  options: { root?: HTMLElement; attribute?: 'class' | 'data-theme'; colorScheme?: boolean } = {}
): ThemeTarget | null {
  if (typeof document === 'undefined') return null;
  const root = options.root ?? document.documentElement;
  const attribute = options.attribute ?? 'class';
  return {
    apply(theme) {
      if (attribute === 'class') root.classList.toggle('dark', theme === 'dark');
      else root.setAttribute('data-theme', theme);
      if (options.colorScheme !== false) root.style.colorScheme = theme; // скроллбары, формы
    },
  };
}
```

#### B5. Язык — `src/language/language.ts`

```ts
import { computed, effect, signal, type ReadonlySignal, type Signal } from '../signals';
import { createStore, onScopeDispose } from '../model/scope';
import { signalFrom } from '../model/signal-from';
import { watchField } from '../model/behaviors-value';
import { createLocaleStore, type LocaleLoad, type LocaleStoreState } from '../i18n/locale-store';
import { createI18n, type I18nHandle } from '../i18n/translator';
import type { MessageValues } from '../i18n/message-format';
import { DEFAULT_LOCALE, type FormLocale } from '../i18n/locale';
import type { StorageAdapter } from '../level-kit/storage';

export interface LanguageTarget {
  apply(code: string, dir: 'ltr' | 'rtl'): void;
}

export interface LanguageOptions {
  load: LocaleLoad; // createLocaleLoader([...]) — загрузку не дублируем
  lang?: Signal<string>; // поле модели: app.$.settings.lang
  initial?: string;
  fallback?: string; // 'en'
  supported?: readonly string[];
  detect?: (() => string | undefined) | null; // по умолчанию browserLanguage({ supported })
  storage?: StorageAdapter | null;
  storageKey?: string; // 'reformer.lang'
  document?: LanguageTarget | null; // по умолчанию documentLang(): <html lang dir>
  onError?: (error: unknown, lang: string) => void;
}

export interface Language {
  readonly lang: ReadonlySignal<string>; // запрошенный
  readonly code: ReadonlySignal<string>; // показанный
  readonly locale: ReadonlySignal<FormLocale | null>;
  readonly i18n: ReadonlySignal<I18nHandle>;
  readonly pending: ReadonlySignal<boolean>;
  readonly error: ReadonlySignal<unknown>;
  readonly dir: ReadonlySignal<'ltr' | 'rtl'>;
  t(key: string, values?: MessageValues, defaultMessage?: string): string;
  /** Resolve — язык показан или вытеснен новым запросом; reject — загрузка упала. */
  set(lang: string): Promise<void>;
  retry(): void;
  dispose(): void;
}

export function createLanguage(options: LanguageOptions): Language {
  return createStore((scope) => {
    const fallback = options.fallback ?? 'en';
    const key = options.storageKey ?? 'reformer.lang';
    const ok = (code: unknown): code is string =>
      typeof code === 'string' &&
      code !== '' &&
      (!options.supported || options.supported.includes(code));
    const detect =
      options.detect === undefined ? browserLanguage({ supported: options.supported }) : options.detect;

    // Начальный язык: хранилище → привязка → initial → браузер → fallback.
    const initial =
      [options.storage?.get(key), options.lang?.peek(), options.initial, detect?.()].find(ok) ??
      fallback;
    const lang = options.lang ?? signal(initial);
    lang.value = initial;

    const store = createLocaleStore(options.load, initial, { onError: options.onError });
    const state = signalFrom(store.getState, store.subscribe);
    watchField(lang, (code) => store.setLang(code), { immediate: true });

    const locale = computed(() => state.value.locale);
    const code = computed(() => state.value.locale?.code ?? DEFAULT_LOCALE.code);
    const i18n = computed(() => createI18n(state.value.locale ?? DEFAULT_LOCALE)); // мемоизирован
    const dir = computed(() => textDirection(code.value));

    // Сохраняется показанный язык: не загрузившийся язык не переживёт перезагрузку.
    if (options.storage) {
      const storage = options.storage;
      watchField(code, (shown) => void storage.set(key, shown));
      const stop = storage.subscribe?.(key, () => {
        const stored = storage.get(key);
        if (ok(stored)) lang.value = stored;
      });
      if (stop) onScopeDispose(stop);
    }

    const target = options.document === undefined ? documentLang() : options.document;
    if (target) scope.effect(() => target.apply(code.value, dir.value));

    return {
      lang,
      code,
      locale,
      i18n,
      dir,
      pending: computed(() => state.value.pending),
      error: computed(() => state.value.error),
      t: (k: string, values?: MessageValues, defaultMessage?: string) =>
        i18n.value.t(k, values, defaultMessage), // внутри computed — реактивно
      set(next: string) {
        lang.value = next;
        return whenShown(state, next);
      },
      retry: () => store.retry(),
    };
  });
}

function whenShown(state: ReadonlySignal<LocaleStoreState>, requested: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settle: (() => void) | undefined;
    const stop = effect(() => {
      const { lang, pending, error } = state.value;
      if (settle) return;
      if (lang !== requested) settle = resolve; // вытеснен новым запросом
      else if (!pending) settle = error === undefined ? resolve : () => reject(error);
      if (settle) queueMicrotask(() => (stop(), settle!()));
    });
  });
}

export function browserLanguage(o: { supported?: readonly string[] } = {}) {
  return (): string | undefined => {
    if (typeof navigator === 'undefined') return undefined;
    for (const tag of navigator.languages ?? [navigator.language]) {
      const base = tag.split('-')[0];
      const hit = [tag, base].find((c) => !o.supported || o.supported.includes(c));
      if (hit) return hit;
    }
    return undefined;
  };
}

export function documentLang(root?: HTMLElement): LanguageTarget | null {
  if (typeof document === 'undefined') return null;
  const el = root ?? document.documentElement;
  return {
    apply(code, dir) {
      el.lang = code;
      el.dir = dir;
    },
  };
}

const RTL = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'yi', 'dv', 'ku', 'sd']);
function textDirection(code: string): 'ltr' | 'rtl' {
  try {
    const info = (new Intl.Locale(code) as { getTextInfo?: () => { direction: string } })
      .getTextInfo?.();
    if (info) return info.direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    /* невалидный тег — ниже запасной список */
  }
  return RTL.has(code.split('-')[0]) ? 'rtl' : 'ltr';
}
```

#### B6. `I18nProvider` — третий режим `{ language }`

```ts
// platforms/react/i18n/provider.ts — дополнение; режимы { locale } и { lang, load } не меняются.
import type { Language } from '../../../language/language'; // только тип: рантайм /language не тянется

export interface I18nLanguageProviderProps {
  language: Language;
  fallback?: ReactNode;
  children?: ReactNode;
}
export type I18nProviderProps =
  | I18nStaticProviderProps
  | I18nLoadingProviderProps
  | I18nLanguageProviderProps;

function LanguageProvider({ language, fallback, children }: I18nLanguageProviderProps) {
  // Один подписчик на все поля: перерисовка только при смене локали, pending или ошибки.
  const value = useComputed(() => {
    const locale = language.locale.value;
    const error = language.error.value;
    if (locale === null && error === undefined) return null; // первая загрузка — fallback
    return contextValue(language.i18n.value, language.pending.value, error, language.retry);
  }, [language]);
  if (value === null)
    return fallback === undefined ? null : createElement(Fragment, null, fallback);
  return provide(value, children); // тот же I18nContext — страж singleton не меняется
}

export function I18nProvider(props: I18nProviderProps): ReactElement | null {
  if ('language' in props) return createElement(LanguageProvider, props);
  return 'locale' in props
    ? createElement(StaticProvider, props)
    : createElement(LoadingProvider, props);
}
```

#### B7. Таблица — публичные типы, `src/table/types.ts`

```ts
import type { ReadonlySignal, Signal } from '../signals';
import type { Model, ModelArraySignals } from '../model/types';

export type RowKey = string;
export interface SortEntry { id: string; desc: boolean }
export type TableFilters = Record<string, unknown>;
/** Совпадает с TableQuery нынешнего DataGrid — ui-kit реэкспортирует его под тем же именем. */
export interface TableQuery {
  filters: TableFilters;
  pagination: { pageIndex: number; pageSize: number };
  sorting: SortEntry[];
}
export interface TablePage<Row> { rows: Row[]; total: number }
export type TableStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ColumnDef<Row, V = unknown> {
  id: string;
  /** Значение для сортировки и фильтра (не для рендера). Без него — row[id]. */
  value?: (row: Row) => V;
  sortable?: boolean;
  filterable?: boolean;
  compare?: (a: V, b: V, collator: Intl.Collator) => number;
  match?: (value: V, filter: unknown) => boolean;
  filter?: Signal<unknown>; // привязка фильтра к полю модели
  initialFilter?: unknown;
  visible?: boolean;
  meta?: Readonly<Record<string, unknown>>; // для вида; ядро не читает
}

interface CommonOptions<Row, C> {
  columns: C;
  getRowKey?: (row: Row) => string | number;
  pageSize?: number;
  selection?: 'none' | 'single' | 'multiple';
  multiSort?: boolean;
  locale?: () => string; // реактивно: клиентская коллация
  /** Привязка состояния к полям модели (URL, настройки пользователя). */
  state?: {
    sorting?: Signal<readonly SortEntry[]>;
    pageIndex?: Signal<number>;
    pageSize?: Signal<number>;
    selected?: Signal<ReadonlySet<RowKey>>;
    hidden?: Signal<ReadonlySet<string>>;
  };
}
export type ClientTableOptions<Row, C> = CommonOptions<Row, C> & {
  data: ModelArraySignals<Row, Row[]> | ReadonlySignal<readonly Row[]> | readonly Row[];
};
export type ServerTableOptions<Row, C> = CommonOptions<Row, C> & {
  dataProvider: (query: TableQuery, ctx: { signal: AbortSignal }) => Promise<TablePage<Row>>;
};
export type TableOptions<Row, C> = ClientTableOptions<Row, C> | ServerTableOptions<Row, C>;

/** Лицо колонки: `table.columns.<id>`. */
export interface TableColumnFace {
  readonly id: string;
  readonly sort: ReadonlySignal<'asc' | 'desc' | null>;
  readonly sortIndex: ReadonlySignal<number>; // -1 — колонка не сортирует
  readonly filter: ReadonlySignal<unknown>;
  readonly visible: ReadonlySignal<boolean>;
  toggleSort(options?: { multi?: boolean }): void; // asc → desc → нет
  setSort(direction: 'asc' | 'desc' | null): void;
  setFilter(value: unknown): void;
  clearFilter(): void;
  setVisible(visible: boolean): void;
}

/** Лицо строки. `model` — фасад строки модели: шов для будущего /table/edit. */
export interface TableRow<Row> {
  readonly key: RowKey;
  readonly value: Row;
  readonly model?: Model<Row & object>;
  readonly selected: ReadonlySignal<boolean>;
  select(on?: boolean): void;
  toggle(): void;
}

export interface Table<Row, C extends readonly ColumnDef<Row>[] = readonly ColumnDef<Row>[]> {
  readonly columns: { readonly [K in C[number]['id']]: TableColumnFace };
  readonly rows: ReadonlySignal<readonly TableRow<Row>[]>; // текущая страница
  row(key: RowKey): TableRow<Row> | undefined;
  readonly sorting: ReadonlySignal<readonly SortEntry[]>;
  readonly filters: ReadonlySignal<TableFilters>;
  readonly pageIndex: ReadonlySignal<number>;
  readonly pageSize: ReadonlySignal<number>;
  readonly pageCount: ReadonlySignal<number>;
  readonly total: ReadonlySignal<number>;
  readonly visibleColumns: ReadonlySignal<readonly string[]>;
  readonly query: ReadonlySignal<TableQuery>; // ключ загрузки, источник для URL
  readonly status: ReadonlySignal<TableStatus>;
  readonly refreshing: ReadonlySignal<boolean>;
  readonly error: ReadonlySignal<unknown>;
  readonly selection: {
    readonly keys: ReadonlySignal<ReadonlySet<RowKey>>;
    readonly rows: ReadonlySignal<readonly Row[]>; // и с других страниц
    readonly allOnPage: ReadonlySignal<boolean>;
    readonly someOnPage: ReadonlySignal<boolean>; // для indeterminate-чекбокса
    toggleAllOnPage(): void;
    clear(): void;
  };
  setPage(index: number): void;
  nextPage(): void;
  prevPage(): void;
  setPageSize(size: number): void; // и на первую страницу
  setSorting(sorting: readonly SortEntry[]): void;
  clearFilters(): void;
  reload(): void;
  dispose(): void;
}
```

#### B8. Таблица — сборка, режимы и правила, `src/table/create-table.ts`

```ts
export function createTable<Row, const C extends readonly ColumnDef<Row>[]>(
  options: TableOptions<Row, C>
): Table<Row, C> {
  return createStore(() => {
    const state = createTableState(options); // свои сигналы или привязанные из options.state
    const source =
      'dataProvider' in options ? serverSource(options, state) : clientSource(options, state);
    const pageCount = computed(() =>
      Math.max(1, Math.ceil(source.total.value / state.pageSize.value))
    );
    installRules(state, source, pageCount, options);
    const selection = createSelection(state, source, options);
    const rows = computed(() => source.page.value.map((entry) => rowFace(entry, selection)));
    return {
      columns: buildColumnFaces(options.columns, state), // замороженная запись, лица кэшируются
      rows,
      row: (key: RowKey) => rows.peek().find((r) => r.key === key),
      pageCount,
      total: source.total,
      status: source.status,
      refreshing: source.refreshing,
      error: source.error,
      selection,
      ...stateView(state), // sorting, filters, pageIndex, pageSize, visibleColumns, query
      ...commands(state, pageCount, source), // setPage, toggleSort, setFilter, reload, …
    };
  }) as Table<Row, C>;
}

type Entry<Row> = { readonly key: RowKey; readonly value: Row; readonly model?: Model<Row & object> };

// Клиентский режим: filtered → sorted → paged на computed.
function clientSource<Row>(o: ClientTableOptions<Row, unknown>, s: TableState): Source<Row> {
  const entries = computed(() => readEntries(o.data, o.getRowKey)); // подписка на состав и поля
  const byId = new Map(columnsOf(o).map((c) => [c.id, c]));
  const collator = cachedCollator(o.locale); // Intl.Collator(locale(), { numeric: true }), кэш по коду

  const filtered = computed(() => {
    const active = Object.entries(s.filters.value);
    if (active.length === 0) return entries.value;
    return entries.value.filter(({ value }) =>
      active.every(([id, f]) => {
        const col = byId.get(id)!;
        return (col.match ?? defaultMatch)(valueOf(col, value), f);
      })
    );
  });

  const sorted = computed(() => {
    const sorting = s.sorting.value;
    if (sorting.length === 0) return filtered.value;
    const c = collator(); // читает язык: смена языка пересортирует
    return [...filtered.value].sort((a, b) => {
      for (const { id, desc } of sorting) {
        const col = byId.get(id)!;
        const r = (col.compare ?? defaultCompare)(valueOf(col, a.value), valueOf(col, b.value), c);
        if (r !== 0) return desc ? -r : r;
      }
      return 0;
    });
  });

  return {
    all: filtered, // для R3 и «выбрать всё»
    total: computed(() => filtered.value.length),
    page: computed(() => {
      const start = s.pageIndex.value * s.pageSize.value;
      return sorted.value.slice(start, start + s.pageSize.value);
    }),
    status: signal<TableStatus>('ready'),
    refreshing: signal(false),
    error: signal<unknown>(undefined),
    reload: () => {},
  };
}

function readEntries<Row>(
  data: ClientTableOptions<Row, unknown>['data'],
  getRowKey?: (row: Row) => string | number
): readonly Entry<Row>[] {
  if (isModelContainerSignal(data)) {
    const facade = modelOf(data as ModelArraySignals<Row, Row[]>); // фасад массива модели
    return (data as ModelArraySignals<Row, Row[]>).value.map((value, i) => {
      const model = facade.at(i) as Model<Row & object>;
      // Без getRowKey — ключ узла модели: стабилен при move/swap.
      return { value, model, key: String(getRowKey ? getRowKey(value) : rowKeyOf(model)) };
    });
  }
  const values = isSignal(data) ? data.value : data;
  return values.map((value, i) => ({ value, key: String(getRowKey ? getRowKey(value) : i) }));
}

// Серверный режим: поверх resource() (lywn.4) — AbortSignal, отсев устаревших, keepPrevious.
function serverSource<Row>(o: ServerTableOptions<Row, unknown>, s: TableState): Source<Row> {
  // Ключ загрузки обновляется раз в микрозадачу: поправки R1/R2 попадают в тот же запрос.
  const loadKey = coalesced(s.query);
  const res = resource({
    key: () => loadKey.value,
    load: (query, { signal }) => o.dataProvider(query, { signal }),
    keepPrevious: true, // перезагрузка не размонтирует таблицу (фокус не улетает)
  });
  const page = computed(() =>
    (res.data.value?.rows ?? []).map((value, i) => ({
      value,
      key: String(o.getRowKey ? o.getRowKey(value) : i),
    }))
  );
  return {
    all: page,
    page,
    total: computed(() => res.data.value?.total ?? 0),
    status: res.status,
    refreshing: res.refreshing,
    error: res.error,
    reload: () => res.reload(),
  };
}

// Правила — для внешних записей в привязанные поля; команды держат инварианты сами, в batch.
function installRules<Row>(
  s: TableState,
  source: Source<Row>,
  pageCount: ReadonlySignal<number>,
  o: TableOptions<Row, unknown>
): void {
  // R1. Сменились фильтры → первая страница. Первый прогон watchField пропускает.
  watchField(s.filters, () => {
    if (s.pageIndex.peek() !== 0) runOutsideEffect(() => void (s.pageIndex.value = 0));
  });
  // R2. Набор сжался → страница не дальше последней.
  watchField(
    pageCount,
    (count) => {
      const last = count - 1;
      if (s.pageIndex.peek() > last) runOutsideEffect(() => void (s.pageIndex.value = last));
    },
    { immediate: true }
  );
  // R3. Выбор согласован с данными.
  watchField(source.all, (entries) => {
    const selected = s.selected.peek();
    if (selected.size === 0) return;
    if ('dataProvider' in o && !o.getRowKey) {
      // Ключ — индекс на странице: в новых строках он указывает на другую строку.
      runOutsideEffect(() => void (s.selected.value = new Set()));
      return;
    }
    if ('data' in o) {
      const alive = new Set(entries.map((e) => e.key));
      const kept = new Set([...selected].filter((k) => alive.has(k)));
      if (kept.size !== selected.size) runOutsideEffect(() => void (s.selected.value = kept));
    }
  });
}

// Команда сортировки колонки: asc → desc → нет. С multi остальные колонки сохраняются.
function toggleSort(s: TableState, id: string, multi: boolean): void {
  const current = s.sorting.peek();
  const entry = current.find((e) => e.id === id);
  const direction = !entry ? 'asc' : entry.desc ? null : 'desc';
  const others = multi ? current.filter((e) => e.id !== id) : [];
  s.sorting.value =
    direction === null ? others : [...others, { id, desc: direction === 'desc' }];
}
```

#### B9. Билдер после миграции — `ThemeService` на уровне темы

```ts
// projects/reformer-builder/src/shell/platform/services/theme.ts
import { createStore, onScopeDispose, watchField } from '@reformer/core/model';
import { createTheme, documentTheme, type StorageAdapter } from '@reformer/core/theme';

export function createThemeService(options: ThemeServiceOptions): HostThemeService {
  const { settings } = options;
  const bus = createEventBus();
  return createStore(() => {
    // Умолчание — до первого чтения предпочтения.
    const registration = settings.registerDefault<ThemePreference>(
      THEME_SETTINGS_KEY,
      options.defaultPreference ?? 'system'
    );
    onScopeDispose(() => registration.dispose());

    const theme = createTheme({
      storage: settingsStorage(settings), // предпочтение живёт в настройках проекта
      storageKey: THEME_SETTINGS_KEY,
      system: toCoreSystem(options.system), // Disposable → () => void
      target: options.root ? documentTheme({ root: options.root }) : null,
    });
    watchField(theme.resolved, (next) => bus.emit(ThemeDidChange, next)); // без первого прогона

    return {
      get theme() {
        return theme.resolved.peek();
      },
      get preference() {
        return theme.preference.peek();
      },
      async setPreference(next: ThemePreference) {
        await settings.set(THEME_SETTINGS_KEY, next); // применит подписка хранилища
      },
      onDidChange: (cb: (theme: ThemeKind) => void) => bus.on(ThemeDidChange, cb),
    };
  });
}

function settingsStorage(settings: SettingsService): StorageAdapter {
  return {
    get: (key) => settings.get(key),
    set: (key, value) => settings.set(key, value),
    subscribe(key, onChange) {
      const subscription = settings.onDidChange((changed) => changed === key && onChange());
      return () => subscription.dispose();
    },
  };
}
```

## Риски

- **Размер `/model`** (9.57 из 10 kB). `defineBehavior` и `signalFrom` добавят несколько сотен байт.
  Замерить и, если нужно, честно поднять лимит в том же коммите с обоснованием.
- **`setLocale` в билдере** станет «побеждает последний запрос» вместо порядка завершения — может
  потребоваться правка `i18n.test.ts`.
- **Клиентский режим** пересчитывает снимок массива при правке ячейки: O(n). Для больших наборов
  рекомендовать серверный режим.
- **U0.4** трогает горячий путь поведения формы — только с бенчем.
- **Состав колонок фиксируется при создании таблицы**, как ключи модели. DataGrid при смене колонок
  пересоздаёт таблицу.
