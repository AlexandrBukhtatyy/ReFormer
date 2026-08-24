# Привести шаблоны reformer-builder к канону раскладки формы

## Context

Канон файловой раскладки формы зафиксирован в
[06-form-directory-layout.md](../../packages/reformer-mcp/docs/llms/06-form-directory-layout.md)
(отдаётся агентам через MCP `find_recipe directory-layout`; RU-зеркало —
[project-structure.md](../../projects/reformer-doc/docs/patterns/project-structure.md)).
Правило именования: файлы **плоские**, точечный префикс несут только два concern'а с двумя слоями —
`form.` (модельный слой) и `renderer.` (слой рендера). Для renderer-json набор:

```
index.tsx  types.ts  model.ts  renderer.schema.json  form.behavior.ts
renderer.behavior.ts  validation.ts  data-sources.ts  api.ts  registry.ts
```

Переименование ввёл план [mcp-staged-moonbeam.md](mcp-staged-moonbeam.md). В билдере его применили
**только к экспорту примера** (`src/codegen/` уже отдаёт `form.behavior.ts` / `renderer.behavior.ts` /
`types.ts` / `data-sources.ts` / `api.ts`), а до builtin-шаблонов оно не доехало. В итоге два
генератора билдера дают несовместимые наборы имён, и форма из шаблона не пересоздаётся экспортом без
ручного переименования.

**Что расходится с каноном сейчас:**

| генератор | файл сейчас | канон |
| --- | --- | --- |
| `src/templates/` (builtin) | `form.json` | `renderer.schema.json` |
| `src/templates/` (builtin) | `form-behavior.ts` | `form.behavior.ts` |
| `src/templates/` (builtin) | `render-behavior.ts` | `renderer.behavior.ts` |
| `src/codegen/` (экспорт) | `schema.ts` (TS-литерал) | `renderer.schema.json` |

**Решения по объёму (согласованы):**

- Правим **оба** генератора.
- **Только переименование**, состав не трогаем: `types.ts` / `data-sources.ts` / `api.ts` в
  builtin-шаблоны не добавляем — шаблон остаётся стартовой «рыбой», недостающие concern'ы
  пользователь добирает пунктом «Сгенерировать» контекстного меню.

  > **Пересмотрено 2026-08-24.** Решение отменено: без этих трёх файлов набор шаблона даёт три
  > ошибки `RF012` в `validate_form kind="layout"` — то есть билдер порождал модуль, который его же
  > канон считает неполным. Оба шаблона теперь дают полный набор (10 файлов, 11 у визарда), тип
  > формы переехал из `model.ts` в `types.ts`, справочник и submit подключены по-настоящему
  > (`registry.ts` → `data-sources.ts`, страница и `renderer.behavior.ts` → `api.ts`).
  > Пункты меню при этом тоже добавлены — «добрать concern» из этого плана осталось возможным.
- `wizard.tsx` остаётся отдельным файлом: правило канона «всё в `index.tsx`» написано про **шаги**
  формы, а это инфраструктурный адаптер к ui-kit `FormWizard`. Зафиксировать как осознанное
  отступление в docblock'е `wizard-templates.ts`.

**Побочный выигрыш от `schema.ts` → `renderer.schema.json` в codegen:** сейчас экспортированный
пример не содержит `.json` вообще, поэтому его нельзя открыть обратно в canvas билдера.
`discovery.ts:27-31` уже держит `renderer.schema.json` в `DEFAULT_FORM_SCHEMA_MARKERS` — после
правки экспортированный пример становится re-openable.

---

## 1. Builtin-шаблоны (`src/templates/` + `src/app/*-templates.ts`)

**[builtin.ts](../../projects/reformer-builder/src/templates/builtin.ts)** — `path` и `label` в
`SIMPLE_FILES` (:70, :77, :83) и `WIZARD_FILES` (:110, :120, :126). Остальные пути (`index.tsx`,
`model.ts`, `validation.ts`, `registry.ts`, `wizard.tsx`) уже каноничны.

**[form-templates.ts](../../projects/reformer-builder/src/app/form-templates.ts)** — импорты внутри
`indexTsxTemplate` (:302, :305, :307):

```ts
import rawSchema from './renderer.schema.json';
import { formBehavior } from './form.behavior';
import { formRenderBehavior } from './renderer.behavior';
```

Плюс упоминания старых имён в docblock'ах: :6, :67, :220, :224-225, :256, :261, :280, :287.

**[wizard-templates.ts](../../projects/reformer-builder/src/app/wizard-templates.ts)** — те же
импорты в `wizardIndexTsxTemplate` (:287, :290, :292) + docblock'и :4, :94, :146, :148, :228,
:272-273. В :4 добавить обоснование, почему `wizard.tsx` отступает от канона.

**[save-actions.ts](../../projects/reformer-builder/src/app/save-actions.ts):459-487** — одиночные
генераторы контекстного меню: `'form.json'` → `'renderer.schema.json'`, `'form-behavior.ts'` →
`'form.behavior.ts'`, `'render-behavior.ts'` → `'renderer.behavior.ts'`.
Подписи меню в [FilesPanel.tsx](../../projects/reformer-builder/src/panels/FilesPanel.tsx):386-398
семантические («Модель», «Поведение UI») — **менять не нужно**.

---

## 2. Live-preview runtime — принять новые имена, сохранить старые

Имена файлов зашиты в рантайм живого превью. Там уже есть механика легаси-алиасов
(`behavior.ts` / `ui.ts` — «имена ранних шаблонов билдера»); новые имена добавляются тем же
приёмом, **первыми в списке** (приоритет при коллизии).

- **[compile-form.ts](../../projects/reformer-builder/src/preview-runtime/live/compile-form.ts):40-49**
  — в `ENTRY_FILES` добавить `'form.behavior.ts'`, `'renderer.behavior.ts'`.
- **[extract-exports.ts](../../projects/reformer-builder/src/preview-runtime/live/extract-exports.ts):68-69**
  — `BEHAVIOR_FILES = ['form.behavior.ts', 'form-behavior.ts', 'behavior.ts']`,
  `RENDER_BEHAVIOR_FILES = ['renderer.behavior.ts', 'render-behavior.ts', 'ui.ts']`.
- **[build-live-preview.ts](../../projects/reformer-builder/src/preview-runtime/live/build-live-preview.ts):164**
  — метка файла в `LiveError` → `'renderer.behavior.ts'`.
- **[sibling-sources.ts](../../projects/reformer-builder/src/preview-runtime/live/sibling-sources.ts):2,49**
  — упоминания `form.json` в docblock'ах.

Резолвер импортов ломаться не должен: `resolveLocal` (`compile-form.ts:54-63`) конкатенирует
расширение к спецификатору, поэтому `./form.behavior` → `form.behavior.ts` резолвится штатно;
`isExecutable` (`sibling-sources.ts:29-33`) матчит `/\.tsx?$/` и точку в basename не различает.

---

## 3. Имя формы из имени файла схемы

**[save-actions.ts](../../projects/reformer-builder/src/app/save-actions.ts):543** —
`tab.source.name.replace(/\.(form\.)?json$/i, '') || 'form'`. С `credit.renderer.schema.json` даст
`credit.renderer.schema`, а с голым `renderer.schema.json` (как отдаёт шаблон, где имя несёт папка) —
пустую строку и папку экспорта `form`.

Починить: снимать `.json`, затем хвост `.renderer.schema` / `.form`; при пустом результате брать
**имя каталога** из `tab.source.path` и лишь потом падать в `'form'`. Второй шаг закрывает и
существующий баг с `form.json`.

**[draft-actions.ts](../../projects/reformer-builder/src/app/draft-actions.ts):44** — стартовые
имена вкладок `credit-application.form.json` / `untitled.form.json` → `*.renderer.schema.json`
(это то имя, под которым пользователь сохранит схему на диск).

---

## 4. Тексты для пользователя

- **[FormStateView.tsx](../../projects/reformer-builder/src/canvas/FormStateView.tsx):40-41** —
  «рядом с form.json должны лежать model.ts / validation.ts / form-behavior.ts».
- **[LiveSchemasControl.tsx](../../projects/reformer-builder/src/canvas/LiveSchemasControl.tsx):42,59**
  — перечисление исполняемых файлов и «рядом с form.json должны лежать .ts».

---

## 5. Экспорт примера (`src/codegen/`)

**[emit-schema.ts](../../projects/reformer-builder/src/codegen/emit-schema.ts)** — отдавать чистый
JSON вместо TS-модуля: `JSON.stringify(schema, null, 2) + '\n'`. Проставлять
`$schema: './form-schema.schema.json'` и `version: '1.0'`, если их нет в схеме из canvas, — это даёт
`confidence: 'high'` в `classifyFormSchema` (`discovery.ts:40-47`) и бейдж схемы в дереве проекта.

**[index.ts](../../projects/reformer-builder/src/codegen/index.ts):50** — путь `'schema.ts'` →
`'renderer.schema.json'` (класс остаётся `derived`).

**[emit-index.ts](../../projects/reformer-builder/src/codegen/emit-index.ts):22,29-30** и
**[emit-entry.ts](../../projects/reformer-builder/src/codegen/emit-entry.ts):28,35-36** —
`import { schema } from './schema'` → `import rawSchema from './renderer.schema.json'`; сужающий
каст `as unknown as JsonFormSchema<T>` уже есть в обоих. Целевой проект это переварит:
`projects/react-playground/tsconfig.app.json:9` держит `resolveJsonModule: true`, и эталонный
`mcp-credit-application-renderer-json-v20/index.tsx:14` импортирует схему ровно так же.

**[format.ts](../../projects/reformer-builder/src/codegen/format.ts)** — ветку под `.json`
**не добавлять**: `JSON.stringify(…, null, 2)` уже даёт канонический вид, а prettier-парсер `json`
потянул бы новый плагин (`prettier/plugins/babel`) ради нулевого эффекта. Файл просто пройдёт мимо
форматтера — это штатная ветка «неизвестное расширение».

**[emit-readme.ts](../../projects/reformer-builder/src/codegen/emit-readme.ts):52** — список
регенерируемых файлов.

`entry.ts` и `README.md` в наборе экспорта **остаются**: канон описывает concern'ы формы, а это
инфраструктура билдера (запись в `@reformer/form-registry` и инструкция по вклейке в `App.tsx`).

---

## 6. Тесты

- **[form-templates.test.ts](../../projects/reformer-builder/src/app/form-templates.test.ts):22-27**
  — ожидаемые строки импортов.
- **[codegen.test.ts](../../projects/reformer-builder/src/codegen/codegen.test.ts)** — список путей
  (:63-106); **инвертировать** `expect(files.some(f => f.path.endsWith('.json'))).toBe(false)`
  (:77) в «ровно один `.json` — `renderer.schema.json`»; `byPath('schema.ts')` (:113); файл-заглушку
  соседа в tsc-песочнице (:286) → `renderer.schema.json` + `resolveJsonModule: true` в опциях
  программы.
- **[live-form.test.ts](../../projects/reformer-builder/src/preview-runtime/live/live-form.test.ts):42-43,87,157**
  — ключи в мапе исходников каталога.
- **[builtin-compiles.test.ts](../../projects/reformer-builder/src/templates/builtin-compiles.test.ts)**
  — правок не требует (перечисляет `template.files`, `resolveJsonModule` уже включён :48), но
  именно он и есть главный гейт: гоняет `tsc` по реально сгенерированным файлам шаблона.
- **Новый регресс-тест** рядом с `builtin.ts`: набор путей каждого builtin-шаблона равен
  канонической выборке (`index.tsx`, `model.ts`, `renderer.schema.json`, `validation.ts`,
  `form.behavior.ts`, `renderer.behavior.ts`, `registry.ts` [+ `wizard.tsx` у визарда]) — дешёвый
  страж от повторного расхождения.
- **[template-actions.test.ts](../../projects/reformer-builder/src/app/template-actions.test.ts)** —
  `form.json` там используется как произвольная фикстура пользовательского файла, к builtin-шаблонам
  отношения не имеет; **не трогаем**.

Историю в `docs/brainstorms/reformer-builder.md` и `docs/plans/snoopy-squishing-quilt.md` не
переписываем. `docs/specs/` этих имён не содержит (и read-only по CLAUDE.md).

---

## Verification

```bash
cd projects/reformer-builder
npx vitest run src/templates src/codegen src/app src/preview-runtime   # включая tsc-песочницы
npm run lint && npm run build
```

Ручная проверка в UI (dev-сервер билдера, Chromium — нужен File System Access API):

1. **Шаблон.** Открыть проект → контекстное меню каталога → «Сгенерировать → Выбрать шаблон…» →
   «Пошаговая форма». Ожидается: 8 файлов с каноничными именами, `renderer.schema.json`
   автоматически открылся в canvas с бейджем схемы.
2. **Живое превью.** Вкладка Renderer: чипы подключённых артефактов показывают model / validation /
   behavior / renderBehavior / registry, панель «Сборка» пуста. Правка `form.behavior.ts` в Monaco
   отражается в превью без сохранения — значит рантайм подхватил новое имя.
3. **Легаси.** Открыть старую форму с `form-behavior.ts` / `render-behavior.ts` (например
   `projects/react-playground/src/pages/examples/builder-tests/test-01/`) — превью обязано работать
   по-прежнему.
4. **Экспорт.** «Экспорт примера» из той же формы → в папке лежит `renderer.schema.json` (не
   `schema.ts`), имя папки равно имени формы (не `form`). Скопировать папку в
   `projects/react-playground/src/pages/examples/`, вклеить сниппет из буфера в `App.tsx`,
   `npm run dev` в playground — страница рендерится.
5. **Круг замкнулся.** Открыть экспортированную папку как проект в билдере — `renderer.schema.json`
   распознан как форма (бейдж `high`), живое превью поднимается на соседних `.ts`.
