# Стенд `@reformer/form-registry`: три JSON-формы, живой кэш и метрики

## Context

`@reformer/form-registry` — реестр форм для микрофронтендов: запись `FormEntry` делит **данные**
(`schema`, `initial` — умеют `kind: 'http'`) и **код** (`registry`, `behavior`, `model`, `validation`,
`renderBehavior` — только `inline`/`module`, по сети сознательно не ходят). Все пять этапов
`docs/plans/soft-strolling-zebra.md` закрыты, пакет опубликован.

Проверить его вживую сегодня нечем, и на то три причины:

1. **Кэш схем физически недоступен из React.** `createSchemaCache` реализован полностью — L1 (`Map`
   разобранных объектов) → L2 (`StorageStrategy`: OPFS → IndexedDB → memory) → сеть, условные запросы
   по `ETag`, дедупликация «в полёте» с refcount-отменой, LRU-вытеснение; всё покрыто юнит-тестами.
   При этом `FormRegistryProviderProps` = `{ registry, context, baseRegistry, options, children }` — пропа
   `cache` нет, а [use-form-resource.ts:45](packages/reformer-form-registry/src/react/use-form-resource.ts#L45)
   зовёт `loadForm(entryRef.current, baseRegistry)` вообще без опций. `cache`, `preflight`, `onDiagnostic`
   и `fetchImpl` недостижимы через `FormOutlet`. Документация
   [04-cache-storage.md](packages/reformer-form-registry/docs/llms/04-cache-storage.md) уже показывает
   `<FormRegistryProvider cache={cache} …>` — то есть описывает API, которого нет.
2. **Ни одной схемы по сети.** Во всём репозитории нет ни одного `DataSource` с `kind: 'http'`; обе записи
   витрины (`alerts-list@1.0.0`, `credit-application@1.0.0`) — `inline`. Кэшируются только `schema` и
   `initial` и только на сетевом пути, поэтому кэш не участвует в монтировании ни разу.
3. **Метрик нет.** Наружу торчит единственное `memorySize` (число записей L1). Счётчиков попаданий,
   промахов, ревалидаций и 304 не существует — понять «сработал кэш или нет» нельзя даже в отладчике.

**Итог:** страница-стенд, монтирующая три существующие JSON-формы через реестр, тянущая их схемы по
настоящему HTTP и наглядно показывающая поведение кэша. Метрики кэша — та самая «новая фича», под которую
стенд служит витриной: сначала счётчики в пакете, затем стенд их отображает.

**Согласовано с пользователем:** правим пакет (проброс `cache` + HTTP-схемы); два источника с переключателем
(MSW и статика); новая фича — метрики `hit/miss/stale/304`; раскладка — табы с ручным монтированием.

---

## Часть A. Пакет `@reformer/form-registry`

### A1. Метрики кэша — новая фича

Файл: [cache.ts](packages/reformer-form-registry/src/cache.ts). Всё **аддитивно**: существующие вызовы
`createSchemaCache()` и все 12 тестов продолжают работать без правок (утверждения там — про число вызовов
`fetcher`, значения, `memorySize` и `toContain` по кодам диагностик).

События делятся на **две независимые оси** — иначе счётчики не образуют разбиения и таблица не сходится.

**Ось «исход поиска»** — ровно одно событие на каждый вызов `get()`:

| событие | место |
|---|---|
| `l1-hit` | `load`, ветка `if (hot && now() - hot.storedAt < maxAgeMs)` |
| `dedup` | `load`, ветка `if (running)` — **до** `joinInFlight`, сам `joinInFlight` оставить чистым |
| `l2-hit` | `startLoad`, внутри `if (known && now() - stored.storedAt < maxAgeMs)` |
| `stale` | `startLoad`, перед вызовом `fetcher`, когда `known` есть — уходим в сеть с `If-None-Match` |
| `miss` | там же, когда `known` нет (записи не было **либо** `JSON.parse` упал) |

**Ось «исход сети»** — не больше одного на `startLoad`:

| событие | место |
|---|---|
| `revalidated` | ветка `res.notModified`, **после** guard'а `if (!known) throw` |
| `refetched` | после `fetcher`, когда `known` был |
| `fetched` | после `fetcher`, когда `known` не было |
| `error` / `aborted` | `try/catch` **внутри** IIFE вокруг сетевого участка: `catch (e) { emit(controller.signal.aborted ? 'aborted' : 'error'); throw e }` |

Почему именно так — три поправки к первоначальному замыслу, каждая ловит реальную ошибку:

- **Исход поиска считается ДО сети.** Если считать `miss` после `fetcher`, при отказе сети он не посчитается
  никогда и инвариант поедет.
- **`error` — внутри IIFE, не на внешней цепочке.** `joinInFlight` не имеет `.catch` вовсе, так что двоения
  нет ни при каком варианте; но тело IIFE исполняется ровно один раз на сетевую попытку, а в его скоупе
  доступны `known` и `controller.signal.aborted` — только там можно отличить отказ от отмены (иначе
  StrictMode раздувает счётчик ошибок) и накрыть заодно бросок «304 без тела».
- **`stale` — отдельное событие, не разновидность промаха.** «Тело было, но протухло» и «тела не было» —
  разные истории, и именно первая ведёт к `revalidated`.

Инварианты для теста:

```
l1Hit + l2Hit + dedup + miss + stale === числу вызовов get()
fetched + refetched + revalidated + error + aborted === числу входов в startLoad
```

Три L2-счётчика (`cache-read-failed`, `cache-write-failed`, `cache-corrupt`) берутся **бесплатно** одним
инкрементом внутри существующей воронки `report()`. В `stats.error` они попадать **не должны** — отказ L2
загрузку не роняет, это принципиально разные вещи.

Прочие детали, каждая — исправление конкретной ловушки:

- **`stats()` возвращает копию** (`() => ({ ...counters })`). `Readonly<CacheStats>` — только тип; живой
  объект React-панель через `useMemo`/`useSyncExternalStore` увидит по той же ссылке и не перерисуется
  никогда. Живой канал — `onEvent`, `stats()` — pull для снимка.
- **`durationMs` только у терминальных сетевых событий.** У `dedup` оно эмитится синхронно и было бы `0`,
  хотя вызывающий реально ждал; честно посчитать можно лишь ценой лишнего микротаска на горячем пути.
  Считать через подменяемый `now()`, а не `Date.now()`, иначе тесты с фейковым временем поедут.
- **`bytes` считать на месте**, а не «переиспользовать из `writeL2`»: `writeL2` выходит раньше при
  `if (!storage) return`, а `JSON.stringify` и `byteLength` там идут по второму разу. Посчитать один раз
  рядом с `l1.set` и передать размер в `writeL2` параметром. В JSDoc подписать: **размер после
  сериализации, а не байты по проводу** — иначе панель врёт.

`stats`/`resetStats` как обязательные члены интерфейса `SchemaCache` формально ломают внешних
имплементаторов; в репозитории таких нет, пакет `0.1.0` — приемлемо, отразить в CHANGELOG.

### A2. Проброс кэша в React-слой

| файл | правка |
|---|---|
| [react/context.tsx](packages/reformer-form-registry/src/react/context.tsx) | `FormRegistryProviderProps` += `cache?: SchemaCache`; `FormRegistryOptions` += `preflight?: 'error'\|'warn'\|'off'`, `fetchImpl?: typeof fetch`; `FormRegistryContextValue` += `cache` |
| [react/form-outlet.tsx](packages/reformer-form-registry/src/react/form-outlet.tsx) | `EntryMount` читает `cache`/`options` из контекста, строит адаптер `onDiagnostic` и передаёт в `useFormResource`. `QueryOutlet` не трогать — делегирует |
| [react/use-form-resource.ts](packages/reformer-form-registry/src/react/use-form-resource.ts) | третий параметр `opts`, прокинуть в `loadForm` |
| [loader.ts](packages/reformer-form-registry/src/loader.ts) | в рассылке диагностик добавить `level: p.level` — сейчас теряется, и панель не отличит `error` от `warn` |

**Стабильность ссылок — это не косметика, а условие работоспособности.** Сегодня `useMemo` в `context.tsx`
держит `options` в зависимостях; инлайновый литерал даёт лишний ре-рендер потребителей, но не ломает
загрузку, потому что `useFormResource` зависит от `[key, baseRegistry, nonce]`. **Багом это станет ровно в
тот момент, когда прилетит `cache`**: нестабильная ссылка в зависимостях эффекта = бесконечный цикл
перезагрузки формы. Поэтому обе правки обязательны:

1. в `context.tsx` — деструктурировать `options` на поля и собрать `useMemo` по полям, чтобы литерал
   `options={{…}}` на стороне хоста был безвреден;
2. в `use-form-resource.ts` — `opts` через **ref** (тем же приёмом, что уже применён к `entry`), а в массив
   зависимостей положить **только `cache`** отдельной строкой. Смена экземпляра кэша обязана перезагрузить
   форму — именно так стенд и получит наглядную демонстрацию при смене `maxAgeMs`.

Адаптер `onDiagnostic` нужен из-за расхождения типов: `FormRegistryOptions.onDiagnostic` ждёт `Diagnostic`
(`{ level, code, message, entry? }`), а `loadForm` шлёт `{ code, message, entryKey }`. Строим его в
`EntryMount`, где есть `entry` для поля `entry: { id, version, owner }`. Это заодно оживляет опцию, которая
сегодня кладётся в контекст и не читается никем.

[mounted-form.tsx](packages/reformer-form-registry/src/react/mounted-form.tsx) **трогать не нужно**:
`LoadedForm.preflight` он игнорирует и правильно делает — чтобы показать проблемы preflight в панели,
стенду достаточно `preflight: 'warn'` + `onDiagnostic`, без единой правки пакета.

### A3. Отмену запроса сознательно НЕ прокидываем

`signal` из `useFormResource` в `loadForm` не передаём. Отказ на связке «кэш + StrictMode» хуже, чем просто
отменённый запрос:

1. монтаж 1 → `startLoad` → `inFlight.set(key, state)`, `waiters = 1`;
2. cleanup → `onAbort` → `waiters → 0` → `controller.abort()`;
3. монтаж 2 **синхронно** в том же коммите: промис ещё не settled, `.finally` ещё **не удалил** ключ из
   `inFlight` → `joinInFlight` цепляется к промису, чей контроллер уже `aborted`;
4. `fetchJson` → `FormFetchError('aborted')` → `FormLoadError` → форма в состоянии `error` **без шанса на
   автоповтор**.

Без кэша этого нет — второй монтаж делает свой `fetchOne`. То есть дефект возникает ровно там, где стенд
включает и кэш, и StrictMode.

Добавить в [cache.test.ts](packages/reformer-form-registry/src/cache.test.ts) регрессионный тест,
фиксирующий текущее поведение (`get()` сразу после отмены единственного ждущего присоединяется к
отменённому запросу; `fetcher` вызван один раз), и завести issue в bd с готовым решением — проверка
`if (running && !running.controller.signal.aborted)` перед `joinInFlight`; `.finally` уже защищён сверкой
идентичности, так что `inFlight.set` в `startLoad` безопасно затрёт мёртвую запись.

### A4. Документация пакета

Не `docs/specs/` — править можно. [04-cache-storage.md](packages/reformer-form-registry/docs/llms/04-cache-storage.md)
станет правдой; в [README.md](packages/reformer-form-registry/README.md) заодно исправить накопившийся
дрейф — `ctx=` вместо реального `context=`, пропущенный обязательный `registry`, перепутанные
`errorFallback` / `loadErrorFallback`. Перегенерировать: `npm run generate:llms -w @reformer/form-registry`.

---

## Часть B. Playground

### B1. Два источника HTTP-схем без дублирования файлов

**Статика** — через Vite-суффикс, вместо копий в `public/`:

```ts
import schemaUrl from '../alerts-list-renderer-json/json-schema.json?url&no-inline';
```

`?url` даёт настоящий ассет без второй копии схемы, которая рано или поздно разъедется с исходной.
**`&no-inline` обязателен:** `assetsInlineLimit` в [vite.config.ts](projects/react-playground/vite.config.ts)
не переопределён → дефолт 4096, а схема алертов весит 2040 Б — в прод-сборке она молча превратилась бы в
`data:`-URL, и «статический HTTP-источник» перестал бы быть HTTP-источником (ни запроса, ни ETag, ни 304).

Dev-путь проверять не нужно, он прослежен по исходникам Vite 7: `?url` попадает в `SPECIAL_QUERY_RE`
(конфликта с `vite:json` нет), transform-middleware `.json` не перехватывает, отдаёт `sirv` с
`{ dev: true, etag: true }` — то есть `content-type: application/json` и `ETag` есть, `If-None-Match` → 304
обрабатывается. `looksLikeJson` проходит.

**Отключить браузерный HTTP-кэш** в источнике, иначе «0 запросов» окажется заслугой браузера, а не
`SchemaCache`, и стенд перестанет доказывать то, ради чего сделан:

```ts
{ kind: 'http', url: schemaUrl, init: { cache: 'no-store' } }
```

Именно `no-store`, а не `no-cache`: при `no-cache` браузер ревалидирует сам и отдаёт JS полный `200` вместо
`304` — ветка `revalidated` стала бы ненаблюдаемой.

**MSW** — новый **рукописный** `src/mocks/form-schema-handlers.ts`, подключённый в
[browser.ts](projects/react-playground/src/mocks/browser.ts) перед генерёнными:
`setupWorker(...formSchemaHandlers, ...handlers)`. В `_generated/` писать нельзя — его перезаписывает
`npm run generate:mocks` внутри `npm run build`.

MSW-источник отдаёт те же схемы по `/mock-forms/:id` с управляемыми со страницы сценариями: задержка,
`ETag`, `304` на `If-None-Match`, инъекция `500`/`429`. Четыре вещи, которые надо учесть:

- **304 обязан быть с null-body**: `new HttpResponse(null, { status: 304, headers: { ETag: etag } })`.
  MSW держит 304 в списке кодов без тела, а SW делает `new Response(response.body, response)` — с телом
  конструктор бросит внутри воркера и запрос повиснет.
- **Handlers исполняются в странице, а не в Service Worker** — поэтому объект-сценарий на `window` читается
  корректно. Заблуждение здесь распространённое, стоит написать комментарием.
- **`Retry-After` максимум 1 секунда** в сценарии 429: `retryDelay` потолка не имеет, `Retry-After: 120`
  усыпит на две минуты и повесит e2e.
- **Одна инъекция 500 даёт три запроса**: `retries = 2` по умолчанию, плюс две паузы ~250–500 мс, прежде чем
  форма упадёт в `error`. Панель покажет `error: 1` при трёх запросах — подписать, иначе читается как баг.

Проходной handler для статики писать не надо: MSW подавляет предупреждение о необработанном запросе для
`.json` как для обычного ассета.

Ограничение: MSW включается только при `NODE_ENV === 'development'` и глушится флагом `?mocks=off`
(см. [main.tsx](projects/react-playground/src/main.tsx)) — MSW-источник живёт только в dev, показать это в UI.
В StackBlitz-режиме MSW подменяется прокси только для `/api/*` — вкладку MSW там скрывать.

### B2. Изолированный реестр стенда

**Регистрировать варианты форм в глобальный реестр нельзя.** `matchesQuery` для `by: 'id'` без `version`
матчит **все** версии, `resolveForms` сортирует `byPriorityThenVersionDesc`, а `FormOutlet` берёт `[0]`.
Обе существующие страницы зовут `FormOutlet` **без версии**
([AlertsListRendererJson.tsx:17](projects/react-playground/src/pages/examples/alerts-list-renderer-json/AlertsListRendererJson.tsx#L17),
[complex-multy-step-form-registry/index.tsx:25](projects/react-playground/src/pages/examples/complex-multy-step-form-registry/index.tsx#L25)) —
то есть любая добавленная версия старше `1.0.0` угнала бы их на MSW-вариант, который в прод-сборке не
отвечает вовсе, а под `?mocks=off` заглушен.

Поэтому стенд заводит **свой** реестр на модульном уровне:

```ts
// form-registry-lab/lab-registry.ts
export const labRegistry = createFormRegistry();
labRegistry.registerAll(labEntries);
```

`createFormRegistry` для этого и существует. Что это даёт помимо безопасности: не нужны ни `useEffect` с
`{ onConflict: 'replace' }`, ни cleanup; нет мигания первого кадра (при регистрации в эффекте первый рендер
даёт `entry === undefined`, `FormOutlet` возвращает `null` **до** `EntryMount`, и `fallback` не покажется);
нет цикла register→unregister→register в StrictMode; при HMR модуль переоценивается вместе с новым реестром.

Изоляция снимает и ограничение на адресацию — источник кодируем **идентификатором**, а не версией:
`lab-alerts-inline` / `lab-alerts-static` / `lab-alerts-msw` и так далее, девять записей от трёх фабрик.
Перемонтирование гарантировано: `key={entryKeyOf(entry)}` меняется при смене `id` так же, как при смене
версии. Проверка `schema-identity-mismatch` не помешает — ни в одной из трёх схем нет поля `id`
(у всех только `"version": "1.0"`). Общий хелпер `schema-sources.ts` отдаёт `DataSource` по виду источника,
чтобы девять записей не расползлись копипастой.

**`compatibleSchema` у lab-записей не задавать** — у схем `"version": "1.0"`, не semver, и проверка
`schema-version-drift` уровня `error` потребовала бы отдельной выверки диапазонов без всякой пользы.

**`validation` в записи кредитной заявки не добавлять.** Сегодня её там нет, и это спасает: проверка
`unknown-step-selectors` запускается только под `if (validation?.steps)`, а в схеме нет ни одного селектора
шага (есть `wizard`, `data-boundary`, секции и массивы) — проверка уровня `error` уронила бы монтирование.
Валидация приезжает другим путём, через `patchProps` в узел `wizard` внутри render-behavior.

Что где лежит:

- `alerts-list` — запись есть, нужны http-варианты. Модель строится фабрикой; **на `initial` не переводить**
  — вылезет `unmaterialized-model-paths` на путях внутри `$template`;
- `credit-application` — запись есть; её `json-schema.json` **побайтово идентичен** файлу из
  `complex-multy-step-form-renderer-json` (67 973 Б, сверено), поэтому http-варианты строятся на
  существующих `registry`/`renderBehavior` без риска расхождения preflight;
- `registration-form` — записи **нет**, нужен новый `form-entry.ts` (см. B4).

### B3. Страница стенда

`src/pages/examples/form-registry-lab/`:

| файл | роль |
|---|---|
| `FormRegistryLab.tsx` | default-export; табы трёх форм, переключатель источника, кнопка «размонтировать/смонтировать» |
| `lab-registry.ts` | свой `createFormRegistry()` + девять записей, регистрация на модульном уровне |
| `lab-cache.ts` | `SchemaCache` стенда с настраиваемыми `maxAgeMs` и хранилищем; `onEvent` пишет в сигнал-журнал |
| `lab-net.ts` | считающая обёртка `fetchImpl` — основное доказательство «в сеть не ходили» (см. проверку) |
| `cache-panel.tsx` | счётчики `stats()`, живой журнал `CacheEvent`, кнопки `invalidate` / `clear` / `resetStats` |
| `registry-panel.tsx` | `registry.list()`, диагностика preflight |
| `msw-scenario.tsx` | задержка, `304`, инъекция `500`/`429` — активна только при источнике MSW |

Стенд рендерит **свой вложенный** `<FormRegistryProvider>` со своим кэшем и своим реестром: провайдеры
вкладываются, внутренний перекрывает внешний, поэтому `maxAgeMs` и хранилище меняются на лету (кэш
пересоздаётся) без правок `App.tsx`. Кэш держать в `useMemo`/`useState` с ключом `(maxAgeMs, storageKind)`,
`ResolveContext` — модульной константой.

`pickStorage` вызывать со **своим namespace** (`reformer-forms-lab/v1`): `clear()` стирает namespace целиком,
и общий префикс задел бы записи других страниц; заодно это изолирует e2e.

Обязательно у каждого `FormOutlet` — **`fallback` и `loadErrorFallback`**. Без них `EntryMount` возвращает
`null` и при загрузке, и при отказе: с настоящим HTTP-источником вкладка будет выглядеть пустой, а инъекция
500 — как «ничего не произошло». Повтор (`retry`) доступен **только** через `loadErrorFallback`, а он нужен
для сценария «500 → повтор → успех». `onReady` заворачивать в `useCallback` — иначе дёргается каждый рендер.

Четыре вещи, которые надо подписать в UI, иначе они читаются как баги:

- **inline-вкладка кэш не трогает вообще** — `loadData` возвращает `src.value` до кэша, нулевые счётчики
  там нормальны по построению;
- **`clear()` не сбрасывает `stats()`, а `resetStats()` не чистит кэш** — три кнопки делают три разные вещи;
- **`entryKeyOf` ≠ ключ кэша**: `id@version` против `${owner}/${id}@${version}#${part}`. Показывать оба,
  иначе непонятно, почему смена `owner` даёт промах;
- **одна инъекция 500 = три сетевых запроса** (`retries = 2`).

Демонстрацию `dedup` делать **кнопкой «смонтировать две копии сразу»**, а не объяснением через StrictMode:
два `EntryMount` с одним `netKey` дают `fetched: 1, dedup: 1` и в dev, и в prod, тогда как
StrictMode-объяснение в прод-сборке стало бы ложью.

Стиль — как у существующих страниц витрины: заголовок рисует оболочка (`ExampleHeader` по `exampleGroups`),
свой `<h1>` не дублировать; панели — `Section`/`Card` из `@reformer/ui-kit`; живое состояние — приёмом из
[FormSateDisplay.tsx](projects/react-playground/src/pages/examples/registration-form/FormSateDisplay.tsx)
(подписка **внутри** компонента, чтобы не ре-рендерить родителя).

### B4. `FormEntry` для формы регистрации

Сегодня [form-setup.ts](projects/react-playground/src/pages/examples/registration-form-renderer-json/form-setup.ts)
— монолит: локальные `ui`-сигналы, `createRegistrationRegistry(ui)`, `createJsonForm`, затем замыкания
`submit`/`reset`/`loadPrefill`/`applyPrefill` и `renderBehavior`, доклеенный к бандлу.

Новый `form-entry.ts` рядом (существующая страница остаётся образцом прямого использования `renderer-json` —
ровно как сосуществуют `complex-multy-step-form-renderer-json` и `-registry`):

- **`ui`-сигналы уезжают на уровень модуля** — и это вынужденно, а не стилистически: `FormEntry.registry` —
  `CodeSource<ComponentRegistry>`, то есть **один экземпляр**, а `createRegistrationRegistry(ui)` внутри
  создаёт `createPendingButton(ui.pending)` — новый **тип** React-компонента. Фабрика на монтаж заставила бы
  React ремонтировать поддерево (по той же причине `AsyncBoundary` там зарегистрирован ссылкой);
- **обработчики собираются внутри фабрики `renderBehavior(form, model, …)`** — она получает `form` и `model`
  аргументами, чем снимается исходная проблема порядка объявления, из-за которой поведение сегодня
  доклеивается к бандлу;
- **`ui` сбрасывается в начале фабрики**, а не в `onInit`: `createJsonForm` зовёт фабрику ровно один раз на
  конструкцию формы, синхронно, до первого рендера, тогда как `onInit` привязан к жизненному циклу узла и
  может отработать позже и не один раз. Сброс обязателен — стенд построен вокруг ручного unmount/mount, а
  `submit`/`reset` начинаются с `if (ui.pending.value) return`: размонтаж во время POST оставил бы форму
  **навсегда заблокированной**;
- **ограничение «одна регистрация за раз» — в JSDoc**: два одновременных монтажа разделят один `ui`
  (`pending` одного заблокирует другого, `statusText` будет общим). Табы это исключают, но через месяц
  кто-нибудь добавит режим «рядом»;
- **`initial` и `model` указать оба**: `initial` — чтобы preflight-проверка `unmaterialized-model-paths`
  реально отработала (сверено: 8 путей `$model(...)` в схеме против 8 полей `INITIAL` — пройдёт),
  `model: () => createModel({ ...INITIAL })` — чтобы `MountedForm` не строил модель от одного и того же
  модульного объекта на каждый монтаж. `loadForm` разрешает оба, `MountedForm` предпочтёт фабрику;
- **`validation` не используем**: у регистрации это `ValidationSchema`, прогоняемая вручную через
  `validateModel`, а `FormEntry.validation` ждёт `{ steps, extras }`. Валидатор строится там же через
  `makeRegistrationValidator(model)`.

### B5. Регистрация страницы

Четыре правки в [App.tsx](projects/react-playground/src/App.tsx), как для любого примера: импорт, член union
`ExamplePage`, запись в `exampleGroups` (новая группа «Реестр форм»), `<Route>` внутри `Layout()`.
`src/forms/registry.ts` **не трогать** — у стенда свой реестр.

Заодно одна строка в [main.tsx](projects/react-playground/src/main.tsx): у `enableMocking()` нет `.catch`,
поэтому при любом отказе старта MSW `createRoot` не вызывается и приложение даёт **белый экран** вместо
внятной ошибки. Это чинит целый класс будущих «почему пусто» и снимает ловушку для e2e (см. ниже).

---

## Проверка

1. **Юнит-тесты пакета** — `npm test -w @reformer/form-registry`. Новое: счётчики по каждой ветке кэша
   плюс оба инварианта-разбиения; регрессионный тест на join к отменённому запросу; провайдер с кэшем
   не ходит в сеть на повторном монтаже.
2. **Сборка пакета обязательна** — playground резолвит `@reformer/*` в `dist/`, source-алиасов в
   `vite.config.ts` нет: `npm run build -w @reformer/form-registry`. **Это же требуется перед e2e** —
   `webServer` поднимает только dev-сервер playground и пакеты не собирает; без сборки тесты пойдут против
   старого API и упадут с невнятным `cache is not a function`.
3. **Типы и линт** — корневые `npm run typecheck` (покрывает и form-registry, и react-playground) и `npm run lint`.
4. **Руками** — `npm run dev`, страница `/examples/form-registry-lab`: холодный старт → повторный монтаж
   (0 запросов) → F5 (L2) → `maxAgeMs = 0` + MSW → `304` → инъекция `500` → ретрай → успех →
   `invalidate`/`clear` → две копии сразу (`dedup`). Скриншоты — в
   `projects/react-playground-e2e/screenshots/form-registry-lab/`.
5. **e2e** — `tests/pages/form-registry-lab/` + новый project в `playwright.config.ts`
   (`serviceWorkers` оставить по умолчанию — MSW нужен). Сценарии с префиксом `REG-`.
   Запуск: `cd projects/react-playground-e2e && npx playwright test --project=form-registry-lab`.

**Инструментовать «0 сетевых запросов» через `page.route()` / `page.on('request')` нельзя** — запросы,
обслуженные MSW Service Worker'ом, до них не доходят; это уже зафиксировано комментариями в существующих
тестах репозитория (`registration-form-json.spec.ts`, `credit-form-page.pom.ts`). Три SW-агностичных уровня:

- **основной** — счётчик в обёртке `fetchImpl` (`lab-net.ts`), которую стенд отдаёт провайдеру: измеряет
  ровно то утверждение, которое стенд делает — «загрузчик не пошёл в сеть»;
- **семантический** — `cache.stats()` в `data-testid`: ловит другой класс ошибок («в сеть не пошли, потому
  что форма вообще не смонтировалась»);
- **перекрёстный** — `performance.getEntriesByType('resource')`: в отличие от `page.route`, Resource Timing
  создаётся и для SW-обслуженных запросов.

`serviceWorkers: 'block'` использовать только вместе с `?mocks=off` — иначе `worker.start()` отклоняется и
до правки `main.tsx` из B5 это белый экран. Хранилище L2 в тестах фиксировать `indexeddb`: `pickStorage`
асинхронна и идёт `opfs → indexeddb → memory`, а доступность OPFS в headless нестабильна — иначе тест
«L2 после F5» будет флакать.

## Риски

| риск | блокирующий |
|---|---|
| Забыть `&no-inline` — alerts-схема (2040 Б) инлайнится в `data:` в прод-сборке, HTTP-источник перестаёт быть HTTP-источником | да, заложено в B1 |
| Регистрация вариантов в глобальный реестр угоняет две существующие страницы | да, снято изолированным реестром (B2) |
| Нестабильная ссылка `cache`/`options` в зависимостях эффекта → бесконечная перезагрузка формы | да, снято деструктуризацией + ref (A2) |
| `ETag`/`304` от Vite dev-сервера — проверено по исходникам (`sirv` с `etag: true`), но в проде зависит от хостинга | нет |
| MSW живёт только в dev; в StackBlitz — только `/api/*` | нет, отразить в UI |
| Протечка `ui`-состояния регистрации между монтажами | нет, снято сбросом в фабрике (B4) |
| Сборка пакета забыта перед e2e → невнятное падение | нет, но вписать в README e2e и CI-шаг |
