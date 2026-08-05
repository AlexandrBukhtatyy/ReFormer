# Реестр форм для микрофронтендов — план работ

## Context

Нужно управлять тем, **какая форма рендерится, где и когда**, в приложении из нескольких микрофронтов. Сегодня механизма нет: связка «id формы → модуль» — три строки руками в [App.tsx](projects/react-playground/src/App.tsx), билдер их только печатает сниппетом («Без автопатча»). Загрузки схем по сети нет ни одной — все пять примеров делают статический `import` JSON.

Целевое: микрофронт **регистрирует** формы, хост **разрешает**, какую показать в слоте / на маршруте / по id, с учётом прав и флагов. Схемы приходят из бандла и по сети. Реестр компонентов — общее ядро плюс расширения.

**Зафиксировано с заказчиком:** пакет `@reformer/form-registry`; деградация задаётся на каждую форму (дефолт строгий); валидация комбинированная (ajv до релиза в CI + в рантайме для сетевых схем); персистентный кэш со сменными стратегиями, основная OPFS, кэш выбрасываемый; платформа микрофронтов не выбрана.

---

## Что важно знать до начала

Семь фактов, установленных чтением кода. Каждый из них — источник ошибки, если про него не знать.

**1. Форма — это один файл данных из десяти.** Канонический пакет формы: `renderer.schema.json` — данные; `validation.ts`, `form.behavior.ts`, `renderer.behavior.ts`, `api.ts`, `registry.ts`, `data-sources.ts` (функции), `model.ts`, `types.ts`, `index.tsx` — код. Секции валидации в мета-схеме JSON-DSL нет: верхний уровень это только `$schema`, `id`, `version`, `meta`, `root`. **Форму нельзя доставить по сети целиком** — по сети идёт схема, обращающаяся к коду по имени (`$component`/`$dataSource`/`$fn`/`$locale`) и по `selector`.

**2. `withParent` теряет средний уровень.** [component-registry.ts:53-66](packages/reformer-renderer-json/src/registry/component-registry.ts#L53-L66): `copyEntries` для своего класса читает только `reg.own`, игнорируя `reg.parent`. Композиция `withParent(хост, withParent(ядро, расширения))` теряет ядро. Это блокер требования «ядро + расширения».

**3. Реестр берётся только из контекста.** [json-form-renderer.tsx:133-137](packages/reformer-renderer-json/src/components/json-form-renderer.tsx#L133-L137) — `form.registry` игнорируется. Контекст не пересекает границу бандла, и в проде отказ **молчаливый**: DEV-guard вырезается при сборке пакета (в `packages/*/dist` ноль вхождений `import.meta`).

**4. Валидация подключается мимо `createJsonForm`.** Три пути, все сходятся в `validateModel`: инъекция в визард через `onInit` → `patchProps({form, validateStep, validateAll})`; прямой вызов в submit-обработчике; живая стратегия `createFormValidation`. `ValidationSchema` обязана быть **стабильной ссылкой** — гашение и отмена прогонов ключатся по паре `(model, schema)` через `WeakMap`.

**5. Ошибки валидации тихо исчезают.** `validateModel` роутит через `getNodeForSignal(sig)?.setErrors(...)` — опциональная цепочка. Поле, отсутствующее в начальных значениях, не имеет сигнала → ни поведение, ни валидация не навесятся, и никто не скажет.

**6. Приоритет реестров — last-wins.** `get()` смотрит `own` → `parent`, `withParent` кладёт child в `own`. JSDoc [json-renderer-context.tsx:42](packages/reformer-renderer-json/src/context/json-renderer-context.tsx#L42) и `docs/llms/03-registry.md` утверждают обратное — документация врёт.

**7. Дубль рантайма ломает всё молча.** Две копии `@preact/signals-core` → восемь точек `instanceof Signal` дают `false`. Две копии `@reformer/core` → раздваиваются `WeakMap` в [derived-registry.ts:27](packages/reformer/src/state/derived-registry.ts#L27) (bulk-set **затирает вычисляемые поля**) и [signal-node-registry.ts:18](packages/reformer/src/form/signal-node-registry.ts#L18) (`enableWhen` — тихий no-op). Юнит-тесты не ловят: vitest резолвит один инстанс, ломается только собранный артефакт. Постмортем — [renderer-json/vite.config.ts:12-26](packages/reformer-renderer-json/vite.config.ts#L12-L26).

---

# Этап 0 — правки `@reformer/renderer-json`

Отдельный PR и отдельный релиз: микрофронтам нужна опубликованная версия. Всё аддитивно, ничего не ломает.

## З-0.1 Починить `withParent`

**Файл:** `packages/reformer-renderer-json/src/registry/component-registry.ts:48-68`

```ts
  static withParent(parent: ComponentRegistry, child: ComponentRegistry): ComponentRegistry {
    const merged = new ComponentRegistryImpl();
    // ВСЕГДА через публичные names()/get(): у своего impl они обходят и `own`, и parent-цепочку.
    // Раньше для ComponentRegistryImpl читался только `reg.own`, поэтому СОСТАВНОЙ child
    // терял свой parent: compose(хост, compose(ядро, расширения)) оставался без ядра.
    const copyEntries = (reg: ComponentRegistry): void => {
      for (const name of reg.names()) {
        const meta = reg.get(name);
        if (meta) merged.own.set(name, meta);
      }
    };
    // parent держим живой ссылкой (только для своего impl) — чтобы поздние правки были видны.
    if (parent instanceof ComponentRegistryImpl) merged.parent = parent;
    else copyEntries(parent);
    copyEntries(child); // child перекрывает parent (last-wins)
    return merged;
  }
```

**Проверка** — `packages/reformer-renderer-json/src/registry/component-registry.test.ts`:

```ts
describe('ComponentRegistryImpl.withParent — композиция', () => {
  it('сохраняет цепочку составного child (регрессия: терялся средний уровень)', () => {
    const core = defineRegistry((r) => r.component('Input', Noop));
    const mfe = defineRegistry((r) => r.component('DomainField', Noop));
    const inner = ComponentRegistryImpl.withParent(core, mfe); // ядро + расширения МФ
    const host = defineRegistry((r) => r.component('HostShell', Noop));
    const outer = ComponentRegistryImpl.withParent(host, inner); // хост + (ядро + МФ)

    expect(outer.has('Input')).toBe(true); // ← падало до правки
    expect(outer.has('DomainField')).toBe(true);
    expect(outer.has('HostShell')).toBe(true);
  });

  it('приоритет last-wins: child перекрывает parent', () => {
    const A = defineRegistry((r) => r.component('X', CompA));
    const B = defineRegistry((r) => r.component('X', CompB));
    expect(ComponentRegistryImpl.withParent(A, B).get('X')?.component).toBe(CompB);
  });
});
```

## З-0.2 Публичная `composeRegistries`

**Файл:** тот же, ниже класса.

```ts
/**
 * Композиция реестров слева направо: последний перекрывает предыдущие (last-wins, как Object.assign).
 * Программная альтернатива вложенным `JsonRendererProvider` — нужна там, где порядок владения
 * (форма > микрофронт > ядро) не совпадает с порядком React-дерева.
 *
 * @example
 * const registry = composeRegistries(coreRegistry, mfeRegistry, formRegistry);
 */
export function composeRegistries(...registries: readonly ComponentRegistry[]): ComponentRegistry {
  if (registries.length === 0) return new ComponentRegistryImpl();
  return registries.reduce((acc, next) => ComponentRegistryImpl.withParent(acc, next));
}
```

**Файл:** `packages/reformer-renderer-json/src/index.ts:68`

```ts
export { defineRegistry, composeRegistries } from './registry/component-registry';
```

## З-0.3 Проп `registry` у рендерера — две части

Одной правки мало: `useJsonRendererSettings` **бросает в DEV** при отсутствии реестра ([json-renderer-context.tsx:105-109](packages/reformer-renderer-json/src/context/json-renderer-context.tsx#L105-L109)). Если реестр придёт пропом, а провайдера нет, форма упадёт в разработке. Нужен неконтролирующий вариант хука.

**Файл 1:** `packages/reformer-renderer-json/src/context/json-renderer-context.tsx` — добавить рядом с `useJsonRendererSettings`:

```ts
/**
 * Настройки БЕЗ DEV-guard на наличие реестра. Для потребителей, которые передают
 * реестр пропом и вправе обходиться без провайдера (микрофронты: контекст не
 * пересекает границу бандла). Проверку делает вызывающий.
 */
export function useJsonRendererSettingsUnchecked(): JsonRendererSettings {
  return useContext(JsonRendererContext);
}
```

**Файл 2:** `packages/reformer-renderer-json/src/components/json-form-renderer.tsx` — в `JsonFormRendererProps<T>`:

```ts
  /**
   * Реестр компонентов. Приоритет: `registry` → `form.registry` → контекст.
   *
   * Нужен, когда провайдер и рендерер оказываются в РАЗНЫХ бандлах: React-контекст
   * границу бандла не пересекает, а в прод-сборке отказ молчаливый (DEV-guard вырезан).
   */
  registry?: ComponentRegistry;
```

и в теле компонента (`:125-137`):

```ts
export function JsonFormRenderer<T>({
  form,
  schema: schemaProp,
  model: modelProp,
  registry: registryProp,
  renderBehavior,
  onSchemaReady,
  validateSchema = false,
}: JsonFormRendererProps<T>): ReactNode {
  const { registry: contextRegistry, ...rendererSettings } = useJsonRendererSettingsUnchecked();

  const schema = form?.schema ?? schemaProp;
  const model = form?.model ?? modelProp;
  const registry = registryProp ?? form?.registry ?? contextRegistry;
```

Явная проверка на `:193-197` остаётся — она и становится единственным guard'ом, работающим в проде.

**Проверка:**

```ts
it('registry пропом работает БЕЗ провайдера', () => {
  const registry = defineRegistry((r) => { r.component('Input', Stub); r.component(FIELD_WRAPPER, Wrap); });
  const form = createJsonForm<M>({ schema, registry, initial: {} as M });
  // намеренно без <JsonRendererProvider>
  expect(() => render(<JsonFormRenderer form={form} registry={registry} />)).not.toThrow();
});

it('проп перекрывает контекст', () => { /* провайдер с реестром A, проп с реестром B → рендерится B */ });
```

## З-0.4 `collectOperatorNames`

**Файл:** новый `packages/reformer-renderer-json/src/collect-operator-names.ts` (перенос из [query.ts:124-149](projects/reformer-builder/src/model/query.ts#L124-L149), функция уже чистая и использует `parseOperator` этого пакета).

```ts
/**
 * Сбор имён операторов из ВСЕГО дерева схемы, включая componentProps и `item.$template`.
 * `$model` игнорируется: пути динамичны и сверяются отдельно, против модели.
 *
 * React-free и без ajv — вызывается в node, в тестах и в preflight до сборки формы.
 *
 * @module reformer/renderer-json/collect-operator-names
 */
import { parseOperator } from './operators';
import type { JsonFormSchema } from './types/json-schema';

export interface OperatorNames {
  components: string[];
  dataSources: string[];
  fns: string[];
  locales: string[];
}

export function collectOperatorNames(schema: JsonFormSchema): OperatorNames {
  const components = new Set<string>();
  const dataSources = new Set<string>();
  const fns = new Set<string>();
  const locales = new Set<string>();

  const scan = (v: unknown): void => {
    if (typeof v === 'string') {
      const p = parseOperator(v);
      if (!p) return;
      if (p.op === 'component') components.add(p.arg);
      else if (p.op === 'dataSource') dataSources.add(p.arg);
      else if (p.op === 'fn') fns.add(p.arg);
      else if (p.op === 'locale') locales.add(p.arg);
      return;
    }
    if (Array.isArray(v)) { v.forEach(scan); return; }
    if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) scan(val);
    }
  };

  scan(schema.root);
  return {
    components: [...components],
    dataSources: [...dataSources],
    fns: [...fns],
    locales: [...locales],
  };
}
```

**Экспорт** в `index.ts` рядом с реестром: `collectOperatorNames`, тип `OperatorNames`, плюс уже существующая `collectSchemaSelectors` из `./collect-schema-selectors`.

## З-0.5 `SchemaErrorBoundary` наружу с `fallback`

**Файл:** `packages/reformer-renderer-json/src/components/schema-error-boundary.tsx` — добавить в пропсы `fallback?: (error: Error) => ReactNode` и использовать его в `render()` вместо безусловной `SchemaErrorPanel`. Экспортировать из `index.ts`.

## З-0.6 Привести доки к коду

`json-renderer-context.tsx:42` и `docs/llms/03-registry.md:119` — «внешний имеет приоритет» → **«внутренний (последний) перекрывает внешний, как `Object.assign`»**. Код не меняем: last-wins — это то, что нужно расширениям.

**Проверка этапа 0:**

```bash
npm run test -w @reformer/renderer-json
npm run typecheck
npm run build -w @reformer/renderer-json && npm run check:exports-dist && npm run check:dist-deps
```

Плюс контроль дубля рантайма в собранном артефакте — тот класс, что юнит-тесты не видят:

```bash
node -e "
import('es-module-lexer').then(async ({init,parse}) => { await init;
  const fs = require('fs');
  const src = fs.readFileSync('packages/reformer-renderer-json/dist/index.js','utf8');
  const [imps] = parse(src);
  const ext = imps.map(i=>i.n).filter(n=>n && !n.startsWith('.'));
  console.assert(ext.includes('@reformer/core/signals'), 'signals должен быть ВНЕШНИМ');
  console.assert(!/Cycle detected/.test(src), 'рантайм signals вшит в бандл');
  console.log('ok:', ext.join(', '));
});"
```

---

# Этап 1 — пакет `@reformer/form-registry`, всё из бандла

## З-1.1 Скелет пакета

**Файл:** `packages/reformer-form-registry/package.json`

```jsonc
{
  "name": "@reformer/form-registry",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".":          { "types": "./dist/index.d.ts",    "import": "./dist/index.js" },
    "./react":    { "types": "./dist/react.d.ts",    "import": "./dist/react.js" },
    "./storage":  { "types": "./dist/storage.d.ts",  "import": "./dist/storage.js" },
    "./manifest": { "types": "./dist/manifest.d.ts", "import": "./dist/manifest.js" },
    "./guard":    { "types": "./dist/guard.d.ts",    "import": "./dist/guard.js" }
  },
  "peerDependencies": {
    "@reformer/core": ">=6.0.0",
    "@reformer/renderer-json": ">=6.1.0",
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": { "react": { "optional": true } }
}
```

`react` — опциональный peer: ядро, storage и guard React-free и работают в vanilla-микрофронте.

**Файл:** `packages/reformer-form-registry/vite.config.ts` — `external` **предикатом**, копия приёма из [renderer-json/vite.config.ts:27-32](packages/reformer-renderer-json/vite.config.ts#L27-L32):

```ts
const EXTERNAL: RegExp[] = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@reformer\//,
  /^@preact\/signals-core$/,
];
// ...
    lib: {
      entry: {
        index:    resolve(__dirname, 'src/index.ts'),
        react:    resolve(__dirname, 'src/react/index.ts'),
        storage:  resolve(__dirname, 'src/storage/index.ts'),
        manifest: resolve(__dirname, 'src/manifest/index.ts'),  // ajv — только здесь
        guard:    resolve(__dirname, 'src/guard/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: { external: (id) => EXTERNAL.some((re) => re.test(id)), output: { entryFileNames: '[name].js' } },
```

## З-1.2 Типы

**Файл:** `packages/reformer-form-registry/src/types.ts`

```ts
/** Данные: сериализуемо, может приехать по сети. */
export type DataSource<T> =
  | { kind: 'inline'; value: T }
  | { kind: 'module'; load: () => Promise<T> }
  | { kind: 'http'; url: string; init?: RequestInit };

/** Код: только из бандла. Варианта 'http' НЕТ — это было бы исполнение удалённого кода. */
export type CodeSource<T> =
  | { kind: 'inline'; value: T }
  | { kind: 'module'; load: () => Promise<T> };

/**
 * Валидация не входит в `createJsonForm` — подключается отдельно.
 * `schema` обязана быть СТАБИЛЬНОЙ ссылкой: гашение и отмена прогонов
 * ключатся по паре (model, schema) через WeakMap.
 */
export interface FormValidation<T> {
  schema?: ValidationSchema<T>;                        // весь набор — для submit / validateAll
  steps?: Record<string, ValidationSchema<T> | null>;  // ключ = selector узла Step; null = шаг без правил ЯВНО
  strategy?: ValidationStrategyKind;                   // 'submit' | 'blur' | 'change' | 'afterFirstSubmit'
  debounce?: number;
}

export interface FormEntry<T extends object = Record<string, unknown>> {
  id: string;
  version: string;
  owner: string;                     // какой микрофронт зарегистрировал — для диагностики коллизий

  schema: DataSource<JsonFormSchema<T>>;   // единственная часть, которую можно тянуть по сети
  compatibleSchema?: string;               // semver-range версий схемы, с которыми совместим ЭТОТ код

  initial?: DataSource<T>;
  model?: CodeSource<() => FormModel<T>>;

  registry?: CodeSource<ComponentRegistry>;
  behavior?: CodeSource<FormBehavior<T>>;
  validation?: CodeSource<FormValidation<T>>;
  renderBehavior?: CodeSource<
    (form: FormProxy<T>, model: FormModel<T>, v?: FormValidation<T>) => RenderBehaviorFn<T>
  >;

  placement?: { slots?: readonly string[]; routes?: readonly string[]; priority?: number };
  access?: {
    permissions?: readonly string[];
    flags?: readonly string[];
    canRender?: (ctx: ResolveContext) => boolean;
  };

  degrade?: 'error' | 'placeholder';   // дефолт реестра — 'error'
  meta?: { name?: string; description?: string; tags?: readonly string[] };
}

export interface ResolveContext {
  permissions: ReadonlySet<string>;
  flags: ReadonlySet<string>;
  route?: { path: string; params: Readonly<Record<string, string>> };
  locale?: string;
}

export type FormQuery =
  | { by: 'id'; id: string; version?: string }
  | { by: 'slot'; slot: string }
  | { by: 'route'; path: string }
  | { by: 'tag'; tag: string };
```

## З-1.3 Разрешение — четыре способа, один слой

**Файл:** `packages/reformer-form-registry/src/resolve.ts`

```ts
/**
 * Единственная точка разрешения. Чистая, синхронная, без сети.
 *
 * Три способа адресации (id/slot/route) — это разные ФОРМЫ ЗАПРОСА, а права и флаги —
 * ФИЛЬТР, общий для всех. Отсюда инвариант: право нельзя обойти, войдя через другую дверь.
 * Если бы гейт жил в компоненте слота, императивный API его бы миновал.
 */
export function resolveForms(
  store: readonly FormEntry[],
  query: FormQuery,
  ctx: ResolveContext
): FormEntry[] {
  return store
    .filter((e) => matchesQuery(e, query))
    .filter((e) => passesGate(e, ctx))
    .sort(byPriorityThenVersionDesc);
}

function passesGate(e: FormEntry, ctx: ResolveContext): boolean {
  const a = e.access;
  if (!a) return true;
  if (a.permissions?.some((p) => !ctx.permissions.has(p))) return false;
  if (a.flags?.some((f) => !ctx.flags.has(f))) return false;
  return a.canRender ? a.canRender(ctx) : true;
}
```

Матчер маршрутов компилируется в `RegExp` **при регистрации**, не на каждый резолв. Роутер реестру неизвестен — `ctx.route` подаёт хост.

**Проверка:**

```ts
describe('resolveForms', () => {
  const ctx = (perms: string[] = [], flags: string[] = []): ResolveContext =>
    ({ permissions: new Set(perms), flags: new Set(flags) });

  it.each([
    [{ by: 'id', id: 'a' } as const],
    [{ by: 'slot', slot: 's' } as const],
    [{ by: 'route', path: '/x' } as const],
  ])('гейт работает одинаково для %o', (query) => {
    const store = [entry({ id: 'a', access: { permissions: ['admin'] },
                           placement: { slots: ['s'], routes: ['/x'] } })];
    expect(resolveForms(store, query, ctx([]))).toEqual([]);            // нет права → пусто
    expect(resolveForms(store, query, ctx(['admin']))).toHaveLength(1); // есть право → видно
  });

  it('canRender вызывается последним и только если прошли permissions/flags', () => { /* … */ });
  it('сортировка: priority убыв., затем version убыв.', () => { /* … */ });
});
```

## З-1.4 Реестр и его пиннинг

**Файл:** `packages/reformer-form-registry/src/registry.ts`

```ts
export interface FormRegistry {
  /** @returns unregister — ОБЯЗАТЕЛЕН для single-spa: unmount снимает записи микрофронта. */
  register(entry: FormEntry, opts?: { onConflict?: 'throw' | 'replace' | 'keep' }): () => void;
  registerAll(entries: readonly FormEntry[]): () => void;
  list(): readonly FormEntry[];
  resolve(query: FormQuery, ctx: ResolveContext): FormEntry[];
  preload(key: FormKey, signal?: AbortSignal): Promise<LoadedForm>;
  create<T extends object>(key: FormKey, init: { initial?: T; model?: FormModel<T> }): Promise<JsonForm<T>>;
  subscribe(listener: () => void): () => void;   // для useSyncExternalStore
  readonly diagnostics: readonly Diagnostic[];
}
```

Конфликт `id` между микрофронтами — по `owner` + `onConflict` (дефолт `'throw'`, сообщение называет обоих владельцев).

## З-1.5 React-слой

Разделение на два компонента **обязательное**: `useJsonForm` — ленивый `useState` ([create-json-form.ts:96-99](packages/reformer-renderer-json/src/create-json-form.ts#L96-L99)), фабрика зовётся ровно один раз, поэтому форму нельзя строить, пока не приехали асинхронные части.

**Файл:** `packages/reformer-form-registry/src/react/mounted-form.tsx`

```tsx
/** Синхронный: всё уже загружено и проверено preflight'ом. */
function MountedForm<T extends object>({ entry, loaded, initial, model, onReady }: Props<T>) {
  const jsonForm = useJsonForm(() =>
    createJsonForm<T>({
      schema: loaded.schema,
      registry: loaded.registry,          // уже composed (+ плейсхолдеры при degrade:'placeholder')
      ...(model ? { model } : { initial: (initial ?? loaded.initial) as T }),
      behavior: loaded.behavior,
    })
  );

  // renderBehavior обязан быть стабильным — иначе warn json-form-renderer.tsx:169-178.
  // Валидация уходит сюда: createJsonForm её не принимает, связывание происходит в renderBehavior.
  const renderBehavior = useMemo(
    () => loaded.makeRenderBehavior?.(jsonForm.form, jsonForm.model, loaded.validation),
    [jsonForm]
  );

  useEffect(() => { onReady?.(jsonForm); }, [jsonForm]);

  return (
    <SchemaErrorBoundary fallback={(e) => <FormRuntimeErrorPanel error={e} entry={entry} />}>
      <JsonFormRenderer<T>
        form={jsonForm}
        registry={loaded.registry}   {/* З-0.3: НЕ полагаемся на контекст */}
        renderBehavior={renderBehavior}
        validateSchema={false}       {/* ajv — ответственность загрузчика, не рендерера */}
      />
    </SchemaErrorBoundary>
  );
}
```

**Файл:** `packages/reformer-form-registry/src/react/form-outlet.tsx`

```tsx
export function FormOutlet<T extends object>(props: FormOutletProps<T>): ReactNode {
  const { store, ctx, baseRegistry, options, cache } = useFormRegistryContext();
  const entry = useMemo(
    () => resolveForms(store, { by: 'id', id: props.id, version: props.version }, ctx)[0],
    [store, props.id, props.version, ctx]
  );
  if (!entry) return null;                     // нет записи или нет прав — молча ничего

  const res = useFormResource(entry, cache, baseRegistry, options);
  if (res.status === 'pending') return props.fallback ?? null;
  if (res.status === 'error')
    return props.errorFallback?.(res.error, res.retry) ?? <FormLoadErrorPanel error={res.error} onRetry={res.retry} />;

  // key — ПОЛНОЕ пересоздание при смене записи/версии: без него ленивый useState
  // вернёт старую модель со старой схемой.
  return <MountedForm key={cacheKeyOf(entry)} entry={entry} loaded={res.data} {...props} />;
}
```

`FormSlot` и `FormRoute` — тонкие обёртки: `resolveForms` с соответствующим `query`, затем `FormOutlet` на каждую запись.

## З-1.6 Пилот

Перевести `projects/react-playground` на реестр: пять примеров становятся пятью `FormEntry` вместо ручных строк в `App.tsx`. Первая окупаемость и живой тест.

**Проверка этапа 1:** `npm run dev`, пройти все пять примеров. E2E из `projects/react-playground-e2e` должны остаться зелёными **без правок** — DOM не меняется.

---

# Этап 2 — сеть, кэш, preflight

Схемы объёмные: `complex-multy-step-form` **68 КБ**, `mcp-credit-application` **45 КБ**, `component-catalog.json` **128 КБ**. In-memory кэша мало — он живёт до первого F5.

## З-2.1 Хранилище: интерфейс и фабрики

**Файл:** `packages/reformer-form-registry/src/storage/types.ts` — **ноль зависимостей от форм**, чтобы позже переехать в отдельный пакет без переписывания.

Оформляется в **идиоме проекта**, а не классами: классических Strategy-классов в репозитории нет ни одного. Образец — `LocaleService` ([locale-service.ts:36-106](packages/reformer-renderer-json/src/locale/locale-service.ts#L36)): интерфейс с обязательным минимумом плюс опциональные методы, фабрики `createXxx()`, экспортируемый `defaultXxx`.

```ts
export interface StoredRecord {
  key: string;
  body: string;        // сериализованное тело
  etag?: string;       // для условной ревалидации
  size: number;
  storedAt: number;
  lastUsedAt: number;  // для LRU
}

export interface StorageStrategy {
  readonly name: string;
  get(key: string): Promise<StoredRecord | undefined>;
  set(rec: StoredRecord): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  estimate?(): Promise<{ usage: number; quota: number }>;   // опционален — как render?/keys? у LocaleService
}

export function createOpfsStorage(opts?: OpfsOptions): StorageStrategy;
export function createIndexedDbStorage(opts?: IdbOptions): StorageStrategy;
export function createMemoryStorage(): StorageStrategy;
export const defaultStorage: StorageStrategy;   // memory — доступна всегда

/** Первая доступная по порядку. Порядок — НАСТРОЙКА, а не архитектурное решение. */
export function pickStorage(order?: readonly StorageKind[]): Promise<StorageStrategy>;
```

Дефолт: `['opfs', 'indexeddb', 'memory']`.

Заложено в реализацию OPFS:

- **Синхронные хэндлы только в Worker** — `createSyncAccessHandle()` недоступен на главном потоке, там `createWritable()`, поддержка которого в Safari появилась позже самого OPFS. Фича-детект обязателен.
- **Хранилище общее на origin** — ключ `${CACHE_FORMAT}/${owner}/${id}@${version}`. Без `owner` два микрофронта с одинаковым `id` затрут друг друга.
- **Атомарная запись** — временный файл плюс переименование либо `navigator.locks`: две вкладки, пишущие один файл, дают битую запись.
- **Кэш выбрасываемый** — `persist()` не запрашиваем, флаг под будущий офлайн в `OpfsOptions` выключен.
- **LRU по `lastUsedAt`**, потолок 32 МБ, перед записью сверка с `estimate()`.

**Существующий IndexedDB за образец не берём.** [handle-store.ts](projects/reformer-builder/src/io/handle-store.ts) открывает соединение на каждую операцию и не закрывает, резолвит промис по `request.onsuccess`, а не по `transaction.oncomplete` (для `readwrite` это резолв до коммита), не обрабатывает `onabort` и quota. В новой реализации: одно кэшированное соединение, резолв по `oncomplete`, отдельная ветка на `QuotaExceededError` → вытеснение и повтор.

## З-2.2 Два уровня кэша

L1 в памяти — разобранные объекты и промисы in-flight (там же дедупликация). L2 — сериализованные тела через `StorageStrategy`. Чтение L1 → L2 → сеть; запись сеть → L2 и L1. Ревалидация по `etag` / `If-None-Match`.

**Stale-while-revalidate не пишем — он уже есть.** `asyncResourceReducer` в CDK: `load-start` при наличии данных оставляет `ready` и поднимает `refreshing`, `load-error` **сохраняет** прежние данные ([async-resource.ts:77-88](packages/reformer-cdk/src/components/async-boundary/async-resource.ts#L77-L88)). Кэш встраивается внутрь `load`.

**Ловушка отмены:** `AbortSignal` нельзя пробрасывать в дедуплицированный запрос — если два `FormOutlet` ждут одну схему и один размонтировался, отменять нельзя. Отмена только по refcount.

## З-2.3 Загрузка по сети

Ретраить 5xx/408/429 с джиттером; **4xx не ретраить**. Проверять `content-type` — приём из работающего кода [config/load.ts:77-78](projects/reformer-builder/src/config/load.ts#L77-L78) (SPA-fallback отдаёт `index.html` вместо JSON). Политика ошибок оттуда же: нет данных → дефолты, есть но невалидно → `throw` (fail visible).

## З-2.4 Preflight — пять проверок до сборки формы

**Файл:** `packages/reformer-form-registry/src/preflight.ts`

`convertJsonToM1Tree` синхронный и бросает при незарегистрированном компоненте — для сетевой схемы это вероятнейший отказ.

| проверка | что ловит | есть ли сегодня |
|---|---|---|
| `compatibleSchema` ↔ `schema.version` | схема ушла вперёд кода: CDN отдал v2, микрофронт с поведением v1 не выкачен | **нет**, `version` объявлен и нигде не читается |
| `entry.id`/`version` ↔ `schema.id`/`version` | CDN отдал не ту схему — форма молча пишет чужие поля в модель | нет |
| имена `$component`/`$dataSource`/`$fn`/`$locale` ⊆ реестр | ссылка на незарегистрированный компонент | есть, но только ajv-путём |
| ключи `validation.steps` ⊆ selector'ы узлов `Step` | пошаговая валидация молча не срабатывает на переименованном шаге | **нет нигде**, договорённость в JSDoc |
| пути `$model(...)` ⊆ начальные значения | поле не материализовано → нет сигнала → **ошибки валидации тихо исчезают** | только `console.warn` в конвертере |

```ts
export function preflight<T extends object>(
  entry: FormEntry<T>,
  schema: JsonFormSchema<T>,
  registry: ComponentRegistry,
  initial: unknown,
  validation?: FormValidation<T>
): PreflightResult {
  const used = collectOperatorNames(schema);              // З-0.4
  const selectors = collectSchemaSelectors(schema);       // З-0.4 (экспорт)
  return {
    versionDrift:      checkVersions(entry, schema),      // compatibleSchema + id/version
    missingComponents: used.components.filter((n) => !registry.has(n)),
    missingDataSources: used.dataSources.filter((n) => getDataSourceNames(registry).indexOf(n) < 0),
    missingFns:        used.fns.filter((n) => getFnNames(registry).indexOf(n) < 0),
    unknownStepKeys:   Object.keys(validation?.steps ?? {}).filter((s) => !selectors.has(s)),
    unmaterializedPaths: collectModelPaths(schema).filter((p) => !hasPath(initial, p)),
  };
}
```

Ближайший существующий аналог — [validate-exportable.ts:28-45](projects/reformer-builder/src/codegen/validate-exportable.ts#L28-L45), но он живёт в билдере и сверяется с моком.

**Деградация по формам** (`entry.degrade`, дефолт `'error'`): `'error'` — панель вместо формы; `'placeholder'` — нейтральный стаб на месте узла плюс обязательный `onDiagnostic`. Реюз идеи [unknown-component.tsx:37-52](projects/reformer-builder/src/preview-runtime/unknown-component.tsx#L37-L52).

## З-2.5 Валидация схем — комбинированная

- **До релиза** — все `inline`/`module` схемы прогоняются полным ajv в тесте (этап 4), рантайм-стоимость нулевая.
- **В релизе** — сетевые схемы валидируются при загрузке через subpath `./manifest`. Там же **кэш скомпилированного валидатора**: сейчас `validateFormSchema` создаёт `new Ajv()` и компилирует мета-схему на каждый вызов ([validate.ts:334-338](packages/reformer-renderer-json/src/validate.ts#L334-L338)) — при слоте с пятью формами это пять компиляций.

**Проверка этапа 2.** Контракт хранилища — один набор против **всех** стратегий, это и проверка, и гарантия взаимозаменяемости:

```ts
describe.each([
  ['memory', createMemoryStorage],
  ['indexeddb', createIndexedDbStorage],
  ['opfs', createOpfsStorage],
])('StorageStrategy: %s', (name, make) => {
  it('круг записал → прочитал → удалил', async () => { /* … */ });
  it('68 КБ схемы без потерь', async () => { /* реальный complex-multy-step-form */ });
  it('LRU вытесняет по lastUsedAt при достижении потолка', async () => { /* … */ });
  it('QuotaExceededError → вытеснение и успешный повтор, не проброс', async () => { /* … */ });
  it('ключи двух owner с одинаковым id формы не пересекаются', async () => { /* … */ });
});

it('ИНВАРИАНТ: кэш выбрасываемый', async () => {
  await storage.clear();                       // посреди сессии
  await expect(registry.preload(key)).resolves.toBeDefined();   // ушли в сеть, выжили
});
```

Загрузчики: дедуп (два `load()` одного ключа при in-flight → **один** вызов loader'а); 500 → ретрай, 404 → без ретрая; `content-type: text/html` → `not-json`; JSON без `root` → `not-a-form-schema`.

Preflight, негативные случаи: версия вне `compatibleSchema` → отказ; переименованный selector шага → отказ; `validate(model.$.x)` на поле, которого нет в начальных значениях → **отказ, а не тихий no-op**.

E2E: удалённая схема отдаёт 500 → панель с retry, не белый экран; после retry форма появляется.

**Бенчмарк** (замер, не тест; результат в README пакета): чтение и запись 68 КБ в OPFS против IndexedDB с учётом `JSON.parse` на стороне OPFS. По результату фиксируется порядок в `pickStorage` — меняется одна строка.

---

# Этап 3 — размещение и доступ

`placement.slots` / `placement.routes`, `access`, `FormSlot`, `FormRoute`, `ResolveContext` из хоста. `resolveForms` написан на этапе 1 — здесь только матчеры маршрутов и гейт.

**Проверка:** E2E — слот без права даёт в DOM пусто (а не пустую рамку формы); переход по маршруту монтирует форму из `placement.routes`.

---

# Этап 4 — guard и проверки артефакта

Репозиторий знает про двойной рантайм — комментарии в [renderer-json/vite.config.ts:12-26](packages/reformer-renderer-json/vite.config.ts#L12-L26) и [cdk/vite.config.ts:32-36](packages/reformer-cdk/vite.config.ts#L32-L36) это постмортемы. Но защиты работают на уровне «одна сборка»: grep по `globalThis|window.__|Symbol.for` в `packages/*/src` даёт **ноль** совпадений.

**Файл:** `packages/reformer-form-registry/src/guard/realm.ts` — ноль зависимостей.

```ts
// Symbol.for живёт в cross-realm registry — единственный ключ, совпадающий
// у двух независимо загруженных копий модуля в одном realm.
const KEY = Symbol.for('reformer.runtime.v1');

interface RealmSlot {
  formRegistry?: unknown;
  runtimes: Map<string, Set<unknown>>;   // pkg → набор наблюдённых копий
  diagnostics: Diagnostic[];
  strict: boolean;
}

export function realm(): RealmSlot {
  const g = globalThis as Record<symbol, unknown>;
  return (g[KEY] ??= { runtimes: new Map(), diagnostics: [], strict: false }) as RealmSlot;
}
```

Проверяем **идентичность объектов, а не версии**: две копии одинаковой версии ломают всё так же. Три штампа — конструктор `Signal`, токен модульного скоупа core, `React.createContext`. Для второго нужна единственная правка в ядре: `packages/reformer/src/runtime-token.ts` с `export const CORE_RUNTIME_TOKEN: object = Object.freeze({ v: 1 })`.

Поведение: **никакого `import.meta.env.DEV`** (вырезается при сборке) и **никакого `process.env.NODE_ENV`** (в `packages/reformer/dist` шесть вхождений → `ReferenceError: process is not defined` в голом ESM и web-components). Строгость — рантайм-флагом от хоста. Дефолт `'report'`: `console.error` с конкретным диагнозом плюс `onDiagnostic`; `throw` только при `strict: true`.

**Тест дубля — единственный, который воспроизводит риск.** Vitest по умолчанию резолвит один инстанс, дубль моделируется явно:

```ts
// vitest.config: resolve.alias { '@core-copy': fixtures/core-copy/index.js }
it('две копии core → guard рапортует duplicate', async () => {
  await import('@reformer/core');
  await import('@core-copy');            // физическая вторая копия собранного dist
  expect(checkRuntime().duplicates.map((d) => d.pkg)).toContain('@reformer/core');
});
it('strict: true → бросает; strict: false → только диагностика', () => { /* … */ });
```

Фикстура — копия `packages/reformer/dist`, генерируемая pretest-шагом, не коммитится. Без этого теста guard — недоказанный код.

**Проверки собранного артефакта:**

```bash
npm run check:dist-deps          # подхватит новый пакет автоматически
npm run check:exports-dist       # сверит 5 subpath с lib.entry
node scripts/check-no-node-globals.mjs   # НОВЫЙ: ноль process.* в dist пакета
node scripts/check-ajv-isolation.mjs     # НОВЫЙ: ajv только в dist/manifest.js
npm run size                     # index 4 kB, react 4 kB, storage 3 kB, guard 1 kB
```

`check-ajv-isolation.mjs` закрывает инвариант, который сейчас держит **один комментарий и ничего больше**.

---

# Этап 5 — интеграция с билдером

`projects/reformer-builder/src/codegen/` эмитит `entry.ts` с готовым `FormEntry` вместо копипаст-сниппета; [app-snippet.ts](projects/reformer-builder/src/codegen/app-snippet.ts) заменяется на `emit-entry.ts`. Связка «id формы → модуль» перестаёт быть ручной — исходная дыра закрывается здесь.

Билдер уже провёл границу `derived` / `user` ([codegen/index.ts:49-59](projects/reformer-builder/src/codegen/index.ts#L49-L59)) — машина владеет / человек владеет. Реестру стоит её унаследовать: `entry.ts` — `derived`.

---

## Что переиспользуется

| откуда | что |
|---|---|
| [component-registry.ts](packages/reformer-renderer-json/src/registry/component-registry.ts) | `defineRegistry`, `withParent` (после З-0.1/0.2) |
| [schema/index.ts:50,66,78](packages/reformer-renderer-json/src/schema/index.ts#L50) | `getComponentNames` / `getDataSourceNames` / `getFnNames` |
| [query.ts:124-149](projects/reformer-builder/src/model/query.ts#L124-L149) | `collectOperatorNames` — перенос в пакет |
| [preview-runtime/unknown.ts:13-15](projects/reformer-builder/src/preview-runtime/unknown.ts#L13-L15) | идея preflight |
| [unknown-component.tsx:37-52](projects/reformer-builder/src/preview-runtime/unknown-component.tsx#L37-L52) | плейсхолдеры деградации |
| [registry-drift.test.ts:18-40](projects/reformer-builder/src/preview-runtime/registry-drift.test.ts#L18-L40) | шаблон drift-теста |
| [normalize.ts:33-50](projects/reformer-builder/src/model/normalize.ts#L33-L50), [discovery.ts:39-46](projects/reformer-builder/src/io/discovery.ts#L39-L46) | структурные guard'ы схемы |
| [config/load.ts:68-108](projects/reformer-builder/src/config/load.ts#L68-L108) | fetch → валидация → state, `content-type`, политика ошибок |
| [async-resource.ts:77-98](packages/reformer-cdk/src/components/async-boundary/async-resource.ts#L77-L98) | stale-while-revalidate |
| [useAsyncResource.ts:138-155](packages/reformer-cdk/src/components/async-boundary/useAsyncResource.ts#L138-L155) | двойная защита от гонки |
| [locale-service.ts:36-106](packages/reformer-renderer-json/src/locale/locale-service.ts#L36) | идиома «интерфейс + фабрики + default» |
| [renderer-json/vite.config.ts:12-32](packages/reformer-renderer-json/vite.config.ts#L12-L32) | `EXTERNAL`-предикат, изоляция ajv |
