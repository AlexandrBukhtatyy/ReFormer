# План: модуляризация `@reformer/core` — общий state-субстрат + доменные модули (form, table, …)

## Context

**Идея пользователя.** Разделить core на модули поверх единого реактивного «состояния»:
1. **state** — прокси-объект с сигналами (низкоуровневый субстрат);
2. **form** — работа с формами и их поведением поверх state;
3. будущие модули (**table** и др.), которые работают **аналогично form**: каждый добавляет свой
   доменный прокси/контроллер с логикой, которая **реагирует на изменения state и модифицирует его**.

**Ключевая находка исследования.** Эта архитектура **уже наполовину существует** — рефакторинг «M1»
(v6.0.0) де-факто расслоил core, но граница не формализована и не выражена в структуре/экспортах:

- **state-слой уже есть**: `src/signals.ts` (единственный владелец рантайма `@preact/signals-core`) +
  `src/core/model/` — `createModel<T>()` возвращает `FormModel<T>`, **ES-Proxy над plain-объектом на
  сигналах** (value-доступ `model.a.b`, escape-hatch сигналов `model.$.a` → `PathAwareSignal`,
  `ModelApi`: get/set/patch/isDirty/reset/signalAt). Зависит только от `@preact/signals-core` +
  `derived-registry`.
- **form-слой** = домен поверх state: `src/core/nodes/**` (FieldNode/GroupNode/… — touched/dirty/
  status/errors/componentProps), `src/core/utils/create-form.ts` (связывает схему с нодами **по
  идентичности сигнала**: `node.value === model.$.path`), `src/core/validation/**`, `src/behaviors.ts`
  (DSL `defineFormBehavior`: compute/copyFrom/onChange/enableWhen/applyEach/…), `src/hooks/**`.
- **шов между слоями — один объект-индирекция**: `src/core/utils/signal-node-registry.ts` =
  `WeakMap<Signal, FormNode>`. `create-form.ts` его заполняет, form-слой читает. Обратная связь
  state→form существует ровно в двух местах (`enableWhen/disableWhen` в `core/model/behaviors.ts` и
  `validateFormModel` в `validate-model.ts`) — обе через `getNodeForSignal`.

**Цель этого плана** (согласовано с пользователем):
- **Дизайн**: формализовать (а) «контракт модуля» — переиспользуемый паттерн доменного модуля над
  state, (б) дорожную карту модулей-соседей (table, query, wizard, history, persistence).
- **Исполнение (phase 0–2)**: расцепить три точки связности, реорганизовать `src/` в `src/state/**` +
  `src/form/**` с lint-границей, и выставить subpath-экспорт `@reformer/core/state`. **Новые модули в
  этом плане НЕ реализуются** — только проектируются.

**Упаковка (согласовано)**: конечная цель — **subpath-экспорты внутри `@reformer/core`**
(`/state`, `/form`, `/table`, …), barrel `.` навсегда остаётся зонтиком. Отдельные npm-пакеты — не
цель (оставлено как возможная будущая опция, если понадобится независимая установка/версионирование).

**Инвариант всех фаз, который нельзя нарушать.** Все консументы (`@reformer/cdk`, `/ui-kit`,
`/renderer-react`, `/renderer-json`, `/mcp`) импортируют из barrel `.` и из `@reformer/core/signals`
(renderer-react тянет даже `getNodeForSignal` — шов). Значит `src/index.ts` **по составу экспортов
обязан остаться байт-идентичным**, а `@preact/signals-core` — иметь ровно одного владельца рантайма.

---

## Контракт модуля (дизайн — сердце идеи)

**Доменный модуль над state-субстратом** = фабрика, которая привязывается к (или создаёт) `FormModel`
и возвращает **контроллер** из пяти категорий членов. form-модуль — эталонная реализация этого
контракта.

```ts
import type { FormModel } from '@reformer/core';
import { signal, computed, effect } from '@reformer/core/signals';

type Substrate<T> = FormModel<T>;   // .$ handles + value-proxy + ModelApi

type ModuleFactory<TState, TConfig, TCtrl extends DomainController> =
  (args: { model: Substrate<TState> } & TConfig) => TCtrl;

interface DomainController {
  // (1) ДОМЕННЫЕ СИГНАЛЫ — interaction/view-состояние, которого НЕТ в модели.
  //     form: node.touched/dirty/disabled/errors/componentProps/status
  // (2) DERIVED COMPUTED — агрегаты/производные представления над model + доменными сигналами.
  //     form: createAggregateSignals → valid/invalid/pending/errors; value = computed(...)
  // (3) КОМАНДЫ — императивные операции: пишут доменные сигналы или модель через ModelApi.
  //     form: setValue / markAsTouched / enable / disable / reset
  // (4) РЕАКТИВНЫЕ ПРАВИЛА — effect'ы, которые ЧИТАЮТ state-сигналы и ПИШУТ их обратно;
  //     запись отложена через runOutsideEffect (защита от «Cycle detected»).
  //     form: computeFrom/copyFrom/enableWhen + DSL compute/onChange/applyEach/aggregateInto
  // (5) LIFECYCLE — dispose() рвёт все effect'ы/подписки контроллера.
  dispose(): void;
}
```

Три общих механизма, которые модуль переиспользует со стороны субстрата:
- **флаг «producer-owned сигнал»** — `markDerived/isDerived/unmarkDerived`
  (`core/utils/derived-registry.ts`): правило, пишущее вычисленное значение в поле модели, помечает
  сигнал, чтобы `model.set/patch` его не затирал. Это общий **state**-механизм, не form-специфичный.
- **шов-реестр (индирекция по идентичности)** — `WeakMap<Signal, DomainNode>` по «ручке поля»
  (`core/utils/signal-node-registry.ts` — form-инстанс; паттерн обобщается на любой модуль).
- **отложенная запись** — `runOutsideEffect` (`core/utils/safe-effect.ts`): микротаск-запись, которую
  используют все реактивные правила.

**form-модуль как экземпляр контракта** (маппинг на реальные символы):

| Элемент контракта | form-инстанс | Файл |
|---|---|---|
| Фабрика `(model, config) → controller` | `createForm({ model, schema, behavior })` | `core/utils/create-form.ts` |
| Привязка по идентичности сигнала | `harvestFieldConfig`+`buildModelConfig`+`registerSignalNode` | `create-form.ts` |
| (1) Доменные сигналы | `FieldNode/GroupNode` touched/dirty/errors/status | `core/nodes/**` |
| (2) Derived computed | `createAggregateSignals`; `value=computed` | `core/utils/aggregate-signals.ts` |
| (3) Команды | setValue/markAsTouched/enable/reset | `core/nodes/*.ts` |
| (4) Реактивные правила | value-ops + DSL | `core/model/behaviors.ts`, `src/behaviors.ts` |
| (5) Lifecycle | `GroupNode.dispose()` | `core/nodes/group-node.ts` |
| Мост в React | `useFormControl` на `useSyncExternalStore` | `src/hooks/**` |

---

## Исполняемый план (phase 0–2)

Общий инвариант каждой фазы: `npm run typecheck` (root-скрипт, все пакеты) зелёный · core `vitest`
зелёный · e2e playground зелёный · список экспортов `src/index.ts` не изменился.

### Phase 0 — расцепить швы «на месте» (без переноса файлов)

Три чистых внутренних сплита, устраняющих связность, но не двигающих ничего физически:

- **0a — владение derived-registry.** Зафиксировать `core/utils/derived-registry.ts` как
  **state-owned** флаг producer-owned сигнала (он уже импортирует только `Signal`). Установить
  правило направления: **state никогда не импортирует form**. Кода почти не меняем; добавляем
  ESLint-границу (`no-restricted-imports`: state ⇏ form).
- **0b — расщепить `core/model/behaviors.ts`.** Он смешивает чистые value-ops
  (`computeFrom/copyFrom/watchField/transformValue/resetWhen/syncFields/revalidateWhen` — без шва) и
  `enableWhen/disableWhen` (импортируют `getNodeForSignal`, form-связаны). Разнести на
  `behaviors-value.ts` (state) и `behaviors-node.ts` (form). Оба реэкспортить из `core/model/index.ts`
  — **имена экспортов не меняются**.
- **0c — расщепить `validate-model.ts`.** Отделить headless-движок (`collect/walk/runTasks/
  validateModel/validateModelSync` — без шва) от роутинга в ноды (`validateFormModel`, использует
  `getNodeForSignal`). Оба остаются экспортированы из `core/model/index.ts`.

**Риск:** случайное переименование публичного символа → ломка консументов. **Митигация:** diff списка
экспортов `src/index.ts` и `core/model/index.ts` до/после (должен совпасть).

### Phase 1 — реорг в `src/state/**` и `src/form/**`

Переносим файлы по границе (паттерн один — «переместить + обновить относительные импорты + оставить
barrel как зонтик»):

- **`src/state/**`:** `signals.ts`, `derived-registry.ts`, `core/model/{form-model,types}.ts`,
  headless-движок валидации, `behaviors-value.ts`, `safe-effect.ts`, `subscription-manager.ts`.
- **`src/form/**`:** `core/nodes/**`, `create-form.ts`, `core/validation/**`, `validateFormModel`,
  `behaviors-node.ts`, `signal-node-registry.ts`, `src/behaviors.ts` (DSL), `src/hooks/**`,
  `aggregate-signals.ts`, `status-machine.ts`, `form-submitter.ts`, `form-proxy-builder.ts`,
  `node-factory.ts`.
- `src/index.ts` реэкспортит из `./state` и `./form` (зонтик неизменен). Включить ESLint-границу:
  `src/state/**` не может импортировать `src/form/**`.

**Риск:** churn импортов / случайные циклы. **Митигация:** lint-граница + smoke-тест идентичности
(`model.$.x instanceof Signal`, round-trip `markDerived → isDerived`).

### Phase 2 — выставить subpath `@reformer/core/state`

Стандартная «3-правки» проводка (как уже сделано для `/signals`, `/behaviors`, `/validators`):
1. `packages/reformer/vite.config.ts` → добавить `state: resolve('src/state/index.ts')` в
   `build.lib.entry`.
2. `packages/reformer/package.json` → добавить `"./state"` в `exports`.
3. `rollupOptions.external` **каждого** консумента → добавить `@reformer/core/state` (по образцу
   `@reformer/core/signals` в `reformer-renderer-react/vite.config.ts`).

**Правило единого рантайма:** `src/state/index.ts` реэкспортит рантайм транзитивно из `./signals`, а
barrel `.` реэкспортит state из **тех же** `src/state/**` файлов → `.` и `/state` резолвятся в один
чанк (один `derived`-WeakMap, один `facadeCache`, один `signal-node-registry`).
**Риск:** дублирующийся инстанс модуля → два WeakMap → сломанная идентичность/derived-guard.
**Митигация:** cross-entry identity-тест (пометить через `.`-путь, прочитать через `/state`-путь —
должны работать на одном реестре) + запись в `.size-limit.json` для `dist/state.js`.

> `/form` и `/table` subpath'ы выставляются позже тем же паттерном (вне объёма этого плана).

Трекинг: работу вести через `bd` (issue на каждую фазу; phase 0 блокирует 1, 1 блокирует 2) —
issues создаются на этапе реализации, не в plan-режиме.

---

## Дорожная карта модулей (только дизайн, не реализуется здесь)

Каждый модуль — экземпляр контракта выше: фабрика над `FormModel`/`ModelArray` → контроллер из
доменных сигналов (1) + derived computed (2) + команд (3) + реактивных правил (4) + `dispose` (5).

### table / data-grid (флагманский второй модуль)

`createTable({ rows: model.rows, columns, getRowKey?, pageSize?, editable? })` → `TableController`.
Не владеет данными строк (ими владеет модель, как `ModelArrayNode` делегирует своему `control`) —
владеет только view-состоянием.

- **(1) Доменные сигналы:** `sort` (мульти-сорт), `filters` (по колонкам), `page`, `pageSize`,
  `selection: Set<RowKey>`, `columnOrder`, `columnVisibility`, `editing: {rowKey,columnId}|null`.
- **(2) Derived pipeline** (`computed` из `/signals`): `filtered → sorted → paged → visibleRows`,
  `pageCount`, `allSelected`/`someSelected` (для indeterminate-чекбокса шапки). Чтение `rows.map(...)`
  и `accessor(row)` подписывается на структуру массива и на сигналы полей — как `touchValue` в
  `aggregateInto`.
- **(4) Реактивные правила** (каждая запись через `runOutsideEffect`): R1 — сбросить `page=0` при
  смене `filters` (skip первого прогона, как `watchField`); R2 — clamp `page` при сжатии набора
  (реагирует на `pageCount`); R3 — согласовать `selection` с `filtered` (убрать ключи удалённых/
  отфильтрованных строк). `toggleSelectAll()` — **команда**, не правило.
- **Inline-редактирование = form-модуль на строку** (главная демонстрация переиспользования
  субстрата): строка `rows.at(i)` → `FormModel<TRow>` со стабильной идентичностью (`facadeCache`);
  редактор поднимает per-row форму той же фабрикой, что `ModelArrayNode`
  (`createForm({ model: row, schema })`). Правки пишут в `row.$.*` — те же сигналы, что читает
  `accessor` таблицы, → таблица **живо пересортировывается/перефильтровывается без клея** (субстрат =
  шина сообщений). `commitEdit` = `validateFormModel(row, schema)`; `cancelEdit` = `row.set(snapshot)`.
- **Упаковка:** ядро таблицы зависит только от **state**; путь `editable` — от **form**; чтобы
  read-only/сортируемая таблица не тянула form-слой, редактирование держать за отдельным
  subpath/entry (`@reformer/core/table` vs `@reformer/core/table/edit`).

### Прочие модули-соседи (интересны пользователю, эскиз)

- **query / async-resource** — контроллер `{ data, status, error, isFetching }` (доменные сигналы);
  правило: рефетч при смене key-сигнала; кэш/инвалидация. Реагирует на state, пишет `data`.
- **wizard / stepper** — сейчас частично в CDK `FormWizard`; поднять как модуль: `currentStep`,
  `visited`, derived `canGoNext` из валидности формы (`validateModelSync` как gate). Реагирует на
  form-состояние.
- **history / undo-redo** — снапшоты сигналов модели (`model.get()`), правило-подписка на изменения
  строит undo-стек; команды undo/redo пишут `model.set(...)` (time-travel).
- **persistence / autosave** — правило: debounced-реакция на изменения модели → сохранение
  (localStorage/сервер); гидрация через `model.patch(...)` при загрузке.

---

## Упаковка (итог)

Конечное состояние — **subpath-экспорты** внутри `@reformer/core`: `.` (зонтик, навсегда),
`/signals` (владелец рантайма, уже есть), `/state`, `/form`, `/table` (+ будущие `/query` …). Плюсы
под нашу ситуацию: ноль ломки консументов, тривиальный единый рантайм (один пакет — один владелец
`@preact/signals-core` и один набор WeakMap), 3 правки на subpath. Минус (нет независимой установки
«только table без form») принят: при необходимости в будущем модуль можно выделить в отдельный пакет
`@reformer/<name>` тем же паттерном, сохранив `@reformer/core` зонтиком, — но это **не цель** сейчас.

---

## Верификация (end-to-end)

1. **Export-diff** — до/после phase 0 и phase 1 сравнить состав экспортов `src/index.ts` и
   `core/model/index.ts` (должен совпасть — гарантия неломки barrel).
2. **Typecheck** — `npm run typecheck` (проходит по всем 6 пакетам + playground).
3. **Unit** — core `vitest` (`packages/reformer`: `npm test`) зелёный; особенно тесты behaviors и
   validate-model (расщеплялись в phase 0).
4. **Lint-граница** — новый `no-restricted-imports` (state ⇏ form) не даёт ошибок и ловит нарушение
   (проверить негативным кейсом).
5. **Identity smoke** — тест: `createModel` из `@reformer/core` и `isDerived` из
   `@reformer/core/state` работают на **одном** реестре (пометить сигнал через один путь, увидеть через
   другой); `model.$.x instanceof Signal === true`.
6. **e2e** — `projects/react-playground-e2e` (существующие сценарии сложной формы) зелёные — доказывают,
   что form-слой поверх переорганизованного state не сломан.
7. **size-limit** — `npm run size:check`: core в пределах, добавлен entry `dist/state.js`.
