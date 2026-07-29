# Генерация полноценного примера формы (renderer-json) из билдера

## Context

Сейчас билдер отдаёт только `form.json` (JSON.stringify схемы) — модель, типы, регистри,
данные-провайдеры и submit пользователь пишет руками. Нужно, чтобы билдер по текущей форме
(схема + мок в памяти) генерировал **полноценную многофайловую форму по образцу**
`projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v20/` — так, чтобы
папку можно было положить в рабочий проект, вставить 3 строки в роутинг, и форма **сразу
рендерилась и работала** на синтетических данных, а «доведение» сводилось к **реализации методов в
мок-файлах** (submit, async-загрузчики, условия видимости, валидация).

**Ключевой факт:** `JsonFormSchema` билдера — это чистый layout + `componentProps` + привязки
`$model`/`$dataSource`. Нет поведения, валидации, условной видимости, submit, `selector`-ов. Поэтому:
- **derived** (выводится под ключ): `schema.ts`, `types.ts`, `model.ts`, `registry.ts`, опции в `data-sources.ts`;
- **user-owned stub** (`// TODO`, «методы для реализации»): submit, async-загрузчики, `hideWhen`,
  computed/enableWhen, валидация, mock-backend.

**Решения (подтверждены):** Стратегия **C — полный v20**, **без `renderer.schema.json`** (схема →
TS-файл `schema.ts`). Плюс улучшения: безопасная регенерация (derived/user-owned), авто-`selector`-ы
+ submit-триггер, доставка через `showDirectoryPicker()` (zip — фолбэк), генерируемый `README.md`.
Базовые: детерминизм, «работает-на-вставке», строгие типы, pre-export проверка, сверка со спекой
`packages/reformer-mcp/src/prompts/templates/to-renderer-json.md`, фазирование. Роутинг — **сниппет
для копипаста** в `App.tsx` (без автопатча).

## Набор генерируемых файлов

| Файл | Класс (регенерация) | Источник / что внутри |
|---|---|---|
| `schema.ts` | **derived** (перезапись) | `export const schema: JsonFormSchema = {…}` — схема + **впечённые `selector`-ы** + submit-узел |
| `types.ts` | **derived** | интерфейс формы: **string-union для select-ов** с известными опциями, `?` для необязательных, `SelectOption` |
| `model.ts` | **derived** | `createModel<T>(initialValues)` из `MockData.model` + `blank*()`-фабрики массивов |
| `registry.ts` | **derived** | `$component`/`$dataSource` из схемы; `FIELD_WRAPPER`; **placeholder** для неизвестных компонентов |
| `index.tsx` | **derived** | boilerplate-сборка (импорт `./schema`, без каста) + шапка/результат-баннер |
| `README.md` | **derived** | шаги интеграции, сниппет `App.tsx`, **чеклист методов для реализации** |
| `data-sources.ts` | **user-owned** (skip-if-exists) | опции из мока (рабочие) + `itemLabel`-дефолты + async-загрузчики (stub `return []`) |
| `renderer.behavior.ts` | **user-owned** | `onInit` inject form; submit на реальный selector; `hideWhen`-scaffold по selector-ам секций |
| `form.behavior.ts` | **user-owned** | пустой `defineFormBehavior` + закомменченные примеры compute/enableWhen |
| `validation.ts` | **user-owned** | `required` выведены из props + `makeValidationConfig` + примеры |
| `api.ts` | **user-owned** | `submit*`/`load*` — `console.info` + фейк-задержка + `success:true` |

**Безопасная регенерация:** derived-файлы перезаписываются всегда; user-owned пишутся **только если
их ещё нет** (иначе пропуск + строка в отчёте «пропущено, чтобы не затереть»). Опционально — писать
`<name>.new.ts` рядом для дифа. Так руками реализованные методы переживают повторную генерацию после
правок схемы.

## Авто-`selector`-ы + submit-триггер (на копии схемы, живой таб не мутируем)

Перед эмиссией — трансформация копии схемы:
- Проставить стабильные `selector` контейнерам-секциям (`Section`/титульные контейнеры), `FormArray`-узлам
  и submit-узлу. Id из `title`/label/`$model`-пути → kebab, дедуп (`loan-details-section`, `properties`).
- Если submit-триггера нет (форма — просто `Div` с полями) — **вставить** узел
  `{ component: '$component(Button)', selector: 'submit', componentProps: { children: 'Отправить', type: 'submit' } }`
  в конец корня; зарегистрировать `Button` в `registry.ts`.
- Эти `selector`-ы попадают в `schema.ts`, а `renderer.behavior.ts` цепляется к ним по-настоящему:
  submit — `onComponentEvent(schema.node('submit'), 'onClick', …)`; для каждой секции —
  `// hideWhen(schema.node('<selector>'), () => /* TODO */ false)` (условие пишет пользователь, но узел реальный).
- Список selector-ов и что к ним привязано — в `README.md`.

## Новый модуль `projects/reformer-builder/src/codegen/`

Чистое ядро (без DOM/FS) — снапшот-тестируемо:
- `collect.ts` — обход схемы → `{ fields:{path,kind,array,required,optionValues?}[], components:string[], dataSources: classifyDataSources(...) }`. **Переиспользовать обход `synthObject`** (`preview-runtime/mock-synth.ts`, уже спускается в `item.$template`) + `parseOperator` (`@reformer/renderer-json`); при отсутствии общего `walkNodes` — вынести туда.
- `assign-selectors.ts` — трансформация схемы (селекторы + submit-узел), возвращает `{ schema, sections: {selector,label}[], submitSelector }`.
- `ui-kit-imports.ts` — единый маппинг `имя $component → ui-kit-импорт` (тот же список, что `buildRegistry` в `preview-runtime/build-preview.ts`/`mock-sources.ts` — вынести в общий источник).
- `emit-*.ts` — по эмиттеру на файл (чистые `(collected, mock, names, sel) → string`).
- `naming.ts` — `Names` из имени формы: `dir`, `TypeName`, `pageComponent`, `routePath`, `exampleId`, `title`.
- `app-snippet.ts` — сниппет роутинга для `App.tsx` (используется и в `README.md`, и в модалке).
- `validate-exportable.ts` — pre-export проверка (см. ниже).
- `index.ts` — `buildExampleFiles(schema, mock, name) → { path, content, class: 'derived'|'user' }[]` + `formatOut()` (prettier-standalone).

### Переиспользование
`io/export.ts` (`serializeSchema`) · `canvas/mock-data.ts` (`effectiveMock`/`serializeMock`) ·
`preview-runtime/mock-synth.ts` (`classifyDataSources`/`inferFieldKind`/`FieldKind`/`synthMock`, обход `synthObject`) ·
`preview-runtime/build-preview.ts` + `mock-sources.ts` (маппинг компонентов, placeholder) ·
`io/fs-ops.ts` (`createDirectory`/`createFile`/`joinPath`) · prettier (уже в билдере, `io/save.ts`).

## Детерминизм и «работает-на-вставке»
- **Детерминизм:** брать `effectiveMock(tab.schema, tab.mockText)` (правки пользователя стабильны); синтез-фолбэк — `synthMock(schema, { now: <фикс ISO>, arrayItems: 1 })`, чтобы `schema.ts`/`model.ts` были байт-стабильны между прогонами.
- **Работает-на-вставке** (приёмочный критерий): форма рендерится и интерактивна СРАЗУ, до правок. Значит все заглушки — функциональные no-op, не бросают: реальные опции из мока; `itemLabel = (_, i) => \`#${i+1}\``; `loadX(): Promise<[]>`; неизвестный `$component` → placeholder-компонент (как в preview `mock-sources.ts`), не throw; `api.submit` → `console.info` + `success:true`; валидация — только `required`.

## Эмиттеры — представительные наброски

`emit-model.ts`:
```ts
export function emitModel(mock: MockData, n: Names): string {
  const initial = JSON.stringify(mock.model, null, 2);
  return `import { createModel, type FormModel } from '@reformer/core';
import type { ${n.TypeName} } from './types';
export function createInitialValues(): ${n.TypeName} { return ${initial}; }
export function create${n.TypeName}Model(initial?: Partial<${n.TypeName}>): FormModel<${n.TypeName}> {
  return createModel<${n.TypeName}>({ ...createInitialValues(), ...initial });
}`;
}
```

`emit-behavior.ts` — submit + hideWhen по реальным selector-ам:
```ts
onInit(schema.node('${sel.submitSelector}') ?? schema.root, () =>
  schema.root.patchProps({ form, ...makeValidationConfig(model) }));
onComponentEvent(schema.node('${sel.submitSelector}'), 'onClick', async () => {
  const res = await submit(model.get());        // api.ts — реализовать
  onResult?.(res.success ? 'Отправлено' : res.error, res.success);
});
${sel.sections.map((s) => `// hideWhen(schema.node('${s.selector}'), () => /* TODO */ false);`).join('\n')}
```

`emit-data-sources.ts`: optionLike → `export const NAME: SelectOption[] = [...]` (из мока); scalarLike → `export const NAME = '…'`; functionLike → рабочий `itemLabel`-дефолт; динамические — `export async function loadX(arg, signal?): Promise<SelectOption[]> { return []; /* TODO */ }`.

`emit-index.ts`: `import { schema } from './schema'` (типизирован) → `create<Type>Model()` → `createForm({ model, schema: convertJsonToM1Tree(schema, registry, model), behavior })` → `createJsonRenderBehavior(...)` → `<JsonRendererProvider settings={{registry, model}}><JsonFormRenderer schema={schema} renderBehavior/></JsonRendererProvider>`.

## Pre-export проверка (`validate-exportable.ts`)
Перед генерацией: каждый `$model`-путь имеет значение в моке; каждый `$component` — известен (иначе будет placeholder, warning); каждый `$dataSource` классифицирован. Прогнать `validateSchema` (уже есть). Показать warnings в диалоге, разрешить продолжить.

## Доставка — `showDirectoryPicker()` (+ zip-фолбэк)
- **Основное:** `window.showDirectoryPicker()` → пользователь выбирает любую папку → создать подпапку `<dir>/` → записать файлы через FS Access API (примитивы `io/fs-ops.ts` на выбранном handle). Открывать проект не нужно. При регенерации — читать существующие имена → пропускать user-owned.
- **Фолбэк** (Firefox/Safari без FS Access API): собрать `.zip` через **лениво** импортируемый `jszip` (dep только для этой ветки), скачать (паттерн `downloadSchema`).

## Роутинг — сниппет
`app-snippet.ts` возвращает готовый текст (import + запись `exampleGroups` + `<Route>`); показать после генерации в модалке с «Копировать» и продублировать в `README.md`. `App.tsx` не трогаем.

## UI-интеграция
- Диалог «Экспорт как пример» (расширить `panels/FilesDialogs.tsx`): имя формы (дефолт из имени файла таба), warnings pre-export, кнопка «Выбрать папку…».
- Триггер: пункт `app/AppMenuBar.tsx` («Файл → Экспортировать как пример…») и/или кнопка `canvas/FloatingActions.tsx`. Источник — активный таб: `tab.schema` + `effectiveMock(tab.schema, tab.mockText)`.

## Форматирование
Все `.ts`/`.tsx` — через prettier-standalone (2 пробела, `;`, одинарные кавычки). `README.md` — через prettier (`markdown`). JSON-артефактов нет — схема это `schema.ts`.

## Риски и краевые случаи
- Относительные `$model` в `item.$template` → элемент-интерфейсы в `types.ts` + `blank*()` в `model.ts` (обход как `synthObject`).
- `$html(tag)` — регистри-запись не нужна.
- `FIELD_WRAPPER` обязателен в registri.
- Селекторы не должны конфликтовать с уже проставленными пользователем (дедуп с учётом существующих).
- Каждый `$model` в initialValues — совпадает (модель и обход берут одни пути).

## Фазирование
1. **Ядро (чистое, тесты):** `collect` + `assign-selectors` + 11 эмиттеров + `buildExampleFiles` + `formatOut`; снапшот/unit-тесты. Сюда же детерминизм, типы-union, placeholder, runs-green.
2. **Доставка + UI:** `showDirectoryPicker`-writer + safe-regen (skip-if-exists) + диалог + триггер + pre-export проверка + модалка со сниппетом.
3. **Фолбэк/полировка:** ленивый `jszip` для Safari/FF.

## Verification
- **Unit** (`src/codegen/*.test.ts`): снапшот `buildExampleFiles(sampleSchema, sampleMock, 'loan')` — набор файлов (`schema.ts`, нет `.json`), `schema.ts` содержит впечённые `selector`-ы + submit-узел, `registry.ts` — `FIELD_WRAPPER` + все `$component` + `Button`, `types.ts` — union для select-а, `data-sources.ts` — опции из мока; `class` derived/user проставлен; `assign-selectors`/`collect`/`naming` — точечные. Детерминизм: два прогона байт-идентичны. Фикстуры `model/__fixtures__/sample-schema.ts`.
- **tsc + eslint** билдера чистые; сгенерированный код — prettier-clean.
- **E2E (Playwright, dev IPv4):** в билдере открыть форму → «Экспортировать как пример» → выбрать папку в `react-playground/src/pages/examples/`. Вставить сниппет из `README.md` в `App.tsx`, `npm run dev` (react-playground), перейти по маршруту → форма **рендерится и интерактивна сразу** (select-ы с опциями, submit логирует payload). Затем реализовать `submit` в `api.ts` + одну `hideWhen` → проверить. Регенерация не затирает `api.ts`. Скриншоты → `projects/react-playground-e2e/screenshots/codegen-example/`.

## Файлы
**Новое:** `projects/reformer-builder/src/codegen/{index,collect,assign-selectors,naming,ui-kit-imports,app-snippet,validate-exportable,emit-schema,emit-types,emit-model,emit-registry,emit-data-sources,emit-behavior,emit-form-behavior,emit-validation,emit-api,emit-index,emit-readme}.ts` + `*.test.ts`.
**Правки:** `app/save-actions.ts` (`exportExample` + dir-picker writer + zip-фолбэк), `panels/FilesDialogs.tsx` (диалог), `app/AppMenuBar.tsx` и/или `canvas/FloatingActions.tsx` (триггер), `package.json` (`jszip` как lazy-dep). **Переиспользуем:** `io/export.ts`, `canvas/mock-data.ts`, `preview-runtime/{mock-synth,build-preview,mock-sources}.ts`, `io/fs-ops.ts`.
