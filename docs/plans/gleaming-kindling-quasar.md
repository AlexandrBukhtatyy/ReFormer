# Границы ответственности в ядре `@reformer/core`: аудит и план

## Context

Пользователь подозревает, что в ядре нарушены границы ответственности классов; пример — отправка
формы как метод объекта формы. Решения пользователя (2026-10-11): (1) нужен аудит границ по всем
модулям ядра и план правок, код не меняется до решения по каждому пункту; (2) оркестрация отправки
(прогон правил, показ замечаний, сверка значений, статус) уходит в отдельный объект ядра — бандл отдаёт
его как под-объект, но сам методом `submit` не владеет; (3) все предложения аудита приняты целиком —
сводка в разделе «Принятые решения», по пунктам — в колонке «Решение».

Состояние на момент аудита (2026-10-11): ветка `feature/core-contract-2`, коммит ReFormer-xt4x
(e6f8bbd1): `submit` сверяет модель со снимком, который видели правила, через `deepEqual` и
`deferredWritesSettled` из внутренних файлов модели.

Сверка с кодом 2026-10-15, ветка `develop`. Параллельная сессия закоммитила ещё три правки:

- 0118fc2d — сигнал `shouldShowIssues`; `run.ts` затронут только в комментарии.
- cec150ab — проверка уровня формы сначала ждёт отложенных записей поведения (`afterBehaviorWrites`).
- 5828d3ef — переход шага сверяет модель так же, как отправка; сверка вынесена в общую
  `checkForAction` ([form-level.ts:230-240](../../packages/reformer/src/form/form-level.ts#L230-L240)).

Из-за 5828d3ef сверка «модель изменилась» больше не принадлежит одной отправке. Поэтому объект
отправки получает готовую проверку для действия (`check`), а не четыре зависимости (`validate`,
`snapshot`, `settled`, `equals`), как было в первой редакции плана. `checkForAction` остаётся в уровне
формы и обслуживает и отправку, и `flow.next()`.

## Принятые решения (2026-10-11)

Пользователь принял все предложения аудита целиком.

| Тема | Решение |
| --- | --- |
| Объём | Выполняются оба этапа. Пункты E2, G1 и раздел H остаются как есть. |
| Отправка (A1) | Отдельный объект `bundle.submission` с `submit(handler)` и `submitting`; фабрика `createSubmission` с явно внедрёнными зависимостями. `bundle.submit` и `bundle.submitting` удаляются без псевдонимов. |
| Показ замечаний (A2, C3) | Опция `touch: true \| 'all'` у раннера и контроллера. Вся форма тронута только при `invalid` и `error`; `cancelled` ничего не метит; успешная отправка — как сегодня. |
| `afterFirstSubmit` (A4) | Живую фазу включает только попытка отправки, `run({ submit: true })`. `validate()`, `validateStep`, `flow.next()` нейтральны. |
| Хук `useFormValidation` (A5) | `submit()` — попытка отправки, `validate()` — нейтральная проверка. |
| Модель (A3) | `deepEqual` и `deferredWritesSettled` — публичные примитивы `@reformer/core/model`. Счётчик ревизий отвергнут. |
| Выключенные поля (A6) | Обработчик получает значения модели целиком. Не менять, описать в документации. |
| Жизненный цикл (F1) | `FormBundle.dispose()`. |
| Правила узлов схемы (E1) | Методы записи у `SchemaNodeControl` вместо прямой записи в `__overrideMaps`. |
| Реестр сигнал→нода (B1) | Правило «пишет сборка, читают валидация и поведение» и ESLint-паттерн. |
| Формулировки (D1, C2) | Правка шапок модели и валидации, без изменения кода. |
| Ожидание в раннере (C1) | Одна строка кода: микротаск раннера заменяется ожиданием `deferredWritesSettled()` — тот же примитив, что у проверки уровня формы. |

## Как слои устроены сейчас

| Слой | Что держит | Зависит от | Чем закреплено |
| --- | --- | --- | --- |
| `model/` | значения-сигналы, initial-снимок, dirty/reset, value-операции, `derived`-реестр, `runOutsideEffect` | `signals` | ESLint `no-restricted-imports`: `model ⇏ form`, `⇏ platforms`, `⇏ react` ([eslint.config.js:212-232](../../eslint.config.js#L212-L232)) |
| `form/nodes/` | UI-состояние нод (touched/dirty/disabled/issues/pending/componentProps) над сигналами модели | `model` | только `form ⇏ platforms/react` ([eslint.config.js:235-243](../../eslint.config.js#L235-L243)) |
| `form/validation/` | раннер (сбор → разнос по нодам), стратегия «когда» | `model`, реестр сигнал→нода | — |
| `form/behaviors/` | декларативные правила: значения, состояние нод, правила узлов схемы | `model`, реестр, `schema-controller`, `flow` | — |
| `form/schema/`, `schema-controller` | компиляция дерева, правила узлов по областям | `model` (фасады) | — |
| `form/flow/` | шаги, переходы; проверка шага — инъекцией | только тип `ValidationResult` | — |
| `form/form-level.ts` | правила + контроллер стратегии + `validateStep` + поток + **отправка** | всё выше, `model` внутренности | — |
| `form/form-bundle.ts` | `createForm`: модель → схема → уровень → ноды → поведение; `FormBundle extends FormLevel` | — | — |
| `platforms/react/` | хуки, контекст бандла | `form`, `model` | — |

Внутри `form/` границы ничем не закреплены: ни lint, ни тесты графа импортов. Шов между слоями —
один глобальный `WeakMap` «ручка модели → нода» ([signal-node-registry.ts:21](../../packages/reformer/src/form/signal-node-registry.ts#L21)),
который заполняет сборка и читают валидация, поведение и уровень формы.

Отправки у объекта формы (`FormGroup`/`FormNode`) нет: коммит 05113e44 убрал `submit`, `submitting`,
`validate` у группы и нод ([form-proxy-builder.ts:16-40](../../packages/reformer/src/form/form-proxy-builder.ts#L16-L40)).
Она живёт в `FormLevel` и попадает в бандл spread'ом ([form-bundle.ts:269-280](../../packages/reformer/src/form/form-bundle.ts#L269-L280)).

## Аудит: находки

Вердикты: **нарушение** — модуль делает чужую работу или тянет чужие внутренности; **спорно** — работает,
но ответственность размыта или задокументирована противоречиво; **по дизайну** — осознанный выбор,
менять не предлагается. Колонка «Решение» — решения пользователя от 2026-10-11.

### A. Отправка (пример пользователя)

| № | Где | Что | Вердикт | Предложение | Решение |
| --- | --- | --- | --- | --- | --- |
| A1 | [form-level.ts:120-122](../../packages/reformer/src/form/form-level.ts#L120-L122), [form-bundle.ts:90](../../packages/reformer/src/form/form-bundle.ts#L90) | `submit(handler)` и `submitting` — члены уровня формы и, через spread, бандла. Уровень формы одновременно: собирает правила, владеет контроллером стратегии, проверяет шаг, создаёт поток и оркестрирует отправку. | спорно → по решению пользователя выделяется | Модуль `form/submission.ts`: `createSubmission(...)` с явно внедрёнными зависимостями; `FormLevel.submission`, методы `submit`/`submitting` с уровня и бандла уходят. Детали — раздел «План, этап 1». | принято, этап 1 |
| A2 | [form-level.ts:249](../../packages/reformer/src/form/form-level.ts#L249) | При отказе отправка метит тронутыми **все** ноды через глобальный реестр (`getNodeForSignal(model.$)`) и внутреннее окно валидации `touchByValidation` (`@internal` из `validation/run.ts`). Политика показа замечаний зашита в уровень и расходится с `validateStep`, который трогает только проверенные поля. | нарушение | Политика касания — опция раннера/контроллера (`touch: true \| 'all'`), а не действие уровня; объект отправки реестра не касается. | принято, этап 1 (п. 1.3) |
| A3 | [form-level.ts:13-14](../../packages/reformer/src/form/form-level.ts#L13-L14), [model-nodes.ts:53](../../packages/reformer/src/model/model-nodes.ts#L53), [safe-effect.ts:127-150](../../packages/reformer/src/model/safe-effect.ts#L127-L150) | (коммит e6f8bbd1, xt4x) уровень тянет `deepEqual` и `deferredWritesSettled` напрямую из файлов модели, минуя `model/index.ts`; `deferredWritesSettled` — счётчик на весь рантайм, а не на модель. Шапка `model-nodes.ts` обещает, что дерево наружу не отдаётся. | нарушение | Публичный примитив модели вместо глубоких импортов — либо `revision` модели (счётчик записей), либо `deferredWritesSettled` в barrel `model/index.ts` под документированным именем. Сравнить семантику: `deepEqual` считает A→B→A «не менялось», счётчик — «менялось». | принято, этап 1: barrel-экспорт, счётчик ревизий отвергнут (п. 1.4) |
| A4 | [strategy.ts:162-165](../../packages/reformer/src/form/validation/strategy.ts#L162-L165), [form-level.ts:201-202](../../packages/reformer/src/form/form-level.ts#L201-L202) | `controller.run()` переводит `afterFirstSubmit` в живую фазу; `bundle.validate()` зовёт тот же `run()`, поэтому программная проверка без отправки считается «первой отправкой». | спорно | Опция `run({ submit: true })`, которую передаёт объект отправки; `validate()` фазу не трогает. | принято, этап 1 (п. 1.3) |
| A5 | [use-form-validation.ts:73-75](../../packages/reformer/src/platforms/react/hooks/use-form-validation.ts#L73-L75), [api-decision.ts:601-609](../../packages/reformer-mcp/src/core/decide/api-decision.ts#L601-L609) | Второй смысл слова `submit`: у хука `submit` = `controller.validate()` → `boolean`, без обработчика и `submitting`; правило MCP `submit-guard` рекомендует именно его. | спорно | У хука `submit` — попытка отправки (вся форма тронута, живая фаза), `validate` — нейтральная проверка; правило MCP переводит на объект отправки. | принято, этап 1 (п. 1.5) |
| A6 | [form-level.ts:253-260](../../packages/reformer/src/form/form-level.ts#L253-L260), [behaviors/node.ts:69-76](../../packages/reformer/src/form/behaviors/node.ts#L69-L76) | Обработчик получает `model.get()` целиком, включая выключенные поля, а проверка их пропускает; поведение документирует это как ловушку (`compute` повторяет условие `when`). | по дизайну (данные — модели) | Не менять; явно описать в документации объекта отправки. Опция «значения только включённых полей» — отдельное решение, если понадобится. | принято: не менять, описать в документации (этап 2) |

### B. Реестр сигнал→нода как скрытый канал

| № | Где | Что | Вердикт | Предложение | Решение |
| --- | --- | --- | --- | --- | --- |
| B1 | [signal-node-registry.ts:21,45](../../packages/reformer/src/form/signal-node-registry.ts#L21-L45); читатели: [run.ts:78,184,279-284](../../packages/reformer/src/form/validation/run.ts#L78), [strategy.ts:180](../../packages/reformer/src/form/validation/strategy.ts#L180), [behaviors/node.ts:98](../../packages/reformer/src/form/behaviors/node.ts#L98), [behaviors/operators.ts:209](../../packages/reformer/src/form/behaviors/operators.ts#L209), [collections.ts:101,267](../../packages/reformer/src/form/behaviors/collections.ts#L101), [form-level.ts:249](../../packages/reformer/src/form/form-level.ts#L249) | Один процесс-глобальный `WeakMap`, «последний пишущий побеждает». Через него слои меняют состояние нод, держа в руках только модель. Это и есть задуманный шов (шапка файла), но правил «кто пишет, кто читает» нет. | по дизайну, не закреплено | Зафиксировать правило: пишет только сборка (`create-form.ts`), читают валидация (разнос), поведение (state-операции) и объект отправки — нет. Закрепить ESLint-паттерном на `signal-node-registry` для `form-level.ts`/`submission.ts`. | принято, этап 2 |

### C. Валидация знает тайминг поведения и состояние нод

| № | Где | Что | Вердикт | Предложение | Решение |
| --- | --- | --- | --- | --- | --- |
| C1 | [run.ts:193-196](../../packages/reformer/src/form/validation/run.ts#L193-L196) | Раннер ждёт микротаск, «потому что `enableWhen` пишет отложенно» — знание о тайминге слоя поведения внутри валидации. | спорно | Оставить, но вынести причину в одно место: та же «дождаться отложенных записей» нужна отправке (A3). Один примитив модели, два вызывающих. | принято, этап 2 (документация) |
| C2 | [run.ts:182-188,284](../../packages/reformer/src/form/validation/run.ts#L182-L188), [strategy.ts:178-188](../../packages/reformer/src/form/validation/strategy.ts#L178-L188) | Раннер пишет `pending` и `touched` нод; стратегия `blur` читает `touches` ноды. Валидация — не «над моделью», а над формой, хотя шапка `types.ts` говорит «ни правила, ни схема ничего не знают про ноды». | по дизайну | Правила и схема нод не знают — верно; раннер и стратегия знают по определению («разнос»). Уточнить шапки `run.ts`/`strategy.ts`: разнос и триггер blur — единственные точки контакта с нодами. | принято, этап 2 (документация) |
| C3 | [run.ts:127,136-146](../../packages/reformer/src/form/validation/run.ts#L127-L146) | Модульный счётчик `touchesByValidation` — общее состояние трёх модулей (раннер, стратегия, уровень формы). | спорно | После A2 читатель остаётся один (стратегия), писатель один (раннер) — счётчик становится внутренним для `validation/`. | принято, закрывается этапом 1 |

### D. Модель принимает конфиг схемы

| № | Где | Что | Вердикт | Предложение | Решение |
| --- | --- | --- | --- | --- | --- |
| D1 | [model-value-proxy.ts:280-290](../../packages/reformer/src/model/model-value-proxy.ts#L280-L290), [model-nodes.ts:332-333,387-390](../../packages/reformer/src/model/model-nodes.ts#L387-L390), вызов [create-form.ts:221-223](../../packages/reformer/src/form/create-form.ts#L221-L223) | «Запасной шаблон — `initialValue` узла-массива схемы»: модель знает о схеме по смыслу, хотя шапки `model/index.ts:5-6` и `model-nodes.ts:113-114` обещают обратное. Импорта нет — ESLint не ловит. | спорно (семантика, не импорт) | Механизм оставить (модель принимает запасной шаблон от кого угодно), а формулировки поправить: «запасной шаблон от сборки формы», без слова «схема». `isModelFacade` ([model-value-proxy.ts:293-298](../../packages/reformer/src/model/model-value-proxy.ts#L293-L298)) — то же: описать как общий предикат. | принято, этап 2 (документация) |

### E. Поведение использует внутренние члены соседей

| № | Где | Что | Вердикт | Предложение | Решение |
| --- | --- | --- | --- | --- | --- |
| E1 | [schema-operators.ts:32-112](../../packages/reformer/src/form/behaviors/schema-operators.ts#L32-L112) против [schema-controller.ts:84-99](../../packages/reformer/src/form/schema-controller.ts#L84-L99) | `hideWhen`/`onComponentEvent`/`renderEffect`/`onMount` пишут прямо в `node.__overrideMaps` (`@internal`), при этом тип `SchemaOverrideMaps` публично экспортируется ([form/index.ts:59](../../packages/reformer/src/form/index.ts#L59)). | спорно | Дать `SchemaNodeControl` и `SchemaScope` внутренние методы записи (`addHideCondition`, `addEventHandler`, `addLifecycleHook`, `addRenderEffect`); каждый возвращает функцию снятия, операторы зовут их; `__overrideMaps` читает только рендерер. Имя `setHidden` занято принудительным скрытием. | принято, этап 2 |
| E2 | [behaviors/node.ts:50](../../packages/reformer/src/form/behaviors/node.ts#L50) | `resetOnDisable` зовёт `rawNode(node).resetToCreation()` — внутренний член ноды. | по дизайну (внутри пакета) | Оставить; `@internal` внутри одного пакета допустим. | принято: не менять |

### F. Жизненный цикл без владельца

| № | Где | Что | Вердикт | Предложение | Решение |
| --- | --- | --- | --- | --- | --- |
| F1 | [form-bundle.ts:90-94,281-289](../../packages/reformer/src/form/form-bundle.ts#L281-L289), [use-form-bundle.ts:42-43](../../packages/reformer/src/platforms/react/hooks/use-form-bundle.ts#L42-L43) | У бандла нет `dispose`; `createForm` собирает контроллер, но запускает его React-хук; при сбое `setup` сборка снимает ноды и контроллер вручную через `rawNode`. Поведение и подписки нод при размонтировании не снимаются (ReFormer-8el5). У `validateStep`/`flow.next()` идущий прогон при снятии отменить нечем (ReFormer-jefl). | нарушение | `FormBundle.dispose()`: ноды (поведение, подписки массивов), контроллер, отмена прогонов шага. Владелец вне React — тот, кто вызвал `createForm`. React-сторона (StrictMode, повторное монтирование) — по ReFormer-8el5 отдельно. | принято, этап 2 |

### G. Сборка продублирована

| № | Где | Что | Вердикт | Предложение | Решение |
| --- | --- | --- | --- | --- | --- |
| G1 | [create-react-form.ts:83-96](../../packages/reformer-renderer-react/src/create-react-form.ts#L83-L96), [create-json-form.ts:105-122](../../packages/reformer-renderer-json/src/create-json-form.ts#L105-L122), [mounted-form.tsx:101-117](../../packages/reformer-form-registry/src/react/mounted-form.tsx#L101-L117) | Порядок «модель → уровень → ноды → spread» повторён в трёх пакетах; ради этого `createFormLevel` публичен. | по дизайну (переходный период к единой сборке, ReFormer-4x21) | Не менять в этом плане. Выделение отправки проходит через `createFormLevel`, поэтому три сборки получают `submission` автоматически. | принято: не менять |

### H. Не нарушения (задокументированные решения)

- Ноды держат собственное значение создания и флаг `dirty` рядом со снимком модели
  ([form-control-node.ts:45-46,84](../../packages/reformer/src/form/nodes/form-control-node.ts#L45-L46)) — две
  точки отсчёта (`form.reset()` и `model.reset()`), семантика описана; открыт ReFormer-k152.14.
- Ноды проверяют `isDerived` при `setValue`/`reset` ([form-group-node.ts:99-117](../../packages/reformer/src/form/nodes/form-group-node.ts#L99-L117)) —
  владение значением у `compute`, закреплено коммитом a486991a.
- `FormArrayNode` зависит от `schema/row-key` ([form-array-node.ts:17](../../packages/reformer/src/form/nodes/form-array-node.ts#L17)) —
  ключ строки один для нод и рендерера.
- Скомпилированная схема держит живые фасады модели ([compile.ts:349,377](../../packages/reformer/src/form/schema/compile.ts#L349)) —
  компиляция привязана к экземпляру модели по контракту «узел держит ручку».
- Поток знает только идентификаторы шагов, проверку получает инъекцией ([flow.ts:75-80](../../packages/reformer/src/form/flow/flow.ts#L75-L80)) — чисто.
- Модель не импортирует форму; ноды не исполняют правила; `runValidation` без нод ([run.ts:247-252](../../packages/reformer/src/form/validation/run.ts#L247-L252)) — чисто.

## План, этап 1: объект отправки (решение принято)

Этап закрывает A1 и попутно A2, A3, A4, A5, C3 — без них объект отправки не получится чистым
(ему пришлось бы тянуть реестр и внутренности модели). A4 (нейтральный `validate()`) меняет
наблюдаемую семантику сверх исходного запроса; пользователь принял его вместе с остальными пунктами.

### 1.1 Новый модуль `packages/reformer/src/form/submission.ts`

Имя: `bundle.submission.submit(handler)` и `bundle.submission.submitting` — существительное-подобъект
по образцу `bundle.flow.next()`. Вариант `bundle.submit.run()` отвергнут: объект, названный глаголом,
и молчаливая смена смысла для `typeof bundle.submit === 'function'`.

```ts
// Переезжает из form-level.ts как есть, вместе с JSDoc.
export type SubmitResult<TResult> =
  | { readonly status: 'submitted'; readonly result: TResult }
  | { readonly status: 'invalid' | 'error' | 'cancelled'; readonly validation: ValidationResult }
  | { readonly status: 'failed'; readonly error: unknown };

export interface FormSubmission<T> {
  /** Идёт ли отправка: работает обработчик. */
  readonly submitting: ReadonlySignal<boolean>;
  submit<TResult>(handler: (values: T) => TResult | Promise<TResult>): Promise<SubmitResult<TResult>>;
}

/** Итог проверки для действия: результат, значения, которые видели правила, и устарели ли они. */
export interface ActionCheck<T> {
  readonly result: ValidationResult;
  readonly values: T;
  /** Проверка успешна, но модель с тех пор изменилась. */
  readonly stale: boolean;
}

/** Зависимости явные: модуль не знает ни модели, ни нод, ни реестра. */
export interface SubmissionDependencies<T> {
  /** Проверка перед отправкой; `undefined` — правил нет, обработчик получает `values()`. */
  readonly check: (() => Promise<ActionCheck<T>>) | undefined;
  /** Значения модели без проверки. */
  readonly values: () => T;
}

export function createSubmission<T>(dependencies: SubmissionDependencies<T>): FormSubmission<T>;
```

Тело `submit` — текущие строки [form-level.ts:294-317](../../packages/reformer/src/form/form-level.ts#L294-L317)
с подстановками: `checkForAction(…)` → `dependencies.check()`, `model.get()` → `dependencies.values()`.
Ветка `touchByValidation(() => getNodeForSignal(…))` удаляется — раскрытие замечаний уходит в раннер
(1.3). Импорты модуля: `@preact/signals-core` и типы валидации. Ничего из `../model/*`,
`./signal-node-registry`, `./validation/run`.

### 1.2 Композиция в `form-level.ts`, экспорты

```ts
import { deepEqual, deferredWritesSettled } from '../model/index'; // публичный barrel, см. 1.4
import { createSubmission, type FormSubmission } from './submission';
// удалить импорты: getNodeForSignal, touchByValidation; SubmitResult больше не здесь

export interface FormLevel<T> {
  readonly flow: FormFlow | undefined;
  readonly validating: ReadonlySignal<boolean>;
  readonly validation: FormValidationState<T> | undefined;
  /** Отправка: `submit(handler)` и `submitting`. */
  readonly submission: FormSubmission<T>;
  validate(): Promise<ValidationResult>;      // нейтральна: живую фазу afterFirstSubmit не включает
  validateStep(stepId: string): Promise<ValidationResult>;
}

// checkForAction остаётся здесь: ею же пользуется переход шага (validateStepToMove).
const submission = createSubmission<T>({
  check: controller
    ? () => checkForAction(() => controller.run({ touch: 'all', submit: true }))
    : undefined,
  values: () => model.get() as T,
});
```

`FormLevel.submit` и `FormLevel.submitting` удаляются (жёсткий разрыв, см. 1.8). `FormBundle<T>`
([form-bundle.ts:90](../../packages/reformer/src/form/form-bundle.ts#L90)) и `CoreForm<T>`
([form-config-base.ts:48](../../packages/reformer/src/form/form-config-base.ts#L48)) наследуют
`FormLevel` — у них меняются только JSDoc и примеры. Три сборки (`createForm`, `createReactForm`,
`createJsonForm`) получают `submission` через `createFormLevel` автоматически.

[form/index.ts](../../packages/reformer/src/form/index.ts): `export { createSubmission } from './submission'`,
типы `FormSubmission`, `SubmissionDependencies`, `ActionCheck`, `SubmitResult` — оттуда же; из списка `./form-level`
`SubmitResult` убрать. `createSubmission` публичен не ради симметрии: визарду CDK без сборки нужен тот
же объект (1.6).

### 1.3 Валидация: явная политика касания, владелец `afterFirstSubmit`

[run.ts](../../packages/reformer/src/form/validation/run.ts) — `runAndApply` (внутренний):

```ts
options?: { touch?: boolean | 'all'; skipDisabled?: boolean }
```

- `touch: true` — как сегодня: тронуты проверенные поля.
- `touch: 'all'` — проверенные поля **и**, если статус `invalid` или `error`, вся форма через корень
  реестра (`getNodeForSignal(model.$)?.markAsTouched()`) в том же окне `touchByValidation`. При `valid`
  — как `true` (сегодняшнее поведение успешной отправки сохраняется). При `cancelled` — ничего: результат
  не разносится, раскрывать нечего (меняет SS-11, см. 1.8).
- Публичные `applyValidationResult(result, { touch })` и `validateModel(model, schema, { touch })` не
  меняются: у них нет модели, чтобы найти корень. «Вся форма» — прерогатива контроллера.
- `touchByValidation`/`isTouchByValidation` остаются `@internal`; после этапа писатель один (раннер),
  читатель один (стратегия `blur`) — C3 закрыт.

[strategy.ts](../../packages/reformer/src/form/validation/strategy.ts) — контроллер:

```ts
export interface FormValidationRunOptions {
  /** Какие поля пометить тронутыми: проверенные (по умолчанию) либо вся форма при замечаниях. */
  touch?: true | 'all';
  /** Прогон — попытка отправки: переводит `afterFirstSubmit` в живую фазу. */
  submit?: boolean;
}
run(options?: FormValidationRunOptions): Promise<ValidationResult>; // submitted = true только при submit
validate(): Promise<boolean>;                                       // = run() без опций, нейтрален
```

Живую фазу `afterFirstSubmit` включает только попытка отправки: `submission.submit` сборки и `submit()`
хука `useFormValidation`. `bundle.validate()`, `validateStep`, `flow.next()` — нейтральны. Основание:
имя стратегии буквально «после первой отправки», и кнопка «Проверить» не должна молча переключать
режим формы. `validateStep` в уровне формы → `runAndApply(model, step, { touch: true, skipDisabled: true })`.

### 1.4 Модель: публичные примитивы вместо глубоких импортов

[model/index.ts](../../packages/reformer/src/model/index.ts), раздел «утилиты субстрата»:
`export { deepEqual } from './model-nodes'; export { deferredWritesSettled } from './safe-effect';`
Снять `@internal`, дописать JSDoc: `deepEqual` — то же сравнение, что у `isDirty` (NaN равен себе, Date по
времени, массивы и простые объекты поэлементно, остальное по ссылке); `deferredWritesSettled` — ждёт
только микротаски текущего тика, запись после таймера или `await` — не «тот же тик». В корневой
`src/index.ts` не добавлять. Счётчик остаётся на рантайм, а не на модель: `runOutsideEffect` — общий
планировщик, модели не знает; описать его как «отложенные записи рантайма». Счётчик на модель — вне плана.

Почему не счётчик ревизий модели: у него семантика «любая запись = изменение», и A→B→A или запись того
же значения поведением (`compute`, `copyFrom`) давали бы ложный `cancelled`. Тест
«значение изменили и вернули — submitted» ([form-level.test.ts:633](../../packages/reformer/tests/core/utils/form-level.test.ts#L633))
закрепляет именно равенство значений: обработчик получает ровно то, что видели правила.

### 1.5 Хук `useFormValidation`

[use-form-validation.ts:73-75](../../packages/reformer/src/platforms/react/hooks/use-form-validation.ts#L73-L75):
`submit` → `(await controller.run({ touch: 'all', submit: true })).status === 'valid'`; `validate` →
`controller.validate()`. Два имени делают разное и так документируются — «второй смысл submit» снят.
Тип результата (`Promise<boolean>`) не меняется.

### 1.6 Потребители

| Пакет | Правка кода | Документы |
| --- | --- | --- |
| cdk | [FormWizard.tsx:155-208](../../packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx#L155-L208): `submission = bundle?.submission ?? createSubmission({ check: undefined, values: () => form.getValue() })` в `useMemo`; `isSubmitting` и `submit` контекста — от него. Убирает дубль try/catch и заглушку `NOT_SUBMITTING`; `isSubmitting` вне сборки становится живым. Контекст и `Actions/Submit/Prev/Next` без правок. | `docs/llms/03-form-navigation.md`, `04`, `06`, `07`, `README.md` |
| ui-kit | кода нет (читает `bundle.form`/`flow`); тесты `form-wizard.test.tsx:184,226` — убрать заглушку `{ submitting }` | `01`, `02`, `05`, `06`, `07-form-wizard.md` |
| renderer-react | [form-renderer.tsx:38-43](../../packages/reformer-renderer-react/src/core/form-renderer.tsx#L38-L43): распознавать уровень по `typeof value.submission?.submit === 'function'`; тесты `create-react-form.test.tsx:111,167` | `01`, `03`, `05`, `06`, `07`, `08`, `README.md`, JSDoc `render-behavior.ts` |
| renderer-json | тесты `create-json-form.test.ts:91`, `json-form-renderer-context.test.tsx:21` | `06`, `07`, `README.md` |
| form-registry | только JSDoc (`types.ts`, `loader.ts`, `mounted-form.tsx`) | — |
| MCP | `validate/code.ts:117-122` тексты подсказок; новая эвристика-предупреждение (RF-код по образцу `rangesInside`): `.submit(` с аргументом и `.submitting` не на `submission` → «отправка переехала»; `api-decision.ts:601-609` правило `submit-guard` → объект отправки; `find-recipe.ts:114-115` тема `submission`; шаблоны `add-wizard`, `add-validation`, `add-behavior`, `start-here`, `plan-form`; eval `01-basic.json`, `05-wizard.json` | `docs/llms/05-m1-workflow.md`, `generate:llms` |
| стенды, сайт | `CreditApplicationForm.tsx:58`; `reformer-doc`: `pages/index.tsx:158`, демо `form-wizard.tsx`, `cdk-form-wizard.tsx` | `reformer-doc/docs/**` (21 файл) + `i18n/ru` (17) + `i18n/en/.../mcp/examples.md` |
| ядро, docs | — | `28-submit-and-reset`, `38-form-flow`, `33-validation-strategy` (единое правило живой фазы), `35-unified-contract`, `03-api-signatures`, `17-nonexistent-api` (+ строка таблицы `bundle.submit`/`bundle.submitting` → `bundle.submission.*`), `13`, `02`, `04`, `15`, `05`, `30`, `18`, `31`, `14`, `01`, `07`; затем `generate:llms` |

### 1.7 Тесты

- Новый `tests/core/utils/submission.test.ts`: юнит-тесты `createSubmission` на подделках зависимостей —
  матрица статусов, `submitting` только во время обработчика (и при исключении), без `validate` —
  снимок сразу и `settled`/`equals` не зовутся, ожидание `settled` до повторного снимка, `equals === false`
  → `cancelled` с `validation: { ...result, status: 'cancelled' }`, обработчик получает снимок. Нужен
  собственный минимум покрытия на файл (`coverage.per-file.json`).
- Из `form-level.test.ts` в тот же файл переезжают блоки, описывающие только отправку: «createForm —
  submit», «submit: статусы и значения», «модель изменилась, пока шла проверка», «отложенные записи того
  же тика». В `form-level.test.ts` остаются поток, `validate`/`validateStep`, `validating`, выключенные
  поля, согласие с агрегатом `valid`.
- Переименование вызовов: `submit-statuses` (31), `wizard-happy-path` (6), `live-strategies` (4),
  `conditional-branches` (4), `async-and-races` (3), `loan-form.property`, `validation-result`
  (`level.submission.submit`), `form-node-mark-as-touched`; type-тесты `loan-fixture`, `form-bundle.type-test`,
  `hooks.type-test`; `public-entries.type-test` — новые символы.
- SS-11: ожидание `touched === false` после `cancelled`, снять «поведение под вопросом»; запись в
  `tests/integration/README.md`. Новый LS-тест: «`bundle.validate()` не включает живую фазу, `submission.submit`
  включает»; LS-07 — обновить комментарий. `form-validation-strategy*.test.ts`: там, где `validate()` ждал
  переключения фазы, — `run({ submit: true })` плюс тест «`validate()` оставляет afterFirstSubmit тихим»
  и «`run({ touch: 'all' })` метит всю форму при замечаниях, `cancelled` — ничего».
- `use-form-validation.test.tsx`: «validate не включает живую фазу, submit включает».
- Снимок публичного API (`public-api.snapshot.test.ts -u`): ожидаемый дифф — `.` +`createSubmission`,
  +`FormSubmission`, +`SubmissionDependencies`, +`ActionCheck`; `./model` +`deepEqual`, +`deferredWritesSettled`;
  `./validation` +`FormValidationRunOptions`. Любое другое отличие — ошибка.
- `tests/meta/known-defects.test.ts`: `it.fails` на xt4x больше нет (SS-09 — обычный тест после e6f8bbd1).

### 1.8 Семантика и разрыв

Меняется наблюдаемо: (1) `validate()`, `validateStep`, `flow.next()` не включают `afterFirstSubmit` —
только отправка; (2) `cancelled` не метит форму тронутой; (3) у хука `validate` ≠ `submit`. Всё остальное
(статусы, снимок, сверка, один прогон правил, касание проверенных полей) — без изменений.

Разрыв жёсткий: `bundle.submit`/`bundle.submitting` удаляются без псевдонимов, коммит ядра —
`feat(reformer)!:` с `BREAKING CHANGE`, как в 05113e44. Псевдонимы оставили бы два входа в одно
действие, ложно-рабочий duck-typing и разъезд по трём фабрикам через `...level`. Генераторы MCP
`submit(` не печатают; рукописный код ловит подсказка.

### 1.9 Порядок

0. Выполнено к 2026-10-15: правки параллельной сессии закоммичены (0118fc2d, cec150ab, 5828d3ef).
   Перед стартом сверить статус `ReFormer-xt4x` в beads.
1. Модель: экспорт `deepEqual`, `deferredWritesSettled` (1.4).
2. Валидация: `touch: 'all'`, `FormValidationRunOptions`, нейтральный `validate()` (1.3) + тесты стратегии.
3. Форма: `submission.ts`, `form-level.ts`, `form/index.ts`, хук (1.1, 1.2, 1.5) + тесты, снимок, type-тесты.
4. Документы ядра → `generate:llms` → сборка ядра.
5. Зависимые пакеты по порядку сборки: cdk → ui-kit → renderer-react → renderer-json → form-registry.
6. MCP: подсказки, правило, шаблоны, eval, `generate:llms`, тесты.
7. Стенды, сайт (docs + i18n), e2e.

Коммиты — только по явной просьбе, по одному пакету на коммит.

## План, этап 2: остальные пункты аудита (приняты)

| Пункт | Что сделать | Объём |
| --- | --- | --- |
| F1 | `FormBundle.dispose()`: снять ноды (поведение, подписки массивов), контроллер, отменить прогоны шага; `createForm` при сбое `setup` зовёт его же. React-сторона (StrictMode) — по ReFormer-8el5. | ядро + 3 сборки, тесты утечек |
| E1 | Внутренние `SchemaNodeControl.addHideCondition/addEventHandler/addLifecycleHook` и `SchemaScope.addRenderEffect`, каждый возвращает функцию снятия; операторы поведения зовут их; `__overrideMaps` читает только рендерер. | ядро, тесты schema-operators |
| B1 | Правило «реестр заполняет сборка, читают валидация и поведение» в шапке реестра + ESLint-паттерн `no-restricted-imports` на `signal-node-registry` для `form-level.ts`, `submission.ts`, `flow/**`. | конфиг + документация |
| D1 | Переформулировать `model-nodes.ts:113-114, 332-333`, `model-value-proxy.ts:280-298`, `model/index.ts:5-6`: «запасной шаблон от сборки», без слова «схема». | документация |
| C1, C2 | Шапки `run.ts`/`strategy.ts`: разнос и триггер blur — единственные точки контакта с нодами; микротаск раннера заменяется ожиданием `deferredWritesSettled()` — тот же примитив, что у проверки уровня формы. | документация; C1 — одна строка кода |
| A6 | Описать в `28-submit-and-reset.md`: обработчик получает значения модели целиком, включая выключенные поля. | документация |

Порядок: F1 → E1 → B1 → D1 → C1/C2 → A6, после этапа 1 (B1, C1 и A6 опираются на `submission.ts` и
примитивы из п. 1.4). Каждый пункт — своя задача beads. E2, G1 и раздел H остаются как есть.

## Проверка

```bash
cd packages/reformer && npx tsc -b && node ../../scripts/run-vitest.mjs
npx vitest run -u tests/integration/public-api.snapshot.test.ts     # сверить дифф снимка с 1.7
npm run typecheck && npm run coverage && npm run build                # build = generate:llms + vite
cd ../reformer-cdk && npx tsc -b && node ../../scripts/run-vitest.mjs && npm run generate:llms
# то же: reformer-ui-kit, reformer-renderer-react, reformer-renderer-json, reformer-form-registry
cd ../reformer-mcp && npm run generate:llms && npx tsc -b && node ../../scripts/run-vitest.mjs
cd ../.. && npm run check:mcp-prompts && npm run lint && npm run typecheck && npm run format:check
cd projects/react-playground-e2e && npx playwright test                # complex-multy-step-form, 3 варианта + остальные
```

Ручная проверка: страница complex-multy-step-form в playground (три варианта) — отправка с замечаниями
раскрывает все поля, успешная отправка блокирует кнопку на время обработчика, визард CDK без сборки
показывает `isSubmitting`.

## Beads

Эпик: «Ядро: отправка формы отдельным объектом — `createSubmission` и `bundle.submission`».
Дочерние задачи (по одной на шаг 1.9): модель — примитивы; валидация — `touch: 'all'` и `submit`;
форма — `submission.ts` и `FormLevel.submission`; хук `useFormValidation`; тесты ядра и снимок API;
документы ядра; cdk; ui-kit; renderer-react; renderer-json; form-registry; MCP; стенды и сайт.
Этап 2 — второй эпик «Ядро: границы слоёв — жизненный цикл бандла, запись правил схемы, правило
реестра», по одной задаче на пункт: F1, E1, B1, D1, C1/C2, A6. Задачу F1 связать с ReFormer-8el5
(React-сторона снятия формы) и ReFormer-jefl (отмена идущего прогона шага).

## Реализация (2026-10-15)

Эпики: ReFormer-8tt0 (этап 1, 13 задач), ReFormer-r44p (этап 2, 6 задач). Код не закоммичен.

Отличия от проекта плана, возникшие при реализации:

- **Снятие бандла (F1).** Рендереры собирают форму через публичный `createFormFromModel`, а
  `dispose` ноды — внутренний. Поэтому в ядре появились `FormLevel.dispose()` (живая проверка и
  отмена идущих проверок шага) и публичная `disposeForm(form)`. `bundle.dispose()` у `createForm`,
  `createReactForm`, `createJsonForm` снимает и форму, и уровень; задаётся после `...level`.
- **Методы записи правил схемы (E1).** Объявлены `@internal` на `SchemaNodeControl` и
  `SchemaScope` и возвращают функцию снятия. `RenderSchemaProxy` из renderer-react получил
  `addRenderEffect`, потому что его функцию-схему передают в `renderEffect` ядра.
- **Окно касания.** `touchByValidation` больше не экспортируется: его открывает только раннер.
- **Отправка без проверки** сохраняет прежнюю задержку в один микротаск перед чтением значений.
- **Правило MCP `submit-guard`** рекомендует `FormSubmission`, хук `useFormValidation` — его
  альтернатива для форм без сборки. Новое предупреждение RF010 ловит `bundle.submit(` и
  `.submitting` у получателей `bundle`, `level`, `form` и имён на `Bundle`/`Form`.
- **Тесты ядра.** Общие заготовки формы «сумма и телефон» вынесены в
  `tests/core/utils/shape-form.fixture.ts`; отправка — в `submission.test.ts`, снятие — в
  `bundle-dispose.test.ts`, методы схемы — в `schema-controller.test.ts`, LS-18 — проверка без
  отправки живую фазу не включает.
