# DI сервисов через реестр renderer-json + PoC на кредитной форме

## Context

Сгенерированная форма сегодня **замокана, но моки не подменяются**. В
[mcp-credit-application-renderer-json-v20](../../projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v20/)
загрузчики и submit прибиты жёсткими импортами:

- `form.behavior.ts` → `import { loadCities, loadCarModels } from './data-sources'`
- `renderer.behavior.ts` → `import { submitCreditApplication } from './api'`

Чтобы подключить форму к реальному бэкенду, потребитель обязан править код формы. Плюс режим отказа
сейчас — параметр `simulateError` в сигнатуре каждой функции, то есть свойство вызова, а не реализации.

Цель: форма остаётся **полностью рабочей из коробки на моке**, а приложение-консумент подменяет
реализацию снаружи — без правки файлов формы. Внедрение идёт **через реестр `@reformer/renderer-json`**
(`reg.service` / `getService`), по образцу существующей пары `reg.locale` + `getLocale()` + `LOCALE_SERVICE`.

Объём — proof-of-concept на одном таргете (**renderer-json**). MCP-промпты, builder codegen, таргеты
core/renderer-react — вне объёма.

## Зафиксированные решения

1. DI живёт в реестре renderer-json: `reg.service(token, impl)` / `registry.getService(token)`.
2. PoC — только renderer-json.
3. Мок по умолчанию; провайдер подменяет.
4. Вариативность мока — все четыре: две реализации (TS-мок и HTTP поверх MSW), настраиваемое поведение
   (`latencyMs` / `failures` / `fixtures`), частичная подмена методов, переключатель в UI примера.

## Архитектура: три уровня разрешения сервиса

```
проп services (тесты / явная передача)
  → сервис из ВНЕШНЕГО JsonRendererProvider (registry.getService(token))
    → встроенный мок (форма работает без обвязки)
```

**Почему не merge реестров.** Наивная схема «форма регистрирует мок в свой реестр, приложение
перекрывает снаружи» не работает по двум независимым причинам:

1. [`component-registry.ts:66`](../../packages/reformer-renderer-json/src/registry/component-registry.ts#L66)
   — в `withParent` `copyEntries(child)` идёт последним, а `JsonRendererProvider` вызывает
   `withParent(parentSettings.registry, settings.registry)`. Значит **ближайший провайдер выигрывает**,
   и мок формы перекрыл бы реальный сервис приложения.
2. `createJsonForm` выполняет `behavior` в момент сборки — **до** монтирования любого провайдера.
   Никакой merge на уровне провайдера сюда не успевает.

Работает вместо этого обычный `??`-fallback в теле компонента: собственный `JsonRendererProvider`
формы рендерится в её JSX и на `useContext` в её же теле не влияет — читается внешний контекст.

Отдельно: [`03-registry.md:119`](../../packages/reformer-renderer-json/docs/llms/03-registry.md) утверждает
«внешний > внутренний» — это **противоречит коду**. Правим доку (код — источник истины: приоритет
ближайшего нужен для локальной подмены компонентов).

**Живое переключение** обеспечивает стабильный прокси поверх mutable-ref: `useJsonForm` выполняет
фабрику ровно один раз, поэтому переключатель меняет только внутренний `current`, а идентичности
сервиса / реестра / `renderBehavior` не меняются → форма не пересобирается, введённые данные целы.

## Изменения в `@reformer/renderer-json`

### Новые файлы

**`src/registry/service-token.ts`**

```ts
declare const SERVICE_TYPE: unique symbol;

/** Токен сервиса: строка-ключ реестра, несущая фантомный тип реализации. */
export type ServiceToken<T> = string & { readonly [SERVICE_TYPE]?: T };

export function createServiceToken<T>(name: string): ServiceToken<T> {
  return `${SERVICE_KEY_PREFIX}${name}` as ServiceToken<T>;
}

/** Частичная подмена: заданные методы из overrides, остальные делегируются base. */
export function withServiceOverrides<T extends object>(base: T, overrides: Partial<T>): T {
  return new Proxy(base, {
    get(target, prop) {
      const patched = (overrides as Record<PropertyKey, unknown>)[prop as string];
      if (patched !== undefined) return patched;
      const value = Reflect.get(target, prop, target); // receiver = target → `this` сохраняется
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as T;
}
```

Токен типизирован, чтобы `getService(CREDIT_API)` выводил тип без ручного generic.
`withServiceOverrides` — через `Proxy` + `bind`, а не spread: spread теряет методы прототипа и `this`
у class-based сервисов.

### Правки существующих файлов

| Файл | Изменение |
|---|---|
| [`src/registry/constants.ts`](../../packages/reformer-renderer-json/src/registry/constants.ts) | `export const SERVICE_KEY_PREFIX = '$service:'` + JSDoc по образцу `LOCALE_SERVICE` |
| [`src/registry/types.ts`](../../packages/reformer-renderer-json/src/registry/types.ts) | `'service'` в union `ComponentMetadata['type']`; `getService?<T>(token)` в `ComponentRegistry`; `service<T>(token, impl, description?)` в `RegistryBuilder` |
| [`src/registry/component-registry.ts`](../../packages/reformer-renderer-json/src/registry/component-registry.ts) | метод `getService` в `ComponentRegistryImpl` + ветка `service` в builder `defineRegistry`. **`withParent` не трогаем** |
| [`src/context/json-renderer-context.tsx`](../../packages/reformer-renderer-json/src/context/json-renderer-context.tsx) | новый хук `useJsonRendererService` |
| [`src/index.ts`](../../packages/reformer-renderer-json/src/index.ts) | экспорт `createServiceToken`, `withServiceOverrides`, `SERVICE_KEY_PREFIX`, `useJsonRendererService`, тип `ServiceToken` |

`package.json` / `vite.config.ts` — без изменений (новых subpath-экспортов нет).

```ts
// component-registry.ts
getService<T>(token: ServiceToken<T>): T | undefined {
  const meta = this.get(token);
  if (!meta || meta.type !== 'service') return undefined;
  return meta.component as T;
}

// в defineRegistry:
service(token, impl, description?) {
  if (!token.startsWith(SERVICE_KEY_PREFIX)) {
    throw new Error(
      `reg.service("${token}") expects a token from createServiceToken(...). ` +
        `Raw strings are rejected so services can't collide with $component/$dataSource names.`
    );
  }
  registry._set(token, { component: impl, type: 'service', description });
}
```

```tsx
// json-renderer-context.tsx — читает контекст НАПРЯМУЮ, без DEV-throw из useJsonRendererSettings
export function useJsonRendererService<T>(token: ServiceToken<T>): T | undefined {
  const settings = useContext(JsonRendererContext);
  return settings.registry?.getService?.(token);
}
```

Обоснование деталей:

- **Отдельный `type: 'service'`** — `resolveComponent`/`resolveDataSource`/`resolveFn` уже бросают на
  несовпадение типа, а `getComponentNames`/`getDataSourceNames`/`getFnNames` фильтруют по нему → сервисы
  автоматически невидимы для `validateFormSchema`.
- **Префикс `$service:`** — калька с `LOCALE_SERVICE`; плюс `OPERATOR_RE` в `operators.ts` — закрытый
  whitelist без `service`, т.е. из схемы сервис недостижим by design.
- **`getService` опционален** — `ComponentRegistry` публичный интерфейс, `withParent` уже имеет ветку для
  чужих реализаций без `own`; обязательный метод был бы breaking. Тот же аргумент, что у `getLocale?`.
- **Нужен новый хук**, потому что `useJsonRendererSettings` в DEV бросает при отсутствии `registry`, а
  «форма без обвязки» — ровно этот случай. Сам `JsonRendererContext` наружу не экспортируем.

## PoC-пример

Новый каталог `projects/react-playground/src/pages/examples/credit-application-di-renderer-json/` —
**полная копия v20** (включая `renderer.schema.json`, 45 КБ) с наложенными изменениями.

v20 не трогаем: это артефакт iter-цикла MCP-регрессии, по нему работают динамические проекты
`iter-*` в [playwright.config.ts](../../projects/react-playground-e2e/playwright.config.ts). Копия, а не
импорт из v20: iter-примеры удаляются между итерациями (v2–v18 уже удалены), поэтому перекрёстные
импорты — заведомо хрупкая связь; генератор к тому же выдаёт самодостаточный каталог.

### Новые файлы примера

| Файл | Назначение |
|---|---|
| `services/credit-api.ts` | `CreditApiService`, `ApiResult`, `CreditApiMethod`, токен `CREDIT_API` |
| `services/mock-credit-api.ts` | `createMockCreditService(options)` + дефолтные фикстуры (`CITY_DB`/`CAR_MODEL_DB`) + `delay(ms, signal)` |
| `services/http-credit-api.ts` | `createHttpCreditService({ baseUrl })` поверх MSW-эндпоинтов |
| `services/switchable.ts` | `createSwitchableCreditService(initial)` — стабильный прокси |
| `CreditFormWithDi.tsx` | «сгенерированная форма»: проп → контекст → мок |
| `DiPanel.tsx` | панель переключения реализации |

### Изменённые (относительно копии v20)

- `form.behavior.ts` — вместо `export const creditBehavior` фабрика `createCreditBehavior(api)`;
  три `onChange` зовут `api.loadCities` / `api.loadCarModels` вместо импортов.
- `renderer.behavior.ts` — `createJsonRenderBehavior(form, model, { mode, api, onResult })`;
  `simulateError` из опций **удаляется** (режим отказа переехал в конфиг мока), submit зовёт
  `api.submitApplication`.
- `index.tsx` — становится shell'ом консумента (панель + внешний провайдер), сама форма переезжает в
  `CreditFormWithDi.tsx`.
- `data-sources.ts` — статические словари остаются (см. «Вне объёма»); `CITY_DB`/`CAR_MODEL_DB` и
  `loadCities`/`loadCarModels` переезжают в `services/mock-credit-api.ts` как дефолтные фикстуры.
- `api.ts` — удаляется, его содержимое разошлось по `services/*`.

### Контракт сервиса

```ts
export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

export interface CreditApiService {
  loadCities(region: string, signal?: AbortSignal): Promise<SelectOption[]>;
  loadCarModels(brand: string, signal?: AbortSignal): Promise<SelectOption[]>;
  submitApplication(
    values: CreditApplicationForm,
    signal?: AbortSignal
  ): Promise<ApiResult<{ id: string; message: string }>>;
}

export type CreditApiMethod = keyof CreditApiService;
export const CREDIT_API = createServiceToken<CreditApiService>('creditApi');
```

Три метода — ровно те, что реально вызываются в v20 (`loadApplication`/`loadDictionaries` не зовёт никто).
Асимметрия возврата сохраняется как в v20: загрузчики опций **бросают** (behavior уже обёрнут в `try/catch`
ради `AbortError`), submit возвращает `ApiResult`.

### Настраиваемый мок

```ts
export interface MockCreditServiceOptions {
  /** Одно число на всё либо per-method. Дефолт: 300 загрузчикам, 2000 submit'у. */
  latencyMs?: number | Partial<Record<CreditApiMethod, number>>;
  /** Массив — с дефолтным текстом; запись — со своим. */
  failures?: CreditApiMethod[] | Partial<Record<CreditApiMethod, string | true>>;
  fixtures?: Partial<CreditFixtures>;
}

export function createMockCreditService(options?: MockCreditServiceOptions): CreditApiService;
```

«Падает только submit» → `createMockCreditService({ failures: ['submitApplication'] })`. Это заменяет
параметры `simulateError` в `api.ts` и поле `RenderBehaviorOptions.simulateError`: режим отказа стал
свойством реализации, поэтому HTTP-версия не обязана его поддерживать.

### HTTP-реализация

Эндпоинты уже есть в [msw-handlers](../../projects/react-playground/src/mocks/_generated/msw-handlers.ts):
`GET /api/v1/cities?region=`, `GET /api/v1/car-models?brand=`, `POST /api/v1/credit-applications`.

Два обязательных момента:

- **`r.ok` проверяется до `.json()`** — резолверы отдают 404 с пустым телом, разбор дал бы невнятную
  `SyntaxError`.
- **`AbortError` пробрасывается**, а не маскируется в `{ success: false }`.

Справочники MSW отличаются от мока (`cities?region=moscow` → округа вместо городов; марки toyota/bmw/mercedes
против toyota/kia/lada). **Маппинг сознательно не пишем** — расхождение и есть видимое доказательство смены
источника; в панели строка-подсказка. MSW работает только в dev и глушится `?mocks=off`, поэтому вне dev
режимы http/hybrid дизейблятся с подписью.

### Стабильный прокси и панель

```ts
export function createSwitchableCreditService(initial: CreditApiService): SwitchableCreditService {
  let current = initial;
  const service: CreditApiService = {
    loadCities: (region, signal) => current.loadCities(region, signal),
    loadCarModels: (brand, signal) => current.loadCarModels(brand, signal),
    submitApplication: (values, signal) => current.submitApplication(values, signal),
  };
  return { service, set: (next) => { current = next; } };
}
```

Явная делегация (3 строки) вместо `Proxy` — точные типы и видно, что реализация читается на каждом вызове.

testId панели: `di-panel`, `di-impl-mock`, `di-impl-http`, `di-impl-hybrid`, `di-latency`,
`di-fail-submit`, `di-active-impl`. Заложены сразу, чтобы позже e2e-спек стоил ~30 строк.

### Ключевые места

```tsx
// CreditFormWithDi.tsx — «сгенерированная форма», рабочая без обвязки
export function CreditFormWithDi({ services }: { services?: CreditApiService }) {
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Контекст читается ЗДЕСЬ — собственный провайдер ниже по JSX на это чтение не влияет.
  const injected = useJsonRendererService(CREDIT_API);
  const [fallback] = useState(() => createMockCreditService()); // мок по умолчанию
  const api = services ?? injected ?? fallback;

  // Фабрика выполняется РОВНО один раз → api тут замораживается.
  // Живое переключение обеспечивает стабильный прокси со стороны консумента.
  const jsonForm = useJsonForm(() =>
    createJsonForm<CreditApplicationForm>({
      schema: jsonSchema,
      registry: createRegistry(),
      model: createCreditModel(),
      behavior: createCreditBehavior(api),
    })
  );

  const renderBehavior = useMemo(
    () => createJsonRenderBehavior(jsonForm.form, jsonForm.model, {
      mode: 'create', api, onResult: (message, ok) => setResult({ message, ok }),
    }),
    [jsonForm, api] // api стабилен → memo не пересчитывается
  );
  const settings = useMemo(() => ({ registry: jsonForm.registry }), [jsonForm.registry]);

  return (
    <>
      {result && <div role="status" data-testid="submit-result">{result.message}</div>}
      <JsonRendererProvider settings={settings}>
        <JsonFormRenderer<CreditApplicationForm>
          form={jsonForm} renderBehavior={renderBehavior} validateSchema={import.meta.env.DEV} />
      </JsonRendererProvider>
    </>
  );
}
```

```tsx
// index.tsx — то, что делает приложение-консумент, чтобы подменить сервис
export default function CreditApplicationDiPage() {
  const [impl, setImpl] = useState<Impl>('mock');
  // ...latencyMs, failSubmit...

  // Создаётся ОДИН раз: прокси и services-реестр стабильны навсегда.
  const [di] = useState(() => {
    const sw = createSwitchableCreditService(createMockCreditService());
    const registry = defineRegistry((reg) => reg.service(CREDIT_API, sw.service));
    return { sw, registry };
  });

  const apply = (next) => {
    const mock = createMockCreditService({
      latencyMs: next.latencyMs,
      failures: next.failSubmit ? { submitApplication: 'Не удалось отправить заявку.' } : undefined,
    });
    const http = createHttpCreditService();
    di.sw.set(
      next.impl === 'mock' ? mock
      : next.impl === 'http' ? http
      : withServiceOverrides(mock, { submitApplication: http.submitApplication }) // частичная подмена
    );
  };

  const settings = useMemo(() => ({ registry: di.registry }), [di.registry]);
  return (
    <div className="mx-auto p-6">
      <DiPanel {...{ impl, latencyMs, failSubmit }} onChange={(next) => { /* setState + apply(next) */ }} />
      <JsonRendererProvider settings={settings}>
        <CreditFormWithDi />
      </JsonRendererProvider>
    </div>
  );
}
```

### Подключение в App.tsx

Четыре точечные правки в [App.tsx](../../projects/react-playground/src/App.tsx) по существующему образцу:
импорт, ветка union `ExamplePage` (`| 'di-credit-json'`), пункт в `exampleGroups` (группа «Компоненты и API»,
`path: '/examples/di-credit-json'`), `<Route>`. Новую группу сайдбара не заводим.

## Документация

- [`docs/llms/03-registry.md`](../../packages/reformer-renderer-json/docs/llms/03-registry.md):
  - **исправить** строку 119 — «дубли решает ближайший провайдер: внутренний перекрывает внешний
    (`withParent` копирует записи ребёнка последними)»;
  - Key Concepts — буллет **service** (регистрация, чтение, почему из схемы недоступен);
  - Builder API — строка `reg.service(token, impl)`;
  - новый рецепт «Инъекция сервисов: мок по умолчанию, подмена извне» со ссылкой на PoC;
  - три анти-паттерна: регистрировать мок в собственном реестре формы; тащить сервис через `reg.dataSource`;
    строить сервис внутри `useJsonForm`-фабрики при наличии переключателя.
- [`docs/llms/04-troubleshooting.md`](../../packages/reformer-renderer-json/docs/llms/04-troubleshooting.md) —
  запись «`getService` вернул `undefined`» с чек-листом.
- JSDoc (обязателен `@example` для callable, язык пакета — русский, кастомные теги запрещены):
  `createServiceToken`, `withServiceOverrides`, `useJsonRendererService`, `SERVICE_KEY_PREFIX`,
  `RegistryBuilder.service`, `ComponentRegistry.getService` (с объяснением опциональности).
- `npm run generate:llms` в пакете (llms.txt руками не правится).

Новый файл `NN-services.md` не заводим — сервисы часть реестра.

## Порядок работ

1. **Контракт пакета**: `constants.ts` → `service-token.ts` → `types.ts` → `component-registry.ts`.
   Существующие тесты должны остаться зелёными (поведения не меняем).
2. **React-слой пакета**: `useJsonRendererService` + экспорты в `index.ts`.
3. **Тесты пакета** (см. Верификация).
4. **Сервисы примера**: `credit-api.ts` → `mock-credit-api.ts` → `http-credit-api.ts` → `switchable.ts`.
5. **Behavior-фабрики**: `form.behavior.ts`, `renderer.behavior.ts`.
6. **React примера**: `CreditFormWithDi.tsx` → `DiPanel.tsx` → `index.tsx`.
7. **Подключение** в `App.tsx` + ручной прогон.
8. **Документация** + `generate:llms`.
9. **Сверка**: `git status docs/specs/` пуст; каталог v20 не изменён. Коммит **не делать** без явной просьбы.

Шаги 1–3 и 4–6 независимы после фиксации `CreditApiService`.

## Верификация

### Unit-тесты пакета

`npm test` в `packages/reformer-renderer-json` (vitest через `node ../../scripts/run-vitest.mjs`).
jsdom/RTL в монорепо нет — React-тесты через `renderToStaticMarkup` из `react-dom/server`
(образец: `packages/reformer-cdk/src/components/async-boundary/AsyncBoundary.test.tsx`).

Дописать в `registry/component-registry.test.ts`:

1. `reg.service` кладёт `type: 'service'` под ключом `$service:*`; `getService` возвращает ту же ссылку.
2. голая строка вместо токена — бросает.
3. изоляция видов: токена нет в `getComponentNames`/`getDataSourceNames`/`getFnNames`,
   `getDataSource(token)` → `undefined` (зеркало существующего теста для `LOCALE_SERVICE`).
4. `getService` на записи не-`service` типа → `undefined`.
5. `withParent`: сервис ребёнка перекрывает родительский — **фиксируем направление приоритета**.

Новый `registry/service-token.test.ts`:

6. `createServiceToken('x')` → `'$service:x'`.
7. `withServiceOverrides`: переопределённый метод вызывается, непереопределённый делегируется,
   `this` внутри base указывает на base (проверить на class-based сервисе — spread этот тест не прошёл бы).
8. `withServiceOverrides(base, {})` полностью прозрачен.

Новый `context/use-json-renderer-service.test.tsx` — доказывает механизм разрешения:

9. внутри провайдера с services-реестром сервис виден;
10. **вне любого провайдера хук не бросает** и возвращает `undefined` (регрессия на DEV-throw);
11. вложенные провайдеры: сервис внешнего доступен в поддереве с внутренним провайдером.

### Ручная проверка

`cd projects/react-playground && npm run dev`, открыть `/examples/di-credit-json`:

1. **Мок из коробки** — регион «Москва» → через ~300 мс города «Москва, Зеленоград».
2. **Задержка** — `di-latency` = 2000 → смена региона заметно медленнее.
3. **Отказ** — `di-fail-submit` вкл → submit → плашка `submit-result` с текстом ошибки.
4. **Подмена видна** — режим `http` → регион «Москва» → города стали округами (другой источник).
5. **Данные целы** — заполнить шаги 1–2, переключить реализацию, вернуться: значения на месте,
   в консоли нет warn'а о смене идентичности `renderBehavior`.
6. **Частичная подмена** — режим `hybrid`: опции из мока, а в DevTools Network виден
   `POST /api/v1/credit-applications` с серверным `id`.
7. **Без обвязки** — временно отрендерить `<CreditFormWithDi />` вне провайдера: форма полностью работает.

Скриншоты (если делать) — только в `projects/react-playground-e2e/screenshots/credit-application-di/`,
`fullPage: true`. Временные файлы — в `.tmp/`.

### E2E

Для PoC не заводим: новый playwright-проект + POM ради демо-страницы избыточен, ручной чек-лист
покрывает все свойства. Если понадобится — минимальный ценный спек: переключить `di-impl-http`,
сменить регион, `page.waitForResponse(/\/api\/v1\/cities/)`; запускать **без** `?mocks=off`.

## Риски

| Риск | Митигация |
|---|---|
| Дока и код по приоритету merge разошлись — можно «починить» не то | Правим доку, код не трогаем; тест №5 фиксирует направление |
| Переключатель без прокси теряет данные / пересобирает дерево | `createSwitchableCreditService` + комментарий о заморозке `useJsonForm` |
| Нестабильный `api` → смена идентичности `renderBehavior` | `api` стабилизирован; dev-warn рендерера служит детектором в п. 5 чек-листа |
| http/hybrid не работают вне dev и при `?mocks=off` | Панель дизейблит их вне dev + подпись |
| Расхождение справочников mock/MSW выглядит как баг | Подпись в панели + комментарий в `http-credit-api.ts` |
| Расширение union `ComponentMetadata['type']` формально breaking | Отметить в CHANGELOG; exhaustive-switch по нему в репо нет |
| Токены попадают в `registry.names()` | Принимаем: `names()` нужен `withParent` для копирования чужих реестров; то же верно для `LOCALE_SERVICE` |

## Вне объёма (осознанно)

- **Статические словари остаются `$dataSource`-константами.** `$dataSource` резолвится один раз при
  конвертации → асинхронные словари требуют prefetch/`AsyncBoundary` до сборки формы. Точку расширения
  (`createRegistry(dictionaries)`) отмечаем комментарием, не реализуем. Динамические опции сервисом
  покрыты уже сейчас — они идут через `updateComponentProps`, а не через `$dataSource`.
- **Маппинг справочников mock ↔ MSW** — прячет шов, который и есть предмет демонстрации.
- **Таргеты core / renderer-react**, MCP-промпты (`create-form.md`, `docs/llms/06-form-directory-layout.md`),
  builder codegen (`projects/reformer-builder/src/codegen/`) — отдельными задачами после проверки паттерна.
