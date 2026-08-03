# Data-driven реестр preview: убрать «компонент не зарегистрирован» для палитровых компонентов

## Context

В runtime-preview билдера множество компонентов рисуют плейсхолдер
**«⚠ {name} — компонент не зарегистрирован в preview»**. Причина: палитра и preview-рендер
берутся из **двух несинхронизируемых источников**.

- **Палитра** генерируется data-driven из `@reformer/ui-kit/catalog`
  (`component-catalog.json`, 76 компонентов) + 7 синтетических записей билдера → `getCatalog()`
  ([contract.ts](../../projects/reformer-builder/src/catalog/contract.ts),
  [PalettePanel.tsx](../../projects/reformer-builder/src/panels/PalettePanel.tsx)). Итого 83 элемента.
- **Preview-рендер** — **ручной** список из 21 компонента
  ([known-components.ts](../../projects/reformer-builder/src/preview-runtime/known-components.ts))
  + дублирующий список имён
  ([known-names.ts](../../projects/reformer-builder/src/preview-runtime/known-names.ts)).

Совпадают только 18. Остальные 58 каталожных имён рендерер не знает → плейсхолдер
([unknown-component.tsx](../../projects/reformer-builder/src/preview-runtime/unknown-component.tsx#L17),
детект в [unknown.ts](../../projects/reformer-builder/src/preview-runtime/unknown.ts)). Никакого
кода, гарантирующего «есть в палитре → зарегистрирован», нет — реестр ведётся руками и отстал.

**Цель:** реестр preview строится из того же каталога, что и палитра — расхождение исключено
конструктивно и защищено тестом. Компоненты, которые честно нельзя отрендерить в canvas
(оверлеи, subpath-only), показывают нейтральный подписанный стаб «предпросмотр ограничен»
вместо тревожного warning.

## Установленные факты (верифицировано в коде)

1. **Правило имён регулярное на 100%.** field-запись каталога → экспорт `${name}Field`
   (`InputField`, `SelectField`, и т.д.); container-запись → экспорт `${name}`
   (`Card`, `Alert`, `TypographyH1`…`TypographyMuted` — реальные React-компоненты).
2. **4 «поля без адаптера» на деле имеют `*Field`-алиасы** (`CalendarField`, `ComboboxField`,
   `DatePickerField`, `InputOTPField`) — они просто **subpath-only** (нет в barrel). Правки ui-kit
   не нужны. Комментарий в `known-names.ts:6-7` про их отсутствие — устарел, удалить.
3. **2 контейнера не имеют экспорта, равного имени каталога:** `Chart` (экспорт `ChartContainer`)
   и `Resizable` (экспорт `ResizablePanelGroup`). Резолв вернёт `undefined` → они сами уйдут в стаб.
4. **12 компонентов отсутствуют в barrel** `@reformer/ui-kit` (optional peer-deps):
   `Calendar, Carousel, Chart, Combobox, Command, DatePicker, Drawer, InputOTP, MessageScroller,
   Resizable, Sidebar, Table`. Реестр импортирует из barrel → в Phase 1 они = стаб.
5. **Каталог React-free** (`getCatalog → buildCatalog → contract.ts` тянет только ajv + JSON +
   `make-node`, без React) → имена для `known-names` можно выводить из каталога в node-тестах.
6. **Тест-окружение билдера — `node`, `include: ['src/**/*.test.ts']`**
   ([vitest.config.ts](../../projects/reformer-builder/vitest.config.ts)) — `.tsx`/React не собираются.
   Anti-drift тест обязан быть React-free `.test.ts`.
7. `$html(...)` (op `html`) и `FormArray` (`array`/`item`) не проходят через `$component`-реестр —
   вне scope.

## Approach: catalog-driven реестр + явная render-policy

Реестр перестаёт быть списком — он **выводится из каталога**. Для каждого каталожного имени
резолвится реальный ui-kit-компонент по правилу имён; всё, что намеренно не рендерится живьём,
получает нейтральный подписанный стаб. И карта компонентов, и множество «известных имён»
производятся из единственного источника `getCatalog()` — разойтись с палитрой не могут.
Тест стережёт единственную ручную ручку — allowlist'ы политики.

### 1. Новый файл: `src/preview-runtime/render-policy.ts`

Единый источник политики рендера. React-free, кроме резолвера (принимает barrel-namespace
аргументом, чтобы сами наборы оставались импортируемыми в node).

- `OVERLAY_LIMITED: ReadonlySet<string>` — 10 настоящих оверлеев, чей корень без триггера/портала
  рисует пустоту (живой рендер = невидимый узел, хуже подписанного стаба):
  `Dialog, AlertDialog, Sheet, Popover, HoverCard, Tooltip, DropdownMenu, ContextMenu, Menubar,
  NavigationMenu`.
- `SUBPATH_LIMITED: Map<string, string>` — 12 barrel-omitted компонентов, каждый с коротким reason
  (напр. `Table` → «subpath-only: @tanstack/react-table», `Chart` → «нет экспорта Chart»). Сюда же
  естественно попадают `Chart`/`Resizable` (несовпадение имени → `undefined`).
- `resolveUiKitComponent(name, role, uiKit)` → `uiKit[role === 'field' ? name + 'Field' : name]`.
- `classify(entry, uiKit)` → `{ policy: 'live', component } | { policy: 'limited', reason }`:
  - `OVERLAY_LIMITED.has(name)` → `limited('оверлей — нужен триггер/портал')`;
  - иначе если `resolveUiKitComponent(...)` определён → `live`;
  - иначе → `limited(SUBPATH_LIMITED.get(name) ?? 'не резолвится')`.

Ветка `не резолвится` — растяжка против дрейфа: новое каталожное имя, которое не резолвится
**и** не в allowlist, падает в тесте (осознанное решение обязательно).

### 2. Переписать: `src/preview-runtime/known-components.ts`

Заменить статический объект на data-driven сборку (файл остаётся `.ts` — JSX нет):

- `import * as UiKit from '@reformer/ui-kit'`, `import { Step } from '@reformer/cdk/form-wizard'`,
  `import { getCatalog } from '../catalog'`, `import { classify } from './render-policy'`,
  `import { makePreviewLimitedComponent } from './unknown-component'`.
- Пройти `getCatalog()`, пропустить `role === 'array'` и имена `$html(`, `classify` каждую запись →
  зарегистрировать реальный компонент или `makePreviewLimitedComponent(name, reason)`.
- Явный **INFRA**-блок для имён вне каталога, нужных рендереру: `FormField`, `AsyncBoundary`
  (barrel), `Step` (cdk).
- Экспортировать собранный `KNOWN_COMPONENTS: Record<string, ComponentType>` (один раз на загрузке
  модуля) + хелпер `classifyCatalog()` для тестов.

### 3. Переписать: `src/preview-runtime/known-names.ts` (React-free)

Выводить множество имён из каталога, а не хардкодить:

- `KNOWN_COMPONENT_NAMES = [ ...field+container-имена getCatalog(), 'FormField', 'AsyncBoundary',
  'Step' ]`; `KNOWN_COMPONENT_NAME_SET = new Set(...)`. Остаётся node-safe (каталог React-free).
- Итог: `collectUnknownComponentNames` теперь флагует только `$component`-имена, которых **нет в
  каталоге вообще** (напр. `RendererFormWizard` из фикстуры) — это и есть истинный смысл «unknown».

### 4. Расширить: `src/preview-runtime/unknown-component.tsx`

Разделить плейсхолдер на два намерения:

- `makeUnknownComponent(name)` — прежний **amber** «⚠ … не зарегистрирован в preview» — теперь
  достижим только для реально не-каталожных `$component` из ручного JSON.
- `makePreviewLimitedComponent(name, reason?)` — **нейтральный** стиль (muted-рамка, без amber/warning),
  текст «{name} — предпросмотр ограничен» + опц. reason, по-прежнему рендерит `children` (вложенная
  структура видна). Для 22 policy-limited каталожных компонентов.

### 5. Обновить: `src/preview-runtime/build-preview.ts`

- Цикл по новому `KNOWN_COMPONENTS` (теперь полон по каталогу) → `reg.component`.
- Сохранить `reg.component(FIELD_WRAPPER, KNOWN_COMPONENTS.FormField)`,
  `collectUnknownComponentNames → makeUnknownComponent` (теперь только истинные unknown),
  `registerMockSources`. Структурно меняется только источник карты.

### 6. `src/preview-runtime/index.ts`

Экспортировать `makePreviewLimitedComponent`, наборы политики и `classifyCatalog` для тестов.

## Списки компонентов по политике

**LIVE — реальный ui-kit-компонент (54):**
- Поля через `${name}Field`, из barrel (14): `Input, InputPassword, InputMask, Textarea, Select,
  NativeSelect, Checkbox, RadioGroup, Switch, Slider, FileUpload, FileUploadAvatar, Toggle, ToggleGroup`.
- Контейнеры, корневой экспорт из barrel (40): `Box, Section, Collapsible, Card, Alert, Badge, Avatar,
  Separator, Progress, Label, Skeleton, Spinner, Kbd, Marker, Empty, ScrollArea, AspectRatio,
  InputGroup, ButtonGroup, Button, Item, Bubble, Message, Attachment, Accordion, Tabs, Breadcrumb,
  Pagination` + 12 `Typography*`.

**LIMITED — нейтральный подписанный стаб (22):**
- Оверлеи (10): `Dialog, AlertDialog, Sheet, Popover, HoverCard, Tooltip, DropdownMenu, ContextMenu,
  Menubar, NavigationMenu`.
- Subpath-only поля (4): `Calendar, Combobox, DatePicker, InputOTP`.
- Subpath-only контейнеры (8): `Carousel, Chart, Command, Drawer, MessageScroller, Resizable,
  Sidebar, Table`.

**INFRA — зарегистрированы, но не в каталоге (3):** `FormField` (= `FIELD_WRAPPER`), `AsyncBoundary`, `Step`.

Итог: preview с ~18 живых → **54 живых**; оставшиеся 22 — честный «предпросмотр ограничен» вместо
пугающего warning. Требование «в палитре ⇒ зарегистрирован» выполнено.

## Anti-drift тесты (React-free, node)

- **`registry-drift.test.ts` (главный).** Собрать синтетическую схему, где `root.children` =
  `entry.makeNode()` для **каждой** записи `getCatalog()`, и проверить, что
  `collectUnknownComponentNames(schema)` возвращает `[]`. Буквально симулирует дроп каждого элемента
  палитры и доказывает, что ни один не даёт плейсхолдер «не зарегистрирован». Зависит только от
  `catalog` + `model/query` (образец — существующий
  [unknown.test.ts](../../projects/reformer-builder/src/preview-runtime/unknown.test.ts)).
- **`render-policy.test.ts` (полнота политики).** Для каждого field/container-имени каталога —
  ровно одна политика (`live` / `OVERLAY_LIMITED` / `SUBPATH_LIMITED`); оба allowlist'а — подмножества
  текущих имён каталога (нет протухших записей); каждое `OVERLAY_LIMITED`-имя имеет `role: container`;
  каждое `SUBPATH_LIMITED` несёт reason. Новый компонент ui-kit заставит осознанно классифицировать
  или упадёт в CI.

## Phase 2 (опционально, вне scope этого фикса)

Поднять fidelity для subpath-only, которые осмысленно рендерятся (4 поля + `Table, Carousel,
Sidebar`): добавить точечные optional peer-deps в
[projects/reformer-builder/package.json](../../projects/reformer-builder/package.json) и `import()`
subpath-модули. Оверлеи (`Command, Drawer`) и несовпадения имён (`Chart, Resizable`) остаются стабом.
Спека §13 («точность — на dev-сервере») делает Phase 1 достаточной для MVP.

## Файлы

- **Изменить:** `src/preview-runtime/{known-components.ts, known-names.ts, unknown-component.tsx,
  build-preview.ts, index.ts}`
- **Создать:** `src/preview-runtime/{render-policy.ts, render-policy.test.ts, registry-drift.test.ts}`
- **Без изменений** в `@reformer/ui-kit` для основного фикса.

## Verification

1. **Тесты билдера:** `cd projects/reformer-builder && npm test` — новые `registry-drift.test.ts` и
   `render-policy.test.ts` зелёные; `unknown.test.ts` по-прежнему возвращает `['RendererFormWizard']`.
2. **Typecheck/lint билдера** (проверить обычную команду проекта, напр. `tsc --noEmit` / eslint).
3. **Визуально в runtime-preview:** запустить билдер (dev), переключить canvas в режим Runtime,
   дропнуть из палитры типографику, `Card`, `Alert`, `Badge`, `Avatar`, `Separator`, `Progress`,
   `Tabs` → рендерятся реально (не плейсхолдер). Дропнуть `Dialog`, `Table`, `Calendar` → нейтральный
   «предпросмотр ограничен» (без amber-warning). Скриншоты (fullPage) → в
   `projects/react-playground-e2e/screenshots/preview-registry/`.
4. **Регрессия:** убедиться, что ручной JSON с реально неизвестным `$component(Foo)` всё ещё даёт
   amber-warning «не зарегистрирован».
