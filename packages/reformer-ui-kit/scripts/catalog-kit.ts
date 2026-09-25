/**
 * Блок `kit` каталога — что ui-kit рассказывает о себе билдеру.
 *
 * Раньше это знание жило в билдере таблицами «неявного кита»: каталог без блока `kit` достраивался
 * до `@reformer/ui-kit` — его категориями палитры, оверлеями, листьями и прослойками визарда.
 * Чужой кит, не назвавший себя, притворялся встроенным, а ui-kit, поменяв компонент, должен был
 * править билдер. Теперь кит объявляет всё о себе сам, а билдер достраивает только общее.
 *
 * Имена здесь — имена ЗАПИСЕЙ каталога. Генератор сверяет их с записями и падает на
 * расхождении: переименованный компонент, оставшийся в этой таблице, иначе молча терял бы
 * категорию или запрет превью.
 *
 * @module reformer-ui-kit/scripts/catalog-kit
 */

/** Личность кита: ключ выбора в билдере и то, что видит переключатель. */
export const KIT_IDENTITY = {
  id: 'reformer-ui-kit',
  label: 'ReFormer UI Kit',
  package: '@reformer/ui-kit',
} as const;

/** Компоненты вне палитры, без которых рендерер не соберёт форму. */
export const KIT_INFRA = {
  fieldWrapper: 'FormField',
  asyncBoundary: 'AsyncBoundary',
  list: 'List',
  fieldFrame: 'FieldFrame',
} as const;

/**
 * Адаптеры поверх компонентов кита. У визарда `subpath` нет, и это не упущение: `FormWizard`
 * лежит в главном входе, а подпуть объявляют тому, чего там нет. Отдельного шага у кита нет.
 */
export const KIT_ADAPTERS = { wizard: { symbol: 'FormWizard' }, step: null } as const;

/** Кодоген: спецификатор импорта и символы, которым нужна прослойка вместо прямого импорта. */
export const KIT_CODEGEN = {
  importSpecifier: '@reformer/ui-kit',
  needsShim: ['Wizard', 'RendererFormWizard', 'Step', 'FormWizard'],
} as const;

/**
 * Имя компонента → раздел палитры. Не назначенные попадают в раздел по умолчанию билдера;
 * набор `Typography*` раскладывается билдером по префиксу.
 */
export const CATEGORY_BY_NAME: Record<string, string> = {
  // Поля ввода
  Input: 'Поля ввода',
  InputNumber: 'Поля ввода',
  InputSuggest: 'Поля ввода',
  InputPassword: 'Поля ввода',
  InputMask: 'Поля ввода',
  InputOTP: 'Поля ввода',
  Textarea: 'Поля ввода',
  DatePicker: 'Поля ввода',
  Calendar: 'Поля ввода',
  FileUpload: 'Поля ввода',
  FileUploadAvatar: 'Поля ввода',
  FileUploadDropzone: 'Поля ввода',
  FileUploadInput: 'Поля ввода',
  // Выбор и переключатели
  Select: 'Выбор и переключатели',
  SelectMulti: 'Выбор и переключатели',
  NativeSelect: 'Выбор и переключатели',
  NativeSelectMulti: 'Выбор и переключатели',
  Combobox: 'Выбор и переключатели',
  ComboboxMulti: 'Выбор и переключатели',
  ComboboxTree: 'Выбор и переключатели',
  ComboboxTreeMulti: 'Выбор и переключатели',
  RadioGroup: 'Выбор и переключатели',
  Checkbox: 'Выбор и переключатели',
  Switch: 'Выбор и переключатели',
  Slider: 'Выбор и переключатели',
  Toggle: 'Выбор и переключатели',
  ToggleGroup: 'Выбор и переключатели',
  ToggleGroupMulti: 'Выбор и переключатели',
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
  Avatar: 'Отображение',
  Progress: 'Отображение',
  Skeleton: 'Отображение',
  Spinner: 'Отображение',
  Table: 'Отображение',
  Tree: 'Отображение',
  Chart: 'Отображение',
  Empty: 'Отображение',
  Kbd: 'Отображение',
  Marker: 'Отображение',
  Alert: 'Отображение',
  Separator: 'Отображение',
  Carousel: 'Отображение',
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
 * Настоящие оверлеи: корень без триггера, портала и `open` рисуется в пустоту, и живой рендер
 * дал бы на канвасе НЕВИДИМЫЙ узел — подписанная заглушка честнее. Запрет, а не причина:
 * действует, даже если компонент есть в пространстве имён.
 */
export const OVERLAYS: readonly string[] = [
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
];

/** Причина запрета, которую покажет заглушка оверлея. */
export const OVERLAY_REASON = 'оверлей — нужен триггер/портал';

/**
 * Листья: самодостаточный визуал, детей не держат. `Tree` при роли `container` — не
 * противоречие: строки дерева приходят пропом `nodes`, а без отметки палитра дала бы ему
 * зону сброса, куда всё падало бы в никуда.
 */
export const LEAVES: readonly string[] = [
  'Icon',
  'Separator',
  'Spinner',
  'Skeleton',
  'Progress',
  'Tree',
];

/**
 * Компоненты за подпутём: их тяжёлые необязательные зависимости (`embla-carousel-react`,
 * `recharts`, `cmdk`, `vaul`, `react-resizable-panels`) не должны попадать в главный вход.
 * В главном входе их нет, и билдер объясняет их отсутствие подпутём.
 */
export const SUBPATHS: Readonly<Record<string, string>> = {
  Carousel: 'carousel',
  Chart: 'chart',
  Command: 'command',
  Drawer: 'drawer',
  MessageScroller: 'message-scroller',
  Resizable: 'resizable',
  Sidebar: 'sidebar',
};
