# Единая точка входа: инициализация формы одним вызовом для всех вариантов

## Контекст

Требование: **клиентский код при инициализации формы сводится к одному вызову** — независимо от
того, как форма описана (TS-компоненты, RenderSchema, JSON-схема, запись реестра форм).

Сегодня это выполнено только для реестра форм (`<FormOutlet id>`) и частично для `renderer-json`
([createJsonForm](../../packages/reformer-renderer-json/src/create-json-form.ts) собирает
`{ model, form, schema, registry }`, но render-behavior и валидацию клиент доклеивает сам).
Инвентаризация 16 примеров playground:

| Вариант | Примеров | Шагов сборки | Что повторяется в каждом |
| --- | ---: | ---: | --- |
| core / compound | 6 | 3–7 | `createModel(initial)` → `buildSchema(model)` → `createForm({model, schema, behavior})` в `useMemo`, отдельный `useMemo` под validation-config |
| renderer-react | 4 | 4–7 | то же + **двойной вызов** `buildSchema`: без `form` для `createForm`, с `form` для `createRenderSchema`, затем применение render-behavior |
| renderer-json | 6 | 3–7 | `createJsonForm(...)` + `useMemo` под render-behavior; во флагмане — ещё ручные `convertJsonToM1Tree` + `try/catch` |
| form-registry | 2 | 1 | `<FormOutlet id="…" />`, но реестр умеет только JSON-источник дерева |

Принятые решения: **семейство фабрик по таргету** (имена `createCoreForm`/`createReactForm` свободны,
`createJsonForm` остаётся как есть), **валидация входит в конфиг**, **реестр форм не расширяем**
в этот раз, **мигрируется всё** — примеры, шаблоны билдера, MCP-промпты, документация.

## Ограничения, которые задают дизайн

**Граф зависимостей:** core → ничего; cdk → core; renderer-react → core; renderer-json → core +
renderer-react; form-registry → core + renderer-json + renderer-react.

**Схема — билдер, а не объект.** M1-дерево держит в листьях сами сигналы (`value: model.$.email`),
поэтому построить его до модели нельзя. Отсюда во всех фабриках `schema: (model, form?) => …`.
Существующие билдеры примеров уже такие: `buildCreditApplicationSchema(model, form?)`.

**Двойная сборка дерева в renderer-react** — механика, а не случайность, и цена нарушения выше, чем
считалось. Проверено запуском на собранном `dist`: дерево, содержащее `FormProxy`, роняет
`createForm` с `RangeError: Maximum call stack size exceeded` — `harvestFieldConfig`
(`create-form.ts:81,119`) обходит дерево рекурсией без visited-множества, а прокси формы
самоссылочен (`GroupNode._proxyInstance`, `FormSubmitter.form`). Если же наоборот передать в рендер
дерево, собранное без формы, — ошибки не будет вовсе: визард просто получит `form === undefined` и
молча останется без источника значений. Оба конца инварианта сегодня держатся на комментарии.

**Поле, которое уже массив, не получает ноды.** `buildModelConfig` (`create-form.ts:161`) делает
`if (Array.isArray(val)) continue;`. Поэтому префилл в `file-upload` физически обязан идти **после**
`createForm` — перенос его в фазу «до» тихо убил бы поле. Это и есть доказательство, что одной фазы
`seed` недостаточно, нужна и `setup`.

**Найден баг в текущем коде** (не связанный с задачей, но она его размножит): `createFormValidation`
необратимо «травится» после `dispose()` — флаг `disposed` нигде не сбрасывается, а `start()` на нём
завязан (`validation-strategy.ts`). Проверено счётчиком прогонов: после повторного арма валидация
больше не запускается. Значит `useFormValidation` уже сегодня теряет живую стратегию в dev
(playground монтируется в `<StrictMode>`, double-invoke эффекта) и при remount по роуту. Раз новый
хук будет армить контроллер у каждой формы, чинить надо первым шагом — отдельным коммитом.

**`createForm` научить `initial` нельзя.** Его runtime-дискриминатор завязан на `model.signalAt`
(`create-form.ts:268-272`), объект `{ initial, schema }` guard не проходит и **молча** уходит в
legacy-ветку `new GroupNode`. Плюс возвращает он `FormProxy<T>`, а не бандл — поэтому новая функция.

**Пошаговая валидация переносима в core.** `defineSteps`
([define-steps.ts:84-120](../../packages/reformer-cdk/src/components/form-wizard/define-steps.ts#L84-L120))
не использует из cdk ничего — только `validateModel`, `createFormValidation`,
`defineValidationSchema`, `apply`. Значит фабрика соберёт `validateStep`/`validateAll`/
`createStepController` сама, а в cdk останется `useWizardStepValidation` (армит контроллер в
эффекте — это рендер, не сборка).

**Валидация не может быть «просто полем».** `validateModel` дедуплицирует прогоны по паре
`(model, schema)` через WeakMap — схема обязана быть стабильной ссылкой; живые стратегии требуют
`start()`/`dispose()` в эффекте и не должны стартовать при SSR. Поэтому фабрика **строит** правила и
отдаёт готовые функции + контроллер, а армит его хук.

**Бюджеты бандлов** (замер `npx size-limit`):

| Пакет | Занято | Лимит | Запас |
| --- | ---: | ---: | ---: |
| `@reformer/core` | 18 835 | 21 000 | **2 165 B — тесно** |
| `@reformer/renderer-react` | 4 210 | 10 000 | 5 790 B |
| `@reformer/renderer-json` | 5 250 | 10 000 | 4 750 B |

`createCoreForm` вместе со сборкой валидации — ориентировочно 600–900 B brotli, влезает с запасом
~1.3 kB. План Б, если не влезет: subpath `@reformer/core/setup` (инфраструктура subpath'ов в core
развита) — тогда ключ добавляется в `exports` + `vite.config.ts` + `knip.json` одновременно, иначе
падает `check:exports-dist`.

## Целевой API

Единый конфиг, единый бандл, разница только в том, что специфично для таргета.

```ts
// @reformer/core
interface CreateCoreFormConfig<T extends object> {
  initial?: T;                                     // либо initial, либо model (как в createJsonForm)
  model?: FormModel<T>;
  schema?: (model: FormModel<T>) => FormSchemaNode;
  behavior?: FormBehavior<T>;
  validation?: FormValidation<T>;                  // { schema?, steps?, extras?, strategy?, debounce? }
  seed?: (model: FormModel<T>) => void;            // фаза 1: до сборки формы
  setup?: (bundle: CoreForm<T>) => void;           // фаза 2: после сборки
}
interface CoreForm<T> {
  model: FormModel<T>;
  form: FormProxy<T>;
  validation?: {                                   // собрано из config.validation
    validate(): Promise<boolean>;                  // = validateAll
    validateStep(step: number): Promise<boolean>;
    validateAll(): Promise<boolean>;
    createStepController(step: number): FormValidationController | null;
    stepSelectors: string[];
  };
}
function createCoreForm<T extends object>(config: CreateCoreFormConfig<T>): CoreForm<T>;

// Хук стабильности — ОДИН на все пакеты (живёт в core, react у него уже peer). Ленивый useState +
// арминг живой стратегии в эффекте. В renderer-react и renderer-json экспортируется под именами
// useReactForm / useJsonForm.
function useFormBundle<B extends { validation?: { controller: FormValidationController } }>(
  factory: () => B
): B;

// @reformer/renderer-react — тот же конфиг + рендер
interface CreateReactFormConfig<T extends object> extends CreateCoreFormConfig<T> {
  schema: (model: FormModel<T>, form?: FormProxy<T>) => RenderNode<T>;   // вызывается ДВАЖДЫ внутри
  renderBehavior?: (form: FormProxy<T>, model: FormModel<T>, validation?) => RenderBehaviorFn<T>;
}
interface ReactForm<T> extends CoreForm<T> { render: RenderSchemaProxy<T>; }
function createReactForm<T extends object>(config): ReactForm<T>;
function useReactForm<T>(factory: () => ReactForm<T>): ReactForm<T>;

// @reformer/renderer-json — как сейчас + два поля
interface CreateJsonFormConfig<T> { /* … */ validation?: FormValidation<T>;
  renderBehavior?: (form, model, validation?) => RenderBehaviorFn<T>; }
interface JsonForm<T> { model; form; schema; registry; validation?; renderBehavior?: RenderBehaviorFn<T>; }
```

Тело `createReactForm` — то, ради чего всё затевается:

```ts
const model = config.model ?? createModel<T>(config.initial as T);
config.seed?.(model);                                          // фаза 1
const form = createForm<T>({ model, schema: config.schema(model), behavior: config.behavior });
const validation = buildValidation(model, config.validation);  // общая с core функция
const render = createRenderSchema<T>(() => config.schema(model, form));   // второй вызов билдера
config.renderBehavior?.(form, model, validation)(render);
const bundle = { model, form, validation, render };
config.setup?.(bundle);                                        // фаза 3 (getRef-прогрев и т.п.)
return bundle;
```

**Монтаж тоже одной строкой.** `FormRenderer` получает опциональный проп `form?: ReactForm<T>`
(приоритет `render` → `form.render`), `JsonFormRenderer` — `form.renderBehavior` как fallback для
одноимённого пропа. Тогда страница выглядит так:

```tsx
const creditForm = useReactForm(() => createReactForm<CreditApplicationForm>({
  model: createCreditApplicationModel(),
  schema: buildCreditApplicationSchema,
  behavior: creditApplicationBehavior,
  validation: creditApplicationValidation,
  renderBehavior: createCreditApplicationRenderBehavior,
}));

<FormRenderer form={creditForm} settings={{ fieldWrapper: FormField }} />
```

### Три фазы жизненного цикла

Без них миграция ломает существующие примеры (проверено по коду):

1. `seed(model)` — **до** сборки формы: `alerts-list-renderer-json` наполняет массив модели, потому
   что `onChange` не срабатывает на инициализации, а форму собирает реестр.
2. `setup(bundle)` — **после** сборки: `file-upload` патчит `model.signalAt('preloadedDocs').value`
   (фабрика узлов решает по текущему значению сигнала).
3. `setup(bundle)` в React-фабрике вызывается уже после создания `render`, поэтому покрывает и
   третий случай — прогрев `bundle.render.node(k).getRef()` до первого рендера
   (`imperative-handles`; `getRef` намеренно не бампает version-сигнал).

## Что меняется в пакетах

- **`@reformer/core`** — новые `src/form/create-core-form.ts` (`createCoreForm`),
  `src/form/validation-config.ts` (`FormValidation`, `FormValidationBundle`, `buildValidation`),
  `src/form/hooks/use-form-bundle.ts` (общий хук); правки `validation-strategy.ts` (сброс `disposed`)
  и `create-form.ts` (guard в `harvestFieldConfig`). Тип `FormValidation<T>` поднимается сюда из
  `form-registry` (там остаётся ре-экспорт). Тесты — в `tests/core/utils/` рядом с тестами
  `createForm`; помнить про пороги покрытия (statements 79 / branches 71 / functions 80 / lines 81).
- **`@reformer/renderer-react`** — `src/create-react-form.ts`, проп `form` у `FormRenderer`
  (`src/core/types.ts` + `src/core/form-renderer.tsx`), барель.
- **`@reformer/renderer-json`** — `renderBehavior` и `validation` в `createJsonForm`, fallback в
  `JsonFormRenderer` (`renderBehavior ?? form?.renderBehavior`).
- **`@reformer/form-registry`** — `FormValidation` переезжает в core (ре-экспорт), `MountedForm`
  начинает передавать `validation` в `createJsonForm` вместо ручной склейки. Расширение на не-JSON
  источники — **вне объёма**.
- **`@reformer/cdk`** — не трогаем; `defineSteps` остаётся как есть (его логика дублируется в core
  осознанно, чтобы не заводить зависимость core → cdk).

## Миграция

- **16 примеров playground** — по варианту: 6 core, 4 renderer-react, 6 renderer-json. Флагманы
  (`complex-multy-step-form*`, `mcp-credit-application-*-v20`) идут первыми как эталоны.
- **Кодогенерация билдера** — `codegen/emit-index.ts`, `emit-entry.ts`, `app/form-templates.ts`,
  `wizard-templates.ts`. Их содержимое ассертится по точным подстрокам в `form-templates.test.ts`;
  в `codegen.test.ts` содержимое `index.tsx` не проверяется вовсе — добавить ассерты заодно.
- **MCP-промпты** (`packages/reformer-mcp/src/prompts/templates/`) — `create-form.md` (боилерплейт
  строк 74–126), `add-wizard.md` (блок B3 + чеклист, где сегодня прямо предписано «no `form` prop»),
  `to-renderer-json.md`, `to-renderer.md`, `start-here.md`. Гейт `check:mcp-prompts` сборочный код не
  проверяет — расширить его список паттернов, иначе следующее расхождение снова пройдёт молча.
- **Документация пакетов** — `docs/llms/*` у core, renderer-react, renderer-json, form-registry
  (240 вхождений в 47 файлах); `llms.txt` регенерируется `npm run generate:llms` и гейтится
  `git diff --exit-code`. Каждый новый публичный символ обязан иметь JSDoc с `@example`.
- **Сайт `reformer-doc`** — `quick-start.md`, `packages/renderer-react.md`, `packages/renderer-json.md`,
  `core-concepts/**`, живые компилируемые демо в `src/components/demo/examples/*` и русская
  локаль-зеркало `i18n/ru/**`. Файлы `docs/api/**` генерирует TypeDoc — руками не трогать.

## Этапы

Каждый этап оставляет репозиторий зелёным и коммитится отдельно.

0. **Гигиена ядра — отдельным коммитом, до всего остального** (это чужие дефекты, они должны
   ревьюиться как фиксы, а не прятаться внутри рефакторинга):
   - `createFormValidation` после `dispose()` — `start()` сбрасывает `disposed`. Тест:
     `start → dispose → start` снова армит (сегодня счётчик прогонов не растёт).
   - guard в `harvestFieldConfig`: ранний выход на объекте, похожем на ноду формы
     (`typeof v.getProxy === 'function'`), + внятный dev-warn «в схему попал FormProxy — передавайте
     дерево без формы» вместо `RangeError: Maximum call stack size exceeded`. Тест на варн/бросок.
1. **core: `createCoreForm` + `useFormBundle` + `buildValidation`**, `FormValidation` переезжает в core
   (в `form-registry` остаётся ре-экспорт). Гейты: `npm test -w @reformer/core`, `coverage`,
   `size:check`, `typecheck`, `check:exports-dist`, `knip`.
2. **renderer-react: `createReactForm` + `useReactForm` + проп `form` у `FormRenderer`.**
3. **renderer-json: `validation` и `renderBehavior` в `createJsonForm`** + fallback в рендерере;
   `MountedForm` переводится на новый конфиг.
4. **Флагманы**: `complex-multy-step-form` (core), `-renderer` (react), `-renderer-json` (json).
   Гейт — e2e по трём вариантам: они гоняются одним набором спеков и цепляются за `data-testid`.
5. **Остальные примеры playground** (включая `mcp-*-v20`, `registration-*`, `html-nodes`,
   `imperative-handles`, `file-upload`, `alerts-list`, `builder-tests`).
6. **Шаблоны билдера** + их тесты (и новые ассерты на `index.tsx`).
7. **MCP-промпты** + расширение `check:mcp-prompts`.
8. **Документация**: `docs/llms/*` всех пакетов → `generate:llms` → сайт и русская локаль.

## Верификация

```bash
# по пакетам (после каждого из этапов 1-3)
npm run test -w @reformer/core && npm run coverage -w @reformer/core
npm run test -w @reformer/renderer-react
npm run test -w @reformer/renderer-json
npm run test -w @reformer/form-registry
npm run build -w @reformer/core -w @reformer/renderer-react -w @reformer/renderer-json

# инфраструктурные гейты (те же, что в CI)
npm run size:check
npm run check:exports-dist && npm run check:dist-deps && npm run check:ajv-isolation
npm run check:mcp-prompts
npm run generate:llms --workspaces && git diff --exit-code -- 'packages/*/llms.txt'
npm run typecheck && npm run lint

# приложение и примеры
npm run gen:form-schema -w react-playground
npm run test:e2e -w react-playground-e2e            # все проекты, включая три варианта флагмана
```

Ручная проверка после этапа 4: три варианта кредитной заявки (`/examples/complex`,
`/examples/complex-renderer`, `/examples/json-renderer`) проходят визард, валидация гейтит «Далее»,
условные секции и массивы работают; в консоли нет предупреждений о нестабильных ссылках.

## Риски

- **React-Compiler**: в `complex-multy-step-form-renderer-json` уже был обход
  (`preserve-manual-memoization` ломался на `try/catch` в теле `useMemo`). Новый код собирается в
  ленивом `useState`, что компилятору безразлично, но проверить сборку playground обязательно.
- **Стабильность ссылок валидации**: схемы обязаны быть module-level константами. Если фабрика
  начнёт собирать `defineValidationSchema` на каждый вызов — сломается дедупликация в
  `validateModel` (WeakMap по `(model, schema)`), и валидация станет возвращать `false` от
  отменённых прогонов. Проверяется тестом: два прогона подряд с одной схемой не должны пересобирать её.
- **Бюджет core** — 2.1 kB запаса; при промахе переходим на subpath (план Б выше).
- **Двойной вызов билдера схемы** внутри фабрики: убедиться, что второй вызов действительно получает
  `form`, а первый — нет, иначе harvest пойдёт по `FormProxy` (тест на это обязателен). Само падение
  становится диагностируемым в этапе 0 (guard + dev-warn).
- **Два контроллера валидации на одну пару `(model, schema)`** — если рядом с `validation.strategy` в
  конфиге вызвать ещё и `useFormValidation`, прогоны начнут отменять друг друга (WeakMap-дедуп) и
  submit будет возвращать `false`. Лечится dev-warn в `buildValidation` + явным абзацем в доках:
  либо конфиг фабрики, либо хук — не оба.
- **`useState(fn)` трактует функцию как ленивый инициализатор**, а `RenderSchemaProxy` сам является
  функцией: `useState(bundle.render)` вызвал бы её. Бандлы — объекты, так что путь безопасен, но в
  JSDoc это надо назвать явно.
- **Тихий разъезд документации**: `check:mcp-prompts` сегодня не видит сборочный код — без
  расширения гейта (этап 7) промпты снова разойдутся с API.
