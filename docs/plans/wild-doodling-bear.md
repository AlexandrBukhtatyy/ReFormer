# Ленивая загрузка форм в MFE: `@reformer/form-host`

## Context

Задача: в микрофронтенд-окружении подгружать форму вместе с её поведением как отдельный чанк. Форма —
**независимо версионируемый артефакт** (хост знает только `id` + версию), приносит **свой registry-фрагмент**
поверх базового реестра хоста. Менеджер обязан уметь prefetch/кеш, изоляцию ошибок, типизированный
контракт host↔form и проверку совместимости версий.

Разведка выявила два факта, определяющих архитектуру.

**Первый — форма не может ехать как JSON.** JSON-DSL в ReFormer покрывает только layout; это
задокументированный принцип ([06-validation.md](packages/reformer-renderer-json/docs/llms/06-validation.md):
«оператора `$validator(...)` не существует»). Валидация, `behavior`, render-behavior, submit,
wizard-навигация — только JS. Значит артефакт формы — **ESM-чанк**, внутрь которого JSON-схема
инлайнится импортом. Схема и поведение ссылаются на одни и те же пути модели, поэтому разделять их
на два канала доставки нельзя — получим рассинхрон.

**Второй — библиотека сейчас ломается при двух копиях пакета, и ломается МОЛЧА.** Это и есть
центральная техническая проблема, а не сама загрузка чанка. В `packages/*/src` нет ни одного
`globalThis`/`Symbol.for`-guard'а: механизм дедупликации не заложен вообще, всё держится на
`resolve.dedupe` в конфигах двух SPA. Следствия при двух копиях:

| место | последствие |
|---|---|
| [signal-node-registry.ts:18](packages/reformer/src/form/signal-node-registry.ts#L18) `WeakMap<Signal, FormNode>` | `enableWhen`/`disableWhen` не работают, ошибки валидации не доходят до полей — **без единого сообщения** |
| [derived-registry.ts:27](packages/reformer/src/state/derived-registry.ts#L27) refcount | `model.set/patch` перетирают computed-поля |
| [render-schema-proxy.ts:22](packages/reformer-renderer-react/src/core/render-schema-proxy.ts#L22) `Symbol()` вместо `Symbol.for()` | `isRenderSchemaProxy()` → `false` → **render-behavior молча не монтируется** |

Плюс баг уже в собранном артефакте: [vite.config.ts:29-38](packages/reformer-renderer-json/vite.config.ts#L29-L38)
не экстернализует `@reformer/core/signals`, при том что
[use-signal-value.ts:13](packages/reformer-renderer-json/src/locale/use-signal-value.ts#L13) импортит оттуда
в рантайме. В `dist/index.js` лежит инлайненная копия `@preact/signals-core` со своим классом `Signal` —
`v instanceof Signal` там всегда `false`. `scripts/check-dist-deps.mjs` этого не ловит: он проверяет
«импортирую, но не объявил», а не «должен был экстернализовать, а забандлил».

Итог: **сначала чиним фундамент, потом строим менеджер.** Иначе ленивая загрузка даст формы, которые
выглядят рабочими, но у которых не срабатывает половина поведения.

Объём этого плана — этапы 0–4 (фундамент + работающий менеджер на static-загрузчике). Адаптеры доставки
(ESM+importmap / Module Federation), миграции значений и A/B версий спроектированы, но выносятся в
следующую итерацию.

---

## Целевая архитектура

```
@reformer/core            ← runtime-guard: globalThis + Symbol.for + ABI      [Этап 1]
   ↑ peer
@reformer/renderer-react  ← Symbol.for(PROXY_MARKER), itemKeys в слот         [Этап 1]
   ↑ peer
@reformer/renderer-json   ← + mergeRegistries, collectSchemaOperatorNames     [Этап 2]
   ↑ peer
@reformer/form-host  (НОВЫЙ ПАКЕТ)                                            [Этапы 2–4]
   ├── .            → createFormManager, LazyForm, useLazyForm, ErrorBoundary
   ├── /contract    → типы FormModule/FormManifest + defineFormModule (zero-runtime)
   ├── /loaders     → createStaticLoader (сейчас); esm/federation — потом
   ├── /build       → vite-плагин генерации манифеста
   └── /validate    → ajv-валидация манифеста (по образцу renderer-json/validate)
```

Артефакт формы зависит только от `@reformer/form-host/contract` (типы стираются) + peer'ы
`@reformer/core`, `@reformer/renderer-json`, `react`.

Имя `form-host` выбрано честно: пакет — про **хост**, принимающий чужие формы. `@reformer/loader`
не отражает кеш/версионирование, `@reformer/federation` привязал бы имя к одному из трёх адаптеров.

---

## Этап 0 — починить сборку (~0.5 дня)

1. [packages/reformer-renderer-json/vite.config.ts:29-38](packages/reformer-renderer-json/vite.config.ts#L29-L38) —
   externals с перечисления на предикат по образцу
   [packages/reformer-ui-kit/vite.config.ts:40](packages/reformer-ui-kit/vite.config.ts#L40)
   (`/^@reformer\//` покрывает все subpath'ы разом). Именно перечисление породило баг.
2. То же для [packages/reformer-renderer-react/vite.config.ts](packages/reformer-renderer-react/vite.config.ts) —
   сейчас перечислены 4 core-subpath'а, `/behaviors` и `/validation` заинлайнятся при первом импорте.
3. `scripts/check-dist-deps.mjs` — **фаза B (обратная проверка)**. Правило без парсинга семантики:
   множество singleton-спецификаторов, импортируемых из `src/**`, должно быть подмножеством множества
   из `dist/**`. Что есть в `src`, но исчезло в `dist` — забандлено. Singleton-список: `react`,
   `react-dom`, `@preact/signals-core`, `/^@reformer\//`. Сравнение по **полному спецификатору**, иначе
   `@reformer/core/signals` спрячется за `@reformer/core`.
4. `@preact/signals-core` в [packages/reformer/package.json](packages/reformer/package.json):
   `dependencies` → `peerDependencies` (+ в `devDependencies` для локальной сборки).
5. `npm run check:packaging` добавить во все пакеты (сейчас только в ui-kit) и в CI.

**DoD:** `npm run build --workspaces && npm run check:dist-deps` зелёный;
`grep -c "prototype.peek" packages/reformer-renderer-json/dist/*.js` = 0; в `dist/index.js` появился
`import { Signal, effect } from "@reformer/core/signals"`.

> **Breaking (п.4):** потребители обязаны ставить `@preact/signals-core` сами. Без слома —
> оставить в `dependencies` и полагаться на hoisting + `resolve.dedupe`, но в MFE это не работает:
> у второй копии свой релизный конвейер. Рекомендую peer.
>
> **Поведенческий слом (п.1):** `v instanceof Signal` в renderer-json начнёт возвращать `true`.
> Код, случайно опиравшийся на сломанную ветку, получит новые пути исполнения. Минимум minor.

---

## Этап 1 — runtime-guard от двух копий (~1–1.5 дня)

### Принцип: делить identity-мапы, изолировать ambient-области

Не всё module-level state надо шарить — это уточнение сокращает правки вдвое:

- **`WeakMap`-реестры** (сигнал→нода, derived-refcount, фасады модели, run-state валидации, item-keys) —
  карты идентичности, расхождение копий ломает их молча → **в глобальный слот**.
- **Ambient-стоки** `let current` в [behaviors.ts:66](packages/reformer/src/form/behaviors.ts#L66) и
  [validation-schema.ts:76](packages/reformer/src/form/validation-schema.ts#L76) — состояние текущего
  прогона. Их шаринг **сломал бы** реентерабельность. При расхождении они уже падают громко и внятно →
  **оставить per-copy**, только дописать в текст ошибки диагностику копий.

### Новый файл

`packages/reformer/src/runtime/global-scope.ts` (~130 строк):

```ts
export const RUNTIME_ABI = 1;              // бампится ТОЛЬКО при несовместимой смене формы слота
const ROOT = Symbol.for('@reformer/core#runtime');

export function slot<T>(name: string, create: () => T): T;
export function getRuntimeReport(): RuntimeReport;   // { abi, version, copies[], degraded } — не бросает
export function assertSingleRuntime(opts?: { allowMultipleVersions?: boolean }): void;
```

**Политика конфликтов** — ключевое решение:

| ситуация | поведение |
|---|---|
| одна копия | как сейчас |
| несколько копий, **тот же ABI**, разные minor/patch | слоты **разделяются**, `copies[]` пополняется, один `console.warn` в DEV. Это норма: хост 6.0.0 + форма 6.0.3 |
| несколько копий, **разный ABI** | новая копия получает приватные слоты, `degraded = true`, один `console.error`. **Import-time throw — нет** |

Библиотека не вправе ронять всю страницу на import. Но и молча деградировать нельзя — поэтому
ответственность разделена: **core фиксирует `degraded`, `@reformer/form-host` превращает это в видимый
отказ** — `createFormManager` зовёт `assertSingleRuntime()` на boot и при `degraded` отказывается
монтировать формы, показывая `errorFallback` со списком версий. Сбой локализован в форме.

### Точный список правок

| файл | правка | строк |
|---|---|---|
| `packages/reformer/src/runtime/global-scope.ts` | **новый** | ~130 |
| [signal-node-registry.ts:18](packages/reformer/src/form/signal-node-registry.ts#L18) | `slot('form.signalNode', () => new WeakMap())` | 1 |
| [derived-registry.ts:27](packages/reformer/src/state/derived-registry.ts#L27) | `slot('state.derived', …)` | 1 |
| [form-model.ts:364-368](packages/reformer/src/state/form-model.ts#L364-L368) | `facadeCache`, `rootByFacade` → `slot(…)` | 2 |
| [validation-schema.ts:231](packages/reformer/src/form/validation-schema.ts#L231) | `stateRegistry` → `slot('validation.runState', …)` | 1 |
| [unique-id.ts:37](packages/reformer/src/form/unique-id.ts#L37) | `let counter = 0` → `slot('core.idBox', () => ({ n: 0 }))` — примитив по ссылке не шарится, нужен бокс | 3 |
| [behaviors.ts:73](packages/reformer/src/form/behaviors.ts#L73), [validation-schema.ts:78](packages/reformer/src/form/validation-schema.ts#L78) | дописать `getRuntimeReport()` в текст ошибки при `copies > 1` | 6 |
| [render-schema-proxy.ts:22](packages/reformer-renderer-react/src/core/render-schema-proxy.ts#L22) | `Symbol.for('@reformer/renderer-react#RenderSchemaProxy')`; `isRenderSchemaProxy` проверяет `RENDER_ABI` и **бросает именованную ошибку** при несовпадении — молчаливый `false` и есть тот баг, от которого чинимся | 6 |
| [render-node.tsx:279-280](packages/reformer-renderer-react/src/core/render-node.tsx#L279-L280) | `itemKeys`/`keyCounter` → `slot(…)`/бокс | 3 |
| `packages/reformer/src/index.ts` | экспорт `getRuntimeReport`, `assertSingleRuntime`, `RUNTIME_ABI`, `VERSION` | 2 |
| `packages/reformer/vite.config.ts` | `define: { __REFORMER_VERSION__: … }` из package.json | 3 |

**Итого 1 новый файл + 11 изменённых, ~160 строк.** Блокер оказался дешёвым — это главный вывод этапа.

### Tree-shaking

`"sideEffects": false` остаётся корректным: `const registry = slot(...)` — эффект **удержанного**
модуля, а модуль удерживается только при использовании `registerSignalNode`/`getNodeForSignal`.
Флаг обещает «удаление НЕиспользуемого модуля безопасно» — это по-прежнему правда.

Чего нельзя: голый `assertSingleRuntime()` на верхнем уровне `src/index.ts` — вот это сломало бы
шейкинг барреля. Проверка ABI ленивая, внутри первого `slot()`.

Защита от регресса: ESLint `no-restricted-syntax` на `packages/reformer*/src/**` (кроме `runtime/`) —
запрет module-level `new WeakMap()`/`new Map()`/`let`. Сейчас таких мест 4+4; после правок должно
остаться 2 намеренных ambient `current`.

**DoD:** unit-тест `packages/reformer/src/runtime/global-scope.test.ts` (шаринг при равном ABI, изоляция +
`degraded` при разном, содержимое `RuntimeReport`) через `vi.resetModules()` + очистку
`globalThis[Symbol.for(...)]`; `npm run size` вырос ≤ 0.3 KB; `npm run knip` чистый; coverage core ≥ 80 %.

---

## Этап 2 — контракт form-модуля + манифест + билд (~2 дня)

### Контракт

`packages/reformer-form-host/src/contract/types.ts` — все типы `import type`, runtime-вес 0:

```ts
export const FORM_MODULE_ABI = 1 as const;

export interface FormSetupArgs<TValues, TCtx, TEvents> {
  initial: Partial<TValues>;        // уже прогнан через миграции до manifest.version
  context: TCtx;
  registry: ComponentRegistry;      // base хоста ⊕ фрагмент формы; форма НЕ собирает его сама
  emit: <K extends keyof TEvents & string>(type: K, payload: TEvents[K]) => void;
  signal: AbortSignal;              // живёт до unmount
}

export interface FormInstance<TValues, TResult> {
  readonly bundle: JsonForm<TValues>;              // { model, form, schema, registry }
  readonly renderBehavior?: RenderBehaviorFn<TValues>;
  getValues(): TValues;
  submit?(): Promise<TResult>;
  dispose(): void;                                 // обязан звать bundle.form.dispose()
}

export interface FormModule<TValues, TResult, TCtx, TEvents> {
  readonly abi: typeof FORM_MODULE_ABI;
  readonly manifest: FormManifest;
  createRegistryFragment?(ctx: TCtx): ComponentRegistry;   // только СВОИ компоненты
  setup(args: FormSetupArgs<TValues, TCtx, TEvents>): FormInstance<TValues, TResult>;
  migrations?: readonly FormMigration[];
}

export function defineFormModule<…>(m: FormModule<…>): FormModule<…>;   // идентити-хелпер
```

Типизация host↔form двусторонняя: `TValues` и `TCtx` внутрь, `TResult` и `TEvents` наружу.
`LazyForm` пробрасывает те же параметры — опечатка в `onEvent` ловится компилятором на стороне хоста.

### Как ложится существующий layout формы

Эталон — [mcp-credit-application-renderer-json-v20/](projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v20/)
(канон описан в [06-form-directory-layout.md](packages/reformer-mcp/docs/llms/06-form-directory-layout.md)).
Меняются **два файла из десяти**:

| файл | изменение |
|---|---|
| `index.tsx` | **удаляется из артефакта** (остаётся в репо как демо статического монтирования) |
| `form.entry.ts` | **новый**, ~40 строк: `export default defineFormModule({...})` |
| `registry.ts` | оставляет только свои компоненты; ui-kit приезжает от хоста через `needs` |
| `renderer.behavior.ts` | `onResult` → `emit('submitted', …)`, добавляется `signal` |
| `renderer.schema.json` | заполняются `id`/`version`/`meta` |
| `types.ts`, `model.ts`, `validation.ts`, `data-sources.ts`, `api.ts`, `form.behavior.ts` | **без изменений** |

Схема **импортируется**, а не фетчится — Vite инлайнит JSON в чанк, схема и код физически неразделимы.
Билд-плагин падает при `manifest.version !== schema.version`. Цена — 45 KB JSON в чанке (~6–8 KB gzip);
атомарность важнее.

### Манифест

`form.manifest.json` — генерируется, не пишется руками:

```jsonc
{
  "abi": 1,
  "id": "credit-application",      // === schema.id
  "version": "2.3.0",              // === schema.version, semver, обязателен
  "meta": { "name": "…" },         // === schema.meta
  "engines": { "@reformer/core": "^6.0.0", "@reformer/renderer-json": "^6.0.0" },
  "entry": "./credit-application-2.3.0.js",
  "integrity": "sha384-…",
  "bytes": 128340,
  "needs":    { "components": ["Input","Select","Box","__fieldWrapper"], "dataSources": [], "fn": [] },
  "provides": { "components": ["Wizard","Step"], "dataSources": ["LOAN_TYPES"], "fn": [] }
}
```

Поля `id`/`version`/`meta` уже объявлены в
[json-schema.ts](packages/reformer-renderer-json/src/types/json-schema.ts) и не имеют ни одного
потребителя — манифест становится первым. Новых полей в `JsonFormSchema` не нужно.

`needs`/`provides` **выводятся**: `referenced = collectSchemaOperatorNames(schema)`,
`provides = fragment.names()` (плагин исполняет `createRegistryFragment` в node),
`needs = referenced ∖ provides`. Расхождение невозможно по построению.

### Аддитивное публичное API

| пакет | добавить | зачем |
|---|---|---|
| `@reformer/renderer-json` | `mergeRegistries(parent, child)` — обёртка над `ComponentRegistryImpl.withParent`, класс остаётся internal | **`ComponentRegistryImpl` сейчас не экспортируется из `src/index.ts`** — менеджер физически не может мержить |
| `@reformer/renderer-json` | `collectSchemaOperatorNames(schema)` — вынос приватной `walkOperatorNames` из [validate.ts:69](packages/reformer-renderer-json/src/validate.ts#L69) в ajv-free модуль | из неё билд-плагин выводит `needs`/`provides` |
| core / renderer-react / renderer-json | `export const VERSION: string` | проверка `manifest.engines` |

Всё аддитивное, ни одного breaking.

### Билд артефакта

`packages/reformer-form-host/src/build/vite-plugin-form-manifest.ts`: требует `id` + semver-`version` +
`meta.name`, сверяет версию схемы с `package.json` формы (иначе `this.error`), в `writeBundle` считает
`bytes`/`sha384`, выводит `needs`/`provides`, пишет манифест.

`vite.config.ts` формы — обязательный минимум:

```ts
build: {
  lib: { entry: 'src/form.entry.ts', formats: ['es'], fileName: () => `${id}-${version}.js` },
  rollupOptions: {
    external: (id) =>                        // ПРЕДИКАТ, не перечисление — см. Этап 0
      /^react($|\/)/.test(id) || /^react-dom($|\/)/.test(id) ||
      /^@reformer\//.test(id) || /^@preact\/signals-core$/.test(id),
    output: { inlineDynamicImports: true },  // самодостаточный чанк
  },
}
```

**DoD:** `vite build` эталонной формы даёт один чанк + манифест; `check-dist-deps` фаза B на артефакте
зелёная; `validateFormManifest` валиден; `needs` совпадает с ручным списком.

---

## Этап 3 — ядро менеджера (~2–3 дня)

`packages/reformer-form-host/src/manager/create-form-manager.ts`:

```ts
export interface FormManagerConfig {
  loader: FormLoader;
  registry: ComponentRegistry;               // ui-kit + системные контейнеры, один на приложение
  engines?: Record<string, string>;
  registryConflicts?: 'strict' | 'override' | 'host-wins';   // default 'strict'
  pins?: Record<string, string>;             // id → точная версия: rollback
  maxCached?: number;                        // LRU, default 16
  onEvent?: (e: FormManagerEvent) => void;
}

export interface FormManager {
  resolve(ref, ctx?): Promise<ResolvedForm>;   // манифест + вердикт совместимости
  load(ref, ctx?): Promise<LoadedForm>;
  prefetch(ref | ref[]): void;
  invalidate(ref?): void;
  readonly runtime: RuntimeReport;
}
```

**Кеш и дедуп.** `Map<string, Promise<LoadedForm>>`, ключ `${id}@${resolvedVersion}` (после `pins`,
поэтому две версии живут в кеше одновременно). Конкурентные `load()` делят один промис. **При reject
запись удаляется** — иначе retry навсегда упирается в закешированный отказ; это отдельный тест.
LRU вытесняет только записи без смонтированных инстансов (refcount инкрементится в `LazyForm` на mount).

**Prefetch** = `resolve()` + `loader.prefetch?.()`, никогда не бросает — ошибки только в `onEvent`.

**Совместимость.** `manifest.engines` против новых `VERSION`-констант. Чекер semver-диапазонов — свои
~60 строк (`^`, `~`, `>=`, `x`), без зависимости `semver`; сложнее — отклоняется на валидации манифеста.
Плюс `manifest.abi === FORM_MODULE_ABI` и `assertSingleRuntime()` на boot.

**Мерж реестров и политика конфликтов.** `withParent` даёт приоритет child
([component-registry.ts:66](packages/reformer-renderer-json/src/registry/component-registry.ts#L66))
и создаёт новый объект — хостовый реестр не мутируется, радиус поражения = поддерево одной формы.
Но тихое затенение `Input` устаревшей формой — кошмар при отладке:

- **`'strict'` (default):** `collision = fragment.names() ∩ host.names()`; непусто → `RegistryConflictError`
  со списком → ErrorBoundary. Автора формы принуждает переименовать. Нулевая стоимость рантайма.
- **`'override'`:** текущая семантика + `console.warn` на каждое имя.
- **`'host-wins'`:** инверсия аргументов `withParent(fragment, host)`. Одна строка.

Namespace-префиксы (`credit:MyChart`) **отвергнуты**: требуют переписывать `$component(...)` в 45 KB JSON
на каждой загрузке и ломают `validateFormSchema`.

Дополнительно до `setup()`: `manifest.needs.components ⊆ hostRegistry.names()` — не хватает `Input`,
падаем с внятным списком, а не рендерим сломанное дерево.

**Загрузчик** — единый интерфейс, чтобы выбор доставки не пришлось принимать сейчас:

```ts
export interface FormLoader {
  readonly kind: 'esm' | 'federation' | 'static';
  resolveManifest(ref: FormRef): Promise<FormManifest>;
  load(manifest: FormManifest): Promise<FormModule>;
  prefetch?(manifest: FormManifest): void;
}
```

На этом этапе реализуется только `createStaticLoader({ forms })` — `Record<id, () => import(...)>`.
Смена на ESM/MF потом = одна строка в `createFormManager({ loader })`.

**Рекомендация дефолта на будущее — native ESM + import map**, не Module Federation: требование
«независимо версионируемый артефакт, хост знает id+version» ложится на `GET /forms/{id}/{version}/manifest.json`
+ `import(url)` один-в-один, а `shared: { singleton: true }` работает только внутри MF-графа — legacy MFE,
собранный не MF, в этом договоре не участвует (реальность зафиксирована в
[piped-zooming-flask.md](docs/plans/piped-zooming-flask.md): на одном DOM живут legacy и новые MFE).
Брать MF стоит, если shell и **все** MFE уже на нём с работающим `shared`-контрактом.

**DoD:** unit-тесты — два параллельных `load()` = один вызов loader'а; reject чистит кеш;
`'strict'` бросает на коллизии; несовместимый `engines` даёт типизированную ошибку; `pins` перебивает
запрошенную версию.

---

## Этап 4 — React-слой и изоляция ошибок (~1–2 дня)

`packages/reformer-form-host/src/react/lazy-form.tsx`:

```tsx
export function FormManagerProvider(p: { manager: FormManager; children: ReactNode }): ReactNode;
export function useFormManager(): FormManager;
export function LazyForm<TValues, TResult, TCtx, TEvents>(p: LazyFormProps<…>): ReactNode;
export function useLazyForm<…>(ref, opts): { status; instance?; error?; retry() };
```

`LazyFormProps`: `id`, `version?`, `initial?`, `context?`, `onEvent?`, `onSubmit?`,
`onInstance?` (для хостовой кнопки submit), `fallback?`, `errorFallback?(e, retry)`, `validateSchema?`.

Внутренности — жёстко по существующим инвариантам репо:

1. Подписка на кеш через `useSyncExternalStore`, а не `use()` — работает на React 18 без
   Suspense-оговорок (peer-диапазон пакетов `^18 || ^19`).
2. `setup()` вызывается **ровно один раз** через ленивый инициализатор `useState` — точно как
   [useJsonForm](packages/reformer-renderer-json/src/create-json-form.ts#L96). `useMemo` запрещён:
   React вправе сбросить кеш → потеря введённого.
3. Рендер — ровно как в
   [index.tsx:59-66](projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v20/index.tsx#L59-L66):
   `<JsonRendererProvider settings={{ registry: merged }}><JsonFormRenderer form={inst.bundle} renderBehavior={inst.renderBehavior} /></JsonRendererProvider>`.
4. Unmount: `useEffect(() => () => { ac.abort(); inst.dispose(); }, [inst])` → `bundle.form.dispose()` →
   `groupNode.dispose()` снимает `attachBehaviorCleanup`. Чистый unmount уже есть, менеджер его только зовёт.
5. **ErrorBoundary** — не изобретать: копия паттерна
   [schema-error-boundary.tsx](packages/reformer-renderer-json/src/components/schema-error-boundary.tsx).
   Retry = `manager.invalidate(ref)` + инкремент `key` на поддереве.

**DoD:** демо-страница `/examples/lazy-json-renderer` в playground рендерит ту же кредитную форму лениво;
критерий приёмки — см. ниже.

---

## Верификация

### Главный критерий: ленивая форма ведёт себя как статическая

В [playwright.config.ts](projects/react-playground-e2e/playwright.config.ts) добавить проект по образцу
существующих (`metadata.basePath`):

```ts
{ name: 'lazy-form-json', testDir: './tests/pages/complex-multy-step-form',
  metadata: { basePath: '/examples/lazy-json-renderer', variant: 'json' } }
```

Это прогоняет **весь существующий набор из 9 spec-файлов** (`happy-path`, `validation`, `arrays`,
`computed-fields`, `conditional-fields`, `navigation`, `dependencies`, `reorder`, `a11y`) через
POM `CreditFormPage` против ленивой формы. Ноль новых spec, максимальное покрытие. Условие — артефакт
сохраняет `componentProps.testId = fieldName` (конвенция уже в CLAUDE.md).

### Воспроизведение «двух копий пакета» — ловит регрессию Этапа 1 автоматически

`resolve.alias` не годится — Vite схлопнет по конечному пути. Работает **virtual module с разным id**:
`projects/react-playground/src/mocks/vite-plugin-duplicate-runtime.ts` (~30 строк) отдаёт
`virtual:reformer-core-copy2` = текст `packages/reformer/dist/index.js` + маркер, и вариант
`virtual:reformer-core-abi2` с подменённой строкой `RUNTIME_ABI = 2`. Разные module id ⇒ Rollup
инстанцирует два графа ⇒ два `WeakMap`, два класса `Signal`. Точная репродукция MFE-ситуации.

Страница `projects/react-playground/src/pages/examples/duplicate-runtime/`: форма A на копии 1, форма B
на копии 2, баннер `data-testid="runtime-report"` с `getRuntimeReport()`.
Spec `tests/pages/duplicate-runtime/duplicate-runtime.spec.ts`:

| проверка | ожидание |
|---|---|
| `runtime-report.copies.length` | `2`, обе `shared: true`, `degraded: false` |
| `enableWhen` в форме B на сигнал, зарегистрированный копией 1 | **работает** — слот `form.signalNode` разделён |
| `compute` в форме B + `model.patch` | вычисляемое поле не затирается — общий `derived` |
| `hideWhen` в форме B | секция скрывается — `Symbol.for(PROXY_MARKER)` работает cross-copy |
| страница с `abi2` | `degraded: true`; `LazyForm` показывает `errorFallback` со списком версий; сломанная форма НЕ рендерится |

Без гарда первые четыре красные — сегодня они падали бы именно так, молча неработающим `enableWhen`.

### Уровни ниже e2e

- **Unit:** `global-scope.test.ts` через `vi.resetModules()` + очистка `globalThis[Symbol.for(...)]` —
  политика ABI без браузера, гоняется первой.
- **Packaging (CI):** `npm run build --workspaces && npm run check:dist-deps` — фаза B ловит возврат
  бага externals.
- **Size:** [.size-limit.json](.size-limit.json) пополняется бюджетом на `@reformer/form-host`
  (основной вход ≤ 6 KB gzip без ajv).
- **Новые spec** — только на то, чего нет в существующих: `lazy-form/loading.spec.ts`
  (сеть/кеш/prefetch/retry через `page.route`).

---

## Сводка breaking changes

| # | что | тип |
|---|---|---|
| 1 | `@preact/signals-core`: `dependencies` → `peerDependencies` в `@reformer/core` | **breaking** (установка); есть слабая non-breaking альтернатива |
| 2 | Фикс externals renderer-json: `instanceof Signal` начинает работать | поведенческий, ≥ minor |
| 3 | `isRenderSchemaProxy` бросает при несовпадении `RENDER_ABI` (было — молча `false`) | поведенческий, обязательно |
| 4 | `resetUniqueIdCounter()` сбрасывает разделяемый бокс | test-only |
| 5 | `mergeRegistries`, `collectSchemaOperatorNames`, `VERSION`, `getRuntimeReport`, `assertSingleRuntime`, весь `@reformer/form-host` | **аддитивно** |

Существующий способ монтирования (`index.tsx` + `createJsonForm` + `JsonFormRenderer`) продолжает
работать без изменений — `LazyForm` целиком аддитивен.

---

## Вынесено в следующую итерацию

- `createEsmLoader` (import map + `modulepreload` + SRI через `crypto.subtle` + blob-URL; цена SRI —
  отказ от внутреннего code-splitting формы, так как `import()` не принимает `integrity`).
- `createFederationLoader` (тонкая обёртка; пакет **не** зависит от `@module-federation/*` —
  контейнер-геттер инжектит приложение).
- Миграции значений между версиями схемы (`migratesFrom`, `initialVersion` в `LazyForm`).
- A/B двух версий через `variants: Record<id, (ctx) => version>`.

## Трекинг

Задачи заводить через `bd` (не TodoWrite/markdown), по одной на этап + подзадачи.
В конце сессии — `bd export -o .beads/issues.jsonl` и коммит вместе с `.beads/interactions.jsonl`.
