# Минималистичная (flat) раскладка формы — уточнённая схема имён + env-конфиг

## Context

MCP-сервер ReFormer теперь ведёт агента к flat minimalist раскладке формы как дефолту (задокументировано в `06-form-directory-layout.md` + reformer `15-project-structure.md` + reformer-doc + промпт `create-form`; дефолт конфигурируется env `REFORMER_FORM_LAYOUT`). Первая версия давала **всем** файлам префикс `form-` — это избыточно. По фидбегу: префикс нужен **только файлам с вариативностью** (у которых есть `form`- и `renderer`-версии), и через **точку** (`form.schema.ts` / `renderer.schema.ts`).

**Что делаем:** (1) уточнить схему имён в directory-layout гайдах + промпте; (2) переименовать файлы в 3 сгенерированных v20-формах под новую схему + починить их импорты (tsc-чисто). Env-конфиг уже реализован — не трогаем.

---

## 1. Схема имён: плоские по умолчанию, точка-префикс `form.`/`renderer.` только для schema+behavior

Только **schema** и **behavior** бывают в двух layer-версиях, поэтому только они несут точку-префикс, маркирующий слой. Все прочие файлы — плоские (концерн единственный, слоевой двойственности нет).

**Плоские (одинаковы везде):** `index.tsx`, `types.ts`, `model.ts`, `validation.ts`, `data-sources.ts`, `api.ts` (+ `registry.ts` только у renderer-json).

**Layer-вариативные (точка-префикс):**
- **schema** — определение формы (по одной flavor на target):
  - core → `form.schema.ts` (M1 FormSchema `{ value: model.$.x, component, componentProps }`)
  - renderer-react → `renderer.schema.ts` (RenderNode-дерево, `createRenderSchema`)
  - renderer-json → `renderer.schema.json` (JSON-DSL `$model`/`$component`/`$dataSource`)
- **behavior**:
  - `form.behavior.ts` — model behavior (`defineFormBehavior`: computed/enableWhen/copyFrom/onChange) — **во ВСЕХ target'ах**
  - `renderer.behavior.ts` — render behavior (hideWhen/renderEffect/навигация/submit) — **renderer-react & renderer-json**

Смысл префикса: `form.` = M1/model-слой, `renderer.` = render-слой. Плоское имя = концерн единственный.

**По target'ам:**
```
core (8):            index.tsx  types.ts  model.ts  form.schema.ts  form.behavior.ts  validation.ts  data-sources.ts  api.ts
renderer-react (9):  index.tsx  types.ts  model.ts  renderer.schema.ts  form.behavior.ts  renderer.behavior.ts  validation.ts  data-sources.ts  api.ts
renderer-json (10):  index.tsx  types.ts  model.ts  renderer.schema.json  form.behavior.ts  renderer.behavior.ts  validation.ts  data-sources.ts  api.ts  registry.ts
```
База (`index/types/model/validation/data-sources/api`) идентична; target меняет только schema-flavor + добавляет `renderer.behavior.ts` (rr/json) и `registry.ts` (json). App-level базовый registry + DSL meta-schema у renderer-json остаются на уровне приложения — не меняем.

---

## 2. Config (уже реализовано — не трогаем)

`REFORMER_FORM_LAYOUT` (`minimalist` default | `folders`) читается в `create-form.ts`, ведёт промпт. Нужно лишь обновить **список файлов** в `layoutGuidanceFor(minimalist)` под новую схему имён (§3).

---

## 3. Файлы

**Доки (обновить имена под новую схему):**
- `packages/reformer-mcp/docs/llms/06-form-directory-layout.md` (**канон**): base-дерево (§1) + таблица schema-flavor + additions + reuse-map → плоские имена + `form.schema`/`renderer.schema`/`form.behavior`/`renderer.behavior`. Пояснить правило «точка только для layer-вариативных».
- `packages/reformer/docs/llms/15-project-structure.md` (core-slice): `form.schema.ts` + `form.behavior.ts` + плоские.
- `projects/reformer-doc/docs/patterns/project-structure.md` (+ `composition.md` нота).
- `packages/reformer-mcp/src/prompts/create-form.ts` — в `layoutGuidanceFor` (ветка minimalist) заменить список `form-*` файлов на новую схему.

**v20-формы — переименовать + починить импорты** (`projects/react-playground/src/pages/examples/mcp-credit-application-{core,renderer-react,renderer-json}-v20/`):

Rename-карта:
| было | стало |
| --- | --- |
| `form-types.ts` | `types.ts` |
| `form-model.ts` | `model.ts` |
| `form-validation.ts` | `validation.ts` |
| `form-data-sources.ts` | `data-sources.ts` |
| `form-api.ts` | `api.ts` |
| `form-registry.ts` (json) | `registry.ts` |
| `form-schema.ts` (core) | `form.schema.ts` |
| `form-render-schema.ts` (rr) | `renderer.schema.ts` |
| `form-schema.json` (json) | `renderer.schema.json` |
| `form-behavior.ts` | `form.behavior.ts` |
| `form-render-behavior.ts` (rr/json) | `renderer.behavior.ts` |

Внутри каждого каталога обновить относительные импорты `from './form-X'` → `from './<new>'` (напр. `./form-types`→`./types`, `./form-schema`→`./form.schema`, `./form-render-schema`→`./renderer.schema`, `./form-behavior`→`./form.behavior`, `./form-render-behavior`→`./renderer.behavior`, `./form-schema.json`→`./renderer.schema.json`, `./form-registry`→`./registry`, и т.д.). **App.tsx импортит каталог (index) — не затрагивается.**

**Регенерация/сборка:** `npm run generate:llms` (reformer + reformer-mcp) + `npm run build -w @reformer/mcp` (layoutGuidance в dist) + рестарт для live промпта.

---

## 4. Verification

1. **v20 tsc-чисто:** `cd projects/react-playground && npx tsc --noEmit -p tsconfig.app.json` → rc=0 (все 3 формы с переименованными файлами + починенными импортами компилируются; App.tsx тоже).
2. **Ни одного `form-*` не осталось:** grep по v20-каталогам и по 3 doc-поверхностям — нет файлов/упоминаний с дефис-префиксом `form-`; только плоские + `form.`/`renderer.` (точка).
3. **Гайд обновлён:** `find_recipe(topic="directory-layout")` показывает новую схему (плоские + точка для schema/behavior). `llms.txt` регенерирован.
4. **Env-switch не сломан:** `getCreateFormPrompt` при `REFORMER_FORM_LAYOUT` unset → minimalist (с новым списком файлов), `=folders` → folders.
5. Спека не тронута; предсуществующие M-файлы (кроме целевых доков) не тронуты.
