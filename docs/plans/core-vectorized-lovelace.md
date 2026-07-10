# Переписывание документации `@reformer/core` под архитектуру M1 (v6.0.0)

## Context

Модуль Core (`packages/reformer`, публикуется как `@reformer/core`) прошёл **две волны
рефакторинга** и вышел в **v6.0.0**:

- **Май 2026** — редизайн валидаторов: чистые фабрики вместо операторов; omnibus `number()`
  разбит на `isNumber/integer/multipleOf/nonNegative/nonZero`.
- **Конец июня — июль 2026** — архитектура **M1** становится единственной: слой данных
  `createModel` (источник истины значений) + `createForm({ model, schema, behavior })`; новый
  декларативный контракт behaviors (`@reformer/core/behaviors` + `defineFormBehavior`); новый
  подпуть `@reformer/core/signals`. **Удалён весь legacy**: старая система behaviors и namespace
  `behaviors`, движок `validateForm`, операторы `validate/validateAsync/validateGroup/apply`,
  `FieldPath`+navigator, хук `useHiddenCondition`, тип `FormFields`, omnibus `number()`. Рендер-слой
  ещё раньше вынесен в `@reformer/renderer-react`.

Документация Core в `projects/reformer-doc` (Docusaurus 3.9) отстала и сейчас **смешивает два
несовместимых стиля API** — часть страниц уже на M1, часть на удалённом legacy API
(`new FieldNode({value})`, `form.controls.x`, `show()/hide()`, `field.visible`, `form.valid`,
неверный импорт `@preact/signals-react`). Читатель видит противоречивые примеры, часть которых не
компилируется на v6. Кроме того, документация **не выстроена как последовательный онбординг** — нет
цельного маршрута «от установки до рекомендованных паттернов», отсутствует отдельная страница про
центральный концепт M1 — модель данных.

**Цель:** (1) спроектировать и внедрить **последовательную структуру** документации — маршрут,
плавно вводящий программиста от установки к рекомендованным паттернам; (2) привести весь контент к
единому корректному M1 API. Основной контент — на русском; примеры — статичные code-блоки.

### Решения (согласованы с пользователем)
- **Объём:** полный аудит всех страниц `coreSidebar` + перестройка структуры.
- **Каркас:** перестроить порядок/группы разделов (не только заполнить пробелы).
- **Новые страницы:** добавить ключевые — «Модель данных» (сердце M1) + рецепты в Patterns
  (массивы, submit-lifecycle, async-preload).
- **intro / packages/core:** развести роли — `packages/core` = карточка/хаб пакета,
  `intro` = концептуальное введение (философия M1, mental model).
- **Демо:** статичные ```` ```tsx ```` / ```` ```typescript ```` блоки, без live-harness.
- **Migration guide / CHANGELOG:** вне объёма.
- **Язык:** основной контент `docs/` — русский (совпадает с `defaultLocale: 'ru'`).

## Source of truth

Эталон актуального API — **[packages/reformer/docs/llms/](../../packages/reformer/docs/llms/)**
(32 рецепта, из них авто-генерится `llms.txt`). Все примеры сверять с ними и с исходниками
`packages/reformer/src/`. Соответствие тем ↔ рецептов указано в структуре ниже.

## Целевая структура документации (learning path)

Маршрут: **концепция → установка → первая форма → устройство → валидация → реактивная логика →
React → рекомендованные паттерны → справочник**. `★NEW` — новый файл; `→ llms/NN` — опорный рецепт.

```
coreSidebar
├─ packages/core            Обзор пакета (хаб): назначение, установка, что внутри, навигация
├─ intro                    Философия M1 (концепт + mental model: model → schema → form → behavior), экосистема
├─ Начало работы
│  ├─ getting-started/installation   Требования, npm i @reformer/core (+ ui-kit), подпути /validators /behaviors /signals
│  └─ getting-started/quick-start    Первая форма end-to-end (named-object схема)                → llms/02
├─ Основные концепции
│  ├─ core-concepts/reactive-state   Сигналы, @reformer/core/signals (единый рантайм), fine-grained реактивность
│  ├─ core-concepts/model ★NEW       Модель данных createModel: value-proxy vs model.$, get/patch/reset/isDirty  → llms/19
│  ├─ core-concepts/nodes            Ноды/proxy: Field/Group/Array/ModelArray, form.x, type-guards, сигналы состояния
│  └─ Схемы
│     ├─ schemas/overview            Три слоя: structure / validation / behavior                  → llms/09
│     ├─ schemas/form-schema         field-узел, вложенные группы (builder от ModelSignals), массивы { array, item } → llms/09,10
│     ├─ schemas/validation-schema   validators в узле, ModelValidator
│     ├─ schemas/behavior-schema     defineFormBehavior, createForm({ behavior })                 → llms/20
│     └─ schemas/composition         переиспользуемые builder'ы, apply / applyEach               → llms/15
├─ Валидация
│  ├─ validation/overview            фабрики в validators:[] + validateFormModel                  → llms/01
│  ├─ validation/built-in            полный список фабрик (required/min/max/email/.../даты)       → API §G
│  ├─ validation/custom              сигнатура (value, scope, root); ValidationError { severity } → API §B
│  ├─ validation/async               async-валидаторы, debounce, AbortSignal                     → llms/31,32
│  ├─ validation/validation-strategies  updateOn, validateModelSync как step-gate                 → llms/28
│  └─ validation/error-handling      ValidationError, getErrors(filter), FormErrorHandler/ErrorStrategy
├─ Behaviors
│  ├─ behaviors/overview             два surface (DSL vs примитивы), таблица операторов           → llms/20
│  ├─ behaviors/computed             compute / computeFrom, cycle-detection                       → llms/20,22
│  ├─ behaviors/conditional          enableWhen / disableWhen / resetWhen                         → llms/18,25
│  ├─ behaviors/sync                 copyFrom / syncFields / transformValue                       → llms/23,24,26
│  ├─ behaviors/watch                onChange / watchField / revalidateWhen                       → llms/11,27
│  └─ behaviors/custom               примитивы, effect/defer/onDispose/getScope, exclusiveFlag/aggregateInto
├─ Интеграция с React
│  ├─ react/hooks                    useFormControl / useFormControlValue / useArrayLength        → llms/19,21
│  └─ react/custom-fields            свои компоненты через componentProps                         → llms/16
├─ Рекомендованные паттерны
│  ├─ patterns/project-structure     организация форм в проекте (model/schema/behavior/form)      → llms/15
│  ├─ patterns/arrays ★NEW           массивы и динамические формы: item-schema, операции, агрегаты, cleanup → llms/10,12,21
│  ├─ patterns/submit-and-reset ★NEW жизненный цикл: touchAll → validateFormModel → model.get(); FormSubmitter; reset → llms/28
│  ├─ patterns/async-preload ★NEW    загрузка начальных значений и справочников (options loading) → llms/29,32
│  └─ patterns/openapi-generation    (проверить актуальность фичи; оставить/пометить)
└─ Core API Reference                typedoc (autogenerated) — НЕ трогаем
```

**Роли intro vs packages/core:** `packages/core` — хаб пакета («что за пакет, установка одной
строкой, что внутри, куда идти»); `intro` (slug `/`) — «как думать про формы в ReFormer» (философия
M1, 4 слоя, реактивность, обзор экосистемы `@reformer/core / cdk / ui-kit / renderer / mcp`).

**Опционально (nice-to-have, если останется время):** `patterns/multi-step` (wizard,
`validateModelSync` как step-gate → llms/13), `patterns/common-mistakes` (анти-паттерны →
llms/05,14,17). Не блокируют основной объём.

## Канонические правила M1 (применять единообразно)

1. **Схема — named-object верхнего уровня**, а не `{ children: [...] }`:
   ```typescript
   const schema = {
     name:  { value: model.$.name,  component: Input, validators: [required()] },
     email: { value: model.$.email, component: Input, validators: [required(), email()] },
   };
   const form = createForm<T>({ model, schema, behavior });
   ```
2. **Значения живут в модели.** `createModel<T>(initial)`; чтение вне реактивного контекста —
   `model.get()`; сигнал поля — `model.$.field`; реактивно в React — хуки.
3. **Валидаторы — чистые фабрики** из `@reformer/core/validators` в `validators: [...]` узла;
   запуск `validateFormModel(model, schema)` / headless `validateModel` / `validateModelSync`.
4. **Behaviors — `defineFormBehavior(({ model, form }) => {...})`** из `@reformer/core/behaviors`,
   подключается `createForm({ behavior })`. Различать DSL-операторы vs императивные примитивы из
   `@reformer/core` (принимают сигналы, возвращают cleanup) — llms/20.
5. **Массивы принадлежат модели**: узел `{ array: model.path, item: (itemModel) => subSchema }`;
   операции `model.path.push/removeAt/...`; реактивная длина — `useArrayLength`.
6. **React-хуки:** `useFormControl` (полное состояние), `useFormControlValue` (возвращает `T` —
   **не деструктурировать**), `useArrayLength`.

## Legacy-паттерны для полной вычистки (grep-аудит)

| Паттерн (regex) | Заменить на |
| --- | --- |
| `new FieldNode`, `new GroupNode`, `new ArrayNode` | `createModel` + `createForm({model, schema})` |
| `\.controls\.` , `form\.controls` | proxy-доступ `form.field` / `form.group.field` |
| `\.show\(\)`, `\.hide\(\)`, `\.visible` (свойство ноды) | удалить; видимость через `enableWhen`/условный рендер |
| `form\.valid`, `form\.value` (как источник submit) | `validateFormModel(model, schema)` + `model.get()` |
| `createForm\(schema\)` как рекомендуемый | `createForm({ model, schema })` |
| `{ children: \[` (как канон схемы) | named-object схема |
| `\bnumber\(` (omnibus-валидатор) | `isNumber()/integer()/min()/max()/...` |
| `validateForm\(`, `validateTree`, `applyWhen`, `ValidationRegistry` | `validateModel`/`validateFormModel` + `validators:[]` |
| `useHiddenCondition`, `BehaviorSchemaFn`, `FieldPath`, `FormFields`, `getReformerForm` | удалить (нет в v6) |
| `model\.set\(` / `ModelApi.set` (как замена значения) | `model.patch(...)` (`set` deprecated) |
| `@preact/signals-react`, `@preact/signals-core` (в примерах) | `@reformer/core/signals` |
| `AButsai` (в URL) | `AlexandrBukhtatyy` |
| `@reformer/core/?@beta`, `@beta` (в install) | `@reformer/core` (v6.0.0) |
| `export \* as behaviors`, namespace `behaviors` из `@reformer/core` | `@reformer/core/behaviors` |

## План по шагам

**Шаг 0 — трекинг.** Завести bd-issue (feature) на переписывание Core-доков (`bd`, не
TodoWrite/markdown-TODO). Отметить in_progress.

**Шаг 1 — grep-аудит.** Прогнать таблицу legacy-паттернов по `projects/reformer-doc/docs/**`,
составить точный per-page список правок (уточняет классификацию legacy vs M1).

**Шаг 2 — реструктуризация каркаса (`sidebars.ts` + новые файлы-заглушки).**
- Обновить `coreSidebar` под целевую структуру выше (порядок групп, новые id, перестановка
  `custom`↔`async` в Validation).
- Создать новые файлы: `core-concepts/model.md`, `patterns/arrays.md`,
  `patterns/submit-and-reset.md`, `patterns/async-preload.md` (frontmatter + каркас).
- Проверить, что все id в sidebar существуют (Docusaurus падает на отсутствующих).

**Шаг 3 — переписать LEGACY-страницы (полная переработка):**
- `core-concepts/reactive-state.md` — сигналы через `@reformer/core/signals`, `model.$`; убрать
  `new FieldNode`, `@preact/signals-react`, `field.visible`.
- `core-concepts/nodes.md` — ноды как результат `createForm`; сигналы состояния + методы; без
  `new`/`show`/`hide`/`visible`.
- `core-concepts/schemas/form-schema.md` — под llms/09 (field/nested/array, тип schema=`unknown`,
  proxy + type-guards).
- `validation/error-handling.md` — `ValidationError { code, message, params?, severity }`
  (`warning` не блокирует), `getErrors(filter)`, `FormErrorHandler`/`ErrorStrategy`.
- `behaviors/conditional.md` — `enableWhen/disableWhen`(+`resetOnDisable`), `resetWhen` (llms/18,25).
- `behaviors/sync.md` — `copyFrom`(+`transform`), `syncFields`, `transformValue` (llms/23,24,26).
- `react/hooks.md` — `form.field` вместо `form.controls.field`; submit через `validateFormModel`;
  **добавить `useArrayLength`**; починить StackBlitz-ссылку.

**Шаг 4 — унифицировать уже-M1 страницы (стиль + перевод на русский):**
- `packages/core.md` — превратить в хаб пакета; schema `children[]` → named-object.
- `intro.md` — концептуальное введение (философия M1, 4 слоя, экосистема); на русском.
- `getting-started/installation.md` — убрать `@beta`; подпути exports; связка с ui-kit; на русский.
- `getting-started/quick-start.md` — `children[]` → named-object; на русский (llms/02).
- `core-concepts/schemas/{overview,validation-schema,behavior-schema,composition}.md`,
  `validation/overview.md`, `behaviors/{overview,computed,watch}.md` — перевод на русский, сверка
  примеров; в `behaviors/overview` дополнить таблицу операторов
  (`compute/onChange/apply/applyEach/exclusiveFlag/aggregateInto`).

**Шаг 5 — аудит остальных страниц** (классификация уточняется на Шаге 1):
`validation/{built-in,async,custom,validation-strategies}.md`, `behaviors/custom.md`,
`react/custom-fields.md`, `patterns/{project-structure,openapi-generation}.md` — переписать по
находкам (built-in — полный список фабрик, убрать `number()`; custom — `(value, scope, root)`).

**Шаг 6 — наполнить новые страницы** (`core-concepts/model`, `patterns/arrays`,
`patterns/submit-and-reset`, `patterns/async-preload`) по опорным рецептам llms.

**Шаг 7 — сквозная сверка:** внутренние ссылки/`Next Steps` выстроены по маршруту; повторный
grep-гейт (0 legacy); сверка ключевых сниппетов 1:1 с llms.

## Файлы, которые меняем

Под `projects/reformer-doc/`:
- **`sidebars.ts`** — перестройка `coreSidebar`.
- **`docs/` (правка):** `packages/core.md`, `intro.md`,
  `getting-started/{installation,quick-start}.md`, `core-concepts/{reactive-state,nodes}.md`,
  `core-concepts/schemas/{overview,form-schema,validation-schema,behavior-schema,composition}.md`,
  `validation/{overview,built-in,async,custom,validation-strategies,error-handling}.md`,
  `behaviors/{overview,computed,conditional,sync,watch,custom}.md`,
  `react/{hooks,custom-fields}.md`, `patterns/{project-structure,openapi-generation}.md`.
- **`docs/` (новые):** `core-concepts/model.md`, `patterns/arrays.md`,
  `patterns/submit-and-reset.md`, `patterns/async-preload.md`.

## Что НЕ трогаем

- **`docs/api/**`** — авто-генерится `docusaurus-plugin-typedoc` из JSDoc
  `packages/reformer/src/index.ts`. Руками не редактировать. (Stale JSDoc типа `getReformerForm` —
  правка в `src`, отдельная опциональная задача вне объёма.)
- **`i18n/en/**`** — английские переводы отдельно, вне задачи.
- **`docs/specs/`** — read-only (CLAUDE.md); не задействовано.
- **Live-demo инфраструктура** (`src/components/demo/**`) — не подключаем на этом этапе.

## Verification

1. **Сборка:** `cd projects/reformer-doc && npm run build` — без broken-links (Docusaurus падает на
   битых внутренних ссылках и несуществующих sidebar id). При необходимости предварительно собрать
   workspace-пакеты (CI-паттерн из коммита `fd33999`).
2. **Локальный просмотр:** `npm run start`, пройти `coreSidebar` по маршруту — последовательность
   логична (установка → … → паттерны), примеры консистентны, ни одной legacy-конструкции.
3. **grep-гейт:** повторный прогон таблицы legacy-паттернов по `docs/**` → 0 совпадений (кроме явно
   помеченных контр-примеров).
4. **Сверка примеров:** ключевые сниппеты (quick-start, schema, behaviors, validation, arrays,
   submit) сопоставить 1:1 с соответствующим рецептом `packages/reformer/docs/llms/*.md`.
5. **Ссылки:** внешние ссылки → `AlexandrBukhtatyy`; install без `@beta`.

---

## Дополнение: архитектурная диаграмма M1 для intro

### Context
Введение (`intro.md`) объясняет архитектуру M1 текстом и ASCII-стрелками (Модель → Схема → Форма →
Behavior). Нужна наглядная **диаграмма классов**: ключевые интерфейсы с полями, как связаны
валидаторы и behaviors, как подвязывается `FormField`. Цель — визуально показать, как работает Core,
в разделе «Философия: архитектура M1».

### Содержание (упрощённый вариант — согласовано)
Главные блоки + 3 потока, без второстепенных полей/методов. Точные интерфейсы — из исходников
(`packages/reformer/src/core/model/types.ts`, `.../core/types/schema-node.ts`, `.../hooks/types.ts`,
`.../behaviors.ts`, `packages/reformer-ui-kit/src/components/ui/form-field.tsx`).

Блоки:
1. `createModel<T>` → **FormModel<T>** — источник истины (значения-сигналы): `$`, `get()`, `patch()`, `reset()`.
2. **schema { FormSchemaNode }** — `value: model.$.field`, `component`, `componentProps`, `validators[]` (+ кратко массивы `array/item`).
3. **Validators** (`/validators`) `required/email/min…` → `(value, scope, root)` → **ValidationError** `{ code, message }`.
4. **defineFormBehavior** (`/behaviors`) — операторы `compute/onChange/enableWhen/copyFrom` на сигналах `model.$`.
5. `createForm({ model, schema, behavior })` → **FormProxy / FieldNode** — сигналы `value/errors/valid/touched/disabled` + `setValue()/markAsTouched()`.
6. **FormField** (`@reformer/ui-kit`) `<FormField control={form.field}/>` → `useFormControl(control)` → рендер `component(componentProps)`.

Три потока (подписи стрелок): **Данные** (createModel→FormModel←schema→createForm→ноды→FormField),
**Валидация** (validators→validateFormModel→ValidationError→node.errors→FormField),
**Реактивная логика** (behavior-операторы→`model.$` сигналы→ноды→FormField).

### Формат и артефакты (согласовано)
- **Excalidraw**: исходник `.excalidraw` (редактируемый) + экспорт **SVG** для встраивания.
- **Превью для согласования**: сначала Artifact (HTML, excalidraw-подобный стиль) на claude.ai —
  показать, итерировать; после одобрения визуала — сгенерировать `.excalidraw` + SVG.
- Размещение: `projects/reformer-doc/static/img/architecture-m1.svg` + `.excalidraw`-исходник рядом.

### Шаги
1. Собрать Artifact-превью диаграммы → показать, итерировать до одобрения визуала.
2. Экспортировать финал в `static/img/architecture-m1.svg` (+ `.excalidraw` исходник).
3. Встроить в `docs/intro.md` — заменить/дополнить ASCII-flow в разделе «Философия: архитектура M1»
   через `![Архитектура M1](/img/architecture-m1.svg)`.
4. Продублировать вставку в русский слот `i18n/ru/docusaurus-plugin-content-docs/current/intro.md`
   (SVG общий; RU — основной сайт, см. правило про i18n-слоты в предыдущих секциях).

### Файлы
- `projects/reformer-doc/static/img/architecture-m1.{svg,excalidraw}` (новые).
- `projects/reformer-doc/docs/intro.md` и
  `projects/reformer-doc/i18n/ru/docusaurus-plugin-content-docs/current/intro.md` (встроить картинку).

### Verification
- `npm run build` — обе локали без broken-links/битых ассетов; SVG отображается.
- Диаграмма читается на **светлой и тёмной** теме Docusaurus (нейтральные цвета / прозрачный фон SVG).
- Встроено в обе локали (RU основная, EN fallback).
