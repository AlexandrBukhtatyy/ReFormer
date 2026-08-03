# Палитра reformer-builder: сворачиваемые разделы, иконки из макета, HTML без `$html()`

## Context

Палитра компонентов в reformer-builder ([PalettePanel.tsx](../../projects/reformer-builder/src/panels/PalettePanel.tsx))
сейчас отходит от дизайн-макета (`.tmp/Reformer-Builder-Cloude-Design/Reformer Builder.dc.html`) в трёх местах:

1. **Разделы не сворачиваются.** Каждая категория — простой заголовок + всегда видимый список. В макете (и спеке
   `reformer-builder-spec.md:40-45`) заголовки кликабельные (шеврон ▶ + счётчик), раздел **HTML идёт первым и свёрнут
   по умолчанию**, при поиске все разделы временно раскрываются.
2. **Иконки — по роли, а не по типу.** `glyph()` возвращает один из трёх глифов (`Aa` / `[]` / `▭`) на всю роль. В
   макете у каждого элемента своя текстовая аббревиатура-бейдж (`In`, `Se`, `Ck`…; для HTML — `div`, `sec`, `fs`, `h3`,
   `p`, `hr`).
3. **HTML-элементы подписаны как `$html(div)`.** Пользователь хочет видеть просто имя тега (`div`, `section`…) — и в
   палитре, и на канвасе/в инспекторе.

Цель — привести палитру к макету по (1) и (2) и убрать префикс `$html()` из **отображения** по (3), **не трогая модель
схемы**.

## Ключевой инвариант — модель не меняется

Строка `$html(div)` — это не «label», а значение поля `name` записи каталога, которое одновременно является
сериализуемым оператором модели (`component: "$html(div)"`, тип `HtmlOp` в
[operators.ts](../../packages/reformer-renderer-json/src/operators.ts)). На `name` завязаны: реконструкция узла
([make-node.ts:53](../../projects/reformer-builder/src/catalog/make-node.ts#L53) — `name.startsWith('$html(')`), lookup
записи ([Inspector.tsx:31](../../projects/reformer-builder/src/panels/Inspector.tsx#L31)), drag (`entryName: e.name`),
`key`, фильтр поиска.

**Поэтому `name` в [synthetic-entries.ts](../../projects/reformer-builder/src/catalog/synthetic-entries.ts) НЕ трогаем.**
Все правки — только на уровне рендера подписи/бейджа. Тесты, ожидающие `$html(div)` в `name`
(`catalog.test.ts:14,43`, `contract.test.ts:14`) и в `component` (`mutate.test.ts:123,131`), остаются зелёными.

## Изменения

### 1. [PalettePanel.tsx](../../projects/reformer-builder/src/panels/PalettePanel.tsx) — порядок, сворачивание, иконки, подпись

**а) HTML первым** — переставить в `CATEGORY_ORDER` (строка 17):
```ts
const CATEGORY_ORDER = ['HTML', 'Поля ввода', 'Выбор и переключатели', 'Контейнеры', 'Массив', 'Прочее'];
```

**б) Иконки-глифы по типу** (как в макете) — заменить `glyph()` (строки 19-21) на маппинг по имени/тегу с fallback.
Явные значения взяты из макета (`Reformer Builder.dc.html:1177-1185`); для имён из `CATEGORY_BY_NAME` без глифа в
макете — производные 2-буквенные; незнакомым будущим элементам — fallback «первые 2 буквы, первая заглавная»:
```ts
const HTML_GLYPH: Record<string, string> = { div: 'div', section: 'sec', fieldset: 'fs', h3: 'h3', p: 'p', hr: 'hr' };
const GLYPH_BY_NAME: Record<string, string> = {
  Input: 'In', InputPassword: 'Ip', InputMask: 'Im', InputOTP: 'Io',
  Textarea: 'Tx', DatePicker: 'Dt', Calendar: 'Ca', FileUpload: 'Up', FileUploadAvatar: 'Av',
  Select: 'Se', NativeSelect: 'Ns', Combobox: 'Cb', RadioGroup: 'Rg', Checkbox: 'Ck',
  Switch: 'Sw', Slider: 'Sl', Toggle: 'Tg', ToggleGroup: 'Tg',
  Box: 'Bx', Section: 'Sc', FormArray: 'Fa',
};
function htmlTag(name: string): string | null {
  return name.startsWith('$html(') ? name.slice('$html('.length, -1) : null;
}
function glyph(entry: CatalogEntry): string {
  const tag = htmlTag(entry.name);
  if (tag) return HTML_GLYPH[tag] ?? tag.slice(0, 3);
  return GLYPH_BY_NAME[entry.name] ?? (entry.name[0]?.toUpperCase() ?? '') + (entry.name[1]?.toLowerCase() ?? '');
}
```

**в) Подпись без `$html()`** — новый хелпер, использовать вместо `{e.name}` на строке 94:
```ts
function displayName(entry: CatalogEntry): string {
  return htmlTag(entry.name) ?? entry.name;   // '$html(div)' → 'div', остальное как есть
}
```
Фильтр поиска (строка 25) оставляем по сырому `e.name` — `'$html(div)'.includes('div' | 'html')` всё равно находит.

**г) Сворачиваемые разделы** — локальное состояние + кликабельный заголовок с шевроном и счётчиком:
```ts
const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ HTML: true }); // HTML свёрнут по умолчанию
const toggle = (cat: string) => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }));
const isOpen = (cat: string) => (q.trim() ? true : !collapsed[cat]);  // поиск раскрывает всё
```
Заголовок-`<div>` (строки 75-77) заменить на `<button>` (шеврон `▶` с `rotate-90` при раскрытии, название,
`items.length` справа), а список элементов (строки 78-98) обернуть в `{isOpen(cat) && (…)}`. Состояние локальное:
при перемонтировании палитры (переключение Files ⇄ Palette) HTML снова свёрнут — это удовлетворяет «HTML всегда свёрнут».

### 2. [node-display.ts](../../projects/reformer-builder/src/canvas/node-display.ts) — бейдж узла на канвасе/в инспекторе

`nodeTypeBadge`, строка 20: убрать обёртку `$html(...)`, вернуть просто тег (единообразно с веткой `component`, которая
уже возвращает `parsed.arg`):
```ts
if (parsed?.op === 'html') return parsed.arg;   // было: `$html(${parsed.arg})`
```
`nodeLabel` уже возвращает тег (строка 32, `comp?.arg`) — правок не требует. Этот бейдж используется в
`SchematicCanvas.tsx` и `Inspector.tsx`, поэтому одна правка покрывает и канвас, и инспектор.

## Что НЕ трогаем

- `synthetic-entries.ts` (`name`/`category`), `make-node.ts`, `contract.ts` — модель и идентификаторы каталога.
- Значение `component: "$html(tag)"` в схеме и оператор `HtmlOp` в renderer-json.
- Существующие тесты каталога/модели — они про `name`/`component`, не про отображение.

## Verification

Из `projects/reformer-builder/`:

1. **Тесты** — `npm run test` (vitest): catalog/contract/mutate остаются зелёными (модель не тронута).
2. **Типы + сборка** — `npm run build` (`tsc -b && vite build`); линт — `npm run lint`.
3. **Визуально** — `npm run dev`, открыть палитру:
   - раздел **HTML** первый и **свёрнут**; клик по заголовку раскрывает/сворачивает; шеврон поворачивается; справа счётчик;
   - у элементов **аббревиатуры-бейджи** (Input → `In`, Select → `Se`, Checkbox → `Ck`; HTML → `div`, `sec`, `fs`, `h3`, `p`, `hr`);
   - HTML-элементы подписаны **без** `$html()` — просто `div`, `section`, `fieldset`, `h3`, `p`, `hr`;
   - ввод в поиск временно раскрывает все разделы;
   - перетащить `div` на канвас → бейдж узла показывает `div` (не `$html(div)`), инспектор — тоже; форма по-прежнему рендерится (модель = `$html(div)`).
