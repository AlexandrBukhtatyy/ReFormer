# Разделение ambient-контрактов: `validation/schema.ts` и `behaviors/index.ts`

## Context

Два файла собрали в себе по нескольку зон ответственности:

- **`form/validation/schema.ts`** (331 строка) — entry сабпата `@reformer/core/validation`: типы
  контракта, ambient-сток прогона, шесть операторов схемы, раннер `validateModel` со своим реестром
  состояния, плюс реэкспорт `strategy`.
- **`form/behaviors/index.ts`** (624 строки) — entry сабпата `@reformer/core/behaviors`. Тот же
  паттерн: `let current`, `requireCtx`, ambient-операторы. Шапка `schema.ts` прямо говорит, что он
  «зеркалит контракт поведения», — это два экземпляра одной конструкции, и расходиться им нельзя.

Решения пользователя: разбираем **оба сразу**; entry сабпата `/validation` становится
`validation/index.ts` — симметрично уже существующим `behaviors/index.ts` и `validators/index.ts`.

**Публичная поверхность не меняется.** `/validation` отдаёт 9 runtime-символов и 6 типов,
`/behaviors` — 19 функций и 6 типов. Все внешние потребители (cdk, renderer-react, renderer-json,
playground — 14 файлов, builder, reformer-doc, form-registry) импортируют по публичному имени
сабпата, а не по внутреннему пути, поэтому разбиение их не касается.

## Ключевое ограничение: ambient нельзя разрезать наивно

`current` — модуль-локальная переменная. После разделения на модули **прямая запись из другого
модуля невозможна**: ESM запрещает присваивание импортированной переменной, live binding доступен
только на чтение.

В двух файлах это ограничение играет по-разному:

**`behaviors` — обёртка не нужна.** Единственный писатель `current` — `defineFormBehavior.__run`
(строки 107 и 111, save/restore через `prev`). Читатель — только `requireCtx` (70, 76). Оба
остаются в одном модуле `context.ts`, наружу торчат лишь две «двери» — `onDispose` и `getScope`.
Присваивания через границу модуля не возникает.

**`validation` — обёртка обязательна.** Там писатель (`validateModel`) и читатели (операторы)
расходятся по разным файлам. Значит ambient-модуль должен инкапсулировать окно прогона:

```ts
// validation/context.ts
export function runWithContext<R>(ctx: VContext, fn: () => R): R {
  const prev = current;
  current = ctx;
  try {
    return fn();
  } finally {
    current = prev; // окно закрыто до любого await — инвариант сохраняется
  }
}
```

Раннер вместо ручного присваивания вызывает `runWithContext(ctx, () => schema({ model }))`. Это не
косметика, а единственный корректный способ разнести ambient и раннер по файлам.

**Общий риск обоих разбиений:** `current` становится состоянием отдельного модуля. Если сборка его
продублирует, операторы и раннер увидят разные `current`, и любой оператор упадёт с «вызван вне
схемы». Это ровно то, что проверяют существующие тесты — см. верификацию.

## Часть 1 — `form/validation/`

### Целевая раскладка

```
form/validation/
├── index.ts          entry сабпата: реэкспорт types + operators + run + strategy
├── types.ts          Rule · AsyncRule · ValidationSchema (+ внутренний CallableRule)   ~35
├── context.ts        VContext · requireCtx · touch · gated · runWithContext            ~55
├── operators.ts      validate · validateAsync · validateWhen · cross · each · apply    ~110
├── run.ts            defineValidationSchema · validateModel + RunState/registry        ~120
├── strategy.ts       без изменений, кроме источника импорта
├── config.ts         без изменений, кроме источника импорта
└── error-handler.ts  без изменений
```

Граф строго односторонний: `types ← context ← operators`, `types ← run → context`,
`{types, operators, run} ← index → strategy → run`.

| Файл | Что переезжает (строки текущего `schema.ts`) |
|---|---|
| `types.ts` | `CallableRule` (30), `Rule` (45), `AsyncRule` (51), `ValidationSchema` (57) |
| `context.ts` | `VContext` (63), `current` (76), `requireCtx` (78), `touch` (89), `gated` (96) + новый `runWithContext` |
| `operators.ts` | `validate` (110), `validateAsync` (133), `validateWhen` (160), `cross` (175), `each` (190), `apply` (200) |
| `run.ts` | `defineValidationSchema` (220), `RunState` (225), `stateRegistry` (231), `runStateFor` (233), `hasBlocking` (241), `whenAborted` (247), `validateModel` (283) |
| `index.ts` | шапка контракта + реэкспорты + `export * from './strategy'` (была 331) |

### Побочный эффект: разрывается взаимный цикл

Сейчас `schema.ts:331` делает `export * from './strategy'`, а `strategy.ts:24` импортирует
`validateModel` из `./schema` — взаимный цикл, помеченный в коде как «безопасный, потому что импорт
на уровне функций». После разбиения `strategy.ts` импортирует из `./run`, а реэкспортирует его
`index.ts` — цикл исчезает сам.

### Правки у импортёров

| Файл | Было | Станет |
|---|---|---|
| `validation/strategy.ts:24` | `./schema` | `./run` + `./types` |
| `validation/config.ts:18` | `./schema` | `./operators` (apply) + `./run` + `./types` |
| `form/create-core-form.ts:28` | `./validation/schema` | `./validation` |
| `platforms/react/hooks/use-form-validation.ts:4` | `…/form/validation/schema` | `…/form/validation` |

Конфиги: `vite.config.ts:33` и `knip.json:9` — путь `src/form/validation/schema.ts` →
`src/form/validation/index.ts`. `package.json` не трогается: он ссылается на `dist/validation.*`,
а имя артефакта задаёт ключ entry, который не меняется.

Тесты — 3 файла: `tests/core/validation/validate-model-schema.test.ts:14-23`,
`tests/core/validation/form-validation-strategy.test.ts:13`,
`tests/core/utils/create-core-form.test.ts:13` → переводятся на `src/form/validation`.

## Часть 2 — `form/behaviors/`

### Как файл устроен сейчас

| Секция | Строки | Объём |
|---|---|---|
| Шапка + импорты | 1-42 | 42 |
| Типы контракта | 43-57 | 15 |
| Ambient-сток + текущий scope | 58-119 | 62 |
| Низкоуровневый набор авторинга (`effect`, `defer`) | 120-133 | 14 |
| Утилиты | 134-200 | 67 |
| **Операторы** | **201-624** | **424** |

Две трети файла — одна секция, и внутри неё две разные группы: операторы над скалярным полем
(`compute` 230 … `revalidateWhen` 405) и операторы над коллекциями/под-моделями (`applyEach` 452,
`exclusiveFlag` 524, `aggregateInto` 564, `apply` 606).

### Целевая раскладка

```
form/behaviors/
├── index.ts        entry сабпата: шапка контракта + реэкспорты                 ~45
├── types.ts        BehaviorScope · FormBehavior · ChangeContext + реэкспорт    ~30
├── context.ts      RunContext · current · requireCtx · onDispose · getScope
│                   · defineFormBehavior · effect · defer                       ~85
├── internals.ts    GroupSignals · isLeafSignal · asArray · readGroup
│                   · writeGroup · makeCycleGuard · getByPath                   ~80
├── operators.ts    compute … revalidateWhen + enableGroup/nodeByPath/NodeOps   ~255
├── collections.ts  applyEach · exclusiveFlag · aggregateInto · apply
│                   + RowArray · touchValue · unmaterializedRowForm · nestedModel ~185
└── node.ts         enableWhen/disableWhen над нодой — без изменений
```

Граф: `types ← context`, `types ← internals`, `{types, context, internals} ← operators ← collections`.
Ациклично.

**Распределение 12 внутренних хелперов по потребителям** (из карты зависимостей):

- в `internals.ts` — то, что не трогает ambient: `GroupSignals` (нужен обоим слоям операторов),
  `isLeafSignal`, `asArray`, `readGroup`/`writeGroup` (только `copyFrom`), `makeCycleGuard` (только
  `compute`/`computeFrom`), `getByPath` (три коллекционных оператора);
- в `operators.ts` — всё обслуживание `enableWhen`: `enableGroup` (362), `nodeByPath` (178),
  `NodeOps` (173), `EnableTarget` (336). `nodeByPath` использует `getScope`, поэтому держать его в
  `internals.ts` значило бы затащить туда зависимость от ambient — а так `internals` остаётся
  чистым;
- в `collections.ts` — спутники своих операторов: `RowArray` (499), `touchValue` (505, только
  `aggregateInto`), `unmaterializedRowForm` (417, только `applyEach`), `nestedModel` (186, только
  `apply`).

`makeCycleGuard` (211) сейчас лежит в начале секции «Операторы», но по существу это утилита — едет
в `internals.ts`.

`collections.ts` зависит от `operators.ts` — `exclusiveFlag` (535) внутри вызывает `onChange` и
`defineFormBehavior`. Это единственное ребро между двумя файлами операторов.

### Что упрощает задачу

- `behaviors/index.ts` **не реэкспортируется** ни зонтиком `src/index.ts`, ни `form/index.ts`.
  Внутри пакета на него ссылаются только два **type-only** импорта `FormBehavior`
  (`create-core-form.ts:21`, `create-form.ts:28`) — runtime-импортёров нет. Разбиение физически не
  может задеть состав зонтика.
- Ключ entry `behaviors` в `vite.config.ts` уже указывает на `src/form/behaviors/index.ts` —
  конфиги менять не придётся вовсе.
- Тесты (`tests/behaviors/*`) импортируют `../../src/form/behaviors` — путь каталога, он не
  меняется. Правок в тестах **ноль**.

### На что обратить внимание при переносе

- `/* eslint-disable @typescript-eslint/no-explicit-any */` (строка 41) стоит на весь файл —
  расставить только по тем модулям, где `any` действительно есть.
- Импорт из `../../index` (24-39) тянет символы **обоих** слоёв: 11 из model-слоя и один из
  form-слоя (`coreEnableWhen`, живёт в соседнем `node.ts`). При разбиении импорт распадётся по
  файлам — стоит проверить, что `operators.ts` не потянул лишнего.
- Разница в управлении cleanup'ами, которую легко сломать: `apply` (620) кладёт cleanup под-схемы в
  **родительский** сток через `onDispose`, а `applyEach` (479) держит cleanup'ы строк в
  **собственном** `Map` и вызывает их вручную при удалении строки. Оба живут в `collections.ts` —
  перенести как есть, не унифицируя.

## Что НЕ делаем

- **Цикл через корневой barrel.** `validation/run.ts` и `strategy.ts` будут, как и сейчас,
  импортировать `getNodeForSignal` из `../../index`, что оставляет цикл `index → form/index →
  validation/config → validation/index → index`. Разорвать его можно импортом напрямую из
  `../signal-node-registry`, но это отдельное решение со своим влиянием на чанкинг — не смешиваем
  с разбиением.
- **Унификация двух ambient-реализаций.** После разбиения `validation/context.ts` и
  `behaviors/context.ts` станут визуально похожи, но у них разные `RunContext` и разная семантика
  вложенности. Общую абстракцию не выносим.
- **`.size-limit.json` для `dist/validation.js`** — записи нет (в отличие от `index`, `validators`,
  `behaviors`, `model`). Разбиение размер не увеличит, но гейта на этот артефакт как не было, так и
  не будет. Отдельная задача.

## Верификация

**Главная проверка — тесты ambient-контракта.** Именно они падают, если модуль с `current`
продублировался при сборке:

| Тест | Что охраняет |
|---|---|
| `tests/core/validation/validate-model-schema.test.ts:221` | `validate(...)` вне `validateModel` бросает «вне схемы валидации» |
| `tests/behaviors/facade.test.ts:208-210` | `compute` / `onDispose` / `effect` вне `defineFormBehavior` бросают |
| `tests/behaviors/scenarios.test.ts:575` | то же для `compute` |

Эти же наборы подтверждают и обратное — что внутри прогона контекст виден: `scenarios.test.ts`
(S1-S23) и `web-scenarios.test.ts` (W1-W13) гоняют все 19 операторов, `validate-model-schema.test.ts`
— 8 из 9 символов сабпата.

```bash
# из корня
npm run lint
npm run format:check
npm run typecheck                      # 8 конфигов, включая консументов
npm run knip

npm test -w @reformer/core             # 808 тестов
npm run coverage -w @reformer/core     # пороги 79/71/80/81
npm run build -w @reformer/core

npm run check:exports-dist             # 27 сабпатов сходятся с dist/
npm run size                           # dist/behaviors.js ≤ 5 kB (сейчас 2.48)
git diff --exit-code -- 'packages/*/llms.txt'
```

**Состав сабпатов до и после должен совпасть** — главный инвариант. Снимки снять **до** первой
правки, иначе сравнивать будет не с чем:

```bash
cd packages/reformer/dist
node -e "import('./validation.js').then(m=>console.log(Object.keys(m).sort().join(',')))"
# ожидаем 9: apply, createFormValidation, cross, defineValidationSchema, each,
#            validate, validateAsync, validateModel, validateWhen
node -e "import('./behaviors.js').then(m=>console.log(Object.keys(m).sort().join(',')))"
# ожидаем 19 функций
cat validation.d.ts                    # export * from './form/validation/index'
```

**Смоук на собранном пакете** — проверяет, что ambient пережил бандлинг (vitest гоняет исходники,
дублирование модуля возникает именно на бандлинге):

```js
const { defineValidationSchema, validate, validateModel } = await import('./dist/validation.js');
const { createModel } = await import('./dist/index.js');
const model = createModel({ a: '' });
try { validate(model.$.a, []); throw new Error('НЕ бросил'); } catch { /* ожидаемо */ }
await validateModel(model, defineValidationSchema(({ model }) => validate(model.$.a, [])));
```

**Консументы:** собрать `@reformer/cdk` (`form-wizard/define-steps.ts` — единственный внешний
пакет, использующий `/validation` полно), `renderer-react`, `renderer-json`, затем
`projects/react-playground` (14 файлов с импортами сабпата) и `projects/reformer-builder`
(регистрирует весь namespace `/validation` в live-превью).
