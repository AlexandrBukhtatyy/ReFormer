# Интерактивная вкладка «Renderer» в reformer-builder

## Context

Сейчас в билдере два холста живут раздельно: **Схематичный** (`SchematicCanvas`) умеет всё — клик-выделение,
хоткеи, drag&drop; **Renderer** (`RuntimePreview`, 55 строк) умеет только показывать. Это было исходным
проектным решением («preview — non-interactive»), но на практике редактировать хочется прямо на реальном
рендере: схематика показывает структуру, а не то, как форма выглядит.

Цель — дать вкладке Renderer паритет со схематикой: выделение узлов, все горячие клавиши холста и полный
drag&drop (палитра → форма, перемещение узлов, все 7 зон включая `beside-*`/`stack-*`).

Главное препятствие: **связи «DOM-элемент → узел схемы» не существует**. Путь узла (`JsonPath`) живёт
только как проп в замыкании `NodeView` схематики; в рендерере после `convertJsonToM1Tree` от исходного JSON
не остаётся ничего адресуемого. Значит нужен маркер, который переживёт конвертацию и доедет до DOM.

Второе препятствие: форма в превью живая. Клик по `Input` ставит в него фокус, `Delete` удаляет текст,
а не узел. Решение — **тумблер режима**: «Редактирование» (правим схему) / «Тест» (щупаем форму).

---

## Ключевое решение: маркер через `className`, а не через служебное поле узла

Проверено по коду — служебные поля **на уровне узла** (`"meta"`, `"x-builder"`, `"nodeId"`) не подходят:

- мета-схема ставит `additionalProperties: false` на `fieldNode`/`arrayNode`/`containerNode`
  ([form-schema.schema.json:69,81,101](packages/reformer-renderer-json/src/schema/form-schema.schema.json#L69)) —
  билдер валидирует схему на save/export и такой ключ заблокирует сохранение;
- конвертер `convertNodeM1` собирает узел из фиксированного набора полей и лишние ключи **молча выбрасывает**
  ([json-to-render-schema.ts:244-302](packages/reformer-renderer-json/src/converter/json-to-render-schema.ts#L244-L302)) —
  до рендера они не доходят в принципе.

Ключи **внутри `componentProps`** конвертер не фильтрует и доводит до React-элемента
([transformProps](packages/reformer-renderer-json/src/converter/json-to-render-schema.ts#L218-L227)). Но
произвольный `data-rb-path` попадёт в DOM только у `$html(...)`-узлов и shadcn-портов: `Box`, `Section`,
`FormField`, `List`, `Step`, `Select` (Radix) глушат неизвестные пропсы.

**Транспортом становится `componentProps.className`** — его принимают и ставят на свой корневой DOM почти все:

| Тип узла | Куда попадает класс |
|---|---|
| поле (лист) | рендерер вырезает `className` из `componentProps` и отдаёт FieldWrapper'у ([render-node.tsx:169-175, 243](packages/reformer-renderer-react/src/core/render-node.tsx#L243)) → `FormField` ставит на корневой `<Field>` ([form-field.tsx:65](packages/reformer-ui-kit/src/components/form-field/form-field.tsx#L65)) — **ровно тот FormField-блок, до которого просили расширять выделение** |
| контейнер-компонент | корневой DOM компонента (`cn(base, className)`) |
| `$html(...)` | переживает `sanitizeHtmlProps`, садится на реальный тег |
| массив | `<section className>` в `ModelArraySectionRenderer` |

Слепые зоны — четыре, и все **наши собственные**, чинятся точечно (Фаза 1): `Step` (`<>{children}</>`, DOM нет),
`WizardPreview`/`FormWizard` (объявленный `className` не применяется), обе заглушки в `unknown-component.tsx`.

Маркер — **класс-токен с закодированным путём** (`rbnode-root__children__0`), поэтому карта «id → путь» нигде
не нужна, а CSS-подсветка адресует узел напрямую селектором.

**Инвариант:** аннотированная схема эфемерна — живёт только внутри `RuntimePreview`, не сохраняется, не
экспортируется, не попадает в `tab.schema`. Валидация в превью уже выключена (`validateSchema={false}`).

---

## Режим Renderer'а: «Редактирование» / «Тест»

Новый UI-флаг `ui.runtimeMode: 'edit' | 'test'` (дефолт `edit`), тумблер в `FloatingActions` рядом с
переключателем холстов (виден только при `preview === 'runtime'`), хоткей `⌥⌘E`.

**Режим `edit`** — форма превращается в холст чисто средствами CSS, без перехвата событий:

```css
[data-rb-preview='edit'] *                    { pointer-events: none; }
[data-rb-preview='edit'] [class*='rbnode-']   { pointer-events: auto; }
[data-rb-preview='edit']                      { user-select: none; }
```

Клик по `<input>` внутри поля попадает не в инпут (он выключен), а всплывает до ближайшего элемента с
токеном — то есть до FormField-блока, чей узел мы и выделяем. Ввода в поля нет, фокус в них не уходит,
поэтому хоткеи работают без каких-либо исключений по модификаторам, а `draggable` на узлах не конфликтует
с выделением текста.

**Режим `test`** — ничего из перечисленного не активно: ни подсветки, ни хит-теста, ни `draggable`,
ни холст-хоткеев. Форма ведёт себя ровно как сегодня (это же и способ переключить шаг визарда или
проверить валидацию, а потом вернуться в `edit`).

---

## Фазы

### Ф0. Общая геометрия DnD (рефакторинг без изменения поведения)

Логика зон сейчас заперта внутри схематики и завязана на `DragEvent`, поэтому не переиспользуема и не покрыта тестами.

- **создать** `src/dnd/compute-zone.ts` — перенести `computeZone` из
  [SchematicCanvas.tsx:67-91](projects/reformer-builder/src/canvas/SchematicCanvas.tsx#L67-L91) с чистой сигнатурой
  `(point, rect, node, parentOrientation, allowPerp) => DropZone`; туда же `PERP_ZONES` (54-59) и `zoneEdge(zone, horizontalParent)`
  — чистая версия `edgeLineClass` (94-115).
- **создать** `src/dnd/commit-drop.ts` — перенести `commitDrop` (133-139): `getDrag()` → `performDrop` → `editorActions.commit`.
- **изменить** `SchematicCanvas.tsx` — использовать общие модули; `edgeLineClass` оставить маппером `zoneEdge → tailwind`.
- **создать** `src/dnd/compute-zone.test.ts` — 7 зон × 2 ориентации × `allowPerp` × `canAcceptChildren`.

`resolveDrop`/`performDrop` ([resolve-drop.ts](projects/reformer-builder/src/dnd/resolve-drop.ts)) и
`drag-state.ts` уже чистые — переиспользуются как есть, обе ветки дропа пойдут через них.

**Проверка:** схематика ведёт себя как раньше; `npm test` зелёный.

### Ф1. Аннотация схемы и якоря в DOM

- **создать** `src/preview-runtime/node-token.ts` — кодек пути:
  `encodeNodeToken(path)` (сегменты через `__`, не-alnum → `-<hex>`, чтобы `$template` дал валидный CSS-ident),
  `decodeNodeToken(token)` (числовые сегменты → `number`), `tokenFromClassName(cls)`.
- **создать** `src/preview-runtime/annotate-schema.ts` — `annotateSchema(schema)`: рекурсивная копия дерева
  **через `childSlots`** ([model/node-kind.ts](projects/reformer-builder/src/model/node-kind.ts)), чтобы пути совпадали
  со схематикой по построению; в каждый узел дописывает токен в `componentProps.className`, исходную схему не мутирует.
  - ⚠️ **Ловушка:** у array-компонентов `className` — *дефолт параметра*, а не merge
    (`className = 'space-y-3 mt-2'` в `ModelArraySectionRenderer`, `form-array.tsx:75`, `form-array-section.tsx:171`).
    Если у array-узла своего `className` не было, аннотатор обязан подставить дефолт вместе с токеном, иначе форма потеряет отступы.
  - контейнерам без детей дополнительно вешать `rbnode-empty` (нулевая высота = недостижим курсором).
- Починить четыре «слепые зоны»:
  - **создать** `src/preview-runtime/preview-step.tsx` — `PreviewStep({className, children})` → `<div>`; **изменить**
    `known-components.ts:27,41-51` (cdk `Step` → `PreviewStep`; без `__selfManagedChildren`, чтобы рендерер сам рисовал детей);
  - **изменить** `wizard-preview.tsx:60-68` — обернуть `<FormWizard>` в `<div className={props.className}>`
    (у `FormWizard` проп `className` объявлен, но не применяется);
  - **изменить** `unknown-component.tsx:18-52` — обе заглушки принимают и мержат `className`.
- **изменить** `RuntimePreview.tsx` — хост `<div ref data-rb-preview={mode} tabIndex={-1} className="relative">`;
  `const annotated = useMemo(() => annotateSchema(schema), [schema])` — **обязательно мемо**, иначе `buildPreview`
  пересоберёт модель/форму и превью потеряет введённые значения; дерево формы вынести в `memo`-компонент, чтобы
  выделение/hover/дроп не ре-рендерили форму.
- **dev-диагностика** (там же, DEV-only): сравнить выданные аннотатором токены с `host.querySelectorAll('[class*="rbnode-"]')`
  и `console.warn` о недостающих — самообновляющийся сторож против дрейфа ui-kit.

**Проверка:** в DevTools у каждого видимого узла есть `rbnode-…`; форма визуально не изменилась; raw-JSON панель чистая.

### Ф2. Режим и выделение

- **изменить** `store/types.ts` + `reducers.ts` + `editor-store.ts` — `UiState.runtimeMode: 'edit' | 'test'`,
  редьюсер `setRuntimeMode`, дефолт `'edit'`; опционально `ui.runtimeMode` в `config/types.ts` +
  `runtime-config.schema.json` (как уже сделано для `bottomTab`).
- **изменить** `FloatingActions.tsx:64-97` — второй сегментированный переключатель «Редактирование | Тест»,
  рендерится только при `ui.preview === 'runtime'`.
- **изменить** `EditorLayout.tsx` — хоткей `⌥⌘E` на переключение режима (по `e.code`, как ⌥⌘1/2/3 — на macOS Alt искажает `e.key`).
- **создать** `src/canvas/preview-hit-test.ts` — `nodeAtElement(el, schema)`: `closest('[class*="rbnode-"]')` →
  `decodeNodeToken` → валидация через `getAt` (промах → поднимаемся выше). Возвращает путь + элемент-якорь.
- **создать** `src/canvas/PreviewHighlight.tsx` — подсветка **генерируемым `<style>`**, а не атрибутами на DOM формы
  (атрибуты React стирает при пересоздании узлов; CSS-правило `.rbnode-… { outline: … }` иммунно к ре-рендерам
  и не требует `position: relative`): активный узел — 2px, остальные выделенные — 1px, hover — отдельный
  ref-managed `<style>` без ре-рендера.
- **изменить** `RuntimePreview.tsx` — делегированные слушатели на хосте (только в `edit`): `click` →
  `select`/`extendSelectionTo` (Shift)/`toggleSelectionAt` (Ctrl/Cmd); `dblclick` → `revealRawLine(lineOfPath(...))`
  (паритет со схематикой); `mouseover`/`mouseleave` → hover; `focusin` → вернуть фокус хосту (страховка от Tab внутрь формы).
- **изменить** `CanvasArea.tsx:55-57` — пробросить `selectionPath`/`selectionPaths` в `RuntimePreview`.
- **изменить** `index.css` — правила режима `edit` (pointer-events/user-select/`rbnode-empty`) и токены цвета.

**Проверка:** клик выделяет узел и инспектор показывает его свойства; выделение поля обводит весь FormField-блок;
Shift/Ctrl-выделение совпадает со схематикой; в режиме «Тест» подсветки нет и форма полностью интерактивна.

### Ф3. Горячие клавиши

Правки только в [EditorLayout.tsx](projects/reformer-builder/src/app/EditorLayout.tsx):

- строки 242/249: `inWire` → `inCanvas = (preview === 'wire' || (preview === 'runtime' && runtimeMode === 'edit')) && activeTab != null`;
  та же замена в ветке `Escape` (244-248).
- Исключений по модификаторам не нужно: в `edit` фокус физически не попадает в поля формы, `isEditableTarget`
  срабатывать не будет. В `test` холст-хоткеи выключены гейтом.
- При навигации стрелками — `scrollIntoView({block:'nearest'})` по элементу выделенного узла.
- **изменить** `HelpDialogs.tsx:59` — заголовок группы «Редактирование (схематичный режим)» → «(холст: Схематичный и Renderer)».

**Проверка:** в Renderer/`edit` работают ↑↓←→, ⇧-стрелки, ⌘-стрелки, ⇧⌥-стрелки, Delete, ⌘D, ⌘G, ⇧⌘G, ⇧⌘L, Esc, Space, Enter;
в `test` — ни одна из них, но ⌘S/⌘B/⌥⌘1-3 продолжают работать.

### Ф4. DnD: дроп из палитры (все 7 зон)

- **создать** `src/canvas/preview-dnd.ts` — `resolveDropTarget(host, schema, x, y, target)`: хит-тест →
  `parentNodePath` + `orientationOf` по **исходной** `tab.schema` → `allowPerp = !isRoot && path[len-2] === 'children'`
  (паритет с `SchematicCanvas.tsx:162`) → `computeZone` из Ф0.
- **создать** `src/canvas/PreviewOverlay.tsx` — абсолютный слой `pointer-events:none` внутри хоста; рисует
  линию края (`before`/`after`), рамку (`into`), линию + чип «ряд»/«столбец» (`beside-*`/`stack-*`).
  Обновляется императивно через ref, чтобы `dragover` не ре-рендерил обвязку. Оверлей выбран вместо `::after`
  на цели: псевдоэлемент потребовал бы `position: relative` на элементах формы, а это сделало бы их containing
  block для абсолютно позиционированных потомков (иконки в полях, поповеры).
- **изменить** `RuntimePreview.tsx` — `dragover`/`dragleave`/`drop`/`dragend` на хосте. Важно: если
  `getDrag() === null` (тащат файл/текст извне) — **не** вызывать `preventDefault()`, отдать событие форме
  (иначе сломается `FileUpload`). На `drop` — `preventDefault` + `stopPropagation` + `commitDrop` из Ф0.

**Проверка (главный тест паритета):** дроп компонента X на узел Y в зону Z из схематики и из Renderer'а даёт
идентичный JSON — обе ветки идут через `performDrop`. Прогнать все 7 зон и дроп в пустой контейнер.

### Ф5. DnD: перемещение существующих узлов

- **изменить** `RuntimePreview.tsx` — в `edit`-режиме проставлять `draggable = true` на маркированных элементах:
  layout-эффект после рендера + `MutationObserver` (childList/subtree, rAF-дебаунс) на случай пересоздания узлов
  React'ом. Корень (`['root']`) пропускаем — паритет с `draggable={!isRoot}` (SchematicCanvas.tsx:220).
- `dragstart` (делегированно на хосте) → `setDrag({kind:'move', path})`, `effectAllowed='move'`; `dragend` → `clearDrag()`.
  Приёмник — из Ф4, менять нечего.
- Защита от дропа в себя/потомка уже есть в `performDrop` ([resolve-drop.ts:88,115](projects/reformer-builder/src/dnd/resolve-drop.ts#L88)).

**Проверка:** перенос поля между контейнерами, реордер, вынос в новый ряд/столбец, спец-кейс «переворот пары
в flex-обёртке» (resolve-drop.ts:93-101), запрет дропа в самого себя.

### Ф6. Полировка

- `ResizeObserver` на хосте — пересчёт оверлея, когда под полем появляется текст ошибки.
- rAF-троттлинг hover на больших схемах.
- Подсказка для пустой схемы (аналог «перетащите компонент сюда», SchematicCanvas.tsx:298-320).
- Прогон dev-диагностики по всему каталогу палитры → точечный HOC для компонентов, глотающих `className`
  (обёртка должна рендерить настоящий DOM-элемент и копировать статики `__selfManagedChildren`,
  `reformerNeedsControl`, `reformerLayout` — последняя критична, иначе у Checkbox/Switch задвоится подпись).

---

## Что осознанно не делаем

- **HOC-обёртка всех компонентов реестра с `display: contents`** — отклонено: рвёт child-комбинаторы, на которых
  стоит вёрстка (`space-y-*` = `& > * + *`, `has-[>[data-slot=field]]` и десятки shadcn-правил), даёт нулевой
  `getBoundingClientRect`, требует копирования трёх статик и ломает `resolveFieldAdapter` (резолв по идентичности
  компонента). Остаётся точечным фолбэком в Ф6.
- **Правка пакетов** `packages/*` — фича целиком билдер-локальная.
- **Неактивные шаги визарда** в превью не выделяются (`FormWizardStep` рендерит только текущий) — редактируются
  через схематику либо переключением шага в режиме «Тест».

---

## Риски

| Риск | Митигация |
|---|---|
| Компонент кладёт `className` не на корень / глотает его | dev-диагностика Ф1 ловит на месте; деградация мягкая — узел просто не выделяется кликом, схематика работает |
| Забыть мемоизацию `annotated` → сброс введённых значений на каждый ре-рендер | обязательный пункт ревью + ручной чек «ввёл значение в `test`, переключился в `edit` и обратно» |
| Потеря дефолтного `className` у array-узлов | спец-кейс в аннотаторе + юнит-тест |
| Токен утёк в сохраняемую схему / экспорт | юнит-инвариант (`JSON.stringify(original)` не содержит `rbnode-`) + e2e-проверка экспорта |
| `pointer-events` ломает что-то внутри сложных компонентов (Radix Select) | в `edit` они и должны быть неактивны; проверяется ручным чек-листом по каталогу |
| `MutationObserver` + `draggable` дают лишние срабатывания на больших формах | rAF-дебаунс; наблюдаем только childList/subtree внутри хоста |

---

## Верификация

**Юнит-тесты** (vitest, `environment: node`, рядом с кодом):

- `node-token.test.ts` — round-trip путей, включая `['root','componentProps','steps',1,'children',2]` и
  `['root','item','$template']`; числовые сегменты декодируются в `number`; `children/10` ≠ `children/1/0`;
  токен матчится `/^[A-Za-z][A-Za-z0-9_-]*$/`.
- `annotate-schema.test.ts` — **главные инварианты**: исходная схема структурно не изменилась и не содержит
  `rbnode-`; каждый узел из `walkNodes` получил токен своего пути; существующий `className` сохранён;
  array-узел без `className` получил дефолт; контейнер без детей получил `rbnode-empty`;
  `validateSchema(original)` (`io/validate.ts`) валидна до и после.
- `compute-zone.test.ts` — матрица зон (Ф0).
- расширить `registry-drift.test.ts` — имя `Step` не потерялось при подмене реализации.

**Ручной чек-лист** (обязателен, DnD автоматикой не покрыт) — после каждой фазы: форма визуально идентична
до/после аннотации; в `test` ввод работает как раньше; переключение `edit ⇄ test` не сбрасывает значения полей;
dev-консоль без warn'ов дрейфа.

**Playwright** — у e2e-проекта сейчас единственный `webServer` на `react-playground`; для билдера нужен второй
проект + `webServer` с `cwd: projects/reformer-builder`. Это отдельная задача (завести в bd), но именно она даёт
настоящую проверку HTML5-DnD. Сценарии: клик-выделение (в т.ч. что обводится весь FormField), стрелочная
навигация, ⌘-перемещение, дроп из палитры во все 7 зон, перемещение узла, и контрольный инвариант — экспортированный
JSON не содержит `rbnode-`.

**Скриншоты** — в `projects/react-playground-e2e/screenshots/builder-runtime-edit/`.
