# План: `@reformer/core` для состояния приложения — «модель как стор»

## Context

**Запрос.** Расширить reformer от управления состоянием форм до состояния всего приложения на сигналах.

**Что есть.** Слой `src/model/**` (`createModel`) уже отделён от `src/form/**` (эпик ReFormer-by9, план
[snappy-bouncing-rossum.md](snappy-bouncing-rossum.md), ESLint-граница model ⇏ form, сабпат
`@reformer/core/model`). Операторы `computeFrom/copyFrom/watchField` работают без формы,
`useSignalSnapshot` читает любой сигнал. Сайт (`projects/reformer-doc/docs/core-concepts/levels.mdx`)
уже говорит: «в модели можно держать данные всего приложения».

**Почему модель ещё не стор:**
- ключи фиксированы — словарей `Record<id, T>` нет;
- Map/Set молча превращаются в `{}`. `clone` портит снимок, `deepEqual` считает равными любые две Map — это баг, `model-nodes.ts:21-71`;
- `set` массива пересобирает все строки, `model-nodes.ts:490`;
- у операторов нет общего scope и dispose;
- у хука нет селектора;
- `watchField` вызывает cb без `untracked` (`behaviors-value.ts:108`) — лишние подписки;
- лимит size-limit для `model` меряет только шим: реально ~9 kB gzip против 2 kB.

**Спрос внутри репо.**
- В builder и его плагинах (`projects/reformer-builder/src`, `.ui_builder/plugins`) 68 файлов держат свой `Set` слушателей, 74 файла используют `useSyncExternalStore`, ещё 18 комментариев объясняют, почему снимок должен быть стабилен по ссылке.
- В `workspace-session.ts:88-148` блок «сравнить и уведомить» продублирован.
- «Статус + отмена + повтор» для загрузки написан четыре раза: cdk `async-resource.ts`, cdk option-source, `form-registry/use-form-resource.ts`, рецепты 29/32.

**Решения пользователя (зафиксированы):**
- масштаб — «модель как стор» + `resource()`; без persistence, undo, devtools, middleware и ребрендинга;
- упаковка — сабпаты `@reformer/core`, без новых пакетов;
- пилот — сторы оболочки builder. Документы с undo (`workspace/model/model-document.ts`, `history.ts`) не трогаем.

## Принципы

- **`ModelApi` не расширять.** Новое имя затенило бы одноимённое поле данных (`model-value-proxy.ts:137`). Новое живёт в свободных функциях и на фасадах массива и словаря.
- **Поведение форм меняется только по явному включению:** ключ у `arrayOf`, `recordOf`, `opaque`.
- **Брендовые типы — на необязательном символьном ключе.** Обычный `Record<string, X>` в формах остаётся группой.
- **Каждая фаза — отдельный `feat`, то есть minor.** Фаза выходит вместе со своим рецептом и правилом MCP. Форм-API не ломается.
- **Задачи ведутся в `bd`:** эпик + задача на фазу. Заводятся при старте реализации. Коммиты — только по явной просьбе.

## P0. Фундамент

1. **`watchField` → fix.** В `src/model/behaviors-value.ts:108`: `untracked(() => cb(value))`.
   - На это поведение никто не опирается: `onChange` формы (`form/behaviors/operators.ts:149-189`) передаёт `fire` без чтения сигналов.
   - Тест: cb читает чужой сигнал, его смена cb не вызывает.
2. **Отложенные записи — только документация.** `scheduled` в `src/model/safe-effect.ts:148` один на весь рантайм, поэтому `deferredWritesSettled` (`:221`) ждёт записей всех моделей. В рецепте стора описать это как известное свойство.
   - Предела раундов не вводим. Бесконечная цепочка микротасков вешает вкладку сама, и предел у промиса этого не изменит.
3. **Честный size-limit.**
   - В `packages/reformer/vite.config.ts` добавить `output.manualChunks`: `src/model/**` уходит в стабильный чанк `model-core`. Сейчас в ядре `manualChunks` нет.
   - В `.size-limit.json` добавить проверку `["dist/model.js","dist/model-core-*.js"]` по образцу маски `select-multi-*` (`.size-limit.json:76`).
   - Лимит выставить по первому замеру. Оценка «≈ 9 kB» неточна: общий чанк `safe-effect-*` может содержать и код форм.
   - После смены чанков прогнать `check:dist-deps`, `check:exports-dist` и `tests/model/subpath-single-runtime.test.ts`.
4. **Имя `Model<T>`.** В `src/model/types.ts:304`: `export type Model<T> = ModelObject<T> & ModelApi<T>; export type FormModel<T> = Model<T>`.
   - В этом плане `FormModel` **не** помечается `@deprecated`. Имя встречается в 366 файлах (код и доки), правила `no-deprecated` в ESLint нет, а пометка дала бы пользователям зачёркивание по всему коду. Синоним остаётся навсегда; решать о deprecate — в следующем major.
   - В текстах про стор приложения используем `Model`, в текстах про формы — как есть.

## P1. Стор: время жизни, React, честные листья → открывает пилот W1

```ts
// src/model/scope.ts → @reformer/core/model
interface Scope { run<R>(fn: () => R): R; add(c: () => void): () => void;
  effect(fn: () => void | (() => void)): () => void; readonly disposed: boolean; dispose(): void }
function createScope(): Scope;                 // дочерний к активному, dispose идемпотентен, LIFO
function getCurrentScope(): Scope | undefined;
function onScopeDispose(cleanup: () => void): void;
type Store<T> = T & { dispose(): void };
function createStore<T extends object>(setup: (scope: Scope) => T): Store<T>;
// @reformer/core/react
function useComputed<T>(fn: () => T, deps?: DependencyList, isEqual?: (a: T, b: T) => boolean): T;
```

**Scope.**
- Value-операторы из `behaviors-value.ts` по-прежнему возвращают `BehaviorCleanup` и дополнительно регистрируются в активном scope. Ручной cleanup снимает регистрацию.
- Настройка поведения формы (`__run` в `form/behaviors/context.ts:239`) идёт с приостановленным внешним scope: поведение формы принадлежит только `FormGroupNode.dispose()` (`form/nodes/form-group-node.ts:187`).
- Отдельного `model.dispose()` нет: у модели нет эффектов, кэши лежат в WeakMap.

**Листья.** В `model-nodes.ts:21` дополнить `isPlainObject`.
- Листьями становятся Map, Set, WeakMap, WeakSet, RegExp, Promise, ArrayBuffer.
- Распознавать их по `Object.prototype.toString.call(v)` (`[object Map]` и т.д.), а не через `instanceof`: превью builder работает в отдельном realm (`form-registry/src/guard/realm.ts`), и `instanceof Map` там не сработает.
- `clone` копирует Map/Set поверхностно, `deepEqual` сравнивает их по элементам.
- В тип `Opaque` добавить `ReadonlyMap | ReadonlySet | RegExp`.
- Экземпляры классов пока разбираются в группу, как раньше, но с однократным предупреждением в dev. Признак класса — прототип, у которого свой прототип не `null` (тоже без привязки к realm). Сделать их листьями по умолчанию — в следующем major.

**React.**
- `useComputed`: `computed` в `useMemo(deps)`, обёртка равенства возвращает прежнюю ссылку, дальше `useSignalSnapshot`. `getServerSnapshot` = `peek`.
- Взять `shallowObjectEqual` и `shallowArrayEqual` из `platforms/react/hooks/useSignalSubscription.ts` и вынести общий `shallowEqual` в `/model`.
- Provider не добавляем. Рецепт: стор на запрос + обычный React context.
- **`useStore(factory)`** (добавлен при реализации): стор, которым владеет компонент. Жизненный цикл
  вынесен из `useFormBundle` в общий `use-owned.ts` (снятие микрозадачей, отмена при повторном
  монтаже в StrictMode); `useFormBundle` стоит на нём же и добавляет только арминг живой проверки.
  Без хука рецепт «стор компонента» упирался в ловушку StrictMode (`dispose` в очистке эффекта).

**Тесты:**
- `tests/core/model/scope.test.ts` — вложенность, идемпотентность, автозахват операторов, поведение формы внутри scope не захватывается;
- `map-set-leaf.test.ts`;
- `tests/hooks/use-computed.test.tsx` — число рендеров, StrictMode, утечки по образцу `hooks.leaks.test.tsx`;
- `tests/hooks/ssr.test.tsx`;
- `root-exports.test.ts`;
- type-tests.

**Бюджет размера:** model +0.5 kB, react +0.3 kB. **Факт:** model 7.84 → 9.57 kB (лимит поднят до
10 kB), react 4.53 → 4.58 kB. Бюджет модели был занижен: чанк `scope` (≈1.5 kB) плюс Map/Set в
`clone`/`deepEqual` и предупреждение о классах; size-limit мерит несжатый dev-код с русскими
сообщениями, которые бандлер потребителя частично вырезает (`NODE_ENV`).

## W1. Пилот в builder (сразу после P1)

**Что переводим:**
1. `projects/reformer-builder/src/shell/platform/ui/state/when-context-store.tsx` → `createModel` из пяти плоских полей `WhenContext` (`builder-plugin-api/src/primitives/when-context.ts`) + `patch`.
   - `patch` уже пропускает `undefined` (`model-nodes.ts:292-304`). Это ровно «`undefined` — не трогать» из теста.
   - `set()` должен вернуть `boolean`: сравнить ссылку `model.$.peek()` до и после `patch`. Листья не уведомляют при равном значении, поэтому снимок-`computed` сохраняет ссылку.
   - Снимок модели заморожен только вне production (`model-signals-proxy.ts:52`), а `whenContext()` замораживает всегда. Для тестов этого достаточно, расхождение в prod допустимо: снимок — новый объект, его правка модель не портит.
2. `shell/boot/project/workspace-session.ts:88-148` (`createWorkspaceStatusSource`) и `shell/boot/project/project-status.ts:57-64` → `computed`. Дублирующийся блок «сравнить и уведомить» и ручной `rebind` уходят.
3. `shell/platform/services/theme.ts` → `computed` (предпочтение × система) + `scope.effect` для класса. Подписка темы передаёт значение (`subscribe(cb: (theme) => void)`), адаптер это учитывает.

**Хелперы.** Два локальных хелпера в новом файле `shell/platform/primitives/signal-store.ts` (рядом с `event.ts`, `capability.ts`):
- `signalFrom(read, subscribe)` — превращает событийный источник в сигнал;
- `toSource(sig)` — отдаёт порт `{get, subscribe}`. `subscribe` возвращает `Disposable` (`toDisposable`), а не функцию.

**Политика ошибок оболочки — обязательна для `toSource`.** Сторы оболочки изолируют подписчиков: упавший не мешает остальным, несколько падений собираются в `AggregateError` (`when-context-store.test.ts:86-110`). Preact после пакета перебрасывает только первую ошибку эффекта. Поэтому `toSource` держит свой список слушателей и одну подписку-`effect` на сигнал, а уведомляет по политике оболочки. Это один общий хелпер вместо копии в каждом сторе.

Порты `builder-plugin-api` не меняются. Сигналы импортируются из `@reformer/core/signals`: builder и так зависит от `@reformer/core`, а прямая зависимость от `@preact/signals-core` (`package.json:90`) остаётся для превью. Если `signalFrom` понадобится в трёх и более местах после W2, поднять его в ядро.

**Критерии успеха:**
- код переведённых сторов без тестов сократился не меньше чем на 30%. Считаем только сам стор: в `when-context-store.tsx` рядом живут `useFocusTracking` и прочее, их не учитываем;
- существующие `*.test.ts` проходят без правок;
- зелёные `npm run test:browser -w projects/reformer-builder` и `npm run test:e2e -w projects/reformer-builder-playground-e2e`;
- рендеров не больше, чем было;
- не больше одного обхода (`untracked`/`peek`) на стор.

**Стоп-критерий.** Если в 2 из 3 сторов нужны обходы «Cycle detected» или нестабильная идентичность снимка, либо e2e нестабилен из-за микротасков и это не чинится за день:
- дальше `createModel` не распространяем;
- остаёмся на `signal`/`computed` + хелперах;
- проблемы заводим задачами `bd` на ядро.

## P2. `resource()` — сабпат `@reformer/core/resource` (параллельно с W1)

```ts
interface ResourceOptions<T, K = void, E = unknown> {
  key?: () => K | null | undefined;  // реактивно; null → idle
  load: (key: K, ctx: { signal: AbortSignal; previous: T | undefined }) => Promise<T>;
  enabled?: () => boolean; initialData?: T; keepPrevious?: boolean /* true, SWR */;
  equals?: (a: K, b: K) => boolean /* deepEqual */; toError?: (e: unknown) => E;
  onSuccess?: (d: T) => void; onError?: (e: E) => void;
}
interface Resource<T, E = unknown> {
  readonly state: ReadonlySignal<AsyncResourceState<T, E>>;   // одна подписка для React
  readonly data / status / error / refreshing / isFetching: ReadonlySignal<…>;
  reload(): void; abort(): void; mutate(next: T | ((p: T | undefined) => T)): void;
  settled(): Promise<void>; dispose(): void;
}
function resource<T, K = void, E = unknown>(o: ResourceOptions<T, K, E>): Resource<T, E>;
```

**Файлы.**
- Новые: `src/resource/{machine.ts,resource.ts,index.ts}`.
- Проводка, как у других сабпатов:
  - вход в `vite.config.ts`, `./resource` в `package.json#exports`;
  - `external` у консументов;
  - ESLint-граница resource ⇏ form/platforms;
  - точка typedoc в `projects/reformer-doc/docusaurus.config.ts`;
  - `scripts/check-exports-dist.mjs`;
  - size-limit ≤ 2 kB.

**Переиспользование.**
- Машина состояний переносится из `packages/reformer-cdk/src/components/async-boundary/async-resource.ts` вместе с `async-resource.test.ts`: `asyncResourceReducer`, `initialAsyncResourceState`, `AsyncResourceState`, `rejectionMessage`, `defaultToError`, тип `AsyncStatus` из `types.ts`.
- cdk публично экспортирует `asyncResourceReducer`, `initialAsyncResourceState` и `defaultToError` (`async-boundary/index.ts`), а машиной пользуется ещё `file-upload/file-upload-core.ts`. Поэтому cdk реэкспортирует их из ядра под теми же именами: публичный API cdk не меняется. cdk уже зависит от `@reformer/core`.
- Отсечение устаревших ответов — токен прогона, как флаг `cancelled` в `useAsyncResource`.
- `resource` регистрируется в активном scope.

**Переход cdk.**
- (a) Сначала только импорт машины.
- (b) `useAsyncResource` поверх `resource()` — только при зелёных `AsyncBoundary.test.tsx` и тесте StrictMode. Ресурс создаётся в эффекте, не в `useMemo`.

**Кэш и дедупликация — позже.** `form-registry/src/cache.ts` заточен под схемы, его не обобщаем.

**Пилот W2a:** `shell/boot/settings/MarketplaceTab.tsx` — там ручная машина `loading`/`error` на `useState`.

## P3. Сверка массивов по ключу

```ts
interface ArrayOfOptions<U> { key: (keyof U & string) | ((item: U) => PropertyKey) }
function arrayOf<U>(blank: (() => U) | null, items?: readonly U[], options?: ArrayOfOptions<U>): U[];
```

**Расширение сигнатуры.** Сейчас шаблон обязателен: `arrayOf<U>(blank: () => U, items = [])` (`model-nodes.ts:151`). P3 разрешает `blank: null` для массивов без шаблона — вкладки, строки из сервера. `push()`/`insertAt()` без значения у такого массива бросают ошибку с подсказкой, как сейчас у массива без `arrayOf`. Изменение совместимое: старые вызовы не меняются.

**Рантайм.**
- Ключ хранится под отдельным символом рядом с `BLANK` (`model-nodes.ts:86`) и наследуется через шаблон, как `BLANK`.
- `ModelArrayNode.set`: таблица «ключ → узел». Найденный узел переиспользуется через `node.set(item)`, новый собирается заново.
- Всё внутри `batch`. `items.value` присваивается только при смене состава или порядка.
- Дубли ключей: предупреждение в dev, дубль пересобирается.
- `patch` сверяет так же. Массивы без ключа ведут себя как раньше.

**Бесплатно для форм.** `form/nodes/form-array-node.ts:82-119` кэширует строку формы по фасаду строки модели, а фасад стабилен на узел (`facadeCache`, `model-value-proxy.ts:151`). Поэтому touched, замечания и `applyEach` строки переживают `model.set/patch/reset`.

**Тесты:**
- `array-keyed.test.ts`;
- property-тесты в `model-array.property.test.ts`: `get()` равен входу; узлы сохранившихся ключей идентичны; при том же порядке нет уведомления о составе;
- интеграция с формой.

**Пилот W2b:** `shell/platform/ui/state/tabs.ts` (`TabsState { tabs, activeId }`, `:70`).
- Редьюсеры и их тесты не трогаем; `commit(next)` (`:392`) превращается в `model.set(next)` с `arrayOf(null, [], { key: t => t.ref.id })`.
- Цель: нажатие клавиши перерисовывает точку «изменён» только у одной вкладки.
- Если выигрыша нет, остаёмся на `signal<TabsState>`.

## P4. `recordOf` и `opaque` (самый рискованный, последний)

```ts
function recordOf<V>(blank?: ((key: string) => V) | null, entries?: Readonly<Record<string, V>>,
  options?: { leaf?: boolean }): RecordOf<V>;   // leaf: значения — листья, не группы
function opaque<T extends object>(value: T): Opaque<T>;   // WeakSet-метка → лист
interface ModelRecord<V> { readonly size: number; has(k): boolean; at(k): ModelArrayItem<V> | undefined;
  keys(): string[]; entries(): [string, ModelArrayItem<V>][]; set(k, v: V): void;
  add(k, v?: Partial<V>): void; delete(k): boolean; clear(): void; toObject(): Record<string, V> }
```

**Типы.** Ветка `typeof RECORD extends keyof NonNullable<V>` в `ModelValue`, `ModelSignalNode` и `DeepPartialValue` (`types.ts`). Обычные `Record<…>` форм не затрагиваются.

**Рантайм.**
- Новый `ModelRecordNode` (`kind: 'record'`), состав — `Signal<Map<string, ModelNode>>`.
- `set` сверяет по ключу. `patch` от родителя добавляет и обновляет ключи, но не удаляет.
- Ключ с `.` — ошибка в dev.

**Аудит.**
- В модели: `model-signals-proxy.ts` (`childAt`, `containerSignal`, `freezeSnapshot`, `resolveSignalAt`), `create-model.ts` (`walkLeaves`), `isModelContainerSignal`/`isValueSignal`.
- На стороне формы: `form/create-form.ts`, `form/schema/compile.ts`, `form/behaviors/{collections,internals}.ts`, `form/validation/operators.ts`, конвертер renderer-json.
- В форме словарь — только поле-значение; привязка словаря как группы — явная ошибка.

**Опция `leaf`.** Нужна для словарей произвольных значений. Без неё объект-значение разберётся в группу с фиксированными ключами, и запись значения другой формы бросит ошибку.

**Пилот W3:** кэш областей в `shell/platform/services/settings.ts`. Там `Record<string, unknown>` на область (`SettingsBackend.read`, `:61`), значения произвольные — значит `recordOf(null, entries, { leaf: true })`. По желанию — `resource-tree.ts`: после P1 его `ReadonlyMap`/`ReadonlySet` (`:53-67`) станут листьями.

## P5. Документация и MCP (по ходу фаз, сведение в конце)

- **Рецепты** (`packages/reformer/docs/llms/`):
  - `40-app-state-store.md` (P1);
  - `41-resource.md` (P2; ссылки из 29 и 32 по правилу «вне схемы — `resource`, внутри — `onChange`»);
  - `42-keyed-arrays-and-records.md` (P3/P4);
  - обновить `39-overview.md`;
  - `packages/reformer/llms.txt` не править руками: он собирается (`npm run generate:llms -w packages/reformer`) из `docs/llms/*.md`, JSDoc и `description` пакета. Смена `description` тоже меняет его шапку.
- **Сайт:** `projects/reformer-doc/docs/core-concepts/app-state.mdx` «Модель как стор приложения» — после `model.mdx`, со ссылкой из `levels.mdx`. Там же антипаттерн `useSignalSnapshot(model.$)`.
- **MCP:** правила в `packages/reformer-mcp/src/core/decide/api-decision.ts`, тесты — `packages/reformer-mcp/tests/api-decision.test.ts`:
  - `app-state-outside-form` → `createModel`/`createStore`;
  - `async-load-outside-form` → `resource`;
  - `stable-row-identity` → `arrayOf` с ключом;
  - `dictionary-by-id` → `recordOf`.
  - Генераторы форм (`generate/schema-emit.ts:472-477`, пример в `decide/api-decision.ts:753`) продолжают писать `FormModel<…>`: это код форм, синоним не устаревает.
- **README и `package.json#description`:** «Reactive form and application state on signals».

## Отложено (вне плана)

- `resource`: кэш, дедупликация, ленивый старт.
- Отложенные записи: счётчики на scope и `scope.settled()`.
- Классы как листья по умолчанию и решение о `@deprecated` для `FormModel` (major).
- Структурные поля, начатые с `null`.
- `createStoreContext`.
- Автоматический захват `createForm` внешним scope.
- Перевод size-limit на esbuild.
- Записи словаря в схеме формы.
- Persistence, history/undo, devtools.

## Verification (каждая фаза)

1. Тесты ядра: `npm test -w packages/reformer` (vitest), включая новые тесты фазы и `tests/model/subpath-single-runtime.test.ts`.
2. `npm run typecheck` из корня (все пакеты, playground, builder).
3. `npm run lint`: границы model ⇏ form и resource ⇏ form ловят нарушение (негативный кейс).
4. Экспорты и сборка: `npm run build -w packages/reformer`, `npm run check:exports-dist`, `npm run check:dist-deps`, `npm run size:check`.
5. e2e форм: `npm run test:e2e -w projects/react-playground-e2e` (сложная форма, массивы). Должен быть зелёным — гарантия, что форм-API не сломан.
6. Пилоты:
   - `npm run test:browser -w projects/reformer-builder`, unit-тесты переведённых сторов без правок (в том числе `when-context-store.test.ts`: заморозка, `set` → `boolean`, `AggregateError`);
   - `npm run test:e2e -w projects/reformer-builder-playground-e2e`;
   - замер строк до и после.
7. MCP (P5): `npm run mcp:scenarios`; тест `choose_api` на новые формулировки, рус. и англ.

## Критичные файлы

- `packages/reformer/src/model/{model-nodes.ts,types.ts,model-value-proxy.ts,model-signals-proxy.ts,behaviors-value.ts,safe-effect.ts,create-model.ts,index.ts}`
- `packages/reformer/src/platforms/react/hooks/{useSignalSnapshot.ts,useSignalSubscription.ts}`, `packages/reformer/src/react.ts`
- `packages/reformer/src/form/nodes/form-array-node.ts`, `packages/reformer/src/form/behaviors/context.ts`
- `packages/reformer/{vite.config.ts,package.json}`, `.size-limit.json`, `eslint.config.js`
- `packages/reformer-cdk/src/components/async-boundary/async-resource.ts`
- `projects/reformer-builder/src/shell/{boot/project/workspace-session.ts,boot/project/project-status.ts,platform/ui/state/*.ts,platform/services/theme.ts}`
- `packages/reformer-mcp/src/core/decide/api-decision.ts`
