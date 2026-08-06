# Compound-части в каталоге билдера (фикс «текст в Alert рассыпается по словам»)

## Context

Пользователь в билдере кинул `Alert`, вписал в инспекторе свойство «Текст» — и каждое слово встало на
отдельную строку.

Причина найдена и подтверждена репро (`projects/react-playground-e2e/screenshots/alert-grid-text-bug/repro-anonymous-grid-item.png`):
корень `Alert` — grid-контейнер с `grid-cols-[0_1fr]`
([alert-base.tsx:10](packages/reformer-ui-kit/src/components/alert/variants/base/alert-base.tsx#L10), дословный
порт shadcn). Голый `node.text` рендерится прямым текстовым узлом внутри этого grid → становится
**анонимным grid item** и попадает в **первую колонку шириной `0`**, поэтому строка ломается на каждом
пробеле. Инспектор ([Inspector.tsx:125-158](projects/reformer-builder/src/panels/Inspector.tsx#L125-L158))
и рендерер ([render-node.tsx:847](packages/reformer-renderer-react/src/core/render-node.tsx#L847)) работают
корректно — текст пишется и выводится одной строкой.

Системная причина: в `component-catalog.json` нет compound-частей. Генератор
([generate-catalog.ts](packages/reformer-ui-kit/scripts/generate-catalog.ts)) делает одну запись на каталог
`src/components/<dir>`, поэтому `AlertTitle`/`AlertDescription` (и `CardHeader`, `TabsList`, `TableRow`, …)
в билдере недоступны — собрать Alert правильно нечем, остаётся писать текст в корень.

Итог работы: части compound-компонентов появляются в каталоге и в билдере, ключевые compound'ы при дропе
сразу дают рабочую композицию, а поле «Текст» не предлагается там, где содержимое должно жить в частях.

## Объём (согласовано)

- **Части**: только контентные — **91 часть у 21 родителя** (Accordion, Alert, Attachment, Avatar,
  Breadcrumb, Bubble, ButtonGroup, Card, Carousel, Collapsible, Empty, InputGroup, Item, Kbd, Marker,
  Message, MessageScroller, Pagination, Resizable, Table, Tabs). Части оверлеев/меню (Dialog\*, Sheet\*,
  Drawer\*, DropdownMenu\*, ContextMenu\*, Menubar\*, NavigationMenu\*, Command\*, Sidebar\*, Popover\*,
  HoverCard\*, Tooltip\*, Chart\*) — **не включаем**: их корень в превью и так стаб.
- **Палитра**: части **контекстно** — общего списка не засоряют.
- **Композиции**: дефолтные шаблоны для ключевых compound'ов при дропе родителя.

## План

### A. ui-kit: генератор выпускает части (`packages/reformer-ui-kit/scripts/generate-catalog.ts`)

Третий уровень записей рядом с существующими rich/minimal: **part**.

- Источник — именованные value-экспорты `src/components/<dir>/index.ts` (статический regex-парсинг, как в
  [generate-exports.mjs](packages/reformer-ui-kit/scripts/generate-exports.mjs); `export type {}` игнорируется).
- Часть = экспорт, начинающийся с `PascalCase(dir)` и не равный ему.
- Отсев: суффиксы `Variants` (cva), `Field`/`BaseField` (обёртки полей — уже покрыты rich), `Provider`,
  `Portal`, `Overlay`, `Style`; имена, уже занятые rich/minimal-записями.
- Отсев родителей: существующий `NON_PALETTE_DIRS` + новый `NO_PARTS_DIRS` (оверлеи/меню/чарты, список
  выше) + родители с ролью `field` (их «части» — `SelectItem`, `RadioGroupItem`, `NativeSelectOption`… —
  в ReFormer задаются через `options`/dataSource, а не детьми).
- Запись: `{ name, role: 'container', propsSchema, compoundParent: PascalCase(dir) }`.
- `propsSchema` по умолчанию — `{ className }` (группа `Control`, чтобы инспектор дал редактор классов).
  Для частей, где проп критичен для работы, — карта `PART_PROPS` рядом с генератором (ui-kit владеет
  знанием о своих компонентах): `TabsTrigger`/`TabsContent`/`AccordionItem` → `value`; `AvatarImage` →
  `src`/`alt`; `BreadcrumbLink`/`PaginationLink` → `href`; `PaginationLink` → `isActive`;
  `InputGroupAddon` → `align`.
- Перегенерация: `npm run generate:catalog` в `packages/reformer-ui-kit` (77 → ~168 записей).

### B. Контракт каталога (владелец — билдер)

- [component-catalog.schema.json](projects/reformer-builder/src/catalog/component-catalog.schema.json):
  свойство `compoundParent` (string) — `additionalProperties: false`, без него каталог не пройдёт валидацию.
- [catalog/types.ts](projects/reformer-builder/src/catalog/types.ts): `compoundParent?: string` в
  `CatalogRecord` и `CatalogEntry`.
- [catalog/contract.ts](projects/reformer-builder/src/catalog/contract.ts): проброс поля в
  `buildCatalogFromJson`; категория части наследуется от родителя (`categoryOf(compoundParent, role)`).
- Новый модуль `catalog/compound.ts`: `partsOf(parentName)`, `isCompoundPart(name)`,
  `compoundParentOf(name)` — единая точка для палитры, make-node и превью.

### C. Дефолтные композиции (`catalog/make-node.ts`)

- `COMPOUND_TEMPLATES: Record<string, () => JsonNode>` для ключевых родителей: Alert, Card, Accordion,
  Tabs, Table, Breadcrumb, Empty, Item, InputGroup, Pagination, Avatar, Message, Bubble, Collapsible,
  Carousel. `makeNodeFor` проверяет шаблон **до** `containerNode`.
  Пример (Alert): `Alert > AlertTitle{text:'Заголовок'} + AlertDescription{text:'Описание'}` —
  без `className: 'space-y-4'`, у Alert свой `gap-y`.
  Шаблоны с обязательными пропсами задают их сразу: `Tabs{defaultValue:'tab-1'} > TabsList >
  TabsTrigger{value}…`, `Accordion{type:'single',collapsible:true} > AccordionItem{value} > …`.
- `partNode(name)` — узел для отдельной части: контейнер без `className`; «титульным» частям
  (суффиксы `Title`/`Description`/`Text`/`Trigger`/`Link`/`Page`/`Caption`/`Head`/`Cell`) сразу кладётся
  `text`, иначе `children: []`.

### D. Палитра и QuickAdd

- [PalettePanel.tsx](projects/reformer-builder/src/panels/PalettePanel.tsx): части исключаются из
  `groupByCategory` при пустом поиске; при непустом — участвуют (чтобы находились).
  Сверху появляется раздел **«Части: {Parent}»** (раскрыт), когда выделение находится внутри compound'а:
  ближайший предок (включая сам узел) ищется через `useSelectionPath()` + `useActiveTab()`
  ([store/hooks.ts](projects/reformer-builder/src/store/hooks.ts)) и `parentNodePath`, имя компонента
  сверяется с `partsOf`.
- [QuickAddDialog.tsx](projects/reformer-builder/src/canvas/QuickAddDialog.tsx): части доступны всегда
  (поиск по имени) — изменений не требует, кроме проверки, что фильтр частей не применён.

### E. Инспектор: голый текст у compound-родителей

- [Inspector.tsx:315](projects/reformer-builder/src/panels/Inspector.tsx#L315): `showsText` дополняется —
  если для компонента есть `COMPOUND_TEMPLATES` (его содержимое живёт в частях), поле «Текст» скрывается,
  вместо него подсказка: «Содержимое — в частях: AlertTitle / AlertDescription».
  Если `node.text` уже задан (старые схемы), поле показывается с предупреждением, чтобы значение можно было
  убрать. Один источник истины — `COMPOUND_TEMPLATES`, второго ручного списка не заводим.

### F. Превью

- [render-policy.ts](projects/reformer-builder/src/preview-runtime/render-policy.ts): часть наследует
  политику родителя — если `compoundParent` в `OVERLAY_LIMITED`/`SUBPATH_LIMITED`, часть тоже `limited`
  с той же причиной (актуально для Table\*, Carousel\*, Resizable\*, MessageScroller\*). Остальные части
  резолвятся из barrel `@reformer/ui-kit` штатным правилом имён (`AlertTitle`, `CardHeader` — экспортируются).

### G. Тесты

- `catalog.test.ts` / `contract.test.ts`: части присутствуют (`AlertTitle` с `compoundParent: 'Alert'`),
  служебные экспорты (`alertVariants`, `*Field`, `*Portal`) — нет; каталог валиден против контракта.
- `make-node.test.ts`: каждый шаблон `COMPOUND_TEMPLATES` состоит из имён, существующих в каталоге,
  и даёт валидный `JsonNode`.
- `render-policy.test.ts`: наследование политики частями; существующие инварианты allowlist'ов не сломаны.
- `registry-drift.test.ts` — уже покрывает: дроп всего каталога не должен давать незарегистрированных
  `$component` (проверит, что все 91 часть резолвятся).
- `Inspector.test.ts`: «Текст» скрыт у compound-родителя и показан у Button/`$html(p)`.

### H. Учёт работы

Завести bd-задачу на фикс (`bd create`) и закрыть по завершении — по правилам проекта трекинг только в bd.

## Проверка

1. `npm run generate:catalog` в `packages/reformer-ui-kit` → в `component-catalog.json` появились части;
   `git diff --stat` показывает только этот файл.
2. `npm test` в `packages/reformer-ui-kit` и `projects/reformer-builder` — зелено.
3. Живой билдер (`npm run dev` в `projects/reformer-builder`), сценарий бага end-to-end через playwright MCP:
   дроп `Alert` из палитры → на канве заголовок и описание в нормальной раскладке (не по одному слову);
   выделение `AlertTitle` → инспектор правит его текст; выделение `Alert` → поля «Текст» нет, есть подсказка;
   при выделении внутри Alert палитра показывает раздел «Части: Alert».
   Скриншоты — в `projects/react-playground-e2e/screenshots/alert-grid-text-bug/` (`after-fix-*.png`).
4. Регресс существующих форм: открыть пример из `projects/react-playground/src/pages/examples/`, убедиться,
   что палитра/инспектор прежних компонентов не изменились.

## Не входит в объём

- Части оверлеев и меню (Dialog\*, DropdownMenu\*, Sidebar\*, …) — отдельная задача, если понадобятся.
- `props.ts` для всех 91 части в ui-kit (rich-схемы) — сейчас `className` + точечные критичные пропсы.
- Правила запрета дропа части вне её родителя — часть можно положить куда угодно (как и раньше любой
  контейнер); при необходимости добавим валидацию отдельно.
- Коммит/пуш — по отдельной просьбе.
