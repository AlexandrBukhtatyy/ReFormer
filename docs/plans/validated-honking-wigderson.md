# Renderer исполняет всю форму: валидация, поведение, реестр + панель наблюдения

## Context

Пользователь сгенерировал форму билдером (шаблон даёт каталог из 7 файлов: `form.json`, `model.ts`,
`validation.ts`, `form-behavior.ts`, `render-behavior.ts`, `registry.ts`, `index.tsx`) и во вкладке
**Renderer** видит только вёрстку: поля рисуются, но правила не работают — не срабатывает `required`,
не пересчитываются вычисляемые поля, не скрываются узлы по условию.

Причина зафиксирована в коде прямым текстом: [build-preview.ts:12-13](../../projects/reformer-builder/src/preview-runtime/build-preview.ts#L12-L13)
— «Behavior/validation — не здесь (данные-only путь)». Превью собирается как
`createForm({ model, schema })` без `behavior`, `JsonFormRenderer` монтируется без `renderBehavior`,
модель сидится синтетическим моком из `$model`-путей, а не из `initialFormModel`.

**Цель:** во вкладке Renderer форма работает так же, как запустится в приложении — правила из
соседних `.ts` реально исполняются, ошибки и поведение рисует сам рендерер. Плюс вкладка внизу,
показывающая, что именно отработало.

**Почему нетривиально:** схемы валидации/поведения — это исполняемый TS-код на DSL, а не данные.
Нужны (1) транспиляция TS/JSX в браузере и (2) резолв голых импортов `@reformer/*` на **те же
инстансы**, что уже загружены в билдер — иначе получится второй инстанс `Signal` и порвётся
`getNodeForSignal` / `instanceof`.

### Отношение к предыдущему плану

[docs/plans/majestic-floating-karp.md](majestic-floating-karp.md) описывал ту же задачу и не был
реализован (`preview-runtime/live/` не существует). Его техническое ядро — module-registry / transpile /
link / sibling-sources — берём как есть. Расхождения, вытекающие из решений пользователя:

| Тема | Старый план | Здесь |
|---|---|---|
| Где живёт | новый 4-й режим `'live'` рядом с Renderer | **внутри вкладки Renderer**, тумблером; отдельного режима нет |
| Валидация | submit-узел в form.json + `validateModel` из render-behavior | `createFormValidation(model, schema, options)` — реактивные стратегии core |
| Стратегия | не рассматривалась | `export const validationOptions` в `validation.ts` — одна точка истины для превью и `index.tsx` |
| `registry.ts` формы | не исполнялся | исполняется, кладётся **поверх** реестра билдера через `composeRegistries` |
| Имена файлов | `behavior.ts`, `ui.ts` | актуальные `form-behavior.ts`, `render-behavior.ts` |
| Наблюдаемость | чипы «применено» | вкладка нижней панели: сводка · поля · лог · сборка |

Ограничение безопасности из [imperative-watching-nest.md](imperative-watching-nest.md) («никогда не
eval в main-window») касается **ИИ-сгенерированного** кода. Здесь исполняется код из каталога,
который пользователь открыл сам и всё равно собирается запускать своим Vite. Sandbox при этом
принципиально несовместим с требованием единого инстанса signals (Worker/iframe не разделяют module
graph), поэтому in-process eval за явным opt-in — осознанный tradeoff, тот же, что в §7 старого плана.

## Locked decisions

- Исполняем `model.ts`, `validation.ts`, `form-behavior.ts`, `render-behavior.ts`, `registry.ts`
  (+ то, что они импортируют внутри каталога формы, например `wizard.tsx`). `index.tsx` **не**
  исполняем — это страница с JSX, роутингом и submit'ом.
- Ошибки полей и реакции рисует сам рендерер (штатный `FIELD_WRAPPER`/`FormField`). Своего оверлея
  ошибок поверх превью не делаем.
- UI-переключателя стратегии валидации нет: стратегия берётся из кода формы.
- Реестр формы — поверх реестра билдера (палитра и плейсхолдеры неизвестных компонентов остаются рабочими).
- Транспайлер — `typescript` (`ts.transpileModule`), ленивый чанк, seam `transpileTs()` swap-абельный.

## Архитектура

### Новый слой `projects/reformer-builder/src/preview-runtime/live/`

| Модуль | Ответственность |
|---|---|
| `module-registry.ts` | Статические импорты `@reformer/core`, `/validation`, `/validators`, `/behaviors`, `/signals`, `@reformer/renderer-react`, `@reformer/renderer-json`, `@reformer/cdk`, `react`, `react/jsx-runtime` → `resolveModule(spec)`. Отдаёт коду формы **инстансы билдера** (критично для синглтона signals). `@reformer/ui-kit` резолвится в **активный кит** через существующий [kits/](../../projects/reformer-builder/src/kits/) — не в жёстко вшитый пакет. |
| `transpile.ts` | `transpileTs(code, fileName)` — ленивый `import('typescript')`, `ts.transpileModule(..., { module: CommonJS, jsx: 'react-jsx' })`. Кэш по хэшу текста. |
| `link.ts` | `evalCjsModule(js, require, fileName)` через `new Function('exports','require','module', js)`. Без blob-import и import-map. |
| `sibling-sources.ts` | `readFormSources(formPath)` — файлы каталога формы. **Приоритет: открытая Monaco `code`-вкладка (`tab.text`) → диск** (`readTextFile` из [io/fs-ops.ts](../../projects/reformer-builder/src/io/fs-ops.ts#L142)). Отсутствующий файл → `undefined`. |
| `compile-form.ts` | Граф модулей каталога с топологическим порядком (`model` → остальные), относительные импорты (`./model`, `./wizard`) резолвятся внутри каталога, голые — через `module-registry`. Каждый файл в своём try/catch → `LiveError[]` с именем файла и текстом (битый `validation.ts` не мешает `form-behavior.ts`). |
| `extract-exports.ts` | Достаёт контракт: `initialFormModel`, `formValidation`, `validationOptions`, `formBehavior`, `createRegistry`, и render-behavior в двух формах — `formRenderBehavior` (константа, простой шаблон) либо `createRenderBehavior(form, model)` (фабрика, wizard-шаблон, см. [wizard-templates.ts:232](../../projects/reformer-builder/src/app/wizard-templates.ts#L232)). Различаем по имени экспорта, не по arity. |
| `build-live-preview.ts` | `PreviewBundle` + `{ validation, renderBehavior, applied, errors }`. |
| `live-store.ts` | Публикация текущего live-бандла для панели — по образцу существующего [active-preview.ts](../../projects/reformer-builder/src/preview-runtime/active-preview.ts) (`get/set/subscribe`). |
| `event-log.ts` | Кольцевой буфер событий превью (см. «Лог» ниже). |

### Порядок сборки в `build-live-preview.ts`

Инвариант из эталонов (`registration-form-renderer-json/form-setup.ts`): `createForm` обязан
отработать **до** монтирования `JsonFormRenderer`, иначе листья рендерятся `null`.

1. **Модель:** `initialFormModel` из `model.ts` — база; `$model`-пути, которых в ней нет,
   досеиваются существующими `collectFieldDefaults`/`buildInitialValues` из
   [synth-model.ts](../../projects/reformer-builder/src/preview-runtime/synth-model.ts); правки
   пользователя из панели «Модель → Засев» кладутся сверху. Порядок: synth ← initialFormModel ← правки.
   *Форма станет стартовать пустой вместо «представительно заполненной» — это и нужно, иначе
   `required` не на чем показать.*
2. **Реестр:** `composeRegistries(buildRegistry(schema, dataSources), formRegistry)` — публичный API
   [renderer-json](../../packages/reformer-renderer-json/src/registry/component-registry.ts#L48).
   Реестр формы перекрывает базовый (last-wins), поэтому реальные компоненты и `$dataSource`
   вытесняют плейсхолдеры и моки, а всё, чего в форме нет, продолжает рисоваться.
3. **Форма:** `createForm({ model, schema: convertJsonToM1Tree(annotated, registry, model), behavior: formBehavior })`.
4. **Валидация:** `createFormValidation(model, formValidation, validationOptions)` +
   `controller.start()` в эффекте; `dispose` при пересборке. `validationOptions` отсутствует →
   дефолт core (`'submit'`). Если вместо `formValidation` найден `makeValidationConfig` (контракт
   codegen-экспорта, [emit-validation.ts](../../projects/reformer-builder/src/codegen/emit-validation.ts)) —
   реактивной стратегии нет, доступен только ручной прогон; пишем это в «Сборку».
5. **Render-behavior:** `formRenderBehavior` либо `createRenderBehavior(form, model)` → проп
   `renderBehavior` у `JsonFormRenderer`.

### Контракт `validationOptions`

Добавляется в `validation.ts` обоих шаблонов ([form-templates.ts](../../projects/reformer-builder/src/app/form-templates.ts#L81),
[wizard-templates.ts](../../projects/reformer-builder/src/app/wizard-templates.ts#L170)):

```ts
import type { ValidationStrategyOptions } from '@reformer/core';

/** Когда гонять валидацию. Читают и index.tsx, и Renderer-превью билдера. */
export const validationOptions: ValidationStrategyOptions = { strategy: 'afterFirstSubmit', debounce: 300 };
```

Чтобы это была одна точка истины, `index.tsx` шаблонов переводится на
`useFormValidation({ model, schema: formValidation, ...validationOptions })`
([use-form-validation.ts](../../packages/reformer/src/form/hooks/use-form-validation.ts)) вместо
нынешнего ручного `validateModel` в `submit`. Простой шаблон при этом теряет самописный `status`-блок
в пользу штатного потока.

### UI

- **[FloatingActions.tsx](../../projects/reformer-builder/src/canvas/FloatingActions.tsx)**: в блоке
  Renderer рядом с edit/test — тумблер «Схемы формы» с чипами применённого
  (`model · behavior · validation · ui · registry`) и кнопкой «Перезагрузить схемы». Тумблер
  disabled + подсказка, когда `tab.source.kind !== 'file'` (Mode A — соседних файлов нет).
- **Первое включение в сессии** — подтверждение «Выполнить TS-код из папки формы?» (исполняем код
  in-process); решение запоминается на сессию.
- **[CanvasArea.tsx](../../projects/reformer-builder/src/canvas/CanvasArea.tsx)**: хук
  `useLiveForm(tab)` (компиляция асинхронна: `idle → loading → ready | error`, cancel-токен) отдаёт
  бандл в `RuntimePreview` пропом. Отдельного `LiveRuntimePreview` не заводим — режим Renderer один.
- **[RuntimePreview.tsx](../../projects/reformer-builder/src/canvas/RuntimePreview.tsx)**: если пришёл
  live-бандл — используем его `registry/model/form` вместо `buildPreview` и передаём `renderBehavior`
  в `JsonFormRenderer`. Логика выделения, hover и drag-drop не меняется: класс-токены `rbnode-*`
  ставит та же `annotateSchema`.
- **Пересборка:** при смене identity `schema`, при правке текста соседней `code`-вкладки (debounce
  ~400 мс) и по кнопке. Ввод в поля превью модель **не** пересобирает.

### Панель наблюдения — вкладка «Форма»

Новое значение `BottomTab = 'raw' | 'model' | 'registry' | 'form'`
([store/types.ts](../../projects/reformer-builder/src/store/types.ts#L40)); в
[BottomPanel.tsx](../../projects/reformer-builder/src/canvas/BottomPanel.tsx) добавляется кнопка
вкладки и `SECTION['form'] = null` (не редактируется, счётчик строк и «Сбросить» скрыты).

Новый `canvas/FormStateView.tsx`: шапка-сводка + сегменты «Поля | Лог | Сборка».

| Раздел | Содержимое | Источник |
|---|---|---|
| Сводка | valid/invalid формы, число ошибок, идёт ли async-проверка, активная стратегия, кнопка «Прогнать валидацию» | `form.valid`, `form.errors`, `controller.validating`, `controller.validate()` |
| Поля | дерево путей модели: value · status · touched · dirty · disabled · ошибки с кодами правил | `getNodeForSignal(model.$.<path>)` → сигналы `valid/touched/dirty/errors/status` ([form-node.ts](../../packages/reformer/src/form/nodes/form-node.ts)) |
| Лог | лента: изменение значения, появление/исчезновение конкретной ошибки (код + путь), старт/итог прогона валидации | `effect` по листьям + diff наборов ошибок |
| Сборка | какие файлы подхвачены и исполнены, какие с ошибкой — с текстом и переходом в файл | `LiveError[]` из `compile-form.ts` |

Реактивность — тем же приёмом, что уже работает в
[LiveModelView.tsx](../../projects/reformer-builder/src/canvas/LiveModelView.tsx): `effect` из
`@preact/signals-core` читает `.value` нужных сигналов, React-рендер троттлится кадром.

**Честное ограничение:** core не отдаёт хуков «какое правило behavior сработало», поэтому лог
показывает *следствия* (какое поле изменилось, какая ошибка появилась), а не имя сработавшего
`computeFrom`/`copyFrom`. Атрибуцию «изменено вводом vs производное» берём по наличию фокуса в поле.

## Файлы

- **Новые:** `preview-runtime/live/{module-registry,transpile,link,sibling-sources,compile-form,extract-exports,build-live-preview,live-store,event-log,index}.ts`,
  `canvas/useLiveForm.ts`, `canvas/FormStateView.tsx`.
- **Правки:** `preview-runtime/build-preview.ts` (переиспользовать `buildRegistry`),
  `canvas/{RuntimePreview,CanvasArea,BottomPanel,FloatingActions}.tsx`, `store/types.ts` + редьюсер
  `setBottomTab`, `io/fs-ops.ts` (экспорт `splitPath`), `app/{form-templates,wizard-templates}.ts`
  (`validationOptions` + `useFormValidation` в `index.tsx`).
- **Переиспользовать:** `composeRegistries`, `synth-model.ts`, `annotate-schema.ts`,
  `PreviewErrorBoundary`, `active-preview.ts` как образец стора, `kits/` для резолва ui-kit.

## Фазы

- **Ф0 — plumbing.** `module-registry` + `transpile` + `link`. Проверка: `resolveModule('@reformer/core').createModel === createModel`; строка `form-behavior.ts` компилится и eval'ится в `FormBehavior`.
- **Ф1 — поведение.** `sibling-sources` + `compile-form` + `build-live-preview` (модель из `initialFormModel`, `createForm({ behavior })`) + тумблер + проброс бандла в `RuntimePreview`. **Успех:** в seed-шаблоне `greeting` пересчитывается из `name` по мере ввода.
- **Ф2 — валидация.** `validationOptions` в шаблонах, `createFormValidation` + `start()`, `index.tsx` на `useFormValidation`. **Успех:** пустой `email` подсвечивается самим рендерером по выбранной стратегии.
- **Ф3 — реестр и render-behavior.** `createRegistry()` через `composeRegistries`, `formRenderBehavior` / `createRenderBehavior`. **Успех:** wizard-форма листает шаги и валидирует шаг на своём адаптере из `wizard.tsx`.
- **Ф4 — панель «Форма».** Сводка → Поля → Сборка → Лог.
- **Ф5 — полировка.** Кэш транспиляции, пересборка по правке Monaco, size-budget на ts-чанк, чипы «применено».

## Риски

1. **Синглтон signals** — всё `@reformer/*` только через `module-registry`. Второй инстанс рвёт `instanceof Signal` / `getNodeForSignal`. Это же исключает Worker/iframe-сендбокс.
2. **`createForm` до маунта** — бандл собирается целиком до рендера `JsonFormRenderer`.
3. **Стабильность ссылок** — `formValidation` и контроллер живут на бандле; правка полей их не пересоздаёт (`validateModel` дедупит по identity `(model, schema)`).
4. **In-process eval** — только файлы открытого каталога, только после тумблера и подтверждения. Бесконечный цикл в коде формы повесит вкладку — известное ограничение.
5. **ts-чанк ~8 МБ** — грузится лениво при первом включении; при проблемах с бюджетом seam `transpileTs()` меняется на sucrase без правки остального.
6. **Расхождение контрактов** — codegen-экспорт даёт `makeValidationConfig`, шаблоны `formValidation`. Поддерживаем оба, разницу показываем в «Сборке».
7. **Смена стартовых значений** — форма перестанет открываться заполненной; в панели «Модель → Засев» правки по-прежнему выигрывают.

## Verification

- **Unit (vitest):** `transpileTs` (TS+JSX → CJS); `evalCjsModule` с фейковым `require`; `resolveModule` возвращает инстансы билдера; `compile-form` на inline-строках всех четырёх шаблонов даёт `initialFormModel`/`formValidation`/`formBehavior`; `extract-exports` различает `formRenderBehavior` и `createRenderBehavior`.
- **Integration (jsdom):** после `buildLivePreview` у `model.$.greeting` есть form-node; `model.$.name.value = 'X'` → `greeting === 'Привет, X!'`; `controller.validate()` при пустом `email` → ошибка на узле; `composeRegistries` — компонент формы перекрыл плейсхолдер.
- **E2E (Playwright, Chromium):** `showDirectoryPicker` не автоматизируется — dev-фикстура `window.__rbLiveFixture` подаёт исходники строками в обход FS. Сценарий: включить «Схемы формы» → ввести `name` → снапшот пересчитанного `greeting` → прогнать валидацию → ошибка на `email` → открыть вкладку «Форма» и снять состояние полей. Скриншоты — в `projects/react-playground-e2e/screenshots/builder-live-form/`.
- **Ручной прогон** реального пути: открыть каталог сгенерированной формы → Renderer → тумблер → правка `validation.ts` в Monaco → форма перестроилась.
