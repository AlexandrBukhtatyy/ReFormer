/**
 * Дефолты билдера для «неявного кита» — знание про `@reformer/ui-kit`, которое исторически было
 * рассыпано по коду билдера захардкоженными таблицами.
 *
 * Сюда они переехали ДАННЫМИ, чтобы:
 * 1. каталог без блока `kit` (сегодняшний `component-catalog.json` и любой клиентский `--catalog`)
 *    достраивался до полноценного дескриптора и вёл себя ровно как раньше;
 * 2. чужой кит мог переопределить любую из них своим блоком `kit`, не трогая код билдера.
 *
 * Исходные модули (`catalog/contract`, `preview-runtime/render-policy`, `model/node-kind`,
 * `preview-runtime/known-names`, `codegen/ui-kit-imports`) реэкспортируют эти константы, поэтому их
 * публичная поверхность не изменилась — потребители правятся на этапе 2.
 *
 * Модуль — ЛИСТ графа зависимостей: только `import type`, ничего из `catalog`/`preview-runtime`/
 * `model`. Иначе получается цикл `catalog → kits → render-policy → catalog`.
 *
 * @module reformer-builder/kits/legacy-reformer-ui-kit
 */

import type { KitDescriptorJson, KitRecordPreview } from './types';

/**
 * Имя компонента → категория палитры (спека §5 `category?`). Категория — забота палитры билдера,
 * ui-kit её не поставляет; назначается на загрузке. Незамапленные падают в default (`categoryOf`).
 */
export const CATEGORY_BY_NAME: Record<string, string> = {
  // Поля ввода
  Input: 'Поля ввода',
  InputPassword: 'Поля ввода',
  InputMask: 'Поля ввода',
  InputOTP: 'Поля ввода',
  Textarea: 'Поля ввода',
  DatePicker: 'Поля ввода',
  Calendar: 'Поля ввода',
  FileUpload: 'Поля ввода',
  FileUploadAvatar: 'Поля ввода',
  // Выбор и переключатели
  Select: 'Выбор и переключатели',
  NativeSelect: 'Выбор и переключатели',
  Combobox: 'Выбор и переключатели',
  RadioGroup: 'Выбор и переключатели',
  Checkbox: 'Выбор и переключатели',
  Switch: 'Выбор и переключатели',
  Slider: 'Выбор и переключатели',
  Toggle: 'Выбор и переключатели',
  ToggleGroup: 'Выбор и переключатели',
  // Контейнеры
  Box: 'Контейнеры',
  Section: 'Контейнеры',
  Card: 'Контейнеры',
  Accordion: 'Контейнеры',
  Tabs: 'Контейнеры',
  Collapsible: 'Контейнеры',
  InputGroup: 'Контейнеры',
  ButtonGroup: 'Контейнеры',
  AspectRatio: 'Контейнеры',
  ScrollArea: 'Контейнеры',
  Resizable: 'Контейнеры',
  Sidebar: 'Контейнеры',
  // Действия
  Button: 'Действия',
  // Отображение
  Icon: 'Отображение',
  Label: 'Отображение',
  Badge: 'Отображение',
  Typography: 'Отображение',
  Avatar: 'Отображение',
  Progress: 'Отображение',
  Skeleton: 'Отображение',
  Spinner: 'Отображение',
  Table: 'Отображение',
  Chart: 'Отображение',
  Empty: 'Отображение',
  Kbd: 'Отображение',
  Marker: 'Отображение',
  Alert: 'Отображение',
  Separator: 'Отображение',
  Carousel: 'Отображение',
  // Typography — набор отдельных компонентов (TypographyH1…Muted) → раздел «Типографика» (правило-префикс в categoryOf).
  // Оверлеи
  Dialog: 'Оверлеи',
  AlertDialog: 'Оверлеи',
  Sheet: 'Оверлеи',
  Drawer: 'Оверлеи',
  Popover: 'Оверлеи',
  HoverCard: 'Оверлеи',
  Tooltip: 'Оверлеи',
  Command: 'Оверлеи',
  // Навигация
  DropdownMenu: 'Навигация',
  ContextMenu: 'Навигация',
  Menubar: 'Навигация',
  NavigationMenu: 'Навигация',
  Breadcrumb: 'Навигация',
  Pagination: 'Навигация',
  // Чат
  Bubble: 'Чат',
  Message: 'Чат',
  MessageScroller: 'Чат',
  Attachment: 'Чат',
  Item: 'Чат',
};

/**
 * Настоящие оверлеи: корень Radix без триггера/портала/`open` рендерится в пустоту — живой рендер
 * даёт НЕВИДИМЫЙ узел на canvas, что хуже подписанного стаба. Показываем стаб.
 */
export const OVERLAY_LIMITED: ReadonlySet<string> = new Set([
  'Dialog',
  'AlertDialog',
  'Sheet',
  'Popover',
  'HoverCard',
  'Tooltip',
  'DropdownMenu',
  'ContextMenu',
  'Menubar',
  'NavigationMenu',
]);

/**
 * Subpath-only: компонент есть в каталоге, но НЕ в barrel `@reformer/ui-kit` (тяжёлые optional
 * peer-deps живут за subpath-экспортом) — из barrel-namespace не резолвится. Значение — причина
 * для стаба. `Chart`/`Resizable` дополнительно не имеют экспорта, равного имени каталога
 * (`ChartContainer` / `ResizablePanelGroup`), поэтому не резолвятся даже через subpath.
 */
export const SUBPATH_LIMITED: ReadonlyMap<string, string> = new Map([
  ['Carousel', 'subpath-only: embla-carousel-react'],
  ['Chart', 'subpath-only: recharts (экспорт ChartContainer, не Chart)'],
  ['Command', 'subpath-only: cmdk'],
  ['Drawer', 'subpath-only: vaul'],
  ['MessageScroller', 'subpath-only: @shadcn/react'],
  ['Resizable', 'subpath-only: react-resizable-panels (экспорт ResizablePanelGroup, не Resizable)'],
  ['Sidebar', 'subpath-only'],
]);

/**
 * Компоненты-листья (`$component`): рендерят самодостаточный визуал (иконка, разделитель, спиннер…) —
 * вложенные компоненты не держат. Расширяемый список.
 */
export const LEAF_COMPONENT_NAMES: ReadonlySet<string> = new Set([
  'Icon',
  'Separator',
  'Spinner',
  'Skeleton',
  'Progress',
]);

/**
 * INFRA-имена ВНЕ палитрового каталога, но зарегистрированные в реестре (см. known-components):
 * враппер поля (`FormField` = `FIELD_WRAPPER`), граница async и `List` — обёртка display-списка,
 * которой схемы адресуют array-узлы (`{ array, component: '$component(List)', item.$template }`).
 * `List` есть в `@reformer/ui-kit`, но каталог его не публикует, поэтому без этой записи реальные
 * схемы получали в превью amber-плашку «не зарегистрирован». Единый источник — `known-components`
 * строит для них компоненты по этому списку.
 *
 * `Wizard`/`Step` сюда НЕ входят — они палитровые (синтетические записи каталога, см.
 * `synthetic-entries`), поэтому попадают в реестр обычным путём каталога.
 */
export const INFRA_NAMES = ['FormField', 'AsyncBoundary', 'List'] as const;

/** Wizard-семейство: требует FormWizard-shim — в Фазе 1 отдаём placeholder с TODO. */
export const NEEDS_SHIM: ReadonlySet<string> = new Set([
  'Wizard',
  'RendererFormWizard',
  'Step',
  'FormWizard',
]);

/**
 * ЖЁСТКИЕ запреты живого рендера по умолчанию — только оверлеи ({@link OVERLAY_LIMITED}).
 *
 * `SUBPATH_LIMITED` сюда НЕ входит намеренно: это разные вещи. Оверлей нельзя рисовать вживую даже
 * если он есть в namespace (Radix-корень без триггера даёт невидимый узел), а subpath-only
 * компонент не запрещён — его просто нет в barrel, и если кит его поставит, он отрисуется.
 * Слияние этих двух множеств тихо изменило бы поведение для такого кита.
 *
 * Кит может выставить то же самое per-record полем `preview` — тогда его значение победит.
 */
export function legacyPreviewPolicy(): Map<string, KitRecordPreview> {
  const map = new Map<string, KitRecordPreview>();
  for (const name of OVERLAY_LIMITED)
    map.set(name, { mode: 'limited', reason: 'оверлей — нужен триггер/портал' });
  return map;
}

/** Причины «почему компонента нет в namespace» по умолчанию — из {@link SUBPATH_LIMITED}. */
export function legacyUnresolvedReasons(): Map<string, string> {
  return new Map(SUBPATH_LIMITED);
}

/**
 * Дефолтный дескриптор `@reformer/ui-kit` — база, поверх которой накладывается блок `kit` из
 * каталога. `version` намеренно НЕ берётся из `package.json`: в этом репозитории версии там
 * недостоверны (`@semantic-release/git` не подключён, версия живёт в git-теге), поэтому источник
 * правды для версии кита появится на этапе 3 вместе с реестром китов.
 */
export const LEGACY_KIT: Required<
  Pick<
    KitDescriptorJson,
    'id' | 'label' | 'package' | 'resolve' | 'infra' | 'adapters' | 'palette' | 'styles' | 'codegen'
  >
> = {
  id: 'reformer-ui-kit',
  label: 'ReFormer UI Kit',
  package: '@reformer/ui-kit',
  resolve: { fieldSuffix: 'Field' },
  infra: { fieldWrapper: 'FormField', asyncBoundary: 'AsyncBoundary', list: 'List' },
  adapters: { wizard: { symbol: 'FormWizard', subpath: 'form-wizard' }, step: null },
  palette: { categoryByName: CATEGORY_BY_NAME },
  styles: { mode: 'tokens' },
  codegen: { importSpecifier: '@reformer/ui-kit', needsShim: [...NEEDS_SHIM] },
};
