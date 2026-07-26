# План: resize панелей reformer-builder через draggable-разделители

## Context

В оболочке редактора `reformer-builder` все панели имеют **фиксированные размеры** и их
нельзя менять мышью:

- левый сайдбар (Файлы/Палитра) — `w-[250px]` ([EditorLayout.tsx:83](../../projects/reformer-builder/src/app/EditorLayout.tsx#L83));
- правый инспектор (Свойства) — `w-[300px]` ([EditorLayout.tsx:103](../../projects/reformer-builder/src/app/EditorLayout.tsx#L103));
- нижняя raw-JSON панель (Monaco) — `h-[216px]` ([RawJson.tsx:64](../../projects/reformer-builder/src/canvas/RawJson.tsx#L64)).

Пользователь просит «вертикальный слайдер» (= перетаскиваемый разделитель) в сайдбарах и
resize «всем окнам». Уточнено: речь про **splitter-разделители** панелей билдера (виджет-компонент
`Slider` в палитре формы уже присутствует — это не он). Scope: **левый сайдбар + правый инспектор
(по горизонтали) + нижняя raw-JSON (по вертикали)**. Размеры **сохраняются в localStorage**.
Модалка Save в scope **не входит**.

Итог: пользователь может тянуть разделители, меняя ширину сайдбаров и высоту raw-JSON; выставленные
размеры переживают перезагрузку.

## Подход

Использовать **готовый примитив** `@reformer/ui-kit/resizable` (`ResizablePanelGroup` /
`ResizablePanel` / `ResizableHandle` — дословный порт shadcn на `react-resizable-panels@4.12.2`,
dist собран, экспорты проверены). Persistence — встроенный `autoSaveId` группы (пишет layout в
`localStorage` автоматически). **Store/типы не трогаем** — размеры не идут в `UiState`.

Ключевые свойства `react-resizable-panels` 4.x, на которые опираемся:
- размеры панелей в **процентах** (`defaultSize`/`minSize`/`maxSize`);
- `autoSaveId` хранит layout по **составу панелей** (стабильные `id`+`order`), поэтому условный
  рендер сворачиваемых панелей корректно восстанавливается при повторном открытии;
- прямыми детьми `PanelGroup` могут быть **только** `Panel`/`Handle` — значит вертикальные рейлы
  (38px/34px) остаются flex-siblings **вне** группы.

## Изменения по файлам

### 1. [EditorLayout.tsx](../../projects/reformer-builder/src/app/EditorLayout.tsx) — горизонтальный сплит

Заменить средний flex-ряд (между левым и правым рейлами) на горизонтальный `ResizablePanelGroup`.
Рейлы (`w-[38px]`, `w-[34px]`) и обработчики тумблеров панелей — **без изменений, вне группы**.

Структура:

```
[левый рейл 38px]  ← вне группы
<ResizablePanelGroup direction="horizontal" autoSaveId="rb.layout.h" className="flex-1 min-w-0">
  {ui.leftPanel && <ResizablePanel id="left"  order={1} defaultSize={17} minSize={12} maxSize={35} collapsible>…палитра/файлы…</ResizablePanel>}
  {ui.leftPanel && <ResizableHandle withHandle />}
  <ResizablePanel id="center" order={2} minSize={30}>TabBar + CanvasArea</ResizablePanel>
  {ui.rightOpen && <ResizableHandle withHandle />}
  {ui.rightOpen && <ResizablePanel id="right" order={3} defaultSize={20} minSize={14} maxSize={40} collapsible>…инспектор…</ResizablePanel>}
</ResizablePanelGroup>
[правый рейл 34px]  ← вне группы
```

Детали:
- проценты подобраны под текущие px при ~1440px ширины (250px≈17%, 300px≈20%); центр без
  `defaultSize` — забирает остаток, `minSize` заменяет нынешний `min-w-[320px]`;
- заголовки панелей (`h-[34px]` «Палитра компонентов» / «Свойства») и рамки (`border-r`/`border-l`,
  `bg-sidebar`) переносятся внутрь соответствующих `ResizablePanel` как обёртка `flex flex-col`;
- `ResizableHandle` уже даёт `bg-border` (визуально совпадает с текущими `border-*`) + `withHandle`
  рисует grip-хват; можно чуть расширить hit-area класс-оверрайдом при необходимости.

### 2. [CanvasArea.tsx](../../projects/reformer-builder/src/canvas/CanvasArea.tsx) — вертикальный сплит

Центральная колонка делит высоту между canvas и raw-JSON-редактором, когда `rawJsonOpen`.
Toggle-полоса raw-JSON остаётся всегда видимой.

- `rawJsonOpen === true`: обернуть [canvas-scroll] и [RawJson-редактор] в
  `<ResizablePanelGroup direction="vertical" autoSaveId="rb.layout.v">`:
  - `ResizablePanel id="canvas" order={1} minSize={30}` — текущий scroll-контейнер canvas;
  - `ResizableHandle withHandle`;
  - `ResizablePanel id="raw" order={2} defaultSize={30} minSize={15} maxSize={70}` — блок raw-JSON.
- `rawJsonOpen === false`: без группы — canvas (`flex-1`) + свёрнутая RawJson-полоса (как сейчас).

Флаг `rawJsonOpen` уже доступен через `useUi()`; логику ветвления держим в `CanvasArea`.

### 3. [RawJson.tsx](../../projects/reformer-builder/src/canvas/RawJson.tsx) — редактор растягивается на панель

Сейчас редактор жёстко `h-[216px]` ([RawJson.tsx:64](../../projects/reformer-builder/src/canvas/RawJson.tsx#L64)).
Заменить на `h-full`, чтобы Monaco заполнял высоту вертикальной `ResizablePanel` (её высотой теперь
управляет разделитель). Toggle-заголовок (`flex h-[30px]`) остаётся `flex-none` сверху блока raw-JSON
(внутри нижней панели), так что при open панель = заголовок + `flex-1` редактор. Monaco (`@monaco-editor/react`)
берёт высоту из `h-full` контейнера — фикс-`h-[216px]` снять.

## Риски и как их снять

- **Условный рендер collapsible-панелей + autoSaveId** — основной риск. Стабильные `id`+`order`
  на каждой панели/хэндле, дефолты через `defaultSize`. Проверка — сворачивать/разворачивать
  панели рейлами и перезагружать страницу (см. verification).
- **Monaco в resizable-контейнере** — реагирует на resize родителя автоматически (`@monaco-editor/react`
  использует ResizeObserver); дополнительной логики не требуется, но проверить визуально.
- **localStorage-ключи** — `autoSaveId` `"rb.layout.h"` / `"rb.layout.v"` уникальны, коллизий нет.

## Verification

1. **Typecheck + build** пакета билдера:
   ```bash
   cd projects/reformer-builder && npm run build   # или tsc --noEmit, если есть
   ```
2. **Dev-запуск** и ручная проверка (через /run или `npm run dev`):
   - тянуть левый/правый разделители — сайдбары меняют ширину, центр не «прыгает»;
   - тянуть нижний разделитель при открытой raw-JSON — Monaco корректно перерисовывается;
   - `minSize`/`maxSize` ограничивают размеры; grip-хват виден на разделителях.
3. **Persistence**: выставить размеры → перезагрузить страницу → размеры восстановились
   (проверить `localStorage` ключи `rb.layout.*`).
4. **Collapse**: свернуть палитру/инспектор рейлом и снова открыть — ширина восстанавливается,
   layout не ломается.
5. **Скрин** (fullPage, в `projects/react-playground-e2e/screenshots/reformer-builder-resize/`)
   через playwright MCP — до/после перетаскивания.

Существующие vitest-тесты (`src/**/**.test.ts`) не покрывают визуальный layout; юнит-тест для чисто
презентационного resize малоценен — полагаемся на typecheck/build + ручную/скриншот-проверку.

## Beads

Перед реализацией завести issue (`bd create --type=feature`), пометить in_progress; закрыть по
завершении. Коммит/пуш — **только по явной просьбе** пользователя (правило CLAUDE.md).
