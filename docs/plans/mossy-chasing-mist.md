# Подписка на узел-контейнер в дереве `model.$`

## Context

`createModel` строит дерево, в котором **сигналы есть только в листьях**. В
[form-model.ts:291-330](../../packages/reformer/src/state/form-model.ts#L291-L330) `signalsProxy` для листа
возвращает сам `Signal` из `@preact/signals-core` (отсюда `.value`/`.peek()`/`.subscribe()`), а для
группы и массива — анонимный `Proxy` над пустым `{}`, который умеет только отдать ребёнка по имени и
`__path`. Поэтому:

| Выражение | Сейчас |
|---|---|
| `model.$.propName.subscribe(cb)` | ✅ работает (это `Signal`) |
| `model.$.subscribe(cb)` | ❌ `undefined` — и в рантайме, и в типах |
| `model.$.inner.subscribe(cb)` | ❌ то же |
| `model.$.inner.value` / `.peek()` | ❌ `undefined` |

Блокируют это три независимых слоя: get-трап группы возвращает `undefined` для всего, что не ребёнок;
тип `ModelSignals<T>` ([types.ts:126-144](../../packages/reformer/src/state/types.ts#L126-L144)) — mapped
type строго по `keyof T`, без единого метода; и у `GroupNode` нет реактивного чтения — только
нетрекающий `peek()` ([form-model.ts:124-128](../../packages/reformer/src/state/form-model.ts#L124-L128)),
поэтому `computed(() => group.peek())` никогда не пересчитается.

Следствие уже видно в репозитории. Обход «прочитать все листья внутри `effect`» написан **пять раз** с
разными багами: `walkLeaves`/`eachLeafSignal` (корректный, но не экспортируется наружу — его нет ни в
[state/index.ts](../../packages/reformer/src/state/index.ts), ни в барелях), `readGroup`
([behaviors.ts:144](../../packages/reformer/src/form/behaviors.ts#L144), молча пропускает массивы),
`touchValue` ([behaviors.ts:492](../../packages/reformer/src/form/behaviors.ts#L492)), а также
`modelLeafPaths`+`readValue` и `snapshot` в reformer-builder
([form-event-log.ts:103](../../projects/reformer-builder/src/canvas/form-event-log.ts#L103),
[LiveModelView.tsx:33](../../projects/reformer-builder/src/canvas/LiveModelView.tsx#L33)) — последние два
берут набор ключей из мок-объекта, потому что «ключи модели перечислять ненадёжно». Единственный
публичный способ подписаться на группу — подняться в слой нод (`GroupNode.value` — `computed`,
[group-node.ts:192-199](../../packages/reformer/src/form/nodes/group-node.ts#L192-L199)), но он требует
материализованную ноду и **не видит массивы** ([create-form.ts:136-141](../../packages/reformer/src/form/create-form.ts#L136-L141)).

**Цель:** сделать каждый узел дерева `$` — не только лист — полноценным `ReadonlySignal`, сохранив при
этом доступ к детям.

## Решение

Узел-контейнер (группа и массив) в `$` становится объектом, который **структурно** удовлетворяет
`ReadonlySignal<T>` (`value` / `peek()` / `subscribe()` / `valueOf()` / `toString()` / `toJSON()` / `brand`)
и одновременно остаётся `Proxy` с доступом к детям:

```ts
model.$.subscribe(v => autosave(v));        // v: T целиком
model.$.inner.value                          // { propName: 'x' } — реактивный снимок
model.$.inner.peek()                         // без подписки
model.$.inner.propName.subscribe(cb)         // как и раньше
model.$.tags.subscribe(v => ...)             // реагирует и на push/removeAt, и на правку элемента
watchField(model.$.inner, cb)                // работает бесплатно — принимает ReadonlySignal
```

Value-фасад (`model`, `model.inner`) **не трогаем** — он остаётся «как обычный объект», это его
задокументированный смысл. Подписка идёт через `model.$` / `model.inner.$` (это эквивалентные узлы).

### Ключевое решение реализации: обёртка, а не подкласс `Signal`

Контейнерный узел строится как **обычный объект-делегат** поверх `computed`, а не как `Proxy` вокруг
инстанса `Computed`:

```ts
const agg = computed(() => node.read());
const api = {
  get value() { return agg.value; },
  peek: () => agg.peek(),
  subscribe: (fn) => agg.subscribe(fn),
  valueOf: () => agg.value,
  toString: () => String(agg.value),
  toJSON: () => agg.value,
  brand: agg.brand,
};
// далее — new Proxy(api, { get: дети-первыми, ... })
```

Это принципиально, по двум причинам:

1. **`this`-безопасность.** Если обернуть `Proxy`'ем сам инстанс `Computed`, то при вызове
   `proxy.subscribe(cb)` внутрь метода уйдёт `this === proxy`, и preact начнёт писать во внутренние поля
   (`this._targets = …`) через set-трап — TypeError в strict mode. У делегата методы замкнуты на `agg`,
   receiver не участвует.
2. **`instanceof Signal` остаётся `false`.** По кодовой базе рассыпано ~10 проверок вида
   `value instanceof Signal`, которыми лист отличают от группы:
   [create-form.ts:79,94](../../packages/reformer/src/form/create-form.ts#L79),
   [renderer-react/core/utils.ts:31](../../packages/reformer-renderer-react/src/core/utils.ts#L31),
   [render-node.tsx:452,506,514,547](../../packages/reformer-renderer-react/src/core/render-node.tsx#L452),
   [json-to-render-schema.ts:253](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts#L253).
   `ReadonlySignal` в `@preact/signals-core` — **структурный интерфейс, а не класс**
   ([signals-core.d.ts:76-84](../../node_modules/@preact/signals-core/dist/signals-core.d.ts#L76-L84)),
   поэтому делегат совместим по типам, но не проходит `instanceof`. Все эти места продолжают работать
   без единой правки.

## Изменения

### 1. `packages/reformer/src/state/form-model.ts` — основная работа

**Реактивное чтение контейнеров.** Сейчас `read()` есть только у `LeafNode` (строка 85). Добавить
симметричные методы, зеркалящие существующие `peek()`:

- `GroupNode.read()` — рекурсивно `node.read()` по `children` (в отличие от `peek()`, строки 124-128);
- `ArrayNode.read()` — `this.items.value.map(n => n.read())`. Именно `items.value`, а не `.peek()` —
  это подписка на **состав** массива; тот же приём уже использован в `walkLeaves`
  ([form-model.ts:435](../../packages/reformer/src/state/form-model.ts#L435)) с объяснением в комментарии.

**`signalsProxy` (строки 291-330)** — для `group`/`array` строить делегат по схеме выше и оборачивать в
`Proxy` с порядком разрешения ключа:

1. `__path` → `node.path` (как сейчас);
2. `__kind` → `'group' | 'array'` — новый служебный маркер (см. п. 3);
3. ребёнок по имени / по индексу → `signalsProxy(child)`;
4. иначе → `Reflect.get(api, key)`.

Дети идут **раньше** свойств сигнала — тот же приоритет, что у `makeFormModel`, где поле формы затеняет
метод API ([form-model.ts:390-393](../../packages/reformer/src/state/form-model.ts#L390-L393)). Это
добавляет к списку зарезервированных имён `value`/`peek`/`subscribe`/`valueOf`/`toString`/`toJSON`/`brand`:
поле с таким именем затенит одноимённое свойство сигнала. `subscribe` при этом продолжит работать —
он замкнут на `agg`, а не читает `proxy.value`.

`has`/`ownKeys`/`getOwnPropertyDescriptor` **оставить как есть** (только дети). Так уже устроен `__path`:
доступен через `get`, невидим для `in` и `Object.keys`. Это сохраняет работоспособность
`readGroup` (`Object.keys`) и duck-typing `'value' in v` в reformer-builder
([form-state-read.ts:38](../../projects/reformer-builder/src/canvas/form-state-read.ts#L38),
[LiveModelView.tsx:25](../../projects/reformer-builder/src/canvas/LiveModelView.tsx#L25)) без правок.

**Кэш узлов.** Сейчас `signalsProxy(child)` вызывается на каждый `get` — то есть
`model.$.inner !== model.$.inner`. Для `computed` это неприемлемо (новый агрегат на каждое обращение).
Добавить `WeakMap<ModelNode, proxy>` по образцу существующего `facadeCache`
([form-model.ts:364](../../packages/reformer/src/state/form-model.ts#L364)). Побочно чинит идентичность.

**`batch` в `GroupNode.set` (строки 129-138).** Сейчас дети пишутся по одному → `model.set({...})` даст
N уведомлений подписчику группы вместо одного. Обернуть тело в `batch` из `@preact/signals-core`. То же
для `resetToInitial()`.

### 2. `packages/reformer/src/state/types.ts` — типы

`ModelSignalNode<V>` (строки 137-144) для объектной и массивной веток пересекается с `ReadonlySignal`, с
`Omit` по ключам `T`, чтобы поле формы с именем `value`/`peek`/… не давало конфликта типов (рантайм ведёт
себя так же — дети первыми):

```ts
export type ModelGroupSignals<T> = ModelSignals<T> & Omit<ReadonlySignal<T>, keyof T>;
```

Массивная ветка — аналогично, поверх существующей формы `{ readonly length; readonly [index]: … }`.
Обновить JSDoc `ModelSignals`/`ModelSignalNode` (строки 120-144) и пример в `createModel` (строки 467-482).

### 3. Маркер контейнера + `packages/reformer/src/form/behaviors.ts`

Здесь **единственный источник реальных регрессий**. `isSignal` в behaviors — duck-typing по наличию
`peek` ([behaviors.ts:139-140](../../packages/reformer/src/form/behaviors.ts#L139-L140)), и после
изменения контейнеры начнут его проходить. Последствия:

| Место | Что сломается |
|---|---|
| `enableWhen` [:332](../../packages/reformer/src/form/behaviors.ts#L332) | группа уйдёт в скалярную ветку вместо `enableGroup` → `getNodeForSignal` вернёт `undefined` (в реестре только листья) → **молча перестанет работать** |
| `nestedModel` [:182](../../packages/reformer/src/form/behaviors.ts#L182) | вложенная группа вернёт значение вместо под-модели → сломает `apply` [:607](../../packages/reformer/src/form/behaviors.ts#L607) |
| `copyFrom` [:262](../../packages/reformer/src/form/behaviors.ts#L262) | группа уйдёт в скалярную ветку → потеряется `defer`-обёртка, защищающая от «Cycle detected» |
| `readGroup`/`writeGroup` [:148,155](../../packages/reformer/src/form/behaviors.ts#L148) | `child.value = …` на read-only агрегате |

Поэтому в `signalsProxy` добавляется маркер `__kind: 'group' | 'array'` (по конвенции `__path`), а в
behaviors вводится

```ts
const isLeafSignal = (v: unknown): v is Signal<unknown> =>
  isSignal(v) && (v as { __kind?: string }).__kind === undefined;
```

и заменяет `isSignal` во **всех шести** местах. Дельта поведения — нулевая.

Маркер заодно экспортировать как публичный type-guard из `@reformer/core/state` — прикладной код
(reformer-builder) сможет отличать контейнер от листа честно, без duck-typing по `'value' in v`.

### 4. Тесты — `packages/reformer/tests/core/model/form-model.test.ts`

Новый `describe('FormModel: подписка на контейнерные узлы')`, в стиле существующих (строки 63-106):

- `model.$.subscribe(cb)` — вызов сразу с текущим значением, затем на каждое изменение любого листа;
- `model.$.inner.subscribe` — реагирует на правку листа внутри; `.value`/`.peek()` дают снимок группы;
- `model.$.tags.subscribe` — реагирует и на `push`/`removeAt`/`move`, и на правку поля элемента;
- `model.set({...})` → **один** вызов подписчика (проверка `batch`);
- идентичность: `model.$.inner === model.$.inner`, и `model.$.inner.propName === model.inner.$.propName`
  (расширение существующего теста на строке 292);
- `watchField(model.$.inner, cb)` компилируется и срабатывает — проверка структурной совместимости;
- краевой случай: поле с именем `value` затеняет `.value`, но `subscribe` продолжает работать.

Регрессионные наборы, которые обязаны остаться зелёными: `tests/behaviors/facade.test.ts` (group-`copyFrom`,
строки 128-147), `tests/behaviors/scenarios.test.ts`, `tests/behaviors/web-scenarios.test.ts`,
`tests/core/validation/form-validation-strategy.test.ts`.

### 5. Документация

- [docs/llms/19-reading-values.md](../../packages/reformer/docs/llms/19-reading-values.md) — раздел про
  подписку на группу/модель; здесь же явно пометить `model.get()` и `model.isDirty()` как **нереактивные**
  (`peek`). Сейчас этого предупреждения нет нигде, и `computed(() => model.get())` — тихий баг.
- [docs/llms/20-compute-vs-watch.md](../../packages/reformer/docs/llms/20-compute-vs-watch.md) — упомянуть
  `watchField(model.$.<группа>, cb)` как способ следить за поддеревом.
- `llms.txt` перегенерируется скриптом `npm run generate:llms` в пакете.

## Явно вне scope

- `model.subscribe` / `ModelApi.subscribe` — value-фасад не трогаем (решено).
- Запись `model.$.inner.value = {...}` — узел read-only, как и выбранный `ReadonlySignal`.
- Экспорт `eachLeafSignal` наружу и рефакторинг обходов в reformer-builder — отдельная задача; после
  этого изменения они выражаются одной подпиской, но переписывать их здесь не нужно.
- Баг `readGroup` с массивами и дыра «массивы не попадают в `GroupNode.value`» — существующие дефекты,
  этим изменением не затрагиваются.

## Верификация

```bash
# 1. Юнит-тесты ядра (vitest) — новые + регрессия behaviors/validation
cd packages/reformer && npm test

# 2. Типы: пересечение ReadonlySignal с mapped type — главный риск tsc
npx tsc --noEmit -p packages/reformer

# 3. Сборка пакета + перегенерация llms.txt
cd packages/reformer && npm run build

# 4. Потребители: renderer-react / renderer-json / builder не должны сломаться
npm run build -w @reformer/renderer-react -w @reformer/renderer-json
```

Ручная проверка в playground — панель «Модель» в reformer-builder
([LiveModelView.tsx](../../projects/reformer-builder/src/canvas/LiveModelView.tsx)) продолжает показывать
дерево значений (а не свёрнутый объект): это прямой индикатор того, что `has`-трап не начал отдавать
`'value'` и duck-typing потребителей не поехал.
