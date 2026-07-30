# Live-превью: подключение схем формы (model/validation/behavior/ui) к рендереру

## Context

Билдер генерирует «каталог формы» из пяти артефактов: `form.json` (layout, JSON), `model.ts`
(тип + начальные значения), `validation.ts` (`defineValidationSchema`), `behavior.ts`
(`defineFormBehavior`), `ui.ts` (`RenderBehaviorFn`). Сегодня runtime-превью (`ui.preview === 'runtime'`)
рендерит **только layout** `form.json` поверх пустых mock-значений — валидацию/поведение/UI-поведение
игнорирует (`build-preview.ts`: `createForm({ model, schema })` без `behavior`; `RuntimePreview.tsx`:
`JsonFormRenderer` без `renderBehavior`, `validate={false}`).

Пользователь хочет **в рантайме внутри билдера проверять поведение формы с мок-данными** — т.е.
чтобы `validation.ts`/`behavior.ts`/`ui.ts` реально применялись к живой форме.

**Почему это нетривиально:** схемы — исполняемый код (TS-функции на DSL reformer), а не данные. Чтобы
они подействовали, код должен выполниться в браузере. Препятствия: (1) это TypeScript — браузер
исполняет только JS, значит нужен strip типов = **транспиляция**; (2) файлы импортируют
`@reformer/core/*` — голые импорты в браузере не резолвятся, их нужно направить на модули reformer,
**уже загруженные в бандл билдера** (иначе получится второй инстанс `Signal` и сломается
`getNodeForSignal` / `instanceof`).

## Locked decisions

- **Исполнять реальные схемы** в браузере (не layout-only, не внешний dev-сервер).
- **Транспайлер — `typescript`** (`ts.transpileModule`): уже devDep `~5.9.3`, 0 новых зависимостей,
  ленивый ~8МБ чанк только при первом включении live. Прецедент тяжёлого клиентского тулинга есть
  (`prettier/standalone`, ajv через `import('../validate')`). Seam `transpileTs()` — swap-абельный.
- **Мок-данные**: модель сидится из `initialFormModel` (model.ts); дальше правка полей вживую +
  кнопка «Сбросить» (`model.reset()`). Bulk JSON-панель — отдельная фаза, не сейчас.
- **Валидация — средствами reformer**: без отдельной builder-кнопки. Композитный render-behavior
  подключает валидацию штатным потоком — в `wizard`-узел (`validateStep`/`validateAll`) либо в
  `submit`-узел (`onComponentEvent('onClick') → form.markAsTouched() + validateModel`), как в
  эталонах; `revalidateWhen` из behavior.ts даёт живую ревалидацию. → **Дополнить «рыбу» form.json
  submit-узлом с `selector`**, иначе валидации нечем сработать из коробки.
- **Новый третий режим превью** `'live'` («Renderer+схемы»); layout-only `'runtime'` остаётся
  дефолтом/фолбэком, не трогается.

## Runtime-рецепт (эталон)

Проверено по `packages/reformer/` и golden-примерам
`projects/react-playground/src/pages/examples/registration-form-renderer-json/form-setup.ts` (простая
форма) и `.../complex-multy-step-form-renderer-json/` (wizard):

```
model = createModel(initialData)                                  // @reformer/core — источник истины
form  = createForm({ model, schema: convertJsonToM1Tree(json, registry, model), behavior })  // поведение здесь
runValidation = () => validateModel(model, validationSchema)      // @reformer/core/validation — по требованию
<JsonRendererProvider settings={{ registry, model }}>            // модель ТОЛЬКО через provider
  <JsonFormRenderer schema={json} renderBehavior={composed} validate={false} />
```

Инварианты: `createForm` обязан отработать **до** маунта `JsonFormRenderer` (иначе листья рендерятся
`null` — `render-node.tsx:521` «No form node for signal»); `validationSchema` — стабильный `const`
(`validateModel` дедупит по identity `(model, schema)`); node-операции render-behavior требуют
`selector` на узлах.

## Architecture — новый пакет `projects/reformer-builder/src/preview-runtime/live/`

| Модуль | Ответственность |
|---|---|
| `module-registry.ts` | **Статические реальные** импорты `@reformer/core`, `/behaviors`, `/validation`, `/validators`, `/signals`, `@reformer/renderer-react`, `@reformer/renderer-json`, `@reformer/cdk`, `@reformer/ui-kit` → `resolveModule(spec)`. Заставляет Vite забандлить эти entry-points (сейчас они только в тексте `form-templates.ts`) и отдаёт пользовательскому коду **те же инстансы**, что у билдера (крит. для синглтона signals). |
| `transpile.ts` | `transpileTs(code, fileName)` — ленивый `import('typescript')`, `ts.transpileModule(..., { module: CommonJS, jsx: None })` → CJS. `import type` стирается. |
| `link.ts` | `evalCjsModule(js, requireFn, fileName)` — `new Function('exports','require','module', js)`; `require` = `resolveModule`. Без blob/import-map (бандл голых `@reformer/*` спецификаторов + второй инстанс — недопустимы). |
| `sibling-sources.ts` | `readLiveSources(formPath)` — читает `model/validation/behavior/ui.ts` рядом с form.json. **Приоритет**: открытая Monaco `code`-вкладка (`editorStore` `tab.text`) → иначе диск (`readFile` из `io/fs-access.ts` + handle из `projectStore.tree` по пути; `splitPath` экспортнуть из `io/fs-ops.ts`). Отсутствующий файл → `undefined`. |
| `compile-live-form.ts` | `compileLiveForm(sources)` → `{ modules, errors }`. Порядок: сперва `model.ts` (даёт `initialFormModel`), затем `require`-shim `(spec) => spec — './model' ? modelExports : resolveModule(spec)`. Каждый файл в своём try/catch → `LiveError[]` (битый validation.ts не мешает behavior.ts). Извлекает `initialFormModel`, `formValidation`, `formBehavior`, `formUiBehavior`. |
| `build-live-preview.ts` | `buildLivePreview(schema, modules)` → `LivePreviewBundle` (= `PreviewBundle` + `runValidation?`, `renderBehavior?`, `applied`). Модель из `initialFormModel` (мердж с synth-дефолтами для путей, которых нет в модели), `createForm({ ..., behavior })`, композиция render-behavior (см. ниже). |
| `index.ts` | barrel. |

**Композиция render-behavior** (в `build-live-preview.ts`): оборачиваем в try/catch и объединяем:
`formUiBehavior(schema)` (пользовательский) + инъекцию валидации reformer-способом:
`onInit(schema.node('wizard'), () => node.patchProps({ form, validateStep, validateAll }))` если есть
`wizard`; иначе `onComponentEvent(schema.node('submit'), 'onClick', async () => { form.markAsTouched(); await runValidation(); })`
если есть `submit`. Всё — API `@reformer/renderer-react`.

**Рефактор `build-preview.ts`**: вынести общий `buildRegistry(schema)` (текущий `defineRegistry(...)`),
чтобы live и layout-only пути строили идентичный реестр.

## UI и стор

- `store/types.ts`: `PreviewMode = 'wire' | 'runtime' | 'live'` (сейчас `'wire' | 'runtime'`; учесть
  параллельные правки стора). Редьюсер `setPreview` уже generic.
- `canvas/FloatingActions.tsx`: сегмент-переключатель → три опции **Схематичный / Renderer /
  Renderer+схемы**; «Renderer+схемы» активна только при `tab.source.kind === 'file'` (нужен каталог
  проекта); чипы применённого (`model · behavior · validation · ui`) из `bundle.applied`.
- `canvas/CanvasArea.tsx`: `ui.preview === 'live' ? <LiveRuntimePreview .../> : 'runtime' ? <RuntimePreview/> : <SchematicCanvas/>`.
- **`canvas/LiveRuntimePreview.tsx`** (новый; компиляция асинхронна — отдельно от синхронного
  `RuntimePreview`): стейт-машина `idle → loading → ready(bundle) | error` через `useEffect` с
  cancel-токеном. Пересборка при смене identity `schema` **или** явном «Перезагрузить схемы»
  (правка sibling-`.ts` в Monaco); ввод в поля модель НЕ пересобирает (identity `schema` стабильна →
  дедуп `validateModel` цел). Кнопка «Сбросить данные» → `model.reset()`. Рендер под
  `PreviewErrorBoundary`. Ошибки компиляции — не блокирующая панель над формой
  («схемы не применены: behavior.ts — …»), layout+модель всё равно рисуются.
- **Первый запуск в сессии**: подтверждение «Выполнить TS-код из папки формы?» (исполняем чужой код
  in-process).
- **«рыба» form.json** (`app/form-templates.ts`): добавить `submit`-узел (Button, `selector: 'submit'`)
  — естественный reformer-триггер валидации из коробки.

## Файлы

- Новые: `preview-runtime/live/{module-registry,transpile,link,sibling-sources,compile-live-form,build-live-preview,index}.ts`, `canvas/LiveRuntimePreview.tsx`.
- Правки: `preview-runtime/build-preview.ts` (вынести `buildRegistry`), `canvas/CanvasArea.tsx`, `canvas/FloatingActions.tsx`, `store/types.ts`, `io/fs-ops.ts` (export `splitPath`), `app/form-templates.ts` (submit-узел в form.json).
- Переиспользовать: `synth-model.ts` (`collectFieldDefaults`/`buildInitialValues` для merge-дефолтов), `io/fs-access.ts` `readFile`, `io/discovery.ts` tree/handle, `PreviewErrorBoundary`.
- Эталоны для сверки последовательности: `registration-form-renderer-json/form-setup.ts`, `complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson.tsx`.

## Phasing

- **Ф0 — plumbing**: `module-registry` (+ статические импорты) + `transpile` + `link`. Проверка: строка `behavior.ts` компилится и eval'ится в `FormBehavior`; `resolveModule('@reformer/core').createModel === createModel`.
- **Ф1 — MVP (behavior)**: `sibling-sources` (model+behavior) → `compileLiveForm` → `buildLivePreview` (модель из `initialFormModel`, `createForm({ behavior })`) → режим live + `LiveRuntimePreview`. **Успех**: seed-шаблон — `greeting` вычисляется из `name` вживую по мере ввода.
- **Ф2 — validation средствами reformer**: submit-узел в form.json + композитный render-behavior (submit/wizard → `validateModel`) + `revalidateWhen`. Успех: `required`/`email` подсвечиваются на полях по submit.
- **Ф3 — ui-behavior**: прокинуть `formUiBehavior` в `renderBehavior`; задокументировать ограничение (module-level `formUiBehavior` не замыкается на живую модель — реактивность через wizard-ref).
- **Ф4 — полировка**: пересборка по сохранению в Monaco, кэш транспиляции по хэшу текста, size-budget для ts-чанка, (опц.) JSON-панель мок-данных.

## Risks / gotchas

1. **Синглтоны (главное)**: все `@reformer/*` — через `module-registry` (инстансы билдера). Никаких blob-import/второго бандла — иначе рвётся `instanceof Signal`/`getNodeForSignal`. In-process eval обязателен из-за этого (Worker/iframe не разделяют module graph → сендбокс невозможен).
2. **createForm до рендера**: `buildLivePreview` завершает `createForm` и держит `form` на bundle до маунта `JsonFormRenderer`.
3. **Стабильный `const` валидации**: `formValidation` строится один раз на bundle; правки полей (не меняют identity `schema`) не пересобирают.
4. **Несовпадение формы модели**: пути `$model(x)` из form.json, которых нет в `initialFormModel`, досеиваются synth-дефолтами; лишние ключи безвредны.
5. **Отсутствующие sibling-файлы**: каждый опционален; нет model.ts → `synthModel`; нет behavior/validation/ui → деградация до layout+модель; отражать в чипах `applied`.
6. **Ошибки транспиляции/eval**: per-file изоляция, сбор в `LiveError[]`, показ в панели, ничего не кидается в React.
7. **Безопасность in-process eval**: чужой TS исполняется с правами приложения. Ограничено: только файлы из открытого каталога, только после явного тоггла live + подтверждения. Настоящий сендбокс несовместим с требованием синглтона (п.1) — зафиксировать как осознанный tradeoff.
8. **ui-behavior**: `formUiBehavior` не видит живую модель в замыкании — реактивные правила читают форму через wizard-ref или структурны; не пытаться инжектить модель в module-scope.
9. **ts-чанк ~8МБ**: ленивая загрузка при первом live; добавить бюджет/ignore в `.size-limit.json`.

## Verification

- **Unit (vitest/node)**: `transpileTs` (TS→CJS с `require`/`exports`); `evalCjsModule` (eval с фейковым require); `resolveModule('@reformer/core').createModel === createModel`; `compileLiveForm` на inline-строках 4 шаблонов → `formBehavior`/`formValidation`/`initialFormModel` присутствуют.
- **Integration (jsdom)**: `buildLivePreview(seedForm, compiled)` → `getNodeForSignal(model.$.greeting)` есть после `createForm`; `model.$.name.value='X'` → `model.$.greeting.value === 'Привет, X!'`; `runValidation()` при пустом email → на узле ошибка.
- **E2E (Chromium/Playwright)**: `showDirectoryPicker` — нативный жест, не автоматизируется → dev-fixture-хук (`window.__rbLiveFixture` / `?live-fixture`), подающий `LiveSources` из строк шаблонов в обход FS. Затем: включить «Renderer+схемы», ввести `name`, снапшот вычисленного `greeting`, submit → ошибка на `email`. Ручной прогон — реальный FS-путь (открыть каталог формы → live → ввод → compute+validation).
